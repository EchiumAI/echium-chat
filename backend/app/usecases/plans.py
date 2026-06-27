"""Plan limits, model access and feature gating.

Server-side source of truth for what each subscription tier allows. MUST stay
in sync with the frontend pricing definitions at
`frontend/src/constants/plans.ts` (prices/caps) — this module additionally
encodes the enforcement details (which model keys and features each tier
unlocks) that the frontend does not need.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Optional

from app.repositories.models.subscription import PlanId

# Feature flags that can be gated per plan.
FEATURE_WEB_SEARCH = "web_search"
FEATURE_AGENTS = "agents"
FEATURE_FILE_UPLOAD = "file_upload"
FEATURE_KNOWLEDGE_BASES = "knowledge_bases"

# Model "families" a plan may use. The chat layer maps a concrete model id
# (e.g. "claude-v4.6-sonnet") to one of these tiers via MODEL_TIER below.
MODEL_TIER_BASIC = "basic"  # Haiku / Nova
MODEL_TIER_SONNET = "sonnet"
MODEL_TIER_OPUS = "opus"

# Approximate USD->EUR conversion for metering. calculate_price() returns USD
# (BEDROCK_PRICING is in USD); usage/credit are tracked in EUR. This is a rough
# constant pending a live FX source — fine for cost estimates and PAYG debit
# sizing, not for accounting.
USD_TO_EUR = 0.92


@dataclass(frozen=True)
class PlanLimits:
    plan: PlanId
    # Monthly included messages. None = no cap (pay-as-you-go).
    messages_per_month: Optional[int]
    # Highest model tier the plan may use.
    model_tiers: frozenset
    # Enabled feature flags.
    features: frozenset
    # Whether usage beyond the monthly allowance draws from prepaid credit
    # (pay-as-you-go) rather than being blocked.
    metered_overage: bool = False


_BASIC = frozenset({MODEL_TIER_BASIC})
_SONNET = frozenset({MODEL_TIER_BASIC, MODEL_TIER_SONNET})
_ALL = frozenset({MODEL_TIER_BASIC, MODEL_TIER_SONNET, MODEL_TIER_OPUS})

PLAN_LIMITS: dict[PlanId, PlanLimits] = {
    "free": PlanLimits(
        plan="free",
        messages_per_month=50,
        model_tiers=_BASIC,
        features=frozenset(),
    ),
    "starter": PlanLimits(
        plan="starter",
        messages_per_month=500,
        model_tiers=_SONNET,
        features=frozenset({FEATURE_KNOWLEDGE_BASES}),
    ),
    "pro": PlanLimits(
        plan="pro",
        messages_per_month=2000,
        model_tiers=_ALL,
        features=frozenset(
            {
                FEATURE_KNOWLEDGE_BASES,
                FEATURE_AGENTS,
                FEATURE_FILE_UPLOAD,
                FEATURE_WEB_SEARCH,
            }
        ),
    ),
    "business": PlanLimits(
        plan="business",
        messages_per_month=12000,
        model_tiers=_ALL,
        features=frozenset(
            {
                FEATURE_KNOWLEDGE_BASES,
                FEATURE_AGENTS,
                FEATURE_FILE_UPLOAD,
                FEATURE_WEB_SEARCH,
            }
        ),
    ),
    "max": PlanLimits(
        plan="max",
        messages_per_month=30000,
        model_tiers=_ALL,
        features=frozenset(
            {
                FEATURE_KNOWLEDGE_BASES,
                FEATURE_AGENTS,
                FEATURE_FILE_UPLOAD,
                FEATURE_WEB_SEARCH,
            }
        ),
    ),
    "payg": PlanLimits(
        plan="payg",
        messages_per_month=None,  # no cap; billed from credit
        model_tiers=_ALL,
        features=frozenset(
            {
                FEATURE_KNOWLEDGE_BASES,
                FEATURE_AGENTS,
                FEATURE_FILE_UPLOAD,
                FEATURE_WEB_SEARCH,
            }
        ),
        metered_overage=True,
    ),
}

# Map concrete model keys (see backend/app/bedrock.py BASE_MODEL_IDS) to a tier.
# Unlisted models default to BASIC so a new model never silently unlocks a
# higher tier without an explicit decision.
MODEL_TIER: dict[str, str] = {
    # Opus
    "claude-v4-opus": MODEL_TIER_OPUS,
    "claude-v4.1-opus": MODEL_TIER_OPUS,
    "claude-v4.5-opus": MODEL_TIER_OPUS,
    "claude-v4.6-opus": MODEL_TIER_OPUS,
    "claude-v3-opus": MODEL_TIER_OPUS,
    # Sonnet
    "claude-v4-sonnet": MODEL_TIER_SONNET,
    "claude-v4.5-sonnet": MODEL_TIER_SONNET,
    "claude-v4.6-sonnet": MODEL_TIER_SONNET,
    "claude-v3.5-sonnet": MODEL_TIER_SONNET,
    "claude-v3.5-sonnet-v2": MODEL_TIER_SONNET,
    "claude-v3.7-sonnet": MODEL_TIER_SONNET,
    # Basic (Haiku / Nova / others)
    "claude-v4.5-haiku": MODEL_TIER_BASIC,
    "claude-v3-haiku": MODEL_TIER_BASIC,
    "claude-v3.5-haiku": MODEL_TIER_BASIC,
    "amazon-nova-pro": MODEL_TIER_BASIC,
    "amazon-nova-lite": MODEL_TIER_BASIC,
    "amazon-nova-micro": MODEL_TIER_BASIC,
}


def get_plan_limits(plan: PlanId) -> PlanLimits:
    return PLAN_LIMITS.get(plan, PLAN_LIMITS["free"])

def model_tier(model_key: str) -> str:
    return MODEL_TIER.get(model_key, MODEL_TIER_BASIC)


def is_model_allowed(plan: PlanId, model_key: str) -> bool:
    return model_tier(model_key) in get_plan_limits(plan).model_tiers


def is_feature_allowed(plan: PlanId, feature: str) -> bool:
    return feature in get_plan_limits(plan).features


def messages_remaining(plan: PlanId, used: int) -> Optional[int]:
    """Remaining included messages this period. None = unlimited (PAYG)."""
    limit = get_plan_limits(plan).messages_per_month
    if limit is None:
        return None
    return max(0, limit - used)
