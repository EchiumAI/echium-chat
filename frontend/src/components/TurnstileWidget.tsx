import React, { useEffect, useRef } from 'react';
import {
  TURNSTILE_SITE_KEY,
  getTurnstileWidgetId,
  loadTurnstileScript,
  setTurnstileToken,
  setTurnstileWidgetId,
} from '../utils/turnstile';

// Cloudflare Turnstile CAPTCHA shown on the sign-up form. This is only the
// user-facing half: the Cognito pre sign-up trigger verifies the token and
// rejects sign-ups without one, so scripts that skip this form are blocked.
const TurnstileWidget: React.FC = () => {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) {
      return;
    }
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !ref.current || !window.turnstile) {
          return;
        }
        widgetId = window.turnstile.render(ref.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'dark',
          callback: (token) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
        setTurnstileWidgetId(widgetId);
      })
      .catch(() => {
        // Without the widget the server rejects the sign-up with a clear
        // "security check failed" message, so nothing else to do here.
      });
    return () => {
      cancelled = true;
      setTurnstileToken('');
      if (widgetId && window.turnstile) {
        window.turnstile.remove(widgetId);
      }
      if (getTurnstileWidgetId() === widgetId) {
        setTurnstileWidgetId(undefined);
      }
    };
  }, []);

  if (!TURNSTILE_SITE_KEY) {
    return null;
  }
  return <div ref={ref} className="mt-2 flex justify-center" />;
};

export default TurnstileWidget;
