import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PiCheck, PiArrowRight } from 'react-icons/pi';
import { twMerge } from 'tailwind-merge';
import { PLANS, Plan } from '../constants/plans';

type Props = {
  /** Called when a plan CTA is clicked. Until Paddle checkout is wired this
   *  routes through the same sign-in entry point as the rest of the landing;
   *  the selected plan id is passed so we can resume checkout post-auth. */
  onSelectPlan: (planId: Plan['id']) => void;
};

/**
 * Pricing grid for the pre-auth landing. Data-driven from `constants/plans`,
 * fully localized, and mobile-first: cards stack in a single column on phones
 * and fan out to a responsive grid from `sm`/`lg` up. No checkout here yet —
 * the CTA just enters the auth flow; real Paddle overlay checkout arrives in
 * a later phase.
 */
const PricingPlans: React.FC<Props> = ({ onSelectPlan }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const priceLabel = (plan: Plan): string => {
    if (plan.priceEur === null) {
      return t('pricing.usageBased');
    }
    if (plan.priceEur === 0) {
      return t('pricing.free');
    }
    return `€${plan.priceEur}`;
  };

  const capLabel = (plan: Plan): string => {
    if (plan.messagesPerMonth === null) {
      return t('pricing.noCap');
    }
    return t('pricing.messagesPerMonth', {
      count: plan.messagesPerMonth,
      formatted: plan.messagesPerMonth.toLocaleString(),
    });
  };

  return (
    <section className="w-full">
      <div className="mb-8 text-center">
        <h2 className="text-2xl font-light tracking-tight text-white sm:text-3xl">
          {t('pricing.title')}
        </h2>
        <p className="mt-2 text-sm text-white/55">{t('pricing.subtitle')}</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.id}
            className={twMerge(
              'relative flex flex-col rounded-2xl border border-white/10 bg-white/5 p-5 text-left',
              plan.highlighted && 'border-violet-500/50 bg-violet-500/10 ring-1 ring-violet-500/30'
            )}>
            {plan.highlighted && (
              <span className="absolute -top-2.5 left-5 rounded-full bg-violet-500 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-white">
                {t('pricing.popular')}
              </span>
            )}

            <h3 className="text-base font-medium text-white">
              {t(`pricing.plans.${plan.id}.name`)}
            </h3>
            <p className="mt-0.5 text-xs text-white/50">
              {t(`pricing.plans.${plan.id}.tagline`)}
            </p>

            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-2xl font-semibold text-white">
                {priceLabel(plan)}
              </span>
              {plan.priceEur !== null && plan.priceEur > 0 && (
                <span className="text-sm text-white/50">{t('pricing.perMonth')}</span>
              )}
            </div>

            <p className="mt-2 text-xs font-medium text-white/70">
              {capLabel(plan)}
            </p>

            <ul className="mt-4 flex flex-1 flex-col gap-2">
              {plan.featureKeys.map((key) => (
                <li key={key} className="flex items-start gap-2 text-sm text-white/70">
                  <PiCheck
                    aria-hidden
                    className="mt-0.5 size-4 shrink-0 text-violet-300"
                  />
                  {t(key as never)}
                </li>
              ))}
            </ul>

            <button
              type="button"
              onClick={() => onSelectPlan(plan.id)}
              className={twMerge(
                'mt-6 w-full rounded-xl px-4 py-2.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-violet-400 focus:ring-offset-2 focus:ring-offset-zinc-900',
                plan.highlighted
                  ? 'bg-violet-600 text-white hover:bg-violet-500'
                  : 'border border-white/15 bg-white/5 text-white hover:bg-white/10'
              )}>
              {plan.priceEur === 0
                ? t('pricing.cta.start')
                : t('pricing.cta.choose')}
            </button>
          </div>
        ))}
      </div>

      {/* Pay-as-you-go detail link — appears wherever the grid is shown. */}
      <div className="mt-6 text-center">
        <button
          type="button"
          onClick={() => navigate('/pricing/pay-as-you-go')}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-violet-300 transition-colors hover:text-violet-200">
          {t('payg.linkLabel')}
          <PiArrowRight aria-hidden className="size-3.5" />
        </button>
      </div>
    </section>
  );
};

export default PricingPlans;
