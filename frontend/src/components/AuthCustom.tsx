import React, {
  ReactNode,
  useState,
  useEffect,
  cloneElement,
  ReactElement,
} from 'react';
import { BaseProps } from '../@types/common';
import { getCurrentUser, signInWithRedirect, signOut } from 'aws-amplify/auth';
import { PiCircleNotch } from 'react-icons/pi';
import AuthLanding from './AuthLanding';

type Props = BaseProps & {
  children: ReactNode;
};

const AuthCustom: React.FC<Props> = ({ children }) => {
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

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

          {/* Landing-first (Option A): the CTA starts the hosted-UI redirect
              directly, since the custom provider has no inline form. */}
          <AuthLanding onGetStarted={() => handleSignIn()} />
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
