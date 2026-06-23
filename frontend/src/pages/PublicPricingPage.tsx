import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PiArrowRight } from 'react-icons/pi';
import PricingPlans from '../components/PricingPlans';
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher';

/**
 * Public, unauthenticated pricing page at `/pricing`.
 *
 * Lives outside the auth gate (see routes.tsx) so prospective customers — and
 * payment-provider reviewers (Paddle requires a publicly reachable pricing
 * page) — can see plans without signing in. Reuses the same data-driven,
 * localized PricingPlans grid as the landing. Plan CTAs route into the app at
 * `/`, which presents the sign-in flow; real checkout is wired in a later
 * phase.
 */
const PublicPricingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${t('pricing.title')} · ${t('app.name')}`;
  }, [t]);

  return (
    <div className="auth-dark relative min-h-dvh overflow-hidden bg-zinc-900 px-6 py-10">
      {/* Soft brand-purple radial glow at the top — decorative only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col">
        {/* Header: logo (→ home) · language switcher · sign in */}
        <header className="mb-12 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-2.5 text-left">
            <img
              src="/images/echium_icon_192.png"
              alt=""
              className="size-9 rounded-xl shadow-lg shadow-purple-900/30 ring-1 ring-white/10"
            />
            <span className="text-lg font-light tracking-tight text-white">
              {t('auth.hero.title')}
            </span>
          </button>

          <div className="flex items-center gap-3">
            <AuthLanguageSwitcher />
            <button
              type="button"
              onClick={() => navigate('/')}
              className="hidden items-center gap-1.5 rounded-lg border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-white transition-colors hover:bg-white/10 sm:flex">
              {t('landing.signIn')}
              <PiArrowRight aria-hidden className="size-3.5" />
            </button>
          </div>
        </header>

        {/* Pricing grid */}
        <PricingPlans onSelectPlan={() => navigate('/')} />

        {/* Footer CTA */}
        <div className="mt-12 flex flex-col items-center text-center">
          <button
            type="button"
            onClick={() => navigate('/')}
            className="group flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-900">
            {t('landing.getStarted')}
            <PiArrowRight
              aria-hidden
              className="size-4 transition-transform group-hover:translate-x-0.5"
            />
          </button>
        </div>
      </div>
    </div>
  );
};

export default PublicPricingPage;
