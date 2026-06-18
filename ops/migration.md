# Migrating echium-chat between AWS accounts

This runbook moves the production stack from one AWS account to another while
keeping the same `chat.echium.ai` domain and Cloudflare DNS. Used when an
account is blocked at the Bedrock per-day token cap, when SES production
access is denied, or when consolidating into AWS Organizations later.

The stack is account-agnostic — only the ACM certificate ARN and Anthropic
marketplace agreements are tied to a specific AWS account. Everything else
resolves from the shell's AWS credentials at deploy time.

## Prerequisites

- Source account: the existing deployment (currently EchiumAI account)
- Target account: an AWS account with working Bedrock quotas and ideally SES
  out of sandbox (e.g. an existing personal/business account with spend history)
- Cloudflare access for the `echium.ai` zone
- AdministratorAccess (or close to it) in the target account for bootstrapping

All commands below assume CloudShell in the target account, eu-west-1.

## 1. Bootstrap CDK in both regions

CloudFront WAF lives in us-east-1, the rest in eu-west-1.

```bash
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
echo "Target account: $ACCOUNT_ID"

cdk bootstrap aws://$ACCOUNT_ID/eu-west-1
cdk bootstrap aws://$ACCOUNT_ID/us-east-1
```

## 2. Issue a new ACM certificate for chat.echium.ai

The cert must be in **us-east-1** because CloudFront only consumes certs from
that region.

```bash
aws acm request-certificate \
  --region us-east-1 \
  --domain-name chat.echium.ai \
  --validation-method DNS \
  --query CertificateArn --output text
```

Note the returned ARN — that becomes the new `certificateArn` in `cdk.json`.

Then describe the cert to get the DNS validation record:

```bash
NEW_CERT_ARN="<paste from above>"
aws acm describe-certificate --region us-east-1 --certificate-arn "$NEW_CERT_ARN" \
  --query 'Certificate.DomainValidationOptions[].ResourceRecord' --output table
```

Add the `_xxx.chat.echium.ai → _yyy.acm-validations.aws` CNAME at Cloudflare
(DNS only, grey cloud). Wait until ACM marks the cert as `ISSUED`:

```bash
watch -n 30 'aws acm describe-certificate --region us-east-1 --certificate-arn "$NEW_CERT_ARN" --query Certificate.Status --output text'
```

Typical: 5-10 min after the CNAME propagates.

## 3. Sign Anthropic marketplace agreements

Required once per account, per Claude model. Submit the use-case form:

```bash
aws bedrock put-use-case-for-model-access \
  --region eu-west-1 \
  --form-data file:///dev/stdin <<'EOF'
{
  "companyName": "Echium AI",
  "companyWebsite": "https://echium.ai",
  "intendedUsers": "100-1000",
  "industryOption": "Other",
  "otherIndustryOption": "AI tools",
  "useCases": "Building an EU-resident AI chat assistant for end users. We need access to Claude models for general assistant capabilities. The product is hosted on AWS in eu-west-1 with a custom domain at chat.echium.ai."
}
EOF
```

Then create an agreement for each Claude model we intend to use. Loop:

```bash
for MODEL in \
  anthropic.claude-sonnet-4-5-20250929-v1:0 \
  anthropic.claude-haiku-4-5-20251001-v1:0 \
  anthropic.claude-opus-4-5-20251101-v1:0 \
  anthropic.claude-sonnet-4-6 \
  anthropic.claude-opus-4-6-v1; do
  echo "=== $MODEL ==="
  OFFER=$(aws bedrock list-foundation-model-agreement-offers \
    --region eu-west-1 --model-id "$MODEL" \
    --query 'offers[0].offerId' --output text 2>&1)
  echo "  offer: $OFFER"
  aws bedrock create-foundation-model-agreement \
    --region eu-west-1 --model-id "$MODEL" --offer-token "$OFFER" \
    --query 'modelAgreementId' --output text
done
```

Verify all are AVAILABLE:

```bash
for MODEL in \
  anthropic.claude-sonnet-4-5-20250929-v1:0 \
  anthropic.claude-haiku-4-5-20251001-v1:0 \
  anthropic.claude-opus-4-5-20251101-v1:0 \
  anthropic.claude-sonnet-4-6 \
  anthropic.claude-opus-4-6-v1; do
  echo -n "$MODEL: "
  aws bedrock get-foundation-model-availability \
    --region eu-west-1 --model-id "$MODEL" \
    --query agreementAvailability.status --output text
done
```

## 4. Verify SES domain `echium.ai`

Most of the DKIM CNAMEs are already in Cloudflare from the source account. SES
in the target account needs its own verification token, however.

```bash
aws ses verify-domain-identity --region eu-west-1 --domain echium.ai \
  --query VerificationToken --output text
```

Add a TXT record at Cloudflare:

- Name: `_amazonses.echium.ai`
- Value: the token returned above

Then DKIM:

```bash
aws ses verify-domain-dkim --region eu-west-1 --domain echium.ai \
  --query DkimTokens --output table
```

Add three CNAMEs at Cloudflare (one per token):

- `<token>._domainkey.echium.ai → <token>.dkim.amazonses.com`

Set the custom MAIL FROM domain (matches what the source account had):

```bash
aws ses set-identity-mail-from-domain --region eu-west-1 \
  --identity echium.ai \
  --mail-from-domain mail.echium.ai \
  --behavior-on-mx-failure UseDefaultValue
```

Cloudflare records for `mail.echium.ai`:

- MX `mail.echium.ai → 10 feedback-smtp.eu-west-1.amazonses.com`
- TXT `mail.echium.ai → "v=spf1 include:amazonses.com ~all"`

Wait until the identity flips to `Success`:

```bash
watch -n 30 'aws ses get-identity-verification-attributes --region eu-west-1 --identities echium.ai --query "VerificationAttributes.\"echium.ai\".VerificationStatus" --output text'
```

If the new account is in SES sandbox, request production access via the
Console (Account dashboard → Request production access) using the body in
`docs/ops/email-setup.md`.

## 5. Update the repo for the new account

Edit `cdk/cdk.json`:

- `certificateArn` → the new ARN from step 2

Commit on a branch (avoid pushing to `main` until the new stack is up):

```bash
git checkout -b migrate/aws-account
git add cdk/cdk.json
git commit -m "chore(cdk): point certificateArn at target account ACM"
```

Do **not** push the tag yet — the GitHub Actions deploy is still pointed at
the source account. We will deploy from the local CloudShell first, then flip
the deploy role afterwards.

## 6. Deploy the stack from CloudShell in the target account

```bash
git clone https://github.com/EchiumAI/echium-chat.git
cd echium-chat
git checkout migrate/aws-account

# Install deps and synth
cd cdk
npm ci
npx cdk synth >/dev/null
npx cdk deploy --all --require-approval never
```

Deploy takes ~12-18 minutes. Watch for:

- `BedrockChatStack.FrontendURL` — the new CloudFront domain
- `BedrockChatStack.BackendApiBackendApiUrl…` — the new API Gateway

## 7. Cut over DNS at Cloudflare

In the Cloudflare dashboard for `echium.ai`:

- Update the `chat` CNAME (currently pointing at the source account's
  CloudFront `dXXXX.cloudfront.net`) to the new distribution domain from
  step 6
- Keep "DNS only" (grey cloud); Cloudflare proxy breaks CloudFront SNI

Propagation: minutes. Test:

```bash
curl -sI https://chat.echium.ai | head -1
```

Should return `200` from the new stack.

## 8. Rotate the GitHub Actions OIDC role

The deploy workflow currently assumes
`arn:aws:iam::<source>:role/github-actions-echium-deploy`. Create the
equivalent role in the target account:

- Apply `scripts/github-oidc-bootstrap.yml` (or the equivalent template) with
  the target account ID as the parameter
- Update `.github/workflows/deploy.yml` `role-to-assume` to the new ARN
- Push the branch, merge to `main`, push a tag → GitHub Actions deploys to the
  new account on its own going forward

## 9. Tear down the source stack

Once the new stack is serving traffic and you have confirmed sign-up,
chat, and admin paths, destroy the source-account stack to stop billing:

```bash
# In CloudShell of the SOURCE account
cd cdk
npx cdk destroy --all
```

CloudFormation may leave orphaned S3 buckets behind (intentional — non-empty
buckets resist deletion). Empty and delete them in the console afterwards.

Then close the source account from the AWS billing console (or keep it open
on the free tier as a backup). Closing triggers a 90-day grace period.

## Rollback

If the new stack misbehaves, revert step 7 (point the CNAME back at the
source CloudFront). The source stack is untouched until step 9.
