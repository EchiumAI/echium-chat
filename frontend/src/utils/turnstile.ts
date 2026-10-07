// Cloudflare Turnstile CAPTCHA helpers for the sign-up form. The token is sent
// with the sign-up request and verified server-side by the Cognito pre
// sign-up trigger, which rejects sign-ups without a valid token.

export const TURNSTILE_SITE_KEY: string =
  import.meta.env.VITE_APP_TURNSTILE_SITE_KEY ?? '';

const SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export type TurnstileApi = {
  render: (
    el: HTMLElement,
    options: {
      sitekey: string;
      theme?: 'light' | 'dark' | 'auto';
      callback?: (token: string) => void;
      'expired-callback'?: () => void;
      'error-callback'?: () => void;
    }
  ) => string;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

// Latest token and widget. Tokens are single-use, so the sign-up handler
// takes (clears) the token and resets the widget after every attempt.
let currentToken = '';
let currentWidgetId: string | undefined;

export const setTurnstileToken = (token: string) => {
  currentToken = token;
};

export const setTurnstileWidgetId = (widgetId: string | undefined) => {
  currentWidgetId = widgetId;
};

export const getTurnstileWidgetId = () => currentWidgetId;

export const takeTurnstileToken = (): string => {
  const token = currentToken;
  currentToken = '';
  if (window.turnstile && currentWidgetId) {
    window.turnstile.reset(currentWidgetId);
  }
  return token;
};

let scriptPromise: Promise<void> | null = null;

export const loadTurnstileScript = (): Promise<void> => {
  if (window.turnstile) {
    return Promise.resolve();
  }
  if (!scriptPromise) {
    scriptPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = SCRIPT_URL;
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => {
        scriptPromise = null;
        reject(new Error('Failed to load Turnstile'));
      };
      document.head.appendChild(script);
    });
  }
  return scriptPromise;
};
