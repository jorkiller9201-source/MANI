from pathlib import Path

from fastapi import Request
from slowapi import Limiter

_RATELIMIT_ENV = Path(__file__).resolve().parent / "ratelimit.env"


def get_client_ip_for_rate_limit(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    if request.client and request.client.host:
        return request.client.host
    return "127.0.0.1"


limiter = Limiter(key_func=get_client_ip_for_rate_limit, config_filename=str(_RATELIMIT_ENV))
