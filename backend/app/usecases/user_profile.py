"""User profile ("Profile & memory").

A single short profile per user, describing the person rather than their
chats: name, work, location and languages, interests, how they like answers.
It replaces injecting summaries of other (often unrelated) chats into every
new conversation, which bloated the context and made the model mix chats up.

- Injected into plain chats and into agent chats the user shared it with,
  rebuilt on every turn (never copied into the stored conversation), so edits
  and deletions take effect immediately.
- Kept up to date after each turn by a cheap one-shot model call that only
  records facts the user explicitly stated about themselves.
- Sensitive categories are only stored in their own section while the user
  has opted in; withdrawing consent deletes that section.
"""

from __future__ import annotations

import json
import logging
import re

from app.bedrock import call_converse_api, compose_args_for_converse_api
from app.repositories.conversation import find_conversation_by_id
from app.repositories.models.conversation import SimpleMessageModel, TextContentModel
from app.repositories.models.user_profile import UserProfileModel
from app.repositories.user_profile import (
    delete_user_profile,
    find_user_profile,
    store_user_profile,
)
from app.usecases.global_config import get_title_model
from app.utils import get_current_time

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# Version of the sensitive-data consent wording shown in the UI. Bump it when
# the text changes so recorded consents can be traced to what the user saw.
SENSITIVE_CONSENT_VERSION = "2026-10-06"

# Limits for what the user can save and what the model may write back.
MAX_PROFILE_CHARS = 8000
MAX_SENSITIVE_CHARS = 4000
MAX_REFLECTED_PROFILE_CHARS = 4000
MAX_REFLECTED_SENSITIVE_CHARS = 2000
MAX_ALLOWED_AGENTS = 200

# How much of the latest exchange the reflection reads.
REFLECT_MESSAGES = 4
REFLECT_MESSAGE_CHARS = 3000

PROFILE_SECTIONS = (
    "## Name\n"
    "## Work\n"
    "## Location and languages\n"
    "## Interests and hobbies\n"
    "## How they like answers\n"
    "## Other"
)

REFLECT_PROMPT = """You maintain a short profile of a user so an AI assistant can personalise its answers.

Current profile (Markdown):
---
{profile}
---
{sensitive_block}
Latest exchange between the user and the assistant:
---
{transcript}
---

Update the profile with facts the USER explicitly stated about THEMSELVES in this exchange.

Rules:
- Only record what the user said about themselves: name, work and role, company, location, languages, interests and hobbies, family situation if they mention it, and how they like answers (tone, length, language, format).
- Never guess or infer. Never record facts about other people, the assistant, or the task at hand (documents, projects, one-off requests, numbers, code).
- Keep everything already in the profile unless the user said it is no longer true. The user edits this profile, so preserve their wording.
- Use only these sections, and omit a section that has nothing in it:
{sections}
- Short bullet points. At most 300 words in total.
{sensitive_rules}
Return ONLY a JSON object, no code fences, no explanation:
{{"changed": true or false, "profile": "<full updated profile Markdown>", "sensitive": "<full updated sensitive Markdown, or empty string>"}}
If there is nothing new, return {{"changed": false, "profile": "", "sensitive": ""}}."""

SENSITIVE_RULES_ALLOWED = """- The user has consented to keeping sensitive information. Facts the user explicitly stated about their own health, religion or beliefs, political views, sexual orientation or ethnicity go ONLY in "sensitive" (short bullets), never in "profile". Keep existing sensitive facts unless the user said they are no longer true."""

SENSITIVE_RULES_FORBIDDEN = """- Do NOT record anything about the user's health, religion or beliefs, political views, sexual orientation or ethnicity, even if they mention it. Always return "sensitive" as an empty string."""

CONTEXT_HEADER = (
    "# About the user\n"
    "The user keeps this profile so you can personalise your answers. Use it "
    "naturally where it helps (their name, language, expertise, preferences). "
    "Do not recite it or mention it unless asked. If something the user says "
    "now contradicts it, follow what they say now."
)


# ----------------------------------------------------------------- read/write


def get_profile(user_id: str) -> UserProfileModel:
    return find_user_profile(user_id)


def update_profile(
    user_id: str,
    *,
    enabled: bool,
    profile: str,
    sensitive: str,
    sensitive_consent: bool,
    share_all_agents: bool,
    allowed_agent_ids: list[str],
) -> UserProfileModel:
    """Save the user's edits. Handles sensitive-data consent transitions."""
    if len(profile) > MAX_PROFILE_CHARS:
        raise ValueError(f"Profile is longer than {MAX_PROFILE_CHARS} characters.")
    if len(sensitive) > MAX_SENSITIVE_CHARS:
        raise ValueError(
            f"Sensitive section is longer than {MAX_SENSITIVE_CHARS} characters."
        )
    if len(allowed_agent_ids) > MAX_ALLOWED_AGENTS:
        raise ValueError("Too many agents selected.")

    existing = find_user_profile(user_id)
    now = float(get_current_time())

    updated = existing.model_copy()
    updated.enabled = enabled
    updated.profile = profile.strip()
    updated.share_all_agents = share_all_agents
    updated.allowed_agent_ids = sorted(
        {a.strip() for a in allowed_agent_ids if a and a.strip()}
    )

    if sensitive_consent:
        if not existing.sensitive_consent:
            # Fresh opt-in: record when and which wording was agreed to.
            updated.consent_time = now
            updated.consent_version = SENSITIVE_CONSENT_VERSION
        updated.sensitive_consent = True
        updated.sensitive = sensitive.strip()
    else:
        # Not consented (or consent withdrawn): never keep sensitive data.
        updated.sensitive_consent = False
        updated.sensitive = ""
        updated.consent_time = None
        updated.consent_version = None

    updated.update_time = now
    store_user_profile(user_id, updated)
    return updated


def clear_profile(user_id: str) -> None:
    """Delete everything (profile, sensitive section, consent, sharing)."""
    delete_user_profile(user_id)


# ------------------------------------------------------------------ injection


def profile_visible_to(profile: UserProfileModel, agent_id: str | None) -> bool:
    if not profile.enabled:
        return False
    if agent_id is None:
        return True
    return profile.share_all_agents or agent_id in profile.allowed_agent_ids


def build_profile_context(user_id: str, agent_id: str | None) -> str:
    """System-prompt block with the profile, or '' (best-effort, never raises)."""
    try:
        profile = find_user_profile(user_id)
    except Exception:
        logger.warning("Profile lookup failed", exc_info=True)
        return ""
    return format_profile_context(profile, agent_id)


def format_profile_context(profile: UserProfileModel, agent_id: str | None) -> str:
    if not profile_visible_to(profile, agent_id):
        return ""
    parts: list[str] = []
    if profile.profile.strip():
        parts.append(profile.profile.strip())
    if profile.sensitive_consent and profile.sensitive.strip():
        parts.append(
            "## Sensitive information (shared by the user with consent; treat "
            "with care and only use it when relevant)\n" + profile.sensitive.strip()
        )
    if not parts:
        return ""
    return CONTEXT_HEADER + "\n\n" + "\n\n".join(parts)


# ----------------------------------------------------------------- reflection


def _message_text(message: SimpleMessageModel) -> str:
    return "\n".join(
        c.body for c in message.content if isinstance(c, TextContentModel) and c.body
    ).strip()


def _latest_exchange(user_id: str, conversation_id: str) -> str:
    from app.usecases.chat import trace_to_root

    conversation = find_conversation_by_id(user_id, conversation_id)
    messages = trace_to_root(
        node_id=conversation.last_message_id,
        message_map=conversation.message_map,
    )
    lines: list[str] = []
    for message in messages:
        if message.role not in ("user", "assistant"):
            continue
        text = _message_text(message)
        if text:
            label = "User" if message.role == "user" else "Assistant"
            lines.append(f"{label}: {text[:REFLECT_MESSAGE_CHARS]}")
    return "\n\n".join(lines[-REFLECT_MESSAGES:])


def parse_reflection(raw: str) -> dict | None:
    """Parse the model's JSON reply; tolerate code fences and stray text."""
    text = raw.strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text)
    start, end = text.find("{"), text.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(text[start : end + 1])
    except json.JSONDecodeError:
        return None
    if not isinstance(data, dict):
        return None
    return data


def apply_reflection(
    profile: UserProfileModel, data: dict
) -> tuple[UserProfileModel, bool]:
    """Merge a parsed reflection into the profile. Returns (profile, changed)."""
    if not data.get("changed"):
        return profile, False
    new_profile = data.get("profile")
    new_sensitive = data.get("sensitive", "")
    if not isinstance(new_profile, str) or not isinstance(new_sensitive, str):
        return profile, False
    new_profile = new_profile.strip()
    new_sensitive = new_sensitive.strip() if profile.sensitive_consent else ""

    # Refuse runaway or empty rewrites rather than truncating mid-sentence.
    if len(new_profile) > MAX_REFLECTED_PROFILE_CHARS:
        logger.warning("Reflected profile too long; keeping the current one")
        return profile, False
    if len(new_sensitive) > MAX_REFLECTED_SENSITIVE_CHARS:
        logger.warning("Reflected sensitive section too long; keeping current")
        return profile, False
    if not new_profile and profile.profile.strip():
        return profile, False

    if new_profile == profile.profile.strip() and new_sensitive == (
        profile.sensitive.strip() if profile.sensitive_consent else ""
    ):
        return profile, False

    updated = profile.model_copy()
    updated.profile = new_profile
    if profile.sensitive_consent:
        updated.sensitive = new_sensitive
    updated.update_time = float(get_current_time())
    return updated, True


def reflect_profile(
    user_id: str, conversation_id: str
) -> tuple[UserProfileModel, bool]:
    """Update the profile from the latest exchange of a conversation."""
    profile = find_user_profile(user_id)
    if not profile.enabled:
        return profile, False

    transcript = _latest_exchange(user_id, conversation_id)
    if not transcript:
        return profile, False

    sensitive_block = (
        "Current sensitive section (Markdown):\n---\n"
        f"{profile.sensitive or '(empty)'}\n---\n"
        if profile.sensitive_consent
        else ""
    )
    prompt = REFLECT_PROMPT.format(
        profile=profile.profile or "(empty)",
        sensitive_block=sensitive_block,
        transcript=transcript,
        sections=PROFILE_SECTIONS,
        sensitive_rules=(
            SENSITIVE_RULES_ALLOWED
            if profile.sensitive_consent
            else SENSITIVE_RULES_FORBIDDEN
        ),
    )
    args = compose_args_for_converse_api(
        messages=[
            SimpleMessageModel(
                role="user",
                content=[TextContentModel(content_type="text", body=prompt)],
            )
        ],
        model=get_title_model(),
        stream=False,
    )
    try:
        response = call_converse_api(args)
        content = response["output"].get("message", {}).get("content", [])
        raw = content[0].get("text", "") if content else ""
    except Exception:
        logger.exception("[PROFILE] reflection failed")
        return profile, False

    data = parse_reflection(raw)
    if data is None:
        logger.warning("[PROFILE] reflection returned unparseable output")
        return profile, False

    updated, changed = apply_reflection(profile, data)
    if changed:
        store_user_profile(user_id, updated)
    return updated, changed
