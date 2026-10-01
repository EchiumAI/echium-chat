from app.routes.schemas.user_feedback import UserFeedbackInput, UserFeedbackOutput
from app.usecases.user_feedback import submit_feedback
from app.user import User
from fastapi import APIRouter, Request

router = APIRouter(tags=["feedback"])


@router.post("/feedback", response_model=UserFeedbackOutput)
def post_feedback(request: Request, feedback_input: UserFeedbackInput):
    """Submit a bug report or idea from the in-app Feedback widget.

    Stored in the workspace store, then filed as a GitHub issue in the repo of
    the app it came from (best-effort).
    """
    current_user: User = request.state.current_user
    return submit_feedback(current_user.id, feedback_input)
