# Pipeline Setup

One-time setup to enable the GitHub Actions deploy workflow at
`.github/workflows/deploy.yml`. After this is done, every `vX.Y.Z` git tag
you push will trigger an automated deploy to AWS.

## Overview

```
git push origin v1.0.0
         │
         ▼
  GitHub Actions (free)
         │
         │  OIDC token (no AWS keys stored)
         ▼
  Assume IAM role in AWS  ──► cdk deploy ──► your app on AWS
```

## Prerequisites

- An AWS account (we're using **888284248988** in **eu-west-1**).
- Local AWS CLI configured with credentials that can create IAM resources
  and run `cdk bootstrap`. After this setup, those local credentials are
  no longer needed for deploys.
- This repo pushed to **github.com/EchiumAI/echium-chat**.

## Step 1 — Bootstrap CDK (one-time, local)

CDK needs an S3 bucket and a few IAM roles in your account before it can
deploy anything. This is one-time per account+region.

```bash
cd cdk
npm ci
npx cdk bootstrap aws://888284248988/eu-west-1
```

If you ever want to deploy in another region too, repeat with that region.

## Step 2 — Create the GitHub OIDC role in AWS (one-time)

This applies the CloudFormation template at `scripts/github-oidc-bootstrap.yml`,
which creates:

- The GitHub OIDC identity provider (if your account doesn't have it yet)
- An IAM role named `github-actions-echium-deploy`, trusted only to this
  repo, with permissions to run `cdk deploy`

```bash
aws cloudformation deploy \
  --stack-name github-actions-oidc \
  --template-file scripts/github-oidc-bootstrap.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

If your account already has the GitHub OIDC provider (you may, if you've
done this for another repo), add `--parameter-overrides CreateOidcProvider=false`
to the command.

After it succeeds, grab the role ARN:

```bash
aws cloudformation describe-stacks \
  --stack-name github-actions-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
  --output text \
  --region eu-west-1
```

The ARN should be exactly the value already hardcoded in `deploy.yml`'s
`AWS_ROLE_ARN`. If it differs (e.g. you customized the role name), update
the `env.AWS_ROLE_ARN` line in `.github/workflows/deploy.yml`.

## Step 3 — Configure the GitHub `prod` Environment (one-time, optional)

The deploy job uses `environment: prod`. Even without this step it will
deploy fine, but configuring the environment lets you add safety rails:

1. Open the repo on GitHub → **Settings** → **Environments** → **New environment** → name it `prod`.
2. (Optional) Add **Required reviewers** — anyone listed must click "Approve" before a deploy starts.
3. (Optional) Add a **Wait timer** — e.g. 10 minutes between approval and start, gives you time to back out.
4. (Optional) Restrict to **deployment branches and tags** — set to "Selected" and add `v*.*.*`. This prevents anyone from manually dispatching a deploy from a non-tag.

For a single-developer startup, you can skip all four and rely on tag pushes alone.

## Step 4 — Push the rebrand + the workflow

```bash
git add -A
git status                        # sanity check what you're committing
git commit -m "Rebrand to EchiumAI + add deploy pipeline"
git push origin v3
```

The push triggers the CI jobs (test-frontend, test-cdk, test-backend) but
**does not deploy** — deploys only run on tags.

## Step 5 — Trigger your first deploy

Once the CI jobs pass on `v3`:

```bash
git tag v0.1.0
git push origin v0.1.0
```

This fires the `deploy` job. First-time cold deploy of this stack takes
roughly **30–45 minutes** because OpenSearch + Cognito + CloudFront all
provision from scratch. Watch progress in **GitHub → Actions → Deploy**.

When it's done, the workflow log prints the CloudFront URL. You can also
get it later with:

```bash
aws cloudformation describe-stacks \
  --query "Stacks[?contains(StackName, 'BedrockChat')].Outputs[?OutputKey=='FrontendURL'].OutputValue | [0]" \
  --output text \
  --region eu-west-1
```

## Subsequent deploys

```bash
# Make changes, commit, push to v3 (CI runs)
git push origin v3

# When ready to ship, tag and push (deploys)
git tag v0.2.0 && git push origin v0.2.0
```

A frontend-only change usually deploys in 5–10 minutes.

## Cost expectations

- **GitHub Actions:** $0/month — single deploy of this stack uses
  ~10 minutes of runner time, well within the 2,000 free minutes/month for
  private repos.
- **AWS deployment cost:** the running app itself (OpenSearch, CloudFront,
  Lambda, DynamoDB, Cognito, optional WAF) is the actual bill. See
  `cdk.json` for flags that affect cost: `enableFrontendWaf`,
  `enableRagReplicas`, `enableBotStoreReplicas`.

## Troubleshooting

- **"Could not assume role" in GitHub Actions** — usually a trust-policy
  mismatch. Confirm `GitHubOrg` and `GitHubRepo` in the OIDC stack match
  exactly (case-sensitive). Re-run the CFN deploy with corrected parameters.
- **"This CDK CLI is not compatible..."** — your local CDK version is older
  than what the workflow uses. Run `cd cdk && npm ci` to align.
- **OpenSearch creation failed** — usually means quota issues or service
  not available in `eu-west-1`. Check the CloudFormation events in the
  AWS Console for the specific resource that failed.
- **Deploy hung at 80%** — the CloudFront distribution propagation can
  take 15–20 minutes on a first deploy. Patience.

## Switching AWS accounts later

If you ever need to move to a different AWS account:

1. Apply `scripts/github-oidc-bootstrap.yml` in the new account.
2. Update `AWS_REGION` and `AWS_ROLE_ARN` in `.github/workflows/deploy.yml`.
3. Run `cdk bootstrap` against the new account.
4. Push a new tag.

The pipeline definition (in this repo) is not tied to any AWS account.
