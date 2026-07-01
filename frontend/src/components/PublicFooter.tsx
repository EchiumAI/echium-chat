import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

/**
 * Footer for the public (unauthenticated) pages: pricing, pay-as-you-go, and
 * landing. Provides navigation to the legal pages that the payment provider
 * requires to be publicly reachable, plus a link to the pay-as-you-go detail
 * page. Links use the router so they stay within the SPA.
 */
const PublicFooter: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const links: { labelKey: string; path: string }[] = [
    { labelKey: 'pricing.title', path: '/pricing' },
    { labelKey: 'payg.linkLabel', path: '/pricing/pay-as-you-go' },
    { labelKey: 'download.navLabel', path: '/download' },
    { labelKey: 'legal.terms', path: '/terms' },
    { labelKey: 'legal.privacy', path: '/privacy' },
    { labelKey: 'legal.refund', path: '/refund-policy' },
  ];

  return (
    <footer className="relative z-10 mt-16 border-t border-white/10 pt-8">
      <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-white/50">
        {links.map(({ labelKey, path }) => (
          <button
            key={path}
            type="button"
            onClick={() => navigate(path)}
            className="transition-colors hover:text-white/80">
            {t(labelKey as never)}
          </button>
        ))}
      </nav>
      <p className="mt-5 text-center text-[11px] text-white/30">
        {t('legal.copyright', { year: new Date().getFullYear() })}
      </p>
    </footer>
  );
};

export default PublicFooter;
