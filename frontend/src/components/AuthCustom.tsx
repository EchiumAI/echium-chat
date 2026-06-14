import React, {
  ReactNode,
  useState,
  useEffect,
  cloneElement,
  ReactElement,
} from 'react';
import Button from './Button';
import { BaseProps } from '../@types/common';
import { getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth';
import { useTranslation } from 'react-i18next';
import { PiCircleNotch } from 'react-icons/pi';

type Props = BaseProps & {
  children: ReactNode;
};

const AuthCustom: React.FC<Props> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  useEffect(() => {
    getCurrentUser()
      .then(() => {
        setAuthenticated(true);
      })
      .catch(() => {
        setAuthenticated(false);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const handleSignIn = () => {
    signInWithRedirect({
      provider: {
        custom: import.meta.env.VITE_APP_CUSTOM_PROVIDER_NAME,
      },
    });
  };

  const handleSignOut = () => {
    signOut();
  };

  return (
    <>
      {loading ? (
        <div className="flex flex-col items-center p-4">
          <div className="mb-3 text-4xl">Loading...</div>
          <div className="animate-spin">
            <PiCircleNotch size={100} />
          </div>
        </div>
      ) : !authenticated ? (
        <div className="auth-dark relative flex min-h-dvh items-center justify-center overflow-hidden bg-zinc-900 px-6 py-12">
          {/* Soft brand-purple radial glow at the top of the screen. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_70%)]"
          />

          {/* Single column: hero, sign-in button, feature pills, origin badge —
              all sharing the same width so visual edges line up. */}
          <div className="relative z-10 flex w-full max-w-sm flex-col items-center">
            {/* Hero */}
            <div className="mb-10 flex flex-col items-center text-center">
              <img
                src="/images/echium_icon_192.png"
                alt=""
                className="mb-6 size-16 rounded-2xl shadow-xl shadow-purple-900/30 ring-1 ring-white/10"
              />
              <h1 className="text-4xl font-light tracking-tight text-white">
                {t('auth.hero.title')}
              </h1>
              <p className="mt-4 text-balance text-base leading-relaxed text-white/60">
                {t('auth.hero.subtitle')}
              </p>
            </div>

            {/* Sign-in button */}
            <Button
              onClick={() => handleSignIn()}
              className="mt-2 rounded-xl border-0 bg-aws-sea-blue-light px-12 py-2 text-base font-medium text-white hover:bg-aws-sea-blue-hover-light hover:brightness-100">
              {t('signIn.button.login')}
            </Button>

            {/* Feature pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/50">
              <span>{t('auth.features.multiModel')}</span>
              <span aria-hidden className="text-white/25">
                ·
              </span>
              <span>{t('auth.features.knowledgeBases')}</span>
              <span aria-hidden className="text-white/25">
                ·
              </span>
              <span>{t('auth.features.agents')}</span>
            </div>

            {/* Origin badge */}
            <div className="mt-5 flex items-center justify-center gap-2 text-[11px] uppercase tracking-wider text-white/40">
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
        </div>
      ) : (
        // Pass the signOut function to the child component
        <>
          {cloneElement(children as ReactElement, { signOut: handleSignOut })}
        </>
      )}
    </>
  );
};

export default AuthCustom;
