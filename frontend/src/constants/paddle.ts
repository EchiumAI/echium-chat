/**
 * Paddle client configuration for the in-app overlay checkout.
 *
 * The client-side token and price IDs are NOT secrets (the token is designed
 * to live in the browser), so sandbox values are baked in as defaults and can
 * be overridden per environment via Vite env vars at build time. The server
 * API key and webhook secret live in AWS Secrets Manager and never appear
 * here. Keep these in sync with the Paddle catalog (docs/ops/paddle-setup.md).
 */

import { PlanId } from './plans';

export type PaddleEnvironment = 'sandbox' | 'production';

export const PADDLE_ENVIRONMENT: PaddleEnvironment =
  (import.meta.env.VITE_APP_PADDLE_ENVIRONMENT as PaddleEnvironment) ?? 'sandbox';

export const PADDLE_CLIENT_TOKEN: string =
  import.meta.env.VITE_APP_PADDLE_CLIENT_TOKEN ??
  'test_d7cfcb574b97d70c55754a1db82';

/** Subscription price id per paid plan (Free has no Paddle price). */
export const PADDLE_PLAN_PRICE_IDS: Partial<Record<PlanId, string>> = {
  starter: 'pri_01kw3adt8ttv2qjw1eztcyttqp',
  pro: 'pri_01kw3a757d1wen071m4vdq15r8',
  business: 'pri_01kw3ab0vtq5j04mqmq78aphef',
  max: 'pri_01kw3a0n4fbyjykcpkqwybp6cq',
};

/** One-time top-up price id per EUR amount (pay-as-you-go). */
export const PADDLE_TOPUP_PRICE_IDS: Record<number, string> = {
  10: 'pri_01kw3a37f72s0md5theqmqe7f1',
  25: 'pri_01kw3a445znqjd90m9gjsm15qz',
  50: 'pri_01kw3a51rc5f8nbzc0sh6g60x1',
};
