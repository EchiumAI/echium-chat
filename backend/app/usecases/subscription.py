"""Subscription overview for the in-app billing page and consumption display."""

from __future__ import annotations

import logging
import os

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
    MODEL_TIER_OPUS,
    MODEL_TIER_SONNET,
    PlanLimitError,
    get_plan_limits,
    is_feature_allowed,
    is_model_allowed,
    messages_remaining,
    model_tier,
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


# Minimum plan that unlocks a given model tier / feature, used to suggest an
# upgrade target in PlanLimitError.
_MIN_PLAN_FOR_MODEL_TIER = {
    MODEL_TIER_SONNET: "starter",
    MODEL_TIER_OPUS: "pro",
}


def check_message_allowed(
    user_id: str,
    model_key: str,
    wants_web_search: bool = False,
    is_admin: bool = False,
) -> None:
    """Enforce plan limits before a chat message is processed.

    Raises PlanLimitError (with a reason + suggested upgrade plan) when the
    current plan does not permit the requested model, the monthly message cap
    is exhausted (and the plan is not metered), prepaid credit is depleted
    (pay-as-you-go), or web search is requested without entitlement.

    Gated behind ENABLE_PLAN_ENFORCEMENT (default off) so the code can ship
    before checkout exists without locking everyone to the free tier. Admins
    always bypass enforcement.
    """
    if os.environ.get("ENABLE_PLAN_ENFORCEMENT", "false").lower() != "true":
        return
    if is_admin:
        return

    sub = get_or_create_subscription(user_id)
    plan = sub.plan
    limits = get_plan_limits(plan)

    # 1. Model access.
    if not is_model_allowed(plan, model_key):
        required = _MIN_PLAN_FOR_MODEL_TIER.get(model_tier(model_key), "pro")
        raise PlanLimitError(
            reason="model_not_allowed",
            message="This model isn't available on your current plan.",
            required_plan=required,  # type: ignore[arg-type]
        )

    # 2. Web search feature gate.
    if wants_web_search and not is_feature_allowed(plan, FEATURE_WEB_SEARCH):
        raise PlanLimitError(
            reason="web_search_not_allowed",
            message="Internet search isn't available on your current plan.",
            required_plan="pro",
        )

    # 3. Usage cap (fixed plans) or prepaid credit (pay-as-you-go).
    if limits.metered_overage:
        if sub.credit_balance_eur <= 0:
            raise PlanLimitError(
                reason="insufficient_credit",
                message="Your prepaid credit is used up. Top up to continue.",
                required_plan="payg",
            )
    else:
        usage = get_usage(user_id, current_period())
        remaining = messages_remaining(plan, usage.message_count)
        if remaining is not None and remaining <= 0:
            # Suggest the next paid tier up (free->starter->pro->...).
            upgrade_order = ["free", "starter", "pro", "business", "max"]
            try:
                nxt = upgrade_order[upgrade_order.index(plan) + 1]
            except (ValueError, IndexError):
                nxt = "payg"
            raise PlanLimitError(
                reason="message_limit_reached",
                message="You've reached your monthly message limit.",
                required_plan=nxt,  # type: ignore[arg-type]
            )
