# Paddle billing setup

Tracks the Paddle integration: price IDs, credentials, and what's wired.

Billing is web-first (Paddle as merchant of record, in-app overlay checkout).
Mobile sells nothing in-app — see `mobile-strategy.md`.

## Environments

Paddle sandbox and live are **separate accounts** with separate logins,
credentials, and catalogs. Price IDs below are **sandbox**. Live IDs will
differ and must be recreated + swapped at launch.

- Sandbox dashboard: sandbox-login.paddle.com
- Live dashboard: paddle.com (account approved)

## Sandbox price IDs

| Plan / item | Price | Type | Price ID |
|---|---|---|---|
| Starter | €5/mo | recurring | `pri_01kw3adt8ttv2qjw1eztcyttqp` |
| Pro | €20/mo | recurring | `pri_01kw3a757d1wen071m4vdq15r8` |
| Business | €100/mo | recurring | `pri_01kw3ab0vtq5j04mqmq78aphef` |
| Max | €200/mo | recurring | `pri_01kw3a0n4fbyjykcpkqwybp6cq` |
| Credit €10 | €10 | one-time | `pri_01kw3a37f72s0md5theqmqe7f1` |
| Credit €25 | €25 | one-time | `pri_01kw3a445znqjd90m9gjsm15qz` |
| Credit €50 | €50 | one-time | `pri_01kw3a51rc5f8nbzc0sh6g60x1` |

Free tier has no Paddle product (handled entirely server-side).

## Credentials still needed (sandbox → AWS Secrets Manager / config)

- [ ] **Client-side token** (Developer Tools → Authentication, `test_...`) —
      frontend Paddle.js init. Public-ish; injected at frontend build.
- [ ] **API key** (Developer Tools → Authentication) — server-side calls.
      Store in Secrets Manager, never in git.
- [ ] **Webhook signing secret** (Developer Tools → Notifications) — verify
      inbound webhooks. Store in Secrets Manager. Point the webhook
      destination at the backend `/webhooks/paddle` URL (created when wired).

## Wiring status

- [x] Products + prices created (sandbox)
- [x] Subscription/usage/credit data model + repository
- [x] Usage metering per message + `GET /subscription`
- [ ] Price-ID ↔ plan config (sandbox set; make env-swappable for live)
- [ ] Paddle.js overlay checkout (frontend) — needs client-side token
- [ ] Webhook handler (`/webhooks/paddle`) — needs signing secret
- [ ] In-app billing page (upgrade / top-up buttons)
- [ ] Enforcement + consumption indicator + upgrade prompts

## Notes

- Price IDs are config, not secrets — safe to keep here. The API key and
  webhook secret are secrets — Secrets Manager only.
- At launch: recreate the catalog in the live account, capture live price IDs,
  swap config + secrets, change Paddle.js environment from sandbox to
  production.
