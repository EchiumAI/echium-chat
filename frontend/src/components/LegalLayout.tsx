import React, { ReactNode, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { PiArrowLeft } from 'react-icons/pi';
import PublicFooter from './PublicFooter';

type Props = {
  /** Page heading, e.g. "Terms of Service". */
  title: string;
  /** ISO date shown as "Last updated". */
  lastUpdated: string;
  children: ReactNode;
};

/**
 * Shared chrome for the public legal pages (Terms, Refund, Privacy).
 *
 * These pages live outside the auth gate so they are reachable by prospects
 * and by the payment provider's review team. Content is intentionally kept in
 * English only for now: legal copy should be reviewed by a professional before
 * launch, and machine-translating it across locales would create risk. The
 * `auth-dark` surface matches the rest of the pre-auth experience.
 */
const LegalLayout: React.FC<Props> = ({ title, lastUpdated, children }) => {
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${title} · Echium AI`;
  }, [title]);

  return (
    <div className="auth-dark relative min-h-dvh overflow-hidden bg-zinc-900 px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.18),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-3xl flex-col">
        {/* Header */}
        <header className="mb-10 flex items-center justify-between gap-4">
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
              Echium AI
            </span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-sm text-white/60 transition-colors hover:text-white/90">
            <PiArrowLeft aria-hidden className="size-4" />
            Home
          </button>
        </header>

        {/* Title */}
        <h1 className="text-3xl font-light tracking-tight text-white sm:text-4xl">
          {title}
        </h1>
        <p className="mt-2 text-sm text-white/40">Last updated: {lastUpdated}</p>

        {/* Template notice — remove once reviewed by a lawyer. */}
        <div className="mt-6 rounded-lg border border-amber-400/20 bg-amber-400/5 px-4 py-3 text-sm text-amber-200/80">
          This document is a template and has not yet been reviewed by a legal
          professional. It should be reviewed before relying on it.
        </div>

        {/* Body */}
        <div className="mt-8 space-y-6 pb-10 text-sm leading-relaxed text-white/70">
          {children}
        </div>

        {/* Footer — cross-links to pricing, pay-as-you-go and the other legal
            pages, so every legal page links onward. */}
        <PublicFooter />
      </div>
    </div>
  );
};

export default LegalLayout;
