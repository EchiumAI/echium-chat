import { PlanId } from '../constants/plans';

export interface SubscriptionCapabilities {
  modelTiers: string[];
  webSearch: boolean;
  agents: boolean;
  knowledgeBases: boolean;
  fileUpload: boolean;
}

/** Response shape of GET /subscription. */
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
