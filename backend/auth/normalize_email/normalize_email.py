"""Cognito Pre Sign-up trigger: the server-side gate for self-service sign-up.

Bots call Cognito's public SignUp API directly (skipping our form), so every
check that matters lives here, not in the frontend:

1. CAPTCHA: a valid Cloudflare Turnstile token must accompany the sign-up
   (sent by the form as validationData "turnstileToken"). Fails closed: if the
   secret is not configured, self sign-up is rejected.
2. Duplicate accounts that differ only by email letter-case are rejected.
3. Disposable / temporary email domains are rejected (bundled blocklist from
   github.com/disposable-email-domains, matched on the domain and its parents).
4. The owner is emailed about every attempt that passes the CAPTCHA, whether
   it is accepted or blocked, so unconfirmed sign-ups are visible too.
   CAPTCHA failures are only logged (that is where bot volume lands).

Admin-created users and external-provider flows are passed through unchanged.
"""

import json
import logging
import os
import urllib.parse
import urllib.request
from pathlib import Path
from typing import Dict

import boto3

logger = logging.getLogger()
logger.setLevel(logging.INFO)

cognito = boto3.client("cognito-idp")

TURNSTILE_SECRET_KEY = os.environ.get("TURNSTILE_SECRET_KEY", "")
# Hostnames the Turnstile token must have been issued for (comma-separated).
TURNSTILE_ALLOWED_HOSTNAMES = {
    h.strip().lower()
    for h in os.environ.get("TURNSTILE_ALLOWED_HOSTNAMES", "").split(",")
    if h.strip()
}
TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

OWNER_EMAIL = os.environ.get("OWNER_EMAIL", "")
SES_REGION = os.environ.get("SES_REGION", "eu-west-1")
FROM_EMAIL = os.environ.get("NOTIFY_FROM_EMAIL", "noreply@echium.ai")

# Cognito user statuses that represent a real, usable account. An existing
# match in one of these states means a duplicate sign-up should be blocked.
# UNCONFIRMED is intentionally excluded so a user who abandoned a sign-up can
# retry with the same email.
ACTIVE_STATUSES = {
    "CONFIRMED",
    "ARCHIVED",
    "COMPROMISED",
    "RESET_REQUIRED",
    "FORCE_CHANGE_PASSWORD",
    "EXTERNAL_PROVIDER",
}


class SignUpRejected(Exception):
    """Raised to reject a sign-up; Cognito shows the message to the user."""


def _load_disposable_domains() -> frozenset[str]:
    path = Path(__file__).with_name("disposable_domains.txt")
    try:
        lines = path.read_text(encoding="utf-8").splitlines()
    except OSError:
        logger.error("Disposable domain list missing; check is disabled")
        return frozenset()
    return frozenset(
        line.strip().lower()
        for line in lines
        if line.strip() and not line.startswith("#")
    )


DISPOSABLE_DOMAINS = _load_disposable_domains()


def is_disposable_email(email: str) -> bool:
    """True if the email's domain, or any parent domain, is on the blocklist."""
    domain = email.rsplit("@", 1)[-1].strip().lower().rstrip(".")
    if not domain:
        return False
    parts = domain.split(".")
    return any(".".join(parts[i:]) in DISPOSABLE_DOMAINS for i in range(len(parts) - 1))


def verify_turnstile(token: str, remote_ip: str | None = None) -> bool:
    """Verify a Turnstile token with Cloudflare. Fails closed on any error."""
    if not TURNSTILE_SECRET_KEY or not token:
        return False
    fields = {"secret": TURNSTILE_SECRET_KEY, "response": token}
    if remote_ip:
        fields["remoteip"] = remote_ip
    request = urllib.request.Request(
        TURNSTILE_VERIFY_URL,
        data=urllib.parse.urlencode(fields).encode("utf-8"),
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=8) as response:
            result = json.loads(response.read().decode("utf-8"))
    except Exception:
        logger.exception("Turnstile verification request failed")
        return False
    if not result.get("success"):
        logger.info(f"Turnstile rejected: {result.get('error-codes')}")
        return False
    hostname = str(result.get("hostname", "")).lower()
    if TURNSTILE_ALLOWED_HOSTNAMES and hostname not in TURNSTILE_ALLOWED_HOSTNAMES:
        logger.info(f"Turnstile token issued for unexpected host {hostname!r}")
        return False
    return True


def _find_existing_active_user(user_pool_id: str, email_lower: str) -> bool:
    """Return True if a confirmed/active account already exists for this email,
    compared case-insensitively."""
    paginator = cognito.get_paginator("list_users")
    for page in paginator.paginate(
        UserPoolId=user_pool_id,
        AttributesToGet=["email"],
        Filter=f'email = "{email_lower}"',
    ):
        for user in page.get("Users", []):
            status = user.get("UserStatus")
            stored_email = next(
                (
                    a["Value"]
                    for a in user.get("Attributes", [])
                    if a["Name"] == "email"
                ),
                "",
            )
            if (
                stored_email.strip().lower() == email_lower
                and status in ACTIVE_STATUSES
            ):
                return True
    return False


def notify_owner(email: str, outcome: str, attributes: Dict) -> None:
    """Email the owner about a sign-up attempt. Best-effort, never raises."""
    if not OWNER_EMAIL:
        return
    details = "\n".join(
        f"{key}: {attributes[key]}"
        for key in ("given_name", "family_name", "custom:country", "phone_number")
        if attributes.get(key)
    )
    body = f"Sign-up attempt: {email}\nOutcome: {outcome}\n"
    if details:
        body += f"\n{details}\n"
    body += (
        "\nAccepted attempts still need the user to confirm their email before "
        "they can sign in."
    )
    try:
        boto3.client("ses", region_name=SES_REGION).send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [OWNER_EMAIL]},
            Message={
                "Subject": {"Data": f"Echium sign-up attempt ({outcome}): {email}"},
                "Body": {"Text": {"Data": body}},
            },
        )
    except Exception:
        logger.warning("Failed to send sign-up attempt notification", exc_info=True)


def check_sign_up(event: Dict) -> None:
    """Run every gate for a self-service sign-up; raise SignUpRejected to block."""
    request = event.get("request", {})
    attributes = request.get("userAttributes", {}) or {}
    email_lower = attributes.get("email", "").strip().lower()
    validation = request.get("validationData") or {}
    metadata = request.get("clientMetadata") or {}
    token = validation.get("turnstileToken") or metadata.get("turnstileToken") or ""

    if not verify_turnstile(token):
        # Not emailed: this is where scripted traffic lands.
        logger.info(f"Sign-up rejected (CAPTCHA) for {email_lower!r}")
        raise SignUpRejected(
            "Security check failed. Please reload the page and try again."
        )

    if email_lower and _find_existing_active_user(event["userPoolId"], email_lower):
        notify_owner(email_lower, "blocked: account already exists", attributes)
        raise SignUpRejected("An account with this email already exists.")

    if not email_lower or is_disposable_email(email_lower):
        notify_owner(email_lower or "(none)", "blocked: disposable email", attributes)
        raise SignUpRejected(
            "Please sign up with a permanent email address. Temporary or "
            "disposable email services are not accepted."
        )

    notify_owner(email_lower, "accepted, awaiting email confirmation", attributes)


def handler(event: Dict, context: Dict) -> Dict:
    # Do not log the full event: it contains personal data.
    trigger_source = event.get("triggerSource", "")
    logger.info(f"Pre sign-up trigger: {trigger_source}")
    if trigger_source != "PreSignUp_SignUp":
        return event
    try:
        check_sign_up(event)
    except SignUpRejected as e:
        # Cognito surfaces the exception message as the sign-up failure reason.
        raise Exception(str(e)) from None
    return event
