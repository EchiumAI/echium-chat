# Runbook: Upgrade a user

How to change what a user can access. There are two distinct kinds of "upgrade":

1. **Full / unlimited access** (company staff, developers, comps) — done by
   adding the user to a **Cognito group**. Instant, free, no billing.
2. **A paid plan** (Starter / Pro / Business / Max) or **pay-as-you-go credit**
   — normally self-serve via checkout; plan state lives in DynamoDB, not
   Cognito.

Prerequisites: AWS CLI configured for the **deploy account** (`888284248988`),
region `eu-west-1`. All commands below use that region.

---

## 1. Grant full access (Unlimited group)

Members of the **`Unlimited`** group (and **`Admin`**) bypass **all** plan
limits: no message cap, every model, every feature. This is the mechanism for
giving yourself or a colleague full access.

### Step 1 — find the user pool id
```
aws cognito-idp list-user-pools --max-results 20 --region eu-west-1 \
  --query "UserPools[].[Id,Name]" --output text
```
The Echium pool is the one named `AuthUserPool...` (e.g. `eu-west-1_KjEdTOlcO`).

### Step 2 — find the user's Username
Cognito `Username` is usually a UUID, not the email — look it up by email:
```
aws cognito-idp list-users --user-pool-id <POOL_ID> --region eu-west-1 \
  --query "Users[].[Username,Attributes[?Name=='email'].Value|[0]]" --output text
```

### Step 3 — add the user to the group
```
aws cognito-idp admin-add-user-to-group \
  --user-pool-id <POOL_ID> \
  --username <USERNAME> \
  --group-name Unlimited \
  --region eu-west-1
```

### Step 4 — user must re-login
Group membership is written into the **JWT at sign-in**, so the change only
takes effect after the user **signs out and back in**.

### Verify
```
aws cognito-idp admin-list-groups-for-user \
  --user-pool-id <POOL_ID> --username <USERNAME> --region eu-west-1 \
  --query "Groups[].GroupName" --output text
```

### Remove full access
```
aws cognito-idp admin-remove-user-from-group \
  --user-pool-id <POOL_ID> --username <USERNAME> \
  --group-name Unlimited --region eu-west-1
```
(Again, effective on their next sign-in.)

---

## Cognito groups reference

| Group | Effect |
|---|---|
| `Admin` | Full admin UI + bypasses all plan limits (implies Unlimited-level access). |
| `Unlimited` | Bypasses all plan limits / model gating. No admin UI. Use for staff/devs. |
| `CreatingBotAllowed` | May create custom bots (if bot creation is restricted). |
| `PublishAllowed` | May publish a bot as an API. |

Enforcement rule (backend): a user bypasses limits when
`is_admin() or "Unlimited" in groups`. See
`backend/app/usecases/chat.py` and `backend/app/routes/subscription.py`.

---

## 2. Change a paid plan or add credit

Paid tiers and PAYG credit are **not** Cognito groups — they live in the
subscription table (DynamoDB) and are driven by **Paddle** checkout.

- **Normal path:** the user upgrades themselves on the site at **`/account`**
  (Paddle overlay checkout). The Paddle webhook updates their plan
  automatically. No manual action needed.
- Plan/model/feature entitlements per tier are defined in
  `backend/app/usecases/plans.py` (enforced) and mirrored in
  `frontend/src/constants/plans.ts` (pricing UI).

### Manually inspect a user's plan/usage (read-only)
The subscription table is keyed `PK = USER#{userId}`, `SK = SUBSCRIPTION`:
```
aws dynamodb get-item --region eu-west-1 \
  --table-name <SubscriptionTableName> \
  --key '{"PK":{"S":"USER#<userId>"},"SK":{"S":"SUBSCRIPTION"}}'
```
Find `<SubscriptionTableName>` in the stack outputs (`SubscriptionTableName`).

> Prefer the Unlimited group over hand-editing the subscription record. Manually
> writing plan rows bypasses Paddle and can drift from billing state. Only edit
> directly if you understand the item schema (see
> `backend/app/repositories/subscription.py`).

---

## Notes

- Changes to Cognito groups always require the user to re-authenticate.
- For a brand-new colleague: have them sign up normally first (so the account +
  default free subscription exist), then add them to `Unlimited`.
- Removing someone from `Unlimited` drops them back to their actual paid/free
  plan on next login.
