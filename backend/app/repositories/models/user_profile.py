"""Data model for the user's profile ("Profile & memory").

One short, user-editable document per user describing the person (name,
profession, country, languages, interests, how they like answers), so agents
can personalise replies without injecting summaries of unrelated chats.

Stored on the conversation table in the user's own partition:

    PK = user_id
    SK = {user_id}#PROFILE
    ItemType = "USER_PROFILE"

Sensitive information (health, religion, political views, sexuality,
ethnicity) lives in its own section and is only kept while the user has given
explicit, recorded consent (GDPR Art. 9). Withdrawing consent deletes it.
"""

from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field


class UserProfileModel(BaseModel):
    # Memory on/off. When off, the profile is neither injected nor updated.
    enabled: bool = True
    # The profile itself (Markdown, fixed sections).
    profile: str = ""
    # Sensitive section; only non-empty while sensitive_consent is True.
    sensitive: str = ""
    sensitive_consent: bool = False
    consent_time: Optional[float] = None
    consent_version: Optional[str] = None
    # Which agents may see the profile. Plain chat always sees it when enabled.
    share_all_agents: bool = True
    allowed_agent_ids: list[str] = Field(default_factory=list)
    update_time: float = 0.0
