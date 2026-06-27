import json
import logging

from app.usecases.paddle_webhook import process_event, verify_signature
from fastapi import APIRouter, Request
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)

router = APIRouter(tags=["webhook"])


@router.post("/webhooks/paddle")
async def paddle_webhook(request: Request):
    """Public Paddle webhook endpoint.

    No Cognito auth (Paddle calls it directly) — the Paddle-Signature HMAC is
    the trust boundary. Invalid signatures are rejected with 401. Always
    returns quickly; processing errors are logged but acknowledged so Paddle
    does not hammer retries for a poison event.
    """
    raw_body = await request.body()
    signature = request.headers.get("Paddle-Signature", "")

    if not verify_signature(raw_body, signature):
        logger.warning("Rejected Paddle webhook: invalid signature")
        return JSONResponse(status_code=401, content={"error": "invalid signature"})

    try:
        payload = json.loads(raw_body.decode("utf-8"))
        process_event(payload)
    except Exception as e:  # noqa: BLE001
        # Acknowledge to avoid retry storms; we log for investigation.
        logger.exception(f"Error processing Paddle webhook: {e}")

    return {"status": "ok"}
