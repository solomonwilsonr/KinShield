# CloudTrail summary: who operated the KinShield AWS account

Exported read-only with `aws cloudtrail lookup-events` for IAM user `kiro` (the user both coding agents ran as), region us-east-1, on 2026-10-07. This file holds **counts only**: account IDs, IP addresses, access-key IDs and ARNs are left out. The raw export is kept offline.

CloudTrail timestamps are written by AWS, so they show **when** the agents operated the account, even though this summary was added to the repo after the deadline. The deadline was **2026-10-02 23:59 PT (2026-10-03 06:59 UTC)**.

## Before the deadline
- **2,714 API calls** by `kiro` between 2026-09-28 10:58 PT and 2026-10-02 22:41 PT, across 24 AWS services.
- **276 of them changed something** (deploys, code updates, new resources); the rest were reads such as checking stack status or logs.
- **247 calls carry `app/kiro-ide` in the user agent.** The AWS CLI adds that tag when Kiro runs it, and CloudTrail records it, so these calls are Kiro's.
- 159 calls returned an error. They're counted, not hidden. Most are harmless "not configured" answers when a stack or tool reads a setting that was never set (for example `NoSuchCORSConfiguration` on an S3 bucket). 10 are `TooManyRequestsException` from API Gateway while the agent created the custom domain, which it retried.
- After the deadline: 75 more calls (mostly read-only checks, plus creating the budget, a Lambda quota request and one backend redeploy). They aren't counted above.

### By client
| Client | Calls | Of which changed something |
|---|---:|---:|
| AWS CLI from the developer terminal, where Claude Code ran | 1,374 | 144 |
| CloudFormation, acting for a stack deploy | 866 | 80 |
| Kiro (AWS CLI, tagged app/kiro-ide) | 247 | 43 |
| AWS service on our behalf (lambda) | 196 | 0 |
| AWS service on our behalf (secretsmanager) | 13 | 0 |
| AWS service on our behalf (acm) | 7 | 3 |
| AWS service on our behalf (apigateway) | 6 | 6 |
| Python SDK script (boto3) | 5 | 0 |
| **Total** | **2,714** | **276** |

**How to read this.** Claude Code runs the AWS CLI in the developer's terminal and adds no tag of its own, so CloudTrail can't tell its calls apart from a person typing the same command. Those calls are listed as "AWS CLI from the developer terminal". "CloudFormation, acting for a stack deploy" counts the calls CloudFormation made to create or update resources after an agent ran `cloudformation deploy`. No calls came through the AWS MCP Server (`aws-mcp.amazonaws.com`): 0 events.

### By day (Pacific time)
| Day | Kiro | AWS CLI (terminal / Claude Code) | CloudFormation | Other | Total |
|---|---:|---:|---:|---:|---:|
| Mon Sep 28 | 14 | 2 | 0 | 1 | 17 |
| Tue Sep 29 | 156 | 19 | 225 | 43 | 443 |
| Wed Sep 30 | 58 | 209 | 39 | 23 | 329 |
| Thu Oct 01 | 17 | 524 | 395 | 76 | 1012 |
| Fri Oct 02 | 2 | 620 | 207 | 84 | 913 |

### Deploys
| What | Kiro | AWS CLI (terminal / Claude Code) |
|---|---:|---:|
| Stack deploys applied (`ExecuteChangeSet`) | 6 | 10 |
| Change sets created (`CreateChangeSet`) | 19 | 74 |
| Lambda code updates (`UpdateFunctionCode`) | 11 | 31 |

### What the agents ran most (AWS CLI commands, before the deadline)
Each row counts API calls made by that command, so one `aws cloudformation deploy` shows up as several calls (create a change set, wait, describe, execute).

| Command | API calls |
|---|---:|
| `aws cloudformation deploy` | 454 |
| `aws cloudformation describe-stacks` | 369 |
| `aws service-quotas list-service-quotas` | 306 |
| `aws sts get-caller-identity` | 77 |
| `aws lambda wait function-updated` | 55 |
| `aws logs filter-log-events` | 44 |
| `aws lambda update-function-code` | 42 |
| `aws iam list-service-specific-credentials` | 21 |
| `aws route53domains check-domain-availability` | 19 |
| `aws budgets describe-budgets` | 16 |
| `aws cloudwatch describe-alarms` | 14 |
| `aws acm wait certificate-validated` | 13 |
| `aws s3 ls` | 10 |
| `aws cloudformation validate-template` | 10 |
| `aws route53domains list-prices` | 10 |
| `aws ce get-cost-and-usage` | 9 |
| `aws apigatewayv2 create-domain-name` | 8 |
| `aws lambda get-function-configuration` | 7 |
| `aws secretsmanager get-secret-value` | 7 |
| `aws secretsmanager describe-secret` | 6 |

### Services touched (before the deadline)
| Service | Calls | Changed something |
|---|---:|---:|
| cloudformation | 849 | 112 |
| servicequotas | 308 | 1 |
| iam | 275 | 13 |
| s3 | 271 | 18 |
| lambda | 266 | 65 |
| kms | 216 | 3 |
| dynamodb | 112 | 3 |
| sts | 93 | 0 |
| logs | 81 | 5 |
| apigateway | 78 | 34 |
| route53domains | 30 | 0 |
| secretsmanager | 23 | 3 |
| cognito-idp | 21 | 10 |
| acm | 21 | 1 |
| budgets | 16 | 0 |
| monitoring | 14 | 0 |
| ce | 10 | 0 |
| cloudfront | 10 | 4 |
| route53 | 8 | 4 |
| cloudtrail | 4 | 0 |
| bedrock | 3 | 0 |
| organizations | 2 | 0 |
| polly | 2 | 0 |
| wafv2 | 1 | 0 |

### Milestones (first time each happened)
| When (PT) | Event | Client |
|---|---|---|
| Sep 28 13:17 | secretsmanager `CreateSecret`  | Kiro (AWS CLI, tagged app/kiro-ide) |
| Sep 29 02:53 | cloudformation `ExecuteChangeSet`  | Kiro (AWS CLI, tagged app/kiro-ide) |
| Sep 29 02:53 | dynamodb `CreateTable`  | CloudFormation, acting for a stack deploy |
| Sep 29 02:54 | lambda `UpdateFunctionCode20150331v2`  | Kiro (AWS CLI, tagged app/kiro-ide) |
| Sep 29 03:20 | apigateway `CreateApi`  | CloudFormation, acting for a stack deploy |
| Sep 29 04:49 | s3 `PutBucketWebsite`  | CloudFormation, acting for a stack deploy |
| Oct 02 19:52 | route53 `CreateHostedZone`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 02 19:53 | acm `RequestCertificate`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 02 19:53 | route53 `ChangeResourceRecordSets`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 02 20:02 | cognito-idp `CreateUserPool`  | CloudFormation, acting for a stack deploy |
| Oct 02 20:10 | cognito-idp `SetUICustomization`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 02 21:26 | apigateway `CreateDomainName`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 02 21:26 | apigateway `CreateApiMapping`  | AWS CLI from the developer terminal, where Claude Code ran |
| Oct 03 03:17 | budgets `CreateBudget` (after deadline) | AWS CLI from the developer terminal, where Claude Code ran |

Reproduce (needs read access to the account): `aws cloudtrail lookup-events --lookup-attributes AttributeKey=Username,AttributeValue=kiro --start-time <day>T00:00:00Z --end-time <day>T23:59:59Z`. CloudTrail event history keeps 90 days.
