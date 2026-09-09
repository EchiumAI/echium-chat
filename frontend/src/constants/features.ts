/**
 * Temporary product flags.
 *
 * During the current build-out phase every account is treated as fully
 * entitled (see `ASSUME_ALL_PRO` on the backend), so the monetization UI —
 * plan name, billing/account link, pricing and upgrade prompts — is hidden.
 *
 * Flip `MONETIZATION_ENABLED` back to `true` to restore the paid-plan
 * experience. Nothing is deleted; it's only gated.
 */
export const MONETIZATION_ENABLED = false;
