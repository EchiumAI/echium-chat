import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { PiArrowSquareOut } from 'react-icons/pi';
import useSubscription from '../hooks/useSubscription';
import usePaddle from '../hooks/usePaddle';
import ConsumptionIndicator from '../components/ConsumptionIndicator';
import Button from '../components/Button';
import { PLANS } from '../constants/plans';
import {
  PADDLE_PLAN_PRICE_IDS,
  PADDLE_TOPUP_PRICE_IDS,
} from '../constants/paddle';

/**
 * In-app billing & usage page (/account). Shows the current plan, live usage
 * (via ConsumptionIndicator), upgrade options, and pay-as-you-go credit
 * top-ups. Checkout opens as a Paddle overlay without leaving the app.
 */
const AccountBillingPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subscription } = useSubscription();
  const { ready, openCheckout } = usePaddle();

  const currentPlan = subscription?.plan ?? 'free';

  // Upgrade targets: paid subscription plans other than the current one that
  // have a Paddle price id.
  const upgradePlans = PLANS.filter(
    (p) => p.id !== currentPlan && PADDLE_PLAN_PRICE_IDS[p.id]
  );

  const topupAmounts = Object.keys(PADDLE_TOPUP_PRICE_IDS)
    .map(Number)
    .sort((a, b) => a - b);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-light tracking-tight">
          {t('billing.title')}
        </h1>
        <button
          type="button"
          onClick={() => navigate('/pricing')}
          className="inline-flex items-center gap-1.5 text-sm text-violet-500 hover:text-violet-400">
          {t('billing.comparePlans')}
          <PiArrowSquareOut className="size-3.5" aria-hidden />
        </button>
      </div>

      {/* Current usage */}
      <ConsumptionIndicator variant="full" />

      {/* Upgrade options */}
      {upgradePlans.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium opacity-70">
            {t('billing.changePlan')}
          </h2>
          <div className="flex flex-col gap-2">
            {upgradePlans.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl border border-light-gray p-4 dark:border-aws-ui-color-dark">
                <div>
                  <div className="font-medium">
                    {t(`pricing.plans.${p.id}.name` as never)}
                  </div>
                  <div className="text-sm opacity-60">
                    {p.priceEur !== null ? `€${p.priceEur}/mo` : ''}
                  </div>
                </div>
                <Button
                  outlined
                  disabled={!ready}
                  onClick={() => openCheckout(PADDLE_PLAN_PRICE_IDS[p.id]!)}>
                  {t('billing.choose')}
                </Button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pay-as-you-go top-ups */}
      <section>
        <h2 className="mb-1 text-sm font-medium opacity-70">
          {t('billing.addCredit')}
        </h2>
        <p className="mb-3 text-xs opacity-50">{t('billing.addCreditHint')}</p>
        <div className="flex flex-wrap gap-2">
          {topupAmounts.map((amt) => (
            <Button
              key={amt}
              outlined
              disabled={!ready}
              onClick={() => openCheckout(PADDLE_TOPUP_PRICE_IDS[amt])}>
              €{amt}
            </Button>
          ))}
        </div>
      </section>
    </div>
  );
};

export default AccountBillingPage;
