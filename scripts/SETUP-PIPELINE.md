# Deployment & CI/CD Setup

End-to-end guide for deploying EchiumAI Chat via the GitHub Actions pipeline.

This is a one-time setup. After it's done, every `vX.Y.Z` git tag you push
triggers an automated deploy to AWS.

## Architecture overview

```
Developer machine / dev EC2          GitHub                AWS prod account
    (account 751395542516)        (EchiumAI/echium-chat)    (888284248988)
            │                            │                        │
            │  git push origin main      │                        │
            ├───────────────────────────►│                        │
            │                            │ tests run on push      │
            │                            │ (no deploy yet)        │
            │                            │                        │
            │  git tag v0.1.0 && push    │                        │
            ├───────────────────────────►│  workflow assumes      │
            │                            │  IAM role via OIDC     │
            │                            ├───────────────────────►│
            │                            │  cdk deploy --all      │
            │                            │                        ▼
            │                            │              Stack: BedrockChat
            │                            │              ├─ CloudFront
            │                            │              ├─ Cognito
            │                            │              ├─ Lambda
            │                            │              ├─ DynamoDB
            │                            │              ├─ OpenSearch
            │                            │              └─ ...
```

We use a **two-account setup**:

- **Dev account `751395542516`** — your development EC2 lives here. No
  application infrastructure deployed here. Used only for working on code.
- **Prod account `888284248988`** — where EchiumAI Chat actually runs. The
  GitHub Actions deploy role lives here. The app is deployed to `eu-west-1`.

Bedrock model invocations are cross-region: the app stack runs in `eu-west-1`
but `cdk.json` keeps `bedrockRegion: us-east-1`. With
`enableBedrockCrossRegionInference: true` (already set), the Lambda in
eu-west-1 invokes models hosted wherever Bedrock has capacity. This gives
access to the full model catalog including Claude Opus.

## Prerequisites

- Code is at `https://github.com/EchiumAI/echium-chat`
- Default branch on GitHub: `main` (you can update Settings → Branches if
  it's still pointing at `v3` from the upstream fork)
- AWS Console access to prod account `888284248988` with admin-equivalent
  permissions (used only for the one-time bootstrap)

## One-time setup

### Step 1: Push code to GitHub (from any developer machine)

```bash
git push origin main
```

This triggers the CI jobs from `.github/workflows/deploy.yml` (test-frontend,
test-cdk, test-backend). They run on every push but **do not deploy** —
deploys only fire on `vX.Y.Z` tag pushes.

### Step 2: Bootstrap CDK in the prod account (CloudShell)

Open AWS CloudShell while logged into the prod account `888284248988`.
Verify the right account/region first:

```bash
aws sts get-caller-identity            # should show 888284248988
export AWS_DEFAULT_REGION=eu-west-1
```

Install the CDK CLI and bootstrap:

```bash
sudo npm install -g aws-cdk
cdk bootstrap aws://888284248988/eu-west-1
```

`cdk bootstrap` creates a small `CDKToolkit` CloudFormation stack containing
an S3 bucket, an ECR repository, and a handful of IAM roles that the CDK
itself uses for deployments. One-time per account+region.

### Step 3: Create the GitHub Actions OIDC role (CloudShell)

This creates the IAM role that GitHub Actions will assume, scoped via OIDC
trust to your specific GitHub repo. The CloudFormation template lives in the
repo at `scripts/github-oidc-bootstrap.yml`.

Easiest path in CloudShell:

1. Click **Actions** (top-right) → **Upload file**
2. Pick `scripts/github-oidc-bootstrap.yml` from your local copy of the repo
3. Run:

```bash
aws cloudformation deploy \
  --stack-name github-actions-oidc \
  --template-file ~/github-oidc-bootstrap.yml \
  --capabilities CAPABILITY_NAMED_IAM \
  --region eu-west-1
```

(Use `--template-file ~/github-oidc-bootstrap.yaml` if you uploaded with the
`.yaml` extension.)

Common errors:

- **"OIDC provider already exists"** — your account has used GitHub OIDC for
  another project. Re-run with `--parameter-overrides CreateOidcProvider=false`.
- **"Role with name already exists"** — pick a different role name. Re-run
  with `--parameter-overrides RoleName=github-actions-echium-chat-deploy`,
  then update `AWS_ROLE_ARN` in `.github/workflows/deploy.yml` to match.

After it succeeds, confirm the role ARN:

```bash
aws cloudformation describe-stacks \
  --stack-name github-actions-oidc \
  --query "Stacks[0].Outputs[?OutputKey=='RoleArn'].OutputValue" \
  --output text \
  --region eu-west-1
```

It should print exactly `arn:aws:iam::888284248988:role/github-actions-echium-deploy`,
matching the value in `.github/workflows/deploy.yml`.

### Step 4 (optional): Configure the GitHub `prod` Environment

The deploy job declares `environment: prod`. Even without this step, the
deploy works — but configuring the environment lets you add safety rails:

1. GitHub repo → **Settings** → **Environments** → **New environment** → name `prod`
2. Optionally add **Required reviewers** (anyone listed must approve before deploy starts)
3. Optionally add a **Wait timer** (e.g. 10 minutes between approval and deploy)
4. Optionally restrict to **deployment branches and tags** → set "Selected"
   and add `v*.*.*` so manual workflow dispatches can only deploy from a tag

For a single-developer startup, you can skip all four and rely on tag pushes alone.

### Step 5: Trigger the first deploy

```bash
git tag v0.1.0
git push origin v0.1.0
```

Watch progress at `https://github.com/EchiumAI/echium-chat/actions`.

**First-time cold deploy: 30-45 minutes** — OpenSearch and CloudFront
provision from scratch. Subsequent deploys are 5-15 minutes for
frontend-only changes.

When successful, the workflow logs print the CloudFront URL. You can also
fetch it later:

```bash
aws cloudformation describe-stacks \
  --query "Stacks[?contains(StackName, 'BedrockChat')].Outputs[?OutputKey=='FrontendURL'].OutputValue | [0]" \
  --output text \
  --region eu-west-1
```

## Day-to-day operations

### Deploying a change

```bash
# Make changes, commit, push (CI runs but no deploy)
git push origin main

# When ready to ship, tag and push (deploys)
git tag v0.2.0 && git push origin v0.2.0
```

### Rolling back

There's no native "revert deploy" button. The pattern:

```bash
git revert <bad-commit-sha>
git push origin main
git tag v0.2.1 && git push origin v0.2.1   # rolls forward to a fixed state
```

For state-affecting changes (DynamoDB schema, Cognito config), revert may
not undo data changes. Plan migrations carefully.

### Adding more environments

The current setup is a single environment treated as prod. To add staging:

1. Bootstrap CDK in another account (or another region in the same account)
2. Apply `scripts/github-oidc-bootstrap.yml` there with a different role name
3. Add a `deploy-staging` job in `.github/workflows/deploy.yml` triggered on
   pushes to `main` (no tag), with its own `AWS_ROLE_ARN`
4. Optionally add `environment: staging` for separate approval rules

## Multi-account workflow

The dev EC2 (account `751395542516`) is separate from the prod app account
(`888284248988`). When working locally:

- **Code work** happens on the dev EC2 — clone, edit, commit, push
- **AWS-side admin** (one-time bootstrap, IAM changes) happens in CloudShell
  of the prod account so we use the right credentials
- **Deploys** are fully automated via GitHub Actions — neither account's
  long-lived credentials live in the repo

If you ever need to switch accounts (e.g. move from `888284248988` to a
different one):

1. Bootstrap CDK in the new account (`cdk bootstrap aws://NEWACCT/REGION`)
2. Apply the OIDC stack in the new account (CloudShell)
3. Update `AWS_REGION` and `AWS_ROLE_ARN` in `.github/workflows/deploy.yml`
4. Push a new tag — pipeline deploys to the new account

The pipeline definition (in this repo) is not tied to any AWS account.

## Cost expectations

### Pipeline (GitHub Actions)

- **Public repos:** unlimited free minutes
- **Private repos on Free plan:** 2,000 Linux minutes/month free; one full
  deploy uses ~10 min, so 200 deploys/month before paying. Realistic
  startup usage: $0/month.
- **Beyond free tier:** ~$0.008/min for Linux runners.

Configure GitHub → Settings → Billing to set a hard $0 spending limit, so
the workflow pauses (not charges) if you exceed the free tier.

### AWS deployment

The running app drives the bill, not the pipeline. Major line items:

- **OpenSearch** — has a minimum baseline (~$30-100/month in eu-west-1)
- **CloudFront + WAF** — ~$10-30/month at low traffic; more under load
- **Cognito** — free up to 50k MAU
- **Lambda + API Gateway** — pay-per-request, near-zero idle
- **DynamoDB on-demand** — pay-per-read/write, near-zero idle
- **Bedrock model invocations** — pay-per-token, scales with chat volume

Cost-control levers in `cdk.json`:

| Flag | Effect |
|---|---|
| `enableFrontendWaf: false` | Saves WAF cost (~$10/mo) — drop only if you don't need WAF protection |
| `enableRagReplicas: false` | Disables OpenSearch replicas — saves ~50% of the OpenSearch bill at the cost of HA |
| `enableBotStoreReplicas: false` | Same for the bot store index |

For a pre-revenue startup, expect **$30-80/month** in AWS costs while
nobody's actively using it. Bedrock invocation costs only kick in with
traffic. Tear down the stack (`cdk destroy --all` from CloudShell) when
not in use to stop the OpenSearch baseline.

## Common gotchas

### Docker permission denied (local dev EC2)

If `docker ps` says permission denied even after `sudo usermod -aG docker
ec2-user`, your shell session hasn't picked up the new group yet. Linux
loads groups at login, and tools like code-server or Session Manager keep
long-lived backends that don't refresh on `exit`. Either:

- Fully restart your remote backend (close code-server window, reconnect),
- Or use `newgrp docker` for a sub-shell with the group active

This affects local `cdk synth` only. The pipeline doesn't need local Docker
because GitHub Actions runners have it preinstalled.

### CloudShell `npm install -g` permission denied

CloudShell's global npm prefix needs root. Use `sudo`:

```bash
sudo npm install -g aws-cdk
```

Note that system-level installs in CloudShell are ephemeral (wiped on
session recycle). Anything in `~` persists. For a one-time setup, sudo
install is fine.

### CloudShell heredoc paste drops content

Long multi-line pastes (like an embedded YAML block) sometimes lose
characters in CloudShell. Three more reliable options:

1. **Click Actions → Upload file** in the CloudShell top toolbar, pick the
   YAML from your laptop or dev machine
2. Use `nano <filename>` to open an editor, paste, save with Ctrl+O Enter, exit with Ctrl+X
3. Auth GitHub in CloudShell (`sudo dnf install -y gh && gh auth login`)
   and `git clone` the repo

### "Could not assume role" in GitHub Actions

Usually a trust-policy mismatch. Confirm `GitHubOrg` and `GitHubRepo`
parameters in the OIDC stack match exactly (case-sensitive). Re-deploy the
CFN with the corrected `--parameter-overrides`.

### "This CDK CLI is not compatible..."

Your local CDK CLI is older than what the bootstrap stack expects. Run
`sudo npm install -g aws-cdk@latest` (or `cd cdk && npm ci` to use the
project-pinned version).

## Files in this setup

| File | Purpose |
|---|---|
| `.github/workflows/deploy.yml` | The pipeline definition (CI + deploy) |
| `.github/workflows/cdk.yml` | Pre-existing CI: `cdk synth` + unit tests on PR |
| `.github/workflows/frontend.yml` | Pre-existing CI: lint + build on PR |
| `.github/workflows/backend.yml` | Pre-existing CI: mypy + black + Docker build on PR |
| `scripts/github-oidc-bootstrap.yml` | CloudFormation: GitHub OIDC provider + IAM role |
| `scripts/SETUP-PIPELINE.md` | This document |
| `cdk/cdk.json` | CDK app config — also holds `logoPath` for the EchiumAI sidebar logo |
