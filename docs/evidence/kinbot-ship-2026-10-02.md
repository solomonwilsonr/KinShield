# KinBot ship log (2026-10-02)

Agent: Claude Code, operating the AWS account as IAM user `kiro` (account ID redacted). All output below is verbatim, with the account ID replaced by `<ACCOUNT_ID>`.

## Backend deploy (infra/deploy_backend.sh): adds POST /kinbot + KinShield-Lite
```
=== 1. package lambda into <tmp> ===
packaged:   4770430                     72 files
=== 2. deploy CloudFormation stack (kinshield-backend) ===

Waiting for changeset to be created..

No changes to deploy. Stack kinshield-backend is up to date
=== 3. upload real lambda code ===
{
    "Fn": "kinshield-detector",
    "LastModified": "2026-10-01T20:33:59.000+0000",
    "CodeSize": 4495461
}
=== 4. outputs ===
-------------------------------------------------------------------------------------------------------------------------
|                                                    DescribeStacks                                                     |
+--------------------------------------------+---------------+----------------------------------------------------------+
|                 Description                |   OutputKey   |                       OutputValue                        |
+--------------------------------------------+---------------+----------------------------------------------------------+
|                                            |  TableName    |  kinshield-sessions                                      |
|                                            |  FunctionName |  kinshield-detector                                      |
|  Public HTTP API endpoint for the detector |  ApiUrl       |  https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com  |
+--------------------------------------------+---------------+----------------------------------------------------------+
API_URL=https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com
=== 5. smoke test the public API ===
{"status": "ok", "service": "kinshield-detector", "model": "openai.gpt-oss-20b"}
[http=200]
```

## Frontend deploy (infra/deploy_frontend_s3.sh), uploads of the new files and the smoke test
```
=== 1. deploy S3 website stack ===
bucket=kinshield-site-<ACCOUNT_ID> api=https://zx9d4nrkni.execute-api.us-east-1.amazonaws.com
=== 2. inject API endpoint + sync ===
upload: <build>/index.html to s3://kinshield-site-<ACCOUNT_ID>/index.html
upload: <build>/kinbot.css to s3://kinshield-site-<ACCOUNT_ID>/kinbot.css
upload: <build>/kinbot.js to s3://kinshield-site-<ACCOUNT_ID>/kinbot.js
upload: <build>/kinbot.html to s3://kinshield-site-<ACCOUNT_ID>/kinbot.html
upload: <build>/learn.html to s3://kinshield-site-<ACCOUNT_ID>/learn.html
=== 3. smoke test ===
index.html http=200
WEBSITE_URL=http://kinshield-site-<ACCOUNT_ID>.s3-website-us-east-1.amazonaws.com
```

## Live Playwright check against the S3 website (kinbot.html)
```
1440: HIGH RISK, 4 cited signs (secrecy, gift cards, money, emergency); Lite 98% scam-like; follow-up answered; pharmacy example LOW RISK; no console errors; no horizontal overflow
820: no console errors; no horizontal overflow
390: HIGH RISK, 4 cited signs; follow-up answered; no console errors; no horizontal overflow
```

## KinShield-Lite parity (pure-Python Lambda scorer vs numpy/sklearn Int8Model)
```
parity ok on 52 texts
```

## Redesign to the KinShield UI (same day, frontend only)

`infra/deploy_frontend_s3.sh`, run by the agent as `kiro`. CFN reported "No changes to deploy"; the sync uploaded `kinbot.css`, `kinbot.html` and `kinbot.js`; the smoke test returned `index.html http=200`.

Live Playwright results:

```
1440: HIGH 90 · 4/7 signs · Lite 98% · badge HIGH RISK · follow-up answered · pharmacy example LOW · no overflow · no console errors
820:  no overflow · no console errors
390:  HIGH 102 · 4/7 signs · Lite 98% · badge HIGH RISK · follow-up answered · no overflow · no console errors
```

## Split into an info page and a chat page (same day, frontend only)

`infra/deploy_frontend_s3.sh`, run by the agent as `kiro`. It uploaded the new `kinbot-chat.html` and updated `kinbot.html`, `kinbot.css`, `kinbot.js` and `learn.html`. The smoke test returned `index.html http=200`.

Live Playwright results, the same at 1440, 820 and 390:

```
kinbot.html:      no chat code; no overflow; every CTA → kinbot-chat.html
kinbot-chat.html: input focused and visible on load
?example=0:       auto-run → HIGH, 4/7 signs; follow-up answered; no console errors
```

## Chat page rebuilt as the full-screen KinBot app (same day, frontend only)

The agent deployed as `kiro`. The sync uploaded `kinbot-chat.html`, `kinbot-app.css` and `kinbot-app.js`, and deleted the retired `kinbot.js`. The smoke test returned `index.html http=200`.

Live Playwright results at 1440, 820 and 390:

```
input focused and visible on load
typed SSA scam → MEDIUM/HIGH with 3-4 cited signs; follow-up answered
?example=0 → HIGH, 4 signs
pharmacy example → LOW
no console errors; no horizontal overflow
```
