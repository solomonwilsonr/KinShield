#!/usr/bin/env bash
# Deploy frontend as an S3 static website (account not yet CloudFront-verified).
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
STACK="kinshield-frontend"
BACKEND_STACK="kinshield-backend"
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
WEB="$PROJECT/web/src"

echo "=== 1. deploy S3 website stack ==="
aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
  --template-file "$HERE/frontend-s3.yaml" --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

BUCKET=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
WEBURL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='WebsiteUrl'].OutputValue" --output text)
APIURL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$BACKEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)
echo "bucket=$BUCKET api=$APIURL"

echo "=== 2. inject API endpoint + sync ==="
BUILD="$(mktemp -d)"
cp -R "$WEB"/. "$BUILD/"
cat > "$BUILD/config.js" <<EOF
// Injected at deploy time.
window.KINSHIELD_API = "$APIURL";
EOF
aws s3 sync "$BUILD/" "s3://$BUCKET/" --delete --region "$REGION" \
  --cache-control "public,max-age=60"
rm -rf "$BUILD"

echo "=== 3. smoke test ==="
sleep 2
curl -sS -o /dev/null -w "index.html http=%{http_code}\n" "$WEBURL/"
echo "WEBSITE_URL=$WEBURL"
