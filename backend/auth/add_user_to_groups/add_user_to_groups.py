import os
import json

import boto3
from aws_lambda_powertools import Logger, Tracer
from aws_lambda_powertools.utilities.typing import LambdaContext

USER_POOL_ID: str = os.environ["USER_POOL_ID"]
AUTO_JOIN_USER_GROUPS: list[str] = json.loads(
    os.environ.get("AUTO_JOIN_USER_GROUPS", "[]")
)
# Owner address to notify on new sign-ups (optional). Must be SES-verified
# while SES is in sandbox. Empty = notifications disabled.
OWNER_EMAIL: str = os.environ.get("OWNER_EMAIL", "")
SES_REGION: str = os.environ.get("SES_REGION", "eu-west-1")
FROM_EMAIL: str = os.environ.get("NOTIFY_FROM_EMAIL", "noreply@echium.ai")

logger = Logger()
tracer = Tracer()

cognito = boto3.client("cognito-idp")


def notify_owner_of_signup(user_attributes: dict) -> None:
    """Email the owner that a new user signed up. Best-effort: never block
    the Cognito flow on a notification failure."""
    if not OWNER_EMAIL:
        return
    new_email = user_attributes.get("email", "(unknown)")
    try:
        ses = boto3.client("ses", region_name=SES_REGION)
        ses.send_email(
            Source=FROM_EMAIL,
            Destination={"ToAddresses": [OWNER_EMAIL]},
            Message={
                "Subject": {"Data": "New Echium AI sign-up"},
                "Body": {"Text": {"Data": f"A new user just signed up: {new_email}"}},
            },
        )
        logger.info(f"Sent sign-up notification for {new_email}")
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Failed to send sign-up notification: {e}")


@tracer.capture_lambda_handler
@logger.inject_lambda_context(log_event=True)
def handler(event: dict, context: LambdaContext) -> dict:
    user_name: str = event["userName"]
    user_attributes: dict = event["request"]["userAttributes"]

    trigger_source: str = event["triggerSource"]
    if trigger_source == "PostConfirmation_ConfirmSignUp":
        add_user_to_groups(USER_POOL_ID, user_name, AUTO_JOIN_USER_GROUPS)
        notify_owner_of_signup(user_attributes)

    elif trigger_source == "PostAuthentication_Authentication":
        user_status: str = user_attributes["cognito:user_status"]
        if user_status == "FORCE_CHANGE_PASSWORD":
            add_user_to_groups(USER_POOL_ID, user_name, AUTO_JOIN_USER_GROUPS)

    return event


def add_user_to_groups(user_pool_id: str, username: str, groups: list[str]):
    for group in groups:
        logger.info(f"Adding user '{username}' to group '{group}'")
        cognito.admin_add_user_to_group(
            UserPoolId=user_pool_id,
            Username=username,
            GroupName=group,
        )
