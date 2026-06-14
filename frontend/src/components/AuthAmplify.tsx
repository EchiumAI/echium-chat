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
    <div className="auth-dark flex min-h-dvh flex-col items-center justify-center bg-zinc-900 px-6 py-10">
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
        }}
        components={{
          Header: () => (
            <div className="mb-6 flex items-center justify-center gap-3">
              <img
                src="/images/echium_icon_192.png"
                alt=""
              className="size-12 rounded-full shadow-lg shadow-white/10"
              />
              <div className="text-3xl font-medium tracking-wide text-white/60">
                {t('app.name')}
              </div>
            </div>
          ),
        }}>
        <>{cloneElement(children as ReactElement, { signOut })}</>
      </Authenticator>
    </div>
  );
};

export default AuthAmplify;
