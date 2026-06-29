# TODO / Task tracker

Living list of follow-ups picked up during build-out. Anything that has its own
deep-dive doc is linked. Tick items as they ship and bump them out of here.

Updated: 2026-06-28

## Parked from the billing / monetization + mobile build-out (2026-06-28)

Captured so nothing is lost; pick up when ready.

### Admin monitoring console (separate repo / subdomain)
- [ ] Build a cross-project admin console at `admin.echium.ai` in its **own repo**
      (decision: data stays with each product; console is a cross-project reader).
- [ ] In *this* repo, expose a secured `GET /admin/subscriptions` (admin-only)
      returning per-user email, plan, status, usage this month, cost, credit —
      for the console to consume.
- [ ] Staff auth for the console (separate Cognito pool / SSO, not the customer pool).

### Account deletion / GDPR erasure
- [ ] User-initiated "delete my account" flow (cascading delete: Cognito user +
      conversation/bot/subscription DynamoDB items keyed by `sub` + S3 objects).
- [ ] Admin "delete user + data" action (part of the admin console).
- [ ] Interim: manual via Cognito console + DynamoDB (documented in chat history).

### Mobile apps (EU, no app stores, download from echium site)
- [ ] **Decision needed:** iOS = (A) PWA only (free, no Apple) vs (B) Apple EU
      Web Distribution (€99/yr dev account, true downloadable app).
- [ ] Add **Capacitor** to the existing frontend (same repo) → signed Android APK.
- [ ] `/download` page (Android APK link + iOS install instructions).
- [ ] New GitHub Actions mobile-build workflow (Android SDK + signing keystore).

### Billing follow-ups
- [ ] **Margin review** — €5/500-message tier is loss-making on Sonnet; revisit
      caps / model gating / cost-allowance model before real customers.
- [ ] Verify enforcement with a **non-admin** test account (admins bypass).
- [ ] Unit/integration tests: Paddle signature verification (security-critical),
      plan/limit logic, webhook event processing, price-id maps.
- [ ] Legal pages (Terms/Privacy/Refund) need **professional review**; remove the
      "template" banner before GA.
- [ ] Large file/image uploads: S3 presigned-URL path to lift the 6MB inline cap
      (JPEG compression already mitigates the common photo case — v0.1.43).
- [ ] Swap Paddle sandbox → live (recreate catalog, swap price IDs + secrets,
      Paddle.js environment) at launch — see [`paddle-setup.md`](./paddle-setup.md).

## Priority 1 — soon

### Branded sign-up emails (move off Cognitos default sender)

**Why:** Right now verification emails come from `no-reply@verificationemail.com`
and almost always land in spam. Hurts conversion on the sign-up flow.

**Plan + steps:** see [`email-setup.md`](./email-setup.md). Two tracks:

- [ ] **Track 1 (DNS / AWS, ~10 min clicking + ~24–72h waiting)**
  - [ ] Verify `echium.ai` in SES (eu-west-1) with Easy DKIM
  - [ ] Add the 3 DKIM CNAMEs to Cloudflare (DNS-only / gray cloud)
  - [ ] Optional: Custom MAIL FROM domain (`mail.echium.ai`) for SPF alignment
  - [ ] Optional: SPF + DMARC TXT records in Cloudflare
  - [ ] Request SES production access (so we can send to non-verified recipients)
- [ ] **Track 2 (CDK change, ~10 min coding, must wait for Track 1)**
  - [ ] `cdk/lib/constructs/auth.ts`: switch UserPool email to SES with HTML template
  - [ ] Tag + deploy
  - [ ] Test sign-up: confirm From `noreply@echium.ai`, lands in inbox, code works

### Pin OIDC role trust policy to release tags only

**Why:** `scripts/github-oidc-bootstrap.yml` currently trusts `repo:EchiumAI/echium-chat:*`,
which means any branch push *could* deploy if a workflow change triggered it.
Tighter would be tags only.

- [ ] In `github-oidc-bootstrap.yml`, change `sub` condition from `repo:…:*` to
      `repo:EchiumAI/echium-chat:ref:refs/tags/v*`
- [ ] Re-deploy the OIDC stack (CloudShell):
      `aws cloudformation deploy --stack-name github-actions-oidc --template-file ~/github-oidc-bootstrap.yml --capabilities CAPABILITY_NAMED_IAM --region eu-west-1`
- [ ] Confirm a tag push still deploys; main push CI runs but no longer
      deploys (which it already doesn't, the workflow has its own tag gate too).

### Update pipeline-setup.md

**Why:** Step 2 only bootstraps `eu-west-1`. The `FrontendWafStack` is forced into
`us-east-1` (CloudFront WAF requirement). Anyone replaying this guide hits the
same blocker we did.

- [ ] Add `cdk bootstrap aws://ACCT/us-east-1` to Step 2 with a one-line note
      "WAF for CloudFront is required to live in us-east-1"
- [ ] Same step optionally mentions setting `enableFrontendWaf: false` in
      `cdk.json` to avoid us-east-1 entirely

## Priority 2 — once the basics are stable

### Privacy / cookie notice page + footer link

**Why:** Even though we set zero non-essential cookies today, ePrivacy applies
to localStorage too. We should at least disclose what's stored and why.

- [ ] `frontend/src/pages/PrivacyPage.tsx` — static markdown-style content listing
      Cognito tokens, theme/drawer/model preferences in localStorage
- [ ] Add a small "Privacy" link to the auth screen footer and the in-app menu
- [ ] Routes: add `/privacy` (public, no auth required)

### Translate the new auth keys for the remaining locales

**Why:** When we added `auth.hero/features/origin`, we only translated en, es, de, ja.
Other languages fall back to English at runtime, but proper translations look better.

- [ ] fr (French)
- [ ] it (Italian)
- [ ] pt-br (Portuguese-BR)
- [ ] ko (Korean)
- [ ] zh-hans / zh-hant (Chinese simplified / traditional)
- [ ] vi, th, id, ms, nb, pl

### GitHub Actions billing safety

**Why:** Workflow runs are free on public repos and within the 2,000 min/month
free tier on private. Belt-and-braces: set a hard $0 spending limit so the
workflow pauses (not charges) if we ever go private + over.

- [ ] GitHub → Settings → Billing → Spending limits → Actions = $0

## Priority 3 — when growth justifies it

### Cookie consent banner (only once we add analytics or marketing)

**Why:** Today we have nothing requiring consent. The moment we wire Google
Analytics, Mixpanel, Meta Pixel, etc., we need a consent banner.

- [ ] Self-hosted React banner (~150 LOC) with Accept-all / Reject-all
      equally prominent
- [ ] `useConsent` hook → `localStorage.echium_consent_v1`
- [ ] Categories: necessary (always on), functional, analytics, marketing
- [ ] All non-essential trackers MUST honor `analytics`/`marketing` flag and
      not load until granted

### Email transport scaling

- [ ] If usage grows beyond a few hundred emails/day, consider Postmark / SendGrid
      transactional providers (better deliverability tooling, real-time bounce
      handling); SES is fine for now.

### CDK app cleanups

- [ ] Replace deprecated `aws-cdk-lib.aws_lambda.FunctionOptions#logRetention`
      usages with explicit `logGroup` + `aws-cdk-lib.aws_logs.LogGroup`
- [ ] Replace deprecated `aws-cdk-lib.aws_dynamodb.TableOptions#pointInTimeRecovery`
      with `pointInTimeRecoverySpecification`
- [ ] Bump `aws-actions/configure-aws-credentials` to a Node.js 24-compatible
      version before Sept 2026 (per workflow annotation)

## Quick housekeeping

- [ ] Decide: commit `.vscode/settings.json` (the `typescript.autoClosingTags: false`
      change) or move to a personal global VS Code settings file
- [ ] Delete stray files in workspace root: `.add-auth-i18n.py`, `.fail.log`
      (left over from earlier troubleshooting)
- [ ] Consider adding `.add-auth-i18n.py`, `.fail.log`, `.run-*.{sh,out}` patterns
      to `.gitignore` so they cannot be accidentally committed

## Done in this build-out (kept for reference)

- ✅ Frontend lint fixed (`size-N` shorthand) — v0.1.1
- ✅ Custom domain `chat.echium.ai` wired through CDK + ACM (`feat: certificateArn` param) — v0.1.4
- ✅ Auth screen text readable in dark mode (input text white, autofill override) — v0.1.5/v0.1.6
- ✅ Sign-in field labeled Email + auth labels brightened — v0.1.7
- ✅ Auth screen background softened from black to dark gray — v0.1.8/v0.1.9
- ✅ Anthropic-style hero with tagline + feature pills — v0.1.10
- ✅ ja/de/es i18n keys to satisfy `typeof en` strict type — v0.1.11
- ✅ "Made in Madrid · European Union" origin badge with Madrid + EU flag SVGs — v0.1.12
- ✅ EMAIL-SETUP.md doc with SES + Cognito branded email plan (now at `docs/ops/email-setup.md`)
- ✅ SETUP-PIPELINE.md doc, initial CI/CD bootstrap guide (now at `docs/ops/pipeline-setup.md`)
