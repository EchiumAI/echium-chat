"""Data models for subscription, usage and prepaid credit.

These back the billing layer. The plan ids and the meaning of each tier must
stay in sync with the frontend single source of truth at
`frontend/src/constants/plans.ts`.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field

# Plan ids — mirror frontend/src/constants/plans.ts (PlanId).
PlanId = Literal["free", "starter", "pro", "business", "max", "payg"]

# Subscription lifecycle status. "active" and "trialing" grant access; the
# others restrict it (handled by the enforcement layer).
SubscriptionStatus = Literal[
    "active",
    "trialing",
    "past_due",
    "paused",
    "cancelled",
]


class SubscriptionModel(BaseModel):
    """A user's current plan and billing state.

    Stored at PK=USER#{user_id}, SK=SUBSCRIPTION.
    """

    user_id: str
    plan: PlanId = "free"
    status: SubscriptionStatus = "active"

    # Paddle linkage. Null until the user has transacted through Paddle.
    paddle_customer_id: Optional[str] = None
    paddle_subscription_id: Optional[str] = None

    # Prepaid credit balance in EUR for pay-as-you-go. Persistent (does not
    # reset with the usage period). Charged down as usage accrues.
    credit_balance_eur: float = 0.0

    # Billing period bounds (ISO 8601). Used to decide when monthly caps reset.
    current_period_start: Optional[str] = None
    current_period_end: Optional[str] = None

    created_at: str
    updated_at: str


class UsageModel(BaseModel):
    """Accumulated usage for one user within one billing period.

    Stored at PK=USER#{user_id}, SK=USAGE#{period}, where period is "YYYY-MM".
    Counters are incremented atomically as messages are processed.
    """

    user_id: str
    # Period key, e.g. "2026-06". Monthly granularity for tier caps.
    period: str
    message_count: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    # Accumulated estimated cost in EUR (from calculate_price, converted).
    cost_eur: float = 0.0
    updated_at: str


class CreditLedgerEntryModel(BaseModel):
    """A single pay-as-you-go credit transaction (top-up or debit).

    Stored at PK=USER#{user_id}, SK=LEDGER#{iso8601}#{uuid}. Provides an audit
    trail behind the running `credit_balance_eur` on the subscription.
    """

    user_id: str
    entry_id: str
    # Positive for top-ups, negative for usage debits, in EUR.
    amount_eur: float
    kind: Literal["topup", "debit", "adjustment", "trial_grant"]
    description: str = ""
    # Balance after this entry was applied, for reconciliation.
    balance_after_eur: float = Field(default=0.0)
    created_at: str
