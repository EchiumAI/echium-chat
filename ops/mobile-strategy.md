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

---

# Android implementation plan (Capacitor)

Concrete spec for building and distributing the Android app. Lives in the
**existing `frontend/` repo** (the app wraps the same React web build).

## Architecture

- **Capacitor** wraps the built web app (`frontend/dist`) in a native Android
  shell. The shell loads the bundled SPA, which talks to the same backend
  (`VITE_APP_API_ENDPOINT` / WebSocket) as the website. No separate API.
- App id: `ai.echium.chat` (reverse-DNS). App name: `Echium AI`.
- Billing stays web-first (Paddle overlay opens in the in-app browser/Custom
  Tab). Nothing is sold through Google Play — no Play Billing, no cut.

## Repo additions

- `frontend/capacitor.config.ts` — Capacitor config (appId, appName,
  `webDir: 'dist'`).
- Capacitor deps in `frontend/package.json`: `@capacitor/core`,
  `@capacitor/cli`, `@capacitor/android`.
- `frontend/android/` — the native Gradle project. **Decision:** generate it in
  CI (`npx cap add android`) rather than committing it, to keep the repo clean,
  unless/until we need custom native code (then commit it).

## Build + sign (CI)

A dedicated GitHub Actions workflow (`.github/workflows/android.yml`),
triggered on tags like `android-v*` (separate from the web `deploy.yml`):

1. `npm ci` + `npm run build` (produces `dist`)
2. `npx cap add android` (if not committed) + `npx cap sync android`
3. `./gradlew assembleRelease` in `android/`
4. Sign the APK with a keystore from secrets:
   - `ANDROID_KEYSTORE_BASE64` (the .jks, base64-encoded)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
5. Publish the signed APK to a public, versioned location (S3 + CloudFront,
   e.g. `https://chat.echium.ai/downloads/echium-<version>.apk` and a stable
   `echium-latest.apk`).

### Keystore (one-time, owner)

Generate a release keystore and store it (never commit it):
```
keytool -genkeypair -v -keystore echium-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias echium
```
Base64 it for the GitHub secret: `base64 -w0 echium-release.jks`.
Add the four secrets above to the repo (Settings → Secrets → Actions).
Back up the keystore securely — losing it means a new app identity.

## Distribution + website link

- A public `/download` page on the site (outside the auth gate, like
  `/pricing`): Android "Download APK" button (→ the published APK URL) +
  iOS "Add to Home Screen" instructions + a note that the APK is installed
  outside Google Play (enable "install unknown apps").
- Link `/download` from the public footer and the landing.
- Optional later: a QR code to the APK for easy phone install.

## iOS (unchanged)

iOS stays the **PWA** (Add to Home Screen). The `/download` page gives iOS
users the install instructions. Revisit Apple EU Web Distribution (needs the
€99/yr Apple Developer account) only if a true downloadable iOS app is needed.

## Decisions still open

- **iOS path:** (A) PWA only [default] vs (B) Apple EU Web Distribution.
- **Commit `android/` or generate in CI:** default generate-in-CI until custom
  native code is needed.
- **APK hosting path:** new S3 bucket + CloudFront behaviour under
  `chat.echium.ai/downloads/*`, or a separate `downloads.echium.ai`.
