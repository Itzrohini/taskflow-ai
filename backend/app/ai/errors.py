from fastapi import Request
from fastapi.responses import JSONResponse


class AIError(Exception):
    status_code = 502
    code = "ai_error"
    message = "The AI service could not complete the request."

    def __init__(self) -> None:
        super().__init__(self.message)


class AINotConfiguredError(AIError):
    status_code = 503
    code = "ai_not_configured"
    message = "AI features are not configured."


class AITimeoutError(AIError):
    status_code = 504
    code = "ai_timeout"
    message = "The AI request timed out."


class AIRateLimitedError(AIError):
    status_code = 429
    code = "ai_rate_limited"
    message = "The AI request limit has been reached. Try again later."


class AIInvalidOutputError(AIError):
    status_code = 502
    code = "ai_invalid_output"
    message = "The AI returned an unusable response. Please try again."


class AIProviderError(AIError):
    status_code = 502
    code = "ai_provider_error"
    message = "The AI service is temporarily unavailable."


async def ai_exception_handler(request: Request, exc: AIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.message, "code": exc.code},
    )
