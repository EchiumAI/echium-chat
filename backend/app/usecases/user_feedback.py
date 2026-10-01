"""In-app feedback: store a submission and open a GitHub issue for it.

Design (see docs/plans/in-app-feedback.md):
- The submission is written to DynamoDB first (our system of record, EU
  region, row-level scoped to the user) so nothing is lost if GitHub is down.
- Then we best-effort create an issue in the repo of the product the feedback
  came from. The issue carries a pseudonymous user id only; the mapping to the
  real identity stays in DynamoDB.
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
from datetime import datetime, timezone

import requests
from app.repositories.common import get_conversation_table_client
from app.routes.schemas.user_feedback import UserFeedbackInput, UserFeedbackOutput
from app.utils import get_current_time
from ulid import ULID

logger = logging.getLogger(__name__)

GITHUB_FEEDBACK_TOKEN = os.environ.get("GITHUB_FEEDBACK_TOKEN", "")
# Maps the widget's `app` id to "owner/repo". JSON in env for per-deployment
# override; the default covers the current product set.
_DEFAULT_REPOS = {
    "chat": "EchiumAI/echium-chat",
    "docs": "EchiumAI/echium-docs",
    "draw": "EchiumAI/echium-draw",
}
FEEDBACK_REPOS: dict[str, str] = {
    **_DEFAULT_REPOS,
    **json.loads(os.environ.get("FEEDBACK_REPOS_JSON") or "{}"),
}
# Unknown app ids still get an issue somewhere so nothing is dropped.
FEEDBACK_DEFAULT_REPO = os.environ.get("FEEDBACK_DEFAULT_REPO", "EchiumAI/echium-chat")


def _compose_sk(user_id: str, feedback_id: str) -> str:
    # user_id prefix keeps the item inside the row-level security envelope.
    return f"{user_id}#FEEDBACK#{feedback_id}"


def _pseudonymous_user(user_id: str) -> str:
    return hashlib.sha256(user_id.encode("utf-8")).hexdigest()[:12]


def _issue_title(fb: UserFeedbackInput) -> str:
    first_line = fb.message.strip().splitlines()[0]
    if len(first_line) > 72:
        first_line = first_line[:69].rstrip() + "..."
    prefix = "Bug" if fb.type == "bug" else "Idea"
    return f"[{prefix}] {first_line}"


def _issue_body(fb: UserFeedbackInput, user_id: str, feedback_id: str) -> str:
    submitted = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
    lines = [
        fb.message.strip(),
        "",
        "---",
        f"- **Type:** {fb.type}",
        f"- **App:** {fb.app}",
        f"- **Route:** `{fb.route}`" if fb.route else "- **Route:** (none)",
        f"- **Version:** {fb.version}" if fb.version else "- **Version:** (unknown)",
        (
            f"- **Browser:** {fb.user_agent}"
            if fb.user_agent
            else "- **Browser:** (unknown)"
        ),
        f"- **Reporter:** `{_pseudonymous_user(user_id)}` (pseudonymous)",
        f"- **Feedback id:** `{feedback_id}`",
        f"- **Submitted:** {submitted}",
        "",
        "_Filed automatically from the in-app Feedback widget._",
    ]
    return "\n".join(lines)


def _create_github_issue(
    fb: UserFeedbackInput, user_id: str, feedback_id: str
) -> str | None:
    """Create the issue; return its URL, or None if GitHub isn't configured
    or the call failed (the caller records the sync state)."""
    if not GITHUB_FEEDBACK_TOKEN:
        logger.info("GITHUB_FEEDBACK_TOKEN not set; skipping issue creation")
        return None
    repo = FEEDBACK_REPOS.get(fb.app, FEEDBACK_DEFAULT_REPO)
    labels = ["feedback", f"type:{fb.type}", f"app:{fb.app}"]
    try:
        resp = requests.post(
            f"https://api.github.com/repos/{repo}/issues",
            headers={
                "Authorization": f"Bearer {GITHUB_FEEDBACK_TOKEN}",
                "Accept": "application/vnd.github+json",
                "X-GitHub-Api-Version": "2022-11-28",
            },
            json={
                "title": _issue_title(fb),
                "body": _issue_body(fb, user_id, feedback_id),
                "labels": labels,
            },
            timeout=10,
        )
        if resp.status_code >= 300:
            logger.warning(
                f"GitHub issue creation failed for {repo}: "
                f"{resp.status_code} {resp.text[:300]}"
            )
            return None
        return resp.json().get("html_url")
    except Exception:  # noqa: BLE001 - never let GitHub break the submission
        logger.warning("GitHub issue creation raised", exc_info=True)
        return None


def submit_feedback(user_id: str, fb: UserFeedbackInput) -> UserFeedbackOutput:
    feedback_id = str(ULID())
    table = get_conversation_table_client(user_id)
    now = float(get_current_time())

    item = {
        "PK": user_id,
        "SK": _compose_sk(user_id, feedback_id),
        "App": fb.app,
        "Type": fb.type,
        "Message": fb.message,
        "Route": fb.route or "",
        "UserAgent": fb.user_agent or "",
        "Version": fb.version or "",
        "CreateTime": str(now),
        "Synced": False,
    }
    # 1) Persist first — our copy is the source of record.
    table.put_item(Item=item)

    # 2) Best-effort GitHub issue.
    issue_url = _create_github_issue(fb, user_id, feedback_id)
    if issue_url:
        try:
            table.update_item(
                Key={"PK": user_id, "SK": item["SK"]},
                UpdateExpression="SET Synced = :s, IssueUrl = :u",
                ExpressionAttributeValues={":s": True, ":u": issue_url},
            )
        except Exception:  # noqa: BLE001
            logger.warning("Failed to record issue url on feedback", exc_info=True)

    logger.info(
        f"Feedback {feedback_id} stored (app={fb.app}, type={fb.type}, "
        f"issue={'yes' if issue_url else 'no'})"
    )
    return UserFeedbackOutput(id=feedback_id, issue_url=issue_url)
