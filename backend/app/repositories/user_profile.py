"""Repository for the user profile ("Profile & memory").

One item per user on the conversation table, in the user's own partition so
the STS LeadingKeys row-level security applies:
    PK = user_id, SK = {user_id}#PROFILE, ItemType = "USER_PROFILE".
"""

import logging
from decimal import Decimal as decimal

from app.repositories.common import get_conversation_table_client
from app.repositories.models.user_profile import UserProfileModel

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)


def _profile_sk(user_id: str) -> str:
    # user_id prefix keeps the item inside the user's LeadingKeys scope.
    return f"{user_id}#PROFILE"


def find_user_profile(user_id: str) -> UserProfileModel:
    """Return the user's profile, or a fresh default one if none is stored."""
    table = get_conversation_table_client(user_id)
    response = table.get_item(Key={"PK": user_id, "SK": _profile_sk(user_id)})
    item = response.get("Item")
    if not item:
        return UserProfileModel()
    consent_time = item.get("ConsentTime")
    return UserProfileModel(
        enabled=bool(item.get("Enabled", True)),
        profile=item.get("Profile", ""),
        sensitive=item.get("Sensitive", ""),
        sensitive_consent=bool(item.get("SensitiveConsent", False)),
        consent_time=float(consent_time) if consent_time is not None else None,
        consent_version=item.get("ConsentVersion"),
        share_all_agents=bool(item.get("ShareAllAgents", True)),
        allowed_agent_ids=list(item.get("AllowedAgentIds", []) or []),
        update_time=float(item.get("UpdateTime", 0)),
    )


def store_user_profile(user_id: str, profile: UserProfileModel) -> None:
    table = get_conversation_table_client(user_id)
    item: dict = {
        "PK": user_id,
        "SK": _profile_sk(user_id),
        "ItemType": "USER_PROFILE",
        "Enabled": profile.enabled,
        "Profile": profile.profile,
        "Sensitive": profile.sensitive,
        "SensitiveConsent": profile.sensitive_consent,
        "ShareAllAgents": profile.share_all_agents,
        "AllowedAgentIds": profile.allowed_agent_ids,
        "UpdateTime": decimal(str(profile.update_time)),
    }
    if profile.consent_time is not None:
        item["ConsentTime"] = decimal(str(profile.consent_time))
    if profile.consent_version:
        item["ConsentVersion"] = profile.consent_version
    table.put_item(Item=item)


def delete_user_profile(user_id: str) -> None:
    table = get_conversation_table_client(user_id)
    table.delete_item(Key={"PK": user_id, "SK": _profile_sk(user_id)})
