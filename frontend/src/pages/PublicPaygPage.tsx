import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PiArrowRight, PiCheck } from 'react-icons/pi';
import AuthLanguageSwitcher from '../components/AuthLanguageSwitcher';
import PublicFooter from '../components/PublicFooter';
import {
  PAYG_FREE_MONTHLY_MESSAGES,
  PAYG_TOPUPS_EUR,
  PAYG_RATES,
  messagesForCredit,
} from '../constants/plans';

/**
 * Public, unauthenticated Pay-as-you-go detail page at
 * `/pricing/pay-as-you-go`. Segregates the PAYG model from the main pricing
 * grid and gives per-model granularity: how the prepaid credit works, the
 * top-up amounts, and roughly how many messages each top-up buys per model.
 * Numbers are illustrative estimates (see constants/plans.ts).
 */
const PublicPaygPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    document.title = `${t('payg.title')} · ${t('app.name')}`;
  }, [t]);

  const perks = [
    t('payg.perks.allModels'),
    t('payg.perks.noMonthlyFee'),
    t('payg.perks.priority'),
    t('payg.perks.topUpAnytime'),
  ];

  return (
    <div className="auth-dark relative min-h-dvh overflow-hidden bg-zinc-900 px-6 py-10">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-0 bg-[radial-gradient(60%_50%_at_50%_-10%,rgba(124,58,237,0.22),transparent_70%)]"
      />

      <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col">
        {/* Header */}
        <header className="mb-12 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/pricing')}
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
            {t('payg.title')}
          </h1>
          <p className="mt-4 text-base leading-relaxed text-white/60">
            {t('payg.intro', { count: PAYG_FREE_MONTHLY_MESSAGES })}
          </p>
        </div>

        {/* Perks */}
        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {perks.map((perk) => (
            <div key={perk} className="flex items-start gap-2.5 text-sm text-white/75">
              <PiCheck aria-hidden className="mt-0.5 size-4 shrink-0 text-violet-300" />
              <span>{perk}</span>
            </div>
          ))}
        </div>

        {/* Rate table: how many messages each top-up buys per model */}
        <div className="mt-12">
          <h2 className="text-xl font-light text-white">{t('payg.table.title')}</h2>
          <p className="mt-1 text-sm text-white/50">{t('payg.table.subtitle')}</p>

          <div className="mt-5 overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-white/50">
                  <th className="px-4 py-3 font-medium">{t('payg.table.model')}</th>
                  <th className="px-4 py-3 text-right font-medium">
                    {t('payg.table.perMessage')}
                  </th>
                  {PAYG_TOPUPS_EUR.map((amt) => (
                    <th key={amt} className="px-4 py-3 text-right font-medium">
                      €{amt}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {PAYG_RATES.map((rate) => (
                  <tr
                    key={rate.id}
                    className="border-b border-white/5 last:border-0 text-white/80">
                    <td className="px-4 py-3 font-medium text-white">
                      {t(rate.labelKey as never)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-white/60">
                      €{rate.pricePerMessageEur.toFixed(3)}
                    </td>
                    {PAYG_TOPUPS_EUR.map((amt) => (
                      <td
                        key={amt}
                        className="px-4 py-3 text-right tabular-nums">
                        {t('payg.table.messages', {
                          count: messagesForCredit(amt, rate),
                          formatted: messagesForCredit(amt, rate).toLocaleString(),
                        })}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="mt-3 text-xs text-white/40">{t('payg.table.disclaimer')}</p>
        </div>

        {/* CTA */}
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

        <PublicFooter />
      </div>
    </div>
  );
};

export default PublicPaygPage;
