from collections import deque
from collections.abc import Callable
from threading import Lock
from time import monotonic

from fastapi import Request

from app.ai.errors import AIRateLimitedError
from app.core.config import get_settings

WINDOW_SECONDS = 60 * 60


class SlidingWindowRateLimiter:
    """Per-process sliding-window limiter; counters reset when the process restarts."""

    def __init__(self, clock: Callable[[], float] = monotonic) -> None:
        self._clock = clock
        self._events: dict[str, deque[float]] = {}
        self._lock = Lock()

    def check(self, key: str, limit: int) -> None:
        now = self._clock()
        cutoff = now - WINDOW_SECONDS
        with self._lock:
            for existing_key, events in list(self._events.items()):
                while events and events[0] <= cutoff:
                    events.popleft()
                if not events:
                    del self._events[existing_key]

            events = self._events.setdefault(key, deque())
            if len(events) >= limit:
                raise AIRateLimitedError()
            events.append(now)


_ai_rate_limiter = SlidingWindowRateLimiter()


def enforce_ai_rate_limit(request: Request) -> None:
    client_ip = request.client.host if request.client is not None else "unknown"
    _ai_rate_limiter.check(
        client_ip,
        get_settings().AI_RATE_LIMIT_PER_HOUR,
    )
