import React, { ReactNode, cloneElement, ReactElement } from 'react';
import { BaseProps } from '../@types/common';
import { Authenticator } from '@aws-amplify/ui-react';
import { useTranslation } from 'react-i18next';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { SocialProvider } from '../@types/auth';

type Props = BaseProps & {
  socialProviders: SocialProvider[];
  children: ReactNode;
};

const AuthAmplify: React.FC<Props> = ({ socialProviders, children }) => {
  const { t } = useTranslation();
  const { signOut } = useAuthenticator();

  return (
    <div className="auth-dark relative flex min-h-dvh flex-col items-center justify-center overflow-hidden bg-zinc-900 px-6 py-12">
      {/* Soft brand-purple radial glow anchored to the top of the screen.
          Pure decoration — kept under -z-0 so it never intercepts input. */}
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

      {/* Authenticator card */}
      <div className="relative z-10 w-full max-w-sm">
        <Authenticator
          socialProviders={socialProviders}
          formFields={{
            signIn: {
              username: {
                label: t('auth.email.label'),
                placeholder: t('auth.email.placeholder'),
                type: 'email',
              },
            },
            signUp: {
              username: {
                label: t('auth.email.label'),
                placeholder: t('auth.email.placeholder'),
                type: 'email',
                order: 1,
              },
              password: {
                label: t('auth.password.label'),
                placeholder: t('auth.password.placeholder'),
                order: 2,
              },
              confirm_password: {
                label: t('auth.confirmPassword.label'),
                placeholder: t('auth.confirmPassword.placeholder'),
                order: 3,
              },
            },
            forgotPassword: {
              username: {
                label: t('auth.email.label'),
                placeholder: t('auth.email.placeholder'),
                type: 'email',
              },
            },
            confirmResetPassword: {
              password: {
                label: t('auth.newPassword.label'),
                placeholder: t('auth.newPassword.placeholder'),
              },
              confirm_password: {
                label: t('auth.confirmPassword.label'),
                placeholder: t('auth.confirmPassword.placeholder'),
              },
            },
          }}>
          <>{cloneElement(children as ReactElement, { signOut })}</>
        </Authenticator>
      </div>

      {/* Feature pills below the auth card */}
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
  );
};

export default AuthAmplify;
