#!/usr/bin/env bash
# Deploy the KinShield Tier-1 backend: CloudFormation stack (Lambda + Function URL + DynamoDB),
# then upload the real Lambda code (handler.py + bundled benchmark scenarios).
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
STACK="kinshield-backend"
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
LAMBDA_SRC="$PROJECT/lambda/evidence-detector"
SCEN_SRC="$PROJECT/benchmark/scenarios"
BUILD="$(mktemp -d)"

echo "=== 1. package lambda into $BUILD ==="
cp "$LAMBDA_SRC/handler.py" "$LAMBDA_SRC/agent.py" "$LAMBDA_SRC/media.py" "$LAMBDA_SRC/kb.md" "$LAMBDA_SRC/lite.py" "$LAMBDA_SRC/lite_model.json" "$BUILD/"
mkdir -p "$BUILD/scenarios"
cp "$SCEN_SRC"/*.json "$BUILD/scenarios/"
# bundle the static frontend so the same Lambda serves it over HTTPS (no CloudFront needed)
# (the whole site: every page, script, style and image in web/src, minus dotfiles)
mkdir -p "$BUILD/web"
cp -R "$PROJECT/web/src/." "$BUILD/web/"
find "$BUILD/web" -name '.*' -exec rm -rf {} +
# force same-origin API base in the bundled config.js
printf '// Served same-origin via API Gateway -> Lambda.\nwindow.KINSHIELD_API = "";\n' > "$BUILD/web/config.js"
( cd "$BUILD" && zip -qr function.zip handler.py agent.py media.py kb.md lite.py lite_model.json scenarios web )
echo "packaged: $(cd "$BUILD" && unzip -l function.zip | tail -1)"

echo "=== 2. deploy CloudFormation stack ($STACK) ==="
MODEL_ID="${MODEL_ID:-openai.gpt-oss-20b}"
# Optional sign-in: wire /history to the kinshield-auth user pool when that stack exists.
POOL_ID=$(aws cloudformation describe-stacks --region "$REGION" --stack-name kinshield-auth \
  --query "Stacks[0].Outputs[?OutputKey=='UserPoolId'].OutputValue" --output text 2>/dev/null || true)
CLIENT_ID=$(aws cloudformation describe-stacks --region "$REGION" --stack-name kinshield-auth \
  --query "Stacks[0].Outputs[?OutputKey=='ClientId'].OutputValue" --output text 2>/dev/null || true)
[ "$POOL_ID" = "None" ] && POOL_ID=""; [ "$CLIENT_ID" = "None" ] && CLIENT_ID=""
aws cloudformation deploy \
  --region "$REGION" \
  --stack-name "$STACK" \
  --template-file "$HERE/backend.yaml" \
  --capabilities CAPABILITY_NAMED_IAM \
  --parameter-overrides "ModelId=$MODEL_ID" "UserPoolId=$POOL_ID" "UserPoolClientId=$CLIENT_ID" \
  --no-fail-on-empty-changeset

echo "=== 3. upload real lambda code ==="
FN=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='FunctionName'].OutputValue" --output text)
aws lambda update-function-code --region "$REGION" \
  --function-name "$FN" --zip-file "fileb://$BUILD/function.zip" \
  --query '{Fn:FunctionName,LastModified:LastModified,CodeSize:CodeSize}' --output json
aws lambda wait function-updated --region "$REGION" --function-name "$FN"

echo "=== 4. outputs ==="
aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs" --output table

URL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo "API_URL=$URL"

echo "=== 5. smoke test the public API ==="
sleep 3
curl -sS -w "\n[http=%{http_code}]\n" "$URL/health"
rm -rf "$BUILD"
