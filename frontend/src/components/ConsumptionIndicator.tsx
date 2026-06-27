import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import useSubscription from '../hooks/useSubscription';

type Props = {
  /** Compact variant for the chat header; full variant for the billing page. */
  variant?: 'compact' | 'full';
};

/**
 * Live consumption readout backed by GET /subscription.
 *
 * Fixed plans show messages used / monthly limit with a progress bar.
 * Pay-as-you-go shows the prepaid credit balance. Revalidates on focus (and
 * callers can refresh after sending a message) so it stays roughly current.
 */
const ConsumptionIndicator: React.FC<Props> = ({ variant = 'compact' }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { subscription } = useSubscription();

  if (!subscription) {
    return null;
  }

  const { plan, messagesUsed, messagesLimit, creditBalanceEur, meteredOverage } =
    subscription;

  const isPayg = meteredOverage || messagesLimit === null;

  // Progress + low-balance state for styling.
  const pct =
    messagesLimit && messagesLimit > 0
      ? Math.min(100, Math.round((messagesUsed / messagesLimit) * 100))
      : 0;
  const nearLimit = !isPayg && pct >= 80;

  const planLabel = t(`pricing.plans.${plan}.name` as never);

  if (variant === 'compact') {
    return (
      <button
        type="button"
        onClick={() => navigate('/account')}
        title={t('consumption.viewBilling')}
        className="flex items-center gap-2 rounded-lg px-2 py-1 text-xs text-aws-font-color-light/70 transition-colors hover:bg-light-gray dark:text-aws-font-color-dark/70 dark:hover:bg-aws-ui-color-dark">
        <span className="font-medium">{planLabel}</span>
        <span className="opacity-50">·</span>
        {isPayg ? (
          <span className={creditBalanceEur <= 0 ? 'text-red' : ''}>
            €{creditBalanceEur.toFixed(2)}
          </span>
        ) : (
          <span className={nearLimit ? 'text-amber-500' : ''}>
            {messagesUsed}
            {messagesLimit !== null ? `/${messagesLimit}` : ''}
          </span>
        )}
      </button>
    );
  }

  // Full variant
  return (
    <div className="rounded-xl border border-light-gray p-4 dark:border-aws-ui-color-dark">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-medium">{planLabel}</span>
        {isPayg ? (
          <span
            className={`text-sm ${creditBalanceEur <= 0 ? 'text-red' : ''}`}>
            {t('consumption.creditBalance')}: €{creditBalanceEur.toFixed(2)}
          </span>
        ) : (
          <span className={`text-sm ${nearLimit ? 'text-amber-500' : ''}`}>
            {t('consumption.messagesUsed', {
              used: messagesUsed,
              limit: messagesLimit,
            })}
          </span>
        )}
      </div>
      {!isPayg && messagesLimit !== null && (
        <div className="h-2 w-full overflow-hidden rounded-full bg-light-gray dark:bg-aws-ui-color-dark">
          <div
            className={`h-full rounded-full ${
              nearLimit ? 'bg-amber-500' : 'bg-violet-500'
            }`}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}
    </div>
  );
};

export default ConsumptionIndicator;
