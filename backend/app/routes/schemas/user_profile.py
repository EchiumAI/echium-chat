from typing import Optional

from app.routes.schemas.base import BaseSchema
from pydantic import Field


class UserProfileOutput(BaseSchema):
    enabled: bool
    profile: str
    sensitive: str
    sensitive_consent: bool
    consent_time: Optional[float] = None
    consent_version: Optional[str] = None
    # Wording version the UI must show for the sensitive-data opt-in.
    current_consent_version: str
    share_all_agents: bool
    allowed_agent_ids: list[str]
    update_time: float


class UserProfileInput(BaseSchema):
    enabled: bool = True
    profile: str = Field("", max_length=8000)
    sensitive: str = Field("", max_length=4000)
    sensitive_consent: bool = False
    share_all_agents: bool = True
    allowed_agent_ids: list[str] = Field(default_factory=list, max_length=200)


class UserProfileReflectInput(BaseSchema):
    conversation_id: str = Field(min_length=1, max_length=64)


class UserProfileReflectOutput(BaseSchema):
    changed: bool
