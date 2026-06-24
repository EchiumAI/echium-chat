import json
from typing import Dict

import boto3

cognito = boto3.client("cognito-idp")

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


def _find_existing_active_user(user_pool_id: str, email_lower: str) -> bool:
    """Return True if a confirmed/active account already exists for this email,
    compared case-insensitively. Paginates ListUsers and normalises each
    stored email so that "Person@Example.com" and "person@example.com" match.
    """
    paginator = cognito.get_paginator("list_users")
    # Filter narrows the scan; matching is still re-checked case-insensitively
    # below because Cognito's filter matching is not guaranteed case-folded.
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


def handler(event: Dict, context: Dict) -> Dict:
    """Cognito Pre Sign-up trigger.

    Prevents duplicate accounts that differ only by email letter-case (e.g.
    a user signing up once as Foo@x.com and again as foo@x.com). If an active
    account already exists for the same email (compared case-insensitively),
    the sign-up is rejected. Runs for the standard self-service sign-up flow;
    admin-created and external-provider flows are passed through unchanged.

    NOTE: this stops *new* duplicates. It does not make existing case-mismatched
    logins succeed — Cognito alias matching on this pool is still
    case-sensitive. Fully case-insensitive login requires recreating the pool
    with signInCaseSensitive=false.
    """
    print("Received event:", json.dumps(event, indent=2))

    trigger_source = event.get("triggerSource", "")
    # Only guard interactive self-service sign-ups. Other flows (admin create,
    # federated provider linking) are passed through untouched.
    if trigger_source != "PreSignUp_SignUp":
        return event

    user_pool_id = event["userPoolId"]
    email = event["request"]["userAttributes"].get("email", "")
    email_lower = email.strip().lower()

    if email_lower and _find_existing_active_user(user_pool_id, email_lower):
        # Surfaced to the user by Cognito as the sign-up failure reason.
        raise Exception("An account with this email already exists.")

    return event
