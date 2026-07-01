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

## Build + sign (CI)  — implemented in `.github/workflows/android.yml`

Triggered on `android-vX.Y.Z` tags (separate from the web `deploy.yml`) or
manual dispatch. Steps:

1. `npm ci` + `npm run build` in `frontend/` (produces `dist`).
2. `npx cap add android` + `npx cap sync android` (native project regenerated,
   not committed).
3. `./gradlew assembleRelease` → unsigned release APK.
4. Align + sign with the Android build-tools (`zipalign` then `apksigner`),
   using a keystore decoded from secrets — no edits to the generated Gradle
   files needed:
   - `ANDROID_KEYSTORE_BASE64` (the .jks, base64-encoded)
   - `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`
5. Publish to S3 (via OIDC role) and invalidate CloudFront `/downloads/*`:
   - versioned, immutable: `downloads/echium-<tag>.apk`
   - stable pointer (short TTL): `downloads/echium-latest.apk`
   Both served at `https://chat.echium.ai/downloads/…`. The APK is also
   attached as a workflow artifact.

### Keystore (one-time, owner)

Generate a release keystore and store it (never commit it):
```
keytool -genkeypair -v -keystore echium-release.jks -keyalg RSA -keysize 2048 \
  -validity 10000 -alias echium
```
Base64 it for the GitHub secret: `base64 -w0 echium-release.jks`.
Add the four secrets above to the repo (Settings → Secrets → Actions).
Back up the keystore securely — losing it means a new app identity.

## Distribution + website link  — implemented

- Public `/download` page (`frontend/src/pages/PublicDownloadPage.tsx`), routed
  outside the auth gate like `/pricing`: Android "Download for Android" button
  (→ `VITE_APP_ANDROID_APK_URL` or the default
  `https://chat.echium.ai/downloads/echium-latest.apk`) + iOS "Add to Home
  Screen" steps + an install note (enable "install unknown apps").
- Linked from `PublicFooter` (label `download.navLabel`). i18n keys `download.*`
  in en/ja/es/fr/de/it/pt-br.
- Optional later: a QR code to the APK for easy phone install.

## Hosting infra  — implemented in `cdk/lib/constructs/frontend.ts`

- A **separate `DownloadsBucket`** (private, OAC) holds the APKs, kept apart
  from the web `AssetBucket` because the web build deploy prunes that bucket and
  would otherwise wipe uploaded APKs.
- A CloudFront `additionalBehaviors["/downloads/*"]` serves the downloads bucket
  over HTTPS. Stack outputs `DownloadsBucketName` and `DistributionId` let the
  Android workflow find the upload target and issue the invalidation.

## iOS (PWA) — implemented

iOS ships as an installable **PWA** (Add to Home Screen) — zero Apple cost, no
Developer account. Completed:

- **`apple-*` meta tags** in `frontend/index.html`
  (`apple-mobile-web-app-capable`, `-status-bar-style`, `-title`, and
  `apple-touch-icon`) so "Add to Home Screen" launches Echium full-screen with
  the right title and icon. iOS ignores the web manifest for standalone launch,
  so these tags — not the manifest — are what matter on iOS.
- **Web app manifest** (`frontend/vite.config.ts`) aligned to the "Echium AI"
  brand with `id`/`scope`/`start_url` `/`, `standalone` display,
  `background_color`, and full icon set (drives Android PWA install + install
  banners).
- **`/download` page** gives iOS users the Add-to-Home-Screen steps.

### Native iOS (parked — needs a Mac + Apple account)

A genuine native iOS app (Capacitor iOS) is **not** built: it requires macOS +
Xcode to compile and an Apple Developer Program membership (~€99/yr) plus
signing certs/provisioning profiles for distribution — and EU alternative
distribution still involves Apple terms. Revisit only if the PWA proves
insufficient.

## Decisions (resolved)

- **iOS path:** PWA only (Add to Home Screen). Apple EU Web Distribution parked.
- **`android/` project:** generated in CI, not committed (gitignored) until
  custom native code is needed.
- **APK hosting:** separate S3 bucket + CloudFront `/downloads/*` behavior on
  the existing `chat.echium.ai` distribution.

