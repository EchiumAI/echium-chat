# Mobile strategy

Decision record for how Echium reaches mobile users. Focus: EU, direct
distribution, zero payment to Apple. Captured 2026-06-23.

## Decision

- **Target market (mobile):** EU first.
- **App stores:** avoid the official Apple App Store and Google Play for now —
  no 15–30% commission, no store billing.
- **Billing:** stays web-first via Paddle (merchant of record). The mobile
  experience does not sell digital goods in-app; users subscribe / top up on
  the web at chat.echium.ai. This keeps us clear of store IAP rules and out of
  any commission.
- **Codebase:** one repo. Mobile reuses the existing `frontend/` React app —
  no separate mobile repo, no UI rewrite.

## How each platform is reached (paying Apple nothing)

| Platform | Approach | Apple/Google cost |
|---|---|---|
| **iOS** | PWA (Safari → Add to Home Screen) | €0 — no Apple involvement at all |
| **Android** | Directly-distributed Capacitor app (signed APK on our site / alt store), plus PWA | €0 — sideloading/direct distribution is allowed |

### Why iOS = PWA (important nuance)

The EU DMA does allow alternative iOS distribution (alternative marketplaces,
web distribution) and external payments. **But** shipping a *native* iOS app
outside the App Store still requires:

- Apple Developer Program enrolment (~€99/yr)
- Accepting Apple's EU alternative business terms
- Notarization of the app
- Possibly Apple's Core Technology Fee / Commission (terms have changed; verify
  current Apple terms before relying on this)

That is not "zero Apple." The only path with **no Apple cost or involvement**
is the PWA, installed from Safari. For a chat product the PWA covers the great
majority of native functionality, so it is our iOS route.

iOS PWA limitations to be aware of:
- Web push works from iOS 16.4+ but is less robust than native push.
- No store listing — discovery is via our own marketing and links.

### Why Android = Capacitor + direct distribution

Android has always permitted sideloading and alternative stores. We can build a
signed Capacitor app from the same React frontend and distribute it directly
(our website, QR code, or an alternative store such as the Samsung Galaxy
Store / Aptoide / F-Droid) with our own (web) billing and no Google cut. We can
also offer the PWA on Android as the lowest-friction option.

## Sequencing

Mobile is **not** the current priority. Order of work:

1. Unblock chat (Bedrock access) — nothing is testable until then.
2. Finish web billing (Paddle) + usage enforcement.
3. Promote the **PWA install** as the interim "mobile app" — already works,
   zero extra build, both platforms, global.
4. Add **Capacitor** for a directly-distributed Android app when the web
   product is stable and there's demand for native features.

## Trade-offs accepted

- **Reach/discovery:** no official store listings, so installs come from our own
  channels, not store search. Acceptable for an EU, direct-to-user launch.
- **iOS native features:** deferred — PWA limits (push robustness, some device
  APIs). Revisit only if a concrete need appears.
- **Global expansion:** outside the EU, direct iOS distribution is not
  available; non-EU iOS users would use the PWA (or we revisit the App Store).

## Open items

- Confirm current Apple EU terms/fees before any native iOS distribution.
- Apple Developer (€99/yr) and Google Play (€25 one-time) accounts are **not**
  needed under this plan; only revisit if we change course on stores.
- PWA polish for mobile: install prompts, offline behaviour, iOS push (16.4+).
