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

/**
 * Model access level per plan. Resolved to concrete model ids by the backend
 * enforcement layer (see backend/app/plans.py), kept as a coarse tier here so
 * the frontend doesn't duplicate the model-key list.
 *  - basic:    Amazon Nova + Claude Haiku (cheap)
 *  - standard: basic + Claude Sonnet
 *  - all:      standard + Claude Opus
 */
export type ModelTier = 'basic' | 'standard' | 'all';

/** Machine-readable capability flags used for UI gating + (mirrored) backend
 *  enforcement. Display strings stay in `featureKeys`. */
export interface PlanCapabilities {
  modelTier: ModelTier;
  /** Internet search tool. Pro and up (it is the most expensive feature). */
  webSearch: boolean;
  agents: boolean;
  knowledgeBases: boolean;
  fileUpload: boolean;
  priority: boolean;
}

export interface Plan {
  id: PlanId;
  /** Monthly price in EUR. null = usage-based (PAYG). */
  priceEur: number | null;
  /** Included messages per month. null = no cap (PAYG). */
  messagesPerMonth: number | null;
  /** Machine-readable entitlements (gating). */
  capabilities: PlanCapabilities;
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
    capabilities: {
      modelTier: 'basic',
      webSearch: false,
      agents: false,
      knowledgeBases: false,
      fileUpload: false,
      priority: false,
    },
    featureKeys: ['pricing.features.modelsBasic'],
  },
  {
    id: 'starter',
    priceEur: 5,
    messagesPerMonth: 500,
    capabilities: {
      modelTier: 'standard',
      webSearch: false,
      agents: false,
      knowledgeBases: true,
      fileUpload: false,
      priority: false,
    },
    featureKeys: ['pricing.features.modelsSonnet', 'pricing.features.knowledgeBases'],
  },
  {
    id: 'pro',
    priceEur: 20,
    messagesPerMonth: 2000,
    capabilities: {
      modelTier: 'all',
      webSearch: true,
      agents: true,
      knowledgeBases: true,
      fileUpload: true,
      priority: false,
    },
    featureKeys: [
      'pricing.features.modelsOpus',
      'pricing.features.webSearch',
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
    capabilities: {
      modelTier: 'all',
      webSearch: true,
      agents: true,
      knowledgeBases: true,
      fileUpload: true,
      priority: true,
    },
    featureKeys: [
      'pricing.features.modelsAll',
      'pricing.features.webSearch',
      'pricing.features.agents',
      'pricing.features.fileUpload',
      'pricing.features.priority',
    ],
  },
  {
    id: 'max',
    priceEur: 200,
    messagesPerMonth: 30000,
    capabilities: {
      modelTier: 'all',
      webSearch: true,
      agents: true,
      knowledgeBases: true,
      fileUpload: true,
      priority: true,
    },
    featureKeys: [
      'pricing.features.modelsAll',
      'pricing.features.webSearch',
      'pricing.features.priority',
    ],
  },
  {
    id: 'payg',
    priceEur: null,
    messagesPerMonth: null,
    capabilities: {
      modelTier: 'all',
      webSearch: true,
      agents: true,
      knowledgeBases: true,
      fileUpload: true,
      priority: true,
    },
    featureKeys: [
      'pricing.features.modelsAll',
      'pricing.features.webSearch',
      'pricing.features.agents',
    ],
  },
];

/**
 * Pay-as-you-go pricing model.
 *
 * PAYG has no monthly cap: after the free monthly allowance, usage is billed
 * from a prepaid credit balance at an effective per-message price that already
 * includes our markup over raw Bedrock cost. Because models cost very
 * different amounts, the price-per-message is defined per model — this is the
 * "granularity" the pricing page surfaces (e.g. roughly how many Sonnet vs
 * Haiku messages a given top-up buys).
 *
 * IMPORTANT: these per-message prices are illustrative estimates based on an
 * average message length, pending the margin review. The backend will bill the
 * exact token cost × markup, not these rounded figures — these exist only to
 * give customers an at-a-glance sense of value. Treat changes as commercial
 * decisions. `estimated` is surfaced in the UI so the numbers are never
 * presented as guarantees.
 */

/** Free messages included every month before PAYG billing starts. */
export const PAYG_FREE_MONTHLY_MESSAGES = 50;

/** Prepaid top-up amounts offered, in EUR. */
export const PAYG_TOPUPS_EUR = [10, 25, 50];

export interface PaygModelRate {
  /** Stable id, also used to resolve the display label i18n key. */
  id: string;
  /** i18n key (under `payg.models.*`) for the human-readable model name. */
  labelKey: string;
  /** Effective price charged per average message, in EUR (markup included). */
  pricePerMessageEur: number;
}

/**
 * Effective per-message prices (EUR, markup included), tuned to round,
 * illustrative figures: ~€5 ≈ 1,000 Haiku / 500 Sonnet / 100 Opus messages.
 */
export const PAYG_RATES: PaygModelRate[] = [
  { id: 'nova', labelKey: 'payg.models.nova', pricePerMessageEur: 0.002 },
  { id: 'haiku', labelKey: 'payg.models.haiku', pricePerMessageEur: 0.005 },
  { id: 'sonnet', labelKey: 'payg.models.sonnet', pricePerMessageEur: 0.01 },
  { id: 'opus', labelKey: 'payg.models.opus', pricePerMessageEur: 0.05 },
];

/** Approximate whole-number messages a given EUR credit buys for a model. */
export const messagesForCredit = (
  creditEur: number,
  rate: PaygModelRate
): number => Math.floor(creditEur / rate.pricePerMessageEur);
