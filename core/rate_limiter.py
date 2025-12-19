"""
Rate Limiting Middleware for AI Book Generator
Prevents API abuse and ensures fair usage
"""
from fastapi import Request, HTTPException
from datetime import datetime, timedelta
from collections import defaultdict
from typing import Dict, Tuple
import time


class RateLimiter:
    """
    In-memory rate limiter with sliding window algorithm
    For production, use Redis for distributed rate limiting
    """

    def __init__(self):
        # Storage: {key: [(timestamp, count), ...]}
        self.requests: Dict[str, list] = defaultdict(list)
        self.cleanup_interval = 60  # Cleanup old entries every 60 seconds
        self.last_cleanup = time.time()

    def _cleanup_old_entries(self):
        """Remove entries older than 1 hour to prevent memory bloat"""
        current_time = time.time()
        if current_time - self.last_cleanup < self.cleanup_interval:
            return

        cutoff_time = current_time - 3600  # 1 hour ago
        for key in list(self.requests.keys()):
            self.requests[key] = [
                (ts, count) for ts, count in self.requests[key]
                if ts > cutoff_time
            ]
            if not self.requests[key]:
                del self.requests[key]

        self.last_cleanup = current_time

    def check_rate_limit(
        self,
        key: str,
        max_requests: int,
        window_seconds: int
    ) -> Tuple[bool, Dict]:
        """
        Check if request is within rate limit

        Args:
            key: Unique identifier (IP address, user ID, etc.)
            max_requests: Maximum requests allowed
            window_seconds: Time window in seconds

        Returns:
            (is_allowed, info_dict)
        """
        self._cleanup_old_entries()

        current_time = time.time()
        cutoff_time = current_time - window_seconds

        # Remove old entries for this key
        self.requests[key] = [
            (ts, count) for ts, count in self.requests[key]
            if ts > cutoff_time
        ]

        # Count requests in window
        request_count = sum(count for ts, count in self.requests[key])

        if request_count >= max_requests:
            # Calculate retry after
            oldest_request = min(ts for ts, _ in self.requests[key]) if self.requests[key] else current_time
            retry_after = int(window_seconds - (current_time - oldest_request))

            return False, {
                "allowed": False,
                "limit": max_requests,
                "remaining": 0,
                "retry_after": retry_after,
                "window_seconds": window_seconds
            }

        # Add current request
        self.requests[key].append((current_time, 1))

        return True, {
            "allowed": True,
            "limit": max_requests,
            "remaining": max_requests - request_count - 1,
            "retry_after": 0,
            "window_seconds": window_seconds
        }


# Global rate limiter instance
rate_limiter = RateLimiter()


# Rate limit tiers
class RateLimits:
    """Rate limit configurations for different endpoints"""

    # Authentication (per IP)
    AUTH_ATTEMPTS = (5, 300)  # 5 attempts per 5 minutes

    # General API (per user)
    API_GENERAL = (100, 60)  # 100 requests per minute

    # Book creation (per user)
    BOOK_CREATE = (10, 3600)  # 10 books per hour

    # Page generation (per user)
    PAGE_GENERATE = (100, 3600)  # 100 pages per hour

    # Export (per user)
    EXPORT_BOOK = (20, 3600)  # 20 exports per hour

    # Credit purchase (per user)
    CREDIT_PURCHASE = (5, 3600)  # 5 purchases per hour


async def rate_limit_middleware(
    request: Request,
    limit_type: Tuple[int, int],
    key_func=None
):
    """
    Rate limiting middleware

    Args:
        request: FastAPI request object
        limit_type: (max_requests, window_seconds) tuple
        key_func: Function to extract rate limit key from request
    """
    max_requests, window_seconds = limit_type

    # Determine rate limit key
    if key_func:
        # Check if key_func is async or regular function
        import inspect
        if inspect.iscoroutinefunction(key_func):
            key = await key_func(request)
        else:
            key = key_func(request)
    else:
        # Default to IP address
        key = request.client.host if request.client else "unknown"

    # Check rate limit
    is_allowed, info = rate_limiter.check_rate_limit(
        key=f"{request.url.path}:{key}",
        max_requests=max_requests,
        window_seconds=window_seconds
    )

    # Add rate limit headers to response
    request.state.rate_limit_info = info

    if not is_allowed:
        raise HTTPException(
            status_code=429,
            detail={
                "error": "Rate limit exceeded",
                "limit": info["limit"],
                "window_seconds": info["window_seconds"],
                "retry_after": info["retry_after"]
            },
            headers={
                "X-RateLimit-Limit": str(info["limit"]),
                "X-RateLimit-Remaining": str(info["remaining"]),
                "X-RateLimit-Reset": str(int(time.time()) + info["retry_after"]),
                "Retry-After": str(info["retry_after"])
            }
        )

    return info
