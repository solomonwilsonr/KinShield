#!/usr/bin/env bash
# Deploy the KinShield frontend: CFN (S3 + CloudFront/OAC), inject API endpoint, sync files,
# invalidate cache. Prints the live CloudFront URL.
set -euo pipefail
REGION="${AWS_REGION:-us-east-1}"
STACK="kinshield-frontend"
BACKEND_STACK="kinshield-backend"
HERE="$(cd "$(dirname "$0")" && pwd)"
PROJECT="$(cd "$HERE/.." && pwd)"
WEB="$PROJECT/web/src"

echo "=== 1. deploy frontend stack ==="
aws cloudformation deploy --region "$REGION" --stack-name "$STACK" \
  --template-file "$HERE/frontend.yaml" --capabilities CAPABILITY_NAMED_IAM \
  --no-fail-on-empty-changeset

BUCKET=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)
DIST=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='DistributionId'].OutputValue" --output text)
CFURL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='CloudFrontUrl'].OutputValue" --output text)
APIURL=$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$BACKEND_STACK" \
  --query "Stacks[0].Outputs[?OutputKey=='ApiUrl'].OutputValue" --output text)

echo "bucket=$BUCKET dist=$DIST"
echo "api=$APIURL"

echo "=== 2. inject API endpoint into config.js ==="
BUILD="$(mktemp -d)"
cp -R "$WEB"/. "$BUILD/"
cat > "$BUILD/config.js" <<EOF
// Injected at deploy time.
window.KINSHIELD_API = "$APIURL";
EOF

echo "=== 3. sync to S3 ==="
aws s3 sync "$BUILD/" "s3://$BUCKET/" --delete --region "$REGION" \
  --cache-control "public,max-age=60"
rm -rf "$BUILD"

echo "=== 4. invalidate CloudFront ==="
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" \
  --query 'Invalidation.{Id:Id,Status:Status}' --output json

echo "CLOUDFRONT_URL=$CFURL"
