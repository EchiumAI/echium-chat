"""Repository for subscription, usage and prepaid-credit records.

Single-table design on the subscription table:
    PK = USER#{user_id}
    SK = SUBSCRIPTION              -> SubscriptionModel
    SK = USAGE#{YYYY-MM}           -> UsageModel
    SK = LEDGER#{iso8601}#{uuid}   -> CreditLedgerEntryModel

Usage counters and the credit balance are mutated with atomic ADD updates so
concurrent messages do not lose increments.
"""

from __future__ import annotations

import logging
import uuid
from datetime import datetime, timezone
from decimal import Decimal
from typing import Optional

from app.repositories.common import get_subscription_table_client
from app.repositories.models.subscription import (
    CreditLedgerEntryModel,
    PlanId,
    SubscriptionModel,
    SubscriptionStatus,
    UsageModel,
)
from boto3.dynamodb.conditions import Key

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

SUBSCRIPTION_SK = "SUBSCRIPTION"


def _pk(user_id: str) -> str:
    return f"USER#{user_id}"


def _usage_sk(period: str) -> str:
    return f"USAGE#{period}"


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def current_period(now: Optional[datetime] = None) -> str:
    """Return the current monthly usage-period key, e.g. '2026-06'."""
    now = now or datetime.now(timezone.utc)
    return now.strftime("%Y-%m")


def _to_decimal(value: float) -> Decimal:
    # DynamoDB rejects float; route money/amounts through Decimal via str to
    # avoid binary-float artefacts.
    return Decimal(str(value))


def _from_dynamo_number(value) -> float:
    return float(value) if value is not None else 0.0


# --------------------------------------------------------------------------- #
# Subscription
# --------------------------------------------------------------------------- #


def get_subscription(user_id: str) -> Optional[SubscriptionModel]:
    """Fetch a user's subscription record, or None if they have none yet."""
    table = get_subscription_table_client()
    response = table.get_item(Key={"PK": _pk(user_id), "SK": SUBSCRIPTION_SK})
    item = response.get("Item")
    if not item:
        return None
    return SubscriptionModel(
        user_id=user_id,
        plan=item.get("Plan", "free"),
        status=item.get("Status", "active"),
        paddle_customer_id=item.get("PaddleCustomerId"),
        paddle_subscription_id=item.get("PaddleSubscriptionId"),
        credit_balance_eur=_from_dynamo_number(item.get("CreditBalanceEur", 0)),
        current_period_start=item.get("CurrentPeriodStart"),
        current_period_end=item.get("CurrentPeriodEnd"),
        created_at=item.get("CreatedAt", ""),
        updated_at=item.get("UpdatedAt", ""),
    )


def get_or_create_subscription(user_id: str) -> SubscriptionModel:
    """Return the user's subscription, creating a default free one if absent."""
    existing = get_subscription(user_id)
    if existing is not None:
        return existing

    now = _now_iso()
    sub = SubscriptionModel(
        user_id=user_id,
        plan="free",
        status="active",
        credit_balance_eur=0.0,
        created_at=now,
        updated_at=now,
    )
    table = get_subscription_table_client()
    # Conditional put avoids clobbering a record created concurrently.
    try:
        table.put_item(
            Item={
                "PK": _pk(user_id),
                "SK": SUBSCRIPTION_SK,
                "Plan": sub.plan,
                "Status": sub.status,
                "CreditBalanceEur": _to_decimal(sub.credit_balance_eur),
                "CreatedAt": sub.created_at,
                "UpdatedAt": sub.updated_at,
            },
            ConditionExpression="attribute_not_exists(PK)",
        )
        return sub
    except table.meta.client.exceptions.ConditionalCheckFailedException:
        # Lost the race; return the record that won.
        created = get_subscription(user_id)
        assert created is not None
        return created


def upsert_subscription(
    user_id: str,
    *,
    plan: Optional[PlanId] = None,
    status: Optional[SubscriptionStatus] = None,
    paddle_customer_id: Optional[str] = None,
    paddle_subscription_id: Optional[str] = None,
    current_period_start: Optional[str] = None,
    current_period_end: Optional[str] = None,
) -> None:
    """Create or update a subscription from a billing event (e.g. webhook).

    Only the provided fields are written; omitted fields are left unchanged.
    """
    table = get_subscription_table_client()

    set_parts = ["UpdatedAt = :updated_at"]
    values: dict = {":updated_at": _now_iso()}
    # Ensure CreatedAt exists on first write.
    set_parts.append("CreatedAt = if_not_exists(CreatedAt, :created_at)")
    values[":created_at"] = _now_iso()

    field_map = {
        "Plan": plan,
        "Status": status,
        "PaddleCustomerId": paddle_customer_id,
        "PaddleSubscriptionId": paddle_subscription_id,
        "CurrentPeriodStart": current_period_start,
        "CurrentPeriodEnd": current_period_end,
    }
    for attr, val in field_map.items():
        if val is not None:
            placeholder = f":{attr.lower()}"
            set_parts.append(f"{attr} = {placeholder}")
            values[placeholder] = val

    table.update_item(
        Key={"PK": _pk(user_id), "SK": SUBSCRIPTION_SK},
        UpdateExpression="SET " + ", ".join(set_parts),
        ExpressionAttributeValues=values,
    )


def find_user_id_by_paddle_customer_id(paddle_customer_id: str) -> Optional[str]:
    """Resolve the owning user id from a Paddle customer id via the GSI.

    Used by the webhook handler to map an incoming event back to a user.
    """
    table = get_subscription_table_client()
    response = table.query(
        IndexName="PaddleCustomerIdIndex",
        KeyConditionExpression=Key("PaddleCustomerId").eq(paddle_customer_id),
        Limit=1,
    )
    items = response.get("Items", [])
    if not items:
        return None
    pk = items[0].get("PK", "")
    return pk.removeprefix("USER#") or None


# --------------------------------------------------------------------------- #
# Usage
# --------------------------------------------------------------------------- #


def get_usage(user_id: str, period: Optional[str] = None) -> UsageModel:
    """Fetch usage for a period (defaults to the current month). Returns a
    zeroed model if no usage has been recorded yet."""
    period = period or current_period()
    table = get_subscription_table_client()
    response = table.get_item(Key={"PK": _pk(user_id), "SK": _usage_sk(period)})
    item = response.get("Item")
    if not item:
        return UsageModel(user_id=user_id, period=period, updated_at=_now_iso())
    return UsageModel(
        user_id=user_id,
        period=period,
        message_count=int(item.get("MessageCount", 0)),
        input_tokens=int(item.get("InputTokens", 0)),
        output_tokens=int(item.get("OutputTokens", 0)),
        cost_eur=_from_dynamo_number(item.get("CostEur", 0)),
        updated_at=item.get("UpdatedAt", ""),
    )


def increment_usage(
    user_id: str,
    *,
    messages: int = 1,
    input_tokens: int = 0,
    output_tokens: int = 0,
    cost_eur: float = 0.0,
    period: Optional[str] = None,
) -> UsageModel:
    """Atomically add to a user's usage counters for the period and return the
    updated totals. Safe under concurrency (uses DynamoDB ADD)."""
    period = period or current_period()
    table = get_subscription_table_client()
    response = table.update_item(
        Key={"PK": _pk(user_id), "SK": _usage_sk(period)},
        UpdateExpression=(
            "ADD MessageCount :m, InputTokens :it, OutputTokens :ot, CostEur :c "
            "SET UpdatedAt = :u"
        ),
        ExpressionAttributeValues={
            ":m": messages,
            ":it": input_tokens,
            ":ot": output_tokens,
            ":c": _to_decimal(cost_eur),
            ":u": _now_iso(),
        },
        ReturnValues="ALL_NEW",
    )
    attrs = response.get("Attributes", {})
    return UsageModel(
        user_id=user_id,
        period=period,
        message_count=int(attrs.get("MessageCount", 0)),
        input_tokens=int(attrs.get("InputTokens", 0)),
        output_tokens=int(attrs.get("OutputTokens", 0)),
        cost_eur=_from_dynamo_number(attrs.get("CostEur", 0)),
        updated_at=attrs.get("UpdatedAt", ""),
    )


# --------------------------------------------------------------------------- #
# Prepaid credit (pay-as-you-go)
# --------------------------------------------------------------------------- #


def adjust_credit(
    user_id: str,
    amount_eur: float,
    *,
    kind: str = "adjustment",
    description: str = "",
) -> float:
    """Atomically adjust the prepaid credit balance (positive=top-up,
    negative=debit), write a ledger entry, and return the new balance."""
    table = get_subscription_table_client()
    response = table.update_item(
        Key={"PK": _pk(user_id), "SK": SUBSCRIPTION_SK},
        UpdateExpression="ADD CreditBalanceEur :a SET UpdatedAt = :u",
        ExpressionAttributeValues={
            ":a": _to_decimal(amount_eur),
            ":u": _now_iso(),
        },
        ReturnValues="ALL_NEW",
    )
    new_balance = _from_dynamo_number(
        response.get("Attributes", {}).get("CreditBalanceEur", 0)
    )

    entry = CreditLedgerEntryModel(
        user_id=user_id,
        entry_id=str(uuid.uuid4()),
        amount_eur=amount_eur,
        kind=kind,  # type: ignore[arg-type]
        description=description,
        balance_after_eur=new_balance,
        created_at=_now_iso(),
    )
    table.put_item(
        Item={
            "PK": _pk(user_id),
            "SK": f"LEDGER#{entry.created_at}#{entry.entry_id}",
            "AmountEur": _to_decimal(entry.amount_eur),
            "Kind": entry.kind,
            "Description": entry.description,
            "BalanceAfterEur": _to_decimal(entry.balance_after_eur),
            "CreatedAt": entry.created_at,
        }
    )
    return new_balance
