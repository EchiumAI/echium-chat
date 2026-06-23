# Echium Operations

This folder holds **Echium-specific** operational documentation for this fork
of `aws-samples/bedrock-chat`. Upstream Bedrock Chat docs live in `docs/`
alongside this folder, untouched.

## What's in here

| Doc | Use it for |
|---|---|
| [`pipeline-setup.md`](./pipeline-setup.md) | One-time setup of the GitHub Actions → AWS deploy pipeline (CDK bootstrap, OIDC IAM role, GitHub Environment) |
| [`email-setup.md`](./email-setup.md) | Branded sign-up / password-reset emails via SES + Cognito (DNS, DKIM/SPF/DMARC, custom HTML template) |
| [`migration.md`](./migration.md) | Moving the stack between AWS accounts while keeping the same domain (cert reissue, agreements, SES verify, DNS cutover) |
| [`mobile-strategy.md`](./mobile-strategy.md) | How Echium reaches mobile (EU-first, direct distribution, PWA on iOS / Capacitor on Android, web-first Paddle billing) |
| [`todo.md`](./todo.md) | Living task tracker for outstanding work and recently shipped items |

## Conventions

- **Lowercase, kebab-case file names.** Easier to read in URLs and link.
- **Each doc is self-contained.** Cross-link with relative paths; assume the
  reader landed on this folder via `docs/ops/README.md`.
- **Keep in sync with reality.** When something ships, tick it off in
  `todo.md` so this folder stays a reliable single source of truth for
  "what is the state of our deploy / email / etc."
