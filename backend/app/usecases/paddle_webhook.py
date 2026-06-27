"""Paddle webhook handling: signature verification + event processing.

Keeps our subscription/credit state in sync with Paddle. The webhook route is
public (no Cognito), so signature verification is the trust boundary — every
request must carry a valid Paddle-Signature computed with our destination's
secret key (stored in Secrets Manager).
"""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
from typing import Optional

import boto3
from app.repositories.subscription import (
    adjust_credit,
    find_user_id_by_paddle_customer_id,
    upsert_subscription,
)
from app.usecases.plans import credit_for_price_id, plan_for_price_id

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

PADDLE_SECRET_NAME = os.environ.get("PADDLE_SECRET_NAME", "echium/paddle")
REGION = os.environ.get("REGION", "eu-west-1")

_cached_secret: Optional[str] = None


def _get_webhook_secret() -> Optional[str]:
    """Fetch (and cache) the Paddle webhook signing secret from Secrets
    Manager. Returns None if unavailable (handler then rejects requests)."""
    global _cached_secret
    if _cached_secret:
        return _cached_secret
    try:
        client = boto3.client("secretsmanager", region_name=REGION)
        resp = client.get_secret_value(SecretId=PADDLE_SECRET_NAME)
        data = json.loads(resp["SecretString"])
        _cached_secret = data.get("webhookSecret")
        return _cached_secret
    except Exception as e:  # noqa: BLE001
        logger.error(f"Could not load Paddle webhook secret: {e}")
        return None


def verify_signature(raw_body: bytes, signature_header: str) -> bool:
    """Verify Paddle's `Paddle-Signature` header.

    Format: "ts=<unix>;h1=<hex hmac>". The signed payload is "<ts>:<raw body>"
    HMAC-SHA256'd with the destination secret key. Constant-time compared.
    """
    secret = _get_webhook_secret()
    if not secret or not signature_header:
        return False

    parts = dict(kv.split("=", 1) for kv in signature_header.split(";") if "=" in kv)
    ts = parts.get("ts")
    h1 = parts.get("h1")
    if not ts or not h1:
        return False

    signed_payload = f"{ts}:".encode("utf-8") + raw_body
    expected = hmac.new(
        secret.encode("utf-8"), signed_payload, hashlib.sha256
    ).hexdigest()
    return hmac.compare_digest(expected, h1)


def _resolve_user_id(data: dict) -> Optional[str]:
    """Resolve our user id from an event's data object.

    Prefers custom_data.user_id (set when we open checkout); falls back to the
    Paddle customer id via the GSI for events that lack custom_data.
    """
    custom = data.get("custom_data") or {}
    user_id = custom.get("user_id")
    if user_id:
        return user_id
    customer_id = data.get("customer_id")
    if customer_id:
        return find_user_id_by_paddle_customer_id(customer_id)
    return None


def _items_price_ids(data: dict) -> list[str]:
    ids = []
    for item in data.get("items", []) or []:
        price = item.get("price") or {}
        pid = price.get("id") or item.get("price_id")
        if pid:
            ids.append(pid)
    return ids


# Map Paddle subscription status -> our SubscriptionStatus.
_STATUS_MAP = {
    "active": "active",
    "trialing": "trialing",
    "past_due": "past_due",
    "paused": "paused",
    "canceled": "cancelled",
}


def process_event(payload: dict) -> None:
    """Apply a verified Paddle event to our subscription/credit state."""
    event_type = payload.get("event_type", "")
    data = payload.get("data", {}) or {}
    user_id = _resolve_user_id(data)

    logger.info(f"Paddle event {event_type} for user {user_id}")
    if not user_id:
        logger.warning(f"No user resolved for event {event_type}; skipping")
        return

    if event_type.startswith("subscription."):
        status = _STATUS_MAP.get(data.get("status", ""), "active")
        # Resolve plan from the subscription's recurring price.
        plan = None
        for pid in _items_price_ids(data):
            plan = plan_for_price_id(pid) or plan
        if event_type == "subscription.canceled":
            # Drop back to free on cancellation.
            upsert_subscription(
                user_id,
                plan="free",
                status="cancelled",
                paddle_customer_id=data.get("customer_id"),
                paddle_subscription_id=data.get("id"),
            )
            return
        upsert_subscription(
            user_id,
            plan=plan,  # type: ignore[arg-type]
            status=status,  # type: ignore[arg-type]
            paddle_customer_id=data.get("customer_id"),
            paddle_subscription_id=data.get("id"),
            current_period_start=(data.get("current_billing_period") or {}).get(
                "starts_at"
            ),
            current_period_end=(data.get("current_billing_period") or {}).get(
                "ends_at"
            ),
        )

    elif event_type == "transaction.completed":
        # One-time PAYG top-ups: add credit for each matching price.
        # (Subscription renewals also fire transaction.completed but their
        # prices are not in the top-up map, so they add no credit here.)
        total_credit = 0.0
        for pid in _items_price_ids(data):
            amount = credit_for_price_id(pid)
            if amount:
                total_credit += amount
        if total_credit > 0:
            new_balance = adjust_credit(
                user_id,
                total_credit,
                kind="topup",
                description=f"Paddle top-up ({payload.get('event_id', '')})",
            )
            # Ensure the user is on the PAYG plan after buying credit.
            upsert_subscription(
                user_id,
                plan="payg",
                status="active",
                paddle_customer_id=data.get("customer_id"),
            )
            logger.info(f"Credited user {user_id}; new balance {new_balance}")
