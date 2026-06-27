import useHttp from './useHttp';
import { PlanId, ModelTier } from '../constants/plans';

export interface SubscriptionCapabilities {
  modelTiers: ModelTier[];
  webSearch: boolean;
  agents: boolean;
  knowledgeBases: boolean;
  fileUpload: boolean;
}

export interface SubscriptionOverview {
  plan: PlanId;
  status: string;
  period: string;
  messagesUsed: number;
  /** null => unlimited (pay-as-you-go). */
  messagesLimit: number | null;
  messagesRemaining: number | null;
  meteredOverage: boolean;
  creditBalanceEur: number;
  costThisPeriodEur: number;
  capabilities: SubscriptionCapabilities;
}

/**
 * Current user's plan, usage this period, credit balance and entitlements.
 * Backs the in-chat consumption indicator and the billing page. Revalidates
 * on focus so the meter stays roughly current as messages are sent.
 */
const useSubscription = () => {
  const http = useHttp();
  const { data, error, isLoading, mutate } = http.get<SubscriptionOverview>(
    '/subscription',
    {
      revalidateOnFocus: true,
      revalidateIfStale: true,
    }
  );

  return {
    subscription: data,
    isLoading,
    error,
    /** Call after sending a message to refresh the meter. */
    refresh: mutate,
  };
};

export default useSubscription;
