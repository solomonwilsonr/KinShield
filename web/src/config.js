// Deploy (infra/deploy_frontend_s3.sh) overwrites this file with the backend stack's ApiUrl.
// For local previews (localhost, 127.0.0.1, file://) fall back to the live API so the demo works.
window.KINSHIELD_API = /^(localhost|127\.0\.0\.1|)$/.test(location.hostname)
  ? "https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com"
  : "";
