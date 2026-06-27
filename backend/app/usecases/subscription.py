"""Subscription overview for the in-app billing page and consumption display."""

from __future__ import annotations

import logging

from app.repositories.subscription import (
    current_period,
    get_or_create_subscription,
    get_usage,
)
from app.usecases.plans import (
    FEATURE_AGENTS,
    FEATURE_FILE_UPLOAD,
    FEATURE_KNOWLEDGE_BASES,
    FEATURE_WEB_SEARCH,
    get_plan_limits,
    messages_remaining,
)

logger = logging.getLogger(__name__)


def get_subscription_overview(user_id: str) -> dict:
    """Assemble the user's current plan, usage and entitlements.

    Returned as camelCase JSON for the frontend (billing page + the in-chat
    consumption indicator). Creates a default free subscription on first call.
    """
    sub = get_or_create_subscription(user_id)
    usage = get_usage(user_id, current_period())
    limits = get_plan_limits(sub.plan)

    remaining = messages_remaining(sub.plan, usage.message_count)

    return {
        "plan": sub.plan,
        "status": sub.status,
        "period": usage.period,
        "messagesUsed": usage.message_count,
        # null => unlimited (pay-as-you-go)
        "messagesLimit": limits.messages_per_month,
        "messagesRemaining": remaining,
        "meteredOverage": limits.metered_overage,
        "creditBalanceEur": round(sub.credit_balance_eur, 4),
        "costThisPeriodEur": round(usage.cost_eur, 4),
        "capabilities": {
            "modelTiers": sorted(limits.model_tiers),
            "webSearch": FEATURE_WEB_SEARCH in limits.features,
            "agents": FEATURE_AGENTS in limits.features,
            "knowledgeBases": FEATURE_KNOWLEDGE_BASES in limits.features,
            "fileUpload": FEATURE_FILE_UPLOAD in limits.features,
        },
    }
