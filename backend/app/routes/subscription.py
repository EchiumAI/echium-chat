from app.user import User
from app.usecases.subscription import get_subscription_overview
from fastapi import APIRouter, Request

router = APIRouter(tags=["subscription"])


@router.get("/subscription")
def get_my_subscription(request: Request):
    """Current user's plan, usage this period, credit balance and entitlements.

    Backs the in-app billing page and the in-chat consumption indicator.
    """
    current_user: User = request.state.current_user
    return get_subscription_overview(current_user.id)
