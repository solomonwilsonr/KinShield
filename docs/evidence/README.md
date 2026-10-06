# Coding-agent evidence

Every file here was captured before the 2026-10-02 23:59 PT deadline, except `cloudtrail-summary.md`/`.csv`, which were exported on 2026-10-07 from CloudTrail's own event history and cover Sep 28 to the deadline. This folder shows the coding agents operating the AWS account that runs https://kinshield.site, not just writing code. Everything is plain text except one screenshot. Account IDs and IAM user IDs are replaced with `<ACCOUNT_ID>` and `<IAM_USER_ID>`.

## How the agents connected

- **Kiro** (Sep 28–30) and **Claude Code** (Sep 30–Oct 2) drove the AWS CLI as IAM user `kiro`. They didn't use the AWS MCP Server.
- CloudTrail confirms this. On 2026-09-30, the latest 50 events for `kiro` had the user agent `aws-cli/2.34.3` (43) or `lambda.amazonaws.com` (7), and none were from `aws-mcp.amazonaws.com`. See [`readonly-aws-evidence-2026-09-30.log`](readonly-aws-evidence-2026-09-30.log).
- **Full CloudTrail count, Sep 28 to the deadline:** 2,714 API calls by `kiro` across 24 services, 276 of them changes. 247 are tagged `app/kiro-ide` (Kiro), 1,374 came from the AWS CLI in the developer terminal where Claude Code ran, and 0 came through the AWS MCP Server. See [`cloudtrail-summary.md`](cloudtrail-summary.md).
- The spec trail Kiro wrote is in [`../../.kiro/specs/kinshield/`](../../.kiro/specs/kinshield/) (requirements, design, tasks).

## Timeline

| Date | File | What the agent did |
|---|---|---|
| Sep 28 | [`day0-capture.log`](day0-capture.log), [`day0-bedrock-verification.md`](day0-bedrock-verification.md) | Ran `sts get-caller-identity` and confirmed the account isn't in an Organization. Found that `bedrock-runtime` Converse is blocked for every model and credential type, and that the Bedrock Mantle endpoint works. |
| Sep 28 | [`detector-local-validation.md`](detector-local-validation.md) | Ran the detector against live Mantle before any infrastructure existed: 6/6 seed scenarios passed. Fixed the "Hi Grandma, it's me" false positive in the prompt. |
| Sep 29 | [`day1-backend-deploy.log`](day1-backend-deploy.log) | Deployed `kinshield-backend` (CloudFormation `UPDATE_COMPLETE`, 8 resources), checked `/health` and live `/detect`. Diagnosed transient Mantle failures and added retries with backoff. |
| Sep 29 | [`day1-frontend-live.log`](day1-frontend-live.log) | Deployed the frontend stack. CloudFront was blocked because the account wasn't verified yet, so the site was served from S3 instead. |
| Sep 29 | [`day2-benchmark-dashboard.md`](day2-benchmark-dashboard.md) | Ran the benchmark against the deployed API, made two calibration fixes driven by the results, and shipped the dashboard. |
| Sep 30 | [`readonly-aws-evidence-2026-09-30.log`](readonly-aws-evidence-2026-09-30.log), [`day4-uxfixes-verify.log`](day4-uxfixes-verify.log) | Checked stack and Lambda status, redeployed, and checked the live files. Checked `/detect` with a scam call (HIGH) and a birthday-secret call (LOW). |
| Oct 2 | [`kinbot-ship-2026-10-02.md`](kinbot-ship-2026-10-02.md), [`kinbot-agent-investigation-2026-10-02.png`](kinbot-agent-investigation-2026-10-02.png) | Shipped KinBot and KinShield-Lite (Lambda code update, S3 sync, smoke tests, Playwright checks of the live site). The screenshot shows the live investigator agent. |

## Not included

- The helper shell scripts and Playwright test runs are kept locally. Some of them build resource names from the account ID.
- AWS MCP Server activity isn't claimed anywhere, because none happened.
