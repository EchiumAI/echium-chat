/**
 * Subscription plan definitions — the single source of truth for the pricing
 * UI. Structural facts (price, caps, model access, feature flags) live here;
 * all display text is resolved via i18n keys so the table stays localizable.
 *
 * NOTE: these numbers are an initial proposal pending a margin review. The
 * caps and model gates are what protect per-tier margin against inference
 * cost, so treat changes here as commercial decisions, not cosmetics. When
 * the backend enforcement layer lands it should import this same module so
 * the limits shown to users and the limits enforced never drift apart.
 */

export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'max' | 'payg';

export interface Plan {
  id: PlanId;
  /** Monthly price in EUR. null = usage-based (PAYG). */
  priceEur: number | null;
  /** Included messages per month. null = no cap (PAYG). */
  messagesPerMonth: number | null;
  /** i18n keys (under `pricing.features.*`) describing what the plan unlocks. */
  featureKeys: string[];
  /** Visually emphasise this plan in the grid. */
  highlighted?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: 'free',
    priceEur: 0,
    messagesPerMonth: 50,
    featureKeys: ['pricing.features.modelsBasic'],
  },
  {
    id: 'starter',
    priceEur: 5,
    messagesPerMonth: 500,
    featureKeys: ['pricing.features.modelsSonnet', 'pricing.features.knowledgeBases'],
  },
  {
    id: 'pro',
    priceEur: 20,
    messagesPerMonth: 2000,
    featureKeys: [
      'pricing.features.modelsOpus',
      'pricing.features.knowledgeBases',
      'pricing.features.agents',
      'pricing.features.fileUpload',
    ],
    highlighted: true,
  },
  {
    id: 'business',
    priceEur: 100,
    messagesPerMonth: 12000,
    featureKeys: [
      'pricing.features.modelsAll',
      'pricing.features.agents',
      'pricing.features.fileUpload',
      'pricing.features.priority',
    ],
  },
  {
    id: 'max',
    priceEur: 200,
    messagesPerMonth: 30000,
    featureKeys: ['pricing.features.modelsAll', 'pricing.features.priority'],
  },
  {
    id: 'payg',
    priceEur: null,
    messagesPerMonth: null,
    featureKeys: ['pricing.features.modelsAll', 'pricing.features.agents'],
  },
];
