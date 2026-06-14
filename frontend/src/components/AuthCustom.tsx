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
        <div className="auth-dark relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-zinc-900 px-6 py-12">
          {/* Soft brand-purple radial glow at the top of the screen. */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_70%)]"
          />

          {/* Hero */}
          <div className="relative z-10 mb-10 flex max-w-md flex-col items-center text-center">
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
            className="relative z-10 mt-2 rounded-xl border-0 bg-aws-sea-blue-light px-12 py-2 text-base font-medium text-white hover:bg-aws-sea-blue-hover-light hover:brightness-100">
            {t('signIn.button.login')}
          </Button>

          {/* Feature pills */}
          <div className="relative z-10 mt-8 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs text-white/50">
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
