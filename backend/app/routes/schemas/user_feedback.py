from typing import Literal, Optional

from app.routes.schemas.base import BaseSchema
from pydantic import Field


class UserFeedbackInput(BaseSchema):
    """A bug report or idea submitted from the in-app Feedback widget."""

    # Which product the user was in; the backend maps it to a GitHub repo.
    app: str = Field(min_length=1, max_length=32)
    type: Literal["bug", "idea"]
    message: str = Field(min_length=1, max_length=5000)
    # Auto-captured context (never typed by the user).
    route: Optional[str] = Field(default=None, max_length=512)
    user_agent: Optional[str] = Field(default=None, max_length=512)
    version: Optional[str] = Field(default=None, max_length=64)


class UserFeedbackOutput(BaseSchema):
    id: str
    # URL of the created GitHub issue, if the sync succeeded.
    issue_url: Optional[str] = None
