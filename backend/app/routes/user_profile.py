from app.repositories.models.user_profile import UserProfileModel
from app.routes.schemas.user_profile import (
    UserProfileInput,
    UserProfileOutput,
    UserProfileReflectInput,
    UserProfileReflectOutput,
)
from app.usecases.user_profile import (
    SENSITIVE_CONSENT_VERSION,
    clear_profile,
    get_profile,
    reflect_profile,
    update_profile,
)
from app.user import User
from fastapi import APIRouter, HTTPException, Request

router = APIRouter(tags=["profile"])


def _to_output(profile: UserProfileModel) -> UserProfileOutput:
    return UserProfileOutput(
        enabled=profile.enabled,
        profile=profile.profile,
        sensitive=profile.sensitive,
        sensitive_consent=profile.sensitive_consent,
        consent_time=profile.consent_time,
        consent_version=profile.consent_version,
        current_consent_version=SENSITIVE_CONSENT_VERSION,
        share_all_agents=profile.share_all_agents,
        allowed_agent_ids=profile.allowed_agent_ids,
        update_time=profile.update_time,
    )


@router.get("/profile", response_model=UserProfileOutput)
def get_user_profile(request: Request):
    """The user's Profile & memory (a default, empty profile if none yet)."""
    current_user: User = request.state.current_user
    return _to_output(get_profile(current_user.id))


@router.put("/profile", response_model=UserProfileOutput)
def put_user_profile(request: Request, profile_input: UserProfileInput):
    """Save the user's edits, sharing choices and sensitive-data consent."""
    current_user: User = request.state.current_user
    try:
        profile = update_profile(
            current_user.id,
            enabled=profile_input.enabled,
            profile=profile_input.profile,
            sensitive=profile_input.sensitive,
            sensitive_consent=profile_input.sensitive_consent,
            share_all_agents=profile_input.share_all_agents,
            allowed_agent_ids=profile_input.allowed_agent_ids,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return _to_output(profile)


@router.delete("/profile")
def delete_user_profile(request: Request):
    """Delete the profile, the sensitive section, consent and sharing."""
    current_user: User = request.state.current_user
    clear_profile(current_user.id)
    return {"status": "ok"}


@router.post("/profile/reflect", response_model=UserProfileReflectOutput)
def post_user_profile_reflect(request: Request, reflect_input: UserProfileReflectInput):
    """Update the profile from a finished turn. Called fire-and-forget."""
    current_user: User = request.state.current_user
    _, changed = reflect_profile(current_user.id, reflect_input.conversation_id)
    return UserProfileReflectOutput(changed=changed)
