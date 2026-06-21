import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  PiStackSimple,
  PiBooks,
  PiShieldCheck,
  PiArrowRight,
} from 'react-icons/pi';
import AuthLanguageSwitcher from './AuthLanguageSwitcher';

type Props = {
  /** Primary CTA handler — reveals the sign-in form (Amplify) or starts the
   *  hosted-UI redirect (custom provider). */
  onGetStarted: () => void;
  /** Optional secondary "sign in" handler. When omitted, only the primary CTA
   *  is shown (both actions live behind the same form anyway). */
  onSignIn?: () => void;
};

/**
 * Pre-auth landing view (Option A): leads with what Echium is — hero, a
 * static chat preview, and a few feature highlights — before surfacing the
 * sign-in form. Solves the "login wall with no context" first impression.
 *
 * Mobile-first: single centered column that scrolls top-to-bottom on phones,
 * with type and spacing scaling up at the `sm`/`md` breakpoints. No fixed
 * widths on text containers so longer translations (de/fr ~30% longer than
 * en) wrap instead of overflowing. The chat preview is purely decorative
 * markup — no backend call, no Bedrock, no abuse surface.
 */
const AuthLanding: React.FC<Props> = ({ onGetStarted, onSignIn }) => {
  const { t } = useTranslation();

  const features = [
    {
      icon: PiStackSimple,
      title: t('landing.sections.multiModel.title'),
      description: t('landing.sections.multiModel.description'),
    },
    {
      icon: PiBooks,
      title: t('landing.sections.knowledge.title'),
      description: t('landing.sections.knowledge.description'),
    },
    {
      icon: PiShieldCheck,
      title: t('landing.sections.privacy.title'),
      description: t('landing.sections.privacy.description'),
    },
  ];

  return (
    <div className="relative z-10 flex w-full max-w-md flex-col items-center">
      {/* Language switcher — fixed to the top-right of the viewport so it is
          reachable on every screen size without crowding the hero. */}
      <div className="fixed right-4 top-4 z-20">
        <AuthLanguageSwitcher />
      </div>

      {/* Hero */}
      <div className="mb-8 flex flex-col items-center text-center">
        <img
          src="/images/echium_icon_192.png"
          alt=""
          className="mb-6 size-16 rounded-2xl shadow-xl shadow-purple-900/30 ring-1 ring-white/10"
        />
        <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
          {t('auth.hero.title')}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-white/60">
          {t('auth.hero.subtitle')}
        </p>
      </div>

      {/* Static chat preview — decorative mock of the product so visitors see
          the interface before signing up. */}
      <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4 shadow-2xl shadow-black/30 backdrop-blur-sm">
        <div className="mb-3 flex items-center gap-2">
          <span className="size-2 rounded-full bg-white/20" aria-hidden />
          <span className="size-2 rounded-full bg-white/20" aria-hidden />
          <span className="size-2 rounded-full bg-white/20" aria-hidden />
          <span className="ml-auto text-[10px] uppercase tracking-wider text-white/40">
            {t('landing.preview.label')}
          </span>
        </div>

        {/* User bubble */}
        <div className="mb-3 flex justify-end">
          <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-violet-600/80 px-3.5 py-2 text-left text-sm text-white">
            {t('landing.preview.user')}
          </div>
        </div>

        {/* Assistant bubble */}
        <div className="flex justify-start">
          <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-white/10 px-3.5 py-2 text-left text-sm text-white/80">
            {t('landing.preview.assistant')}
          </div>
        </div>
      </div>

      {/* Primary CTA */}
      <button
        type="button"
        onClick={onGetStarted}
        className="group mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-6 py-3 text-base font-medium text-white transition-colors hover:bg-violet-500 focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-900">
        {t('landing.getStarted')}
        <PiArrowRight
          aria-hidden
          className="size-4 transition-transform group-hover:translate-x-0.5"
        />
      </button>

      {/* Secondary sign-in link */}
      {onSignIn && (
        <p className="mt-3 text-sm text-white/50">
          {t('landing.haveAccount')}{' '}
          <button
            type="button"
            onClick={onSignIn}
            className="font-medium text-violet-300 underline-offset-2 hover:text-violet-200 hover:underline">
            {t('landing.signIn')}
          </button>
        </p>
      )}

      {/* Feature highlights — stacked rows on mobile, comfortable on desktop. */}
      <div className="mt-10 flex w-full flex-col gap-5">
        {features.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex items-start gap-3 text-left">
            <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-violet-500/15 text-violet-300">
              <Icon aria-hidden className="size-4" />
            </span>
            <div>
              <p className="text-sm font-medium text-white/90">{title}</p>
              <p className="mt-0.5 text-sm leading-relaxed text-white/55">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Origin badge — Made in Madrid, European Union */}
      <div className="mt-10 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
        <img
          src="/images/flags/madrid.svg"
          alt="Madrid"
          className="h-3.5 w-auto rounded-sm shadow-sm shadow-black/40"
        />
        <span>{t('auth.origin')}</span>
        <img
          src="/images/flags/eu.svg"
          alt="European Union"
          className="h-3.5 w-auto rounded-sm shadow-sm shadow-black/40"
        />
      </div>
    </div>
  );
};

export default AuthLanding;
