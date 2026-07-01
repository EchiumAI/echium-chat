import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  PiArrowRight,
  PiAndroidLogo,
  PiAppleLogo,
  PiDownloadSimple,
} from 'react-icons/pi';
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher';
import PublicFooter from '../components/PublicFooter';

/** Public APK download URL (latest signed build). Overridable per environment;
 *  the Android CI workflow publishes to this path. */
const APK_URL: string =
  import.meta.env.VITE_APP_ANDROID_APK_URL ??
  'https://chat.echium.ai/downloads/echium-latest.apk';

/**
 * Public, unauthenticated download page at `/download`.
 *
 * Android: direct APK download (installed outside Google Play). iOS: PWA
 * "Add to Home Screen" instructions (no App Store). See
 * docs/ops/mobile-strategy.md.
 */
const PublicDownloadPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${t('download.title')} · ${t('app.name')}`;
  }, [t]);

  return (
    <div className="auth-dark relative min-h-dvh overflow-hidden bg-zinc-900 px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col">
        {/* Header */}
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

        {/* Intro */}
        <div className="max-w-2xl">
          <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
            {t('download.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            {t('download.intro')}
          </p>
        </div>

        {/* Cards */}
        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {/* Android */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 flex items-center gap-2 text-white">
              <PiAndroidLogo aria-hidden className="size-6 text-violet-300" />
              <h2 className="text-lg font-medium">{t('download.android.title')}</h2>
            </div>
            <p className="mb-5 flex-1 text-sm leading-relaxed text-white/55">
              {t('download.android.body')}
            </p>
            <a
              href={APK_URL}
              className="group flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-violet-500">
              <PiDownloadSimple aria-hidden className="size-4" />
              {t('download.android.cta')}
            </a>
            <p className="mt-3 text-xs text-white/40">
              {t('download.android.note')}
            </p>
          </div>

          {/* iOS */}
          <div className="flex flex-col rounded-2xl border border-white/10 bg-white/5 p-6">
            <div className="mb-3 flex items-center gap-2 text-white">
              <PiAppleLogo aria-hidden className="size-6 text-violet-300" />
              <h2 className="text-lg font-medium">{t('download.ios.title')}</h2>
            </div>
            <p className="mb-4 text-sm leading-relaxed text-white/55">
              {t('download.ios.body')}
            </p>
            <ol className="flex-1 list-decimal space-y-1.5 pl-5 text-sm text-white/70">
              <li>{t('download.ios.step1')}</li>
              <li>{t('download.ios.step2')}</li>
              <li>{t('download.ios.step3')}</li>
            </ol>
          </div>
        </div>

        <PublicFooter />
      </div>
    </div>
  );
};

export default PublicDownloadPage;
