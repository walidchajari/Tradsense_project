try:
    import redis
except Exception:
    redis = None

import json
import os
import time
from functools import wraps

# Initialize Redis connection from environment variables
REDIS_URL = os.environ.get('REDIS_URL') or os.environ.get('CELERY_BROKER_URL', 'redis://localhost:6379/0')
if redis is not None:
    try:
        redis_client = redis.from_url(REDIS_URL)
        redis_client.ping()
        print("Successfully connected to Redis.")
    except Exception as e:
        print(f"Could not connect to Redis: {e}")
        redis_client = None
else:
    print("Redis package not installed; caching disabled.")
    redis_client = None

# Fallback in-memory cache when Redis is unavailable.
_memory_cache = {}

def cache(ttl_seconds: int):
    """
    A decorator to cache the result of a function in Redis.
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Create a cache key based on the function name and arguments
            # Note: This is a simple key generation. For complex args, a more robust
            # hashing mechanism might be needed.
            key_parts = [func.__name__] + list(map(str, args)) + [f"{k}={v}" for k, v in sorted(kwargs.items())]
            cache_key = ":".join(key_parts)

            if not redis_client:
                cached = _memory_cache.get(cache_key)
                if cached and cached["expires_at"] > time.time():
                    return cached["value"]
                result = await func(*args, **kwargs)
                _memory_cache[cache_key] = {"value": result, "expires_at": time.time() + ttl_seconds}
                return result

            try:
                # Try to get the result from cache
                if redis_client:
                    cached_result = redis_client.get(cache_key)
                    if cached_result:
                        print(f"Cache HIT for key: {cache_key}")
                        return json.loads(cached_result)

                # If not in cache, call the function
                print(f"Cache MISS for key: {cache_key}")
                result = await func(*args, **kwargs)

                # Store the result in cache with the specified TTL
                if redis_client:
                    try:
                        redis_client.setex(cache_key, ttl_seconds, json.dumps(result))
                    except Exception as e:
                        print(f"Failed to set cache key: {e}")

                return result
            except Exception as e:
                print(f"An unexpected error occurred in cache decorator: {e}")
                return await func(*args, **kwargs)

        return wrapper
    return decorator
