import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Capacitor config for the Android app (EU, direct-distribution; no Google
 * Play). The native shell wraps the built web app (`dist`), which talks to the
 * same backend as the website. Billing stays web-first (Paddle overlay) — no
 * Play Billing. See docs/ops/mobile-strategy.md.
 */
const config: CapacitorConfig = {
  appId: 'ai.echium.chat',
  appName: 'Echium AI',
  webDir: 'dist',
  server: {
    // Load the live production site directly so the app is always in sync with
    // the deployed frontend and reuses the existing Cognito origin/OAuth config
    // (no per-build env baking needed). Override per-env with CAP_SERVER_URL.
    url: process.env.CAP_SERVER_URL ?? 'https://chat.echium.ai',
    cleartext: false,
  },
  android: {
    // Allow the WebView to reach our HTTPS backend + Paddle.
    allowMixedContent: false,
  },
};

export default config;
