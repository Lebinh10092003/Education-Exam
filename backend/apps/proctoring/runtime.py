from functools import lru_cache
from typing import Any

import redis
from django.conf import settings
from django.utils import timezone


def _normalize_session_id(session_id: Any) -> str:
    return str(session_id)


def _presence_key(session_id: Any) -> str:
    return f"presence:session:{_normalize_session_id(session_id)}"


def _monitor_session_key(session_id: Any) -> str:
    return f"monitor:session:{_normalize_session_id(session_id)}"


def _monitor_exam_sessions_key(exam_id: Any) -> str:
    return f"monitor:exam:{exam_id}:sessions"


def _live_request_key(session_id: Any) -> str:
    return f"live:req:session:{_normalize_session_id(session_id)}"


def _live_slots_key() -> str:
    return "live:slots"


def _live_exam_slots_key(exam_id: Any) -> str:
    return f"live:slots:exam:{exam_id}"


def _current_timestamp_ms():
    return int(timezone.now().timestamp() * 1000)


def _filter_reserved_payload(payload, reserved_fields):
    return {key: value for key, value in (payload or {}).items() if key not in reserved_fields}


@lru_cache(maxsize=1)
def get_runtime_redis():
    return redis.Redis.from_url(
        settings.REDIS_RUNTIME_URL,
        decode_responses=True,
        max_connections=settings.REDIS_RUNTIME_MAX_CONNECTIONS,
    )


def _runtime_ttl_seconds(ttl_seconds=None):
    if ttl_seconds is not None:
        return max(int(ttl_seconds), 0)
    return max(int(getattr(settings, "PROCTORING_PRESENCE_TTL_SECONDS", 150)), 0)


def _serialize_mapping(payload):
    serialized = {}
    for key, value in payload.items():
        if value is None:
            continue
        if isinstance(value, bool):
            serialized[key] = "1" if value else "0"
        elif isinstance(value, (dict, list)):
            serialized[key] = str(value)
        else:
            serialized[key] = str(value)
    return serialized


def _coerce_bool(value):
    if isinstance(value, bool):
        return value
    if value is None:
        return False
    if isinstance(value, (int, float)):
        return bool(value)
    return str(value).strip().lower() in {"1", "true", "yes", "on", "online", "active"}


def _coerce_int(value):
    if value in (None, ""):
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return value


def _decode_monitor_state(mapping):
    decoded = {}
    for key, value in mapping.items():
        if key in {"question_index"}:
            decoded[key] = _coerce_int(value)
        elif key in {"camera_ready", "screen_ready"}:
            decoded[key] = _coerce_bool(value)
        else:
            decoded[key] = value
    return decoded


def refresh_presence(*, session_id, exam_id, payload=None, ttl_seconds=None):
    client = get_runtime_redis()
    ttl = _runtime_ttl_seconds(ttl_seconds)
    now = timezone.now().isoformat()
    payload = payload or {}
    monitor_state = {
        "state": "online",
        "connection_status": payload.get("connection_status", "online"),
        "updated_at": now,
    }
    monitor_state.update(
        _filter_reserved_payload(
            payload,
            {
                "state",
                "connection_status",
                "updated_at",
                "presence",
                "session_id",
                "exam_id",
                "ttl_seconds",
                "online",
            },
        )
    )
    monitor_state = _serialize_mapping(monitor_state)

    client.set(_presence_key(session_id), "online", ex=ttl)
    client.hset(_monitor_session_key(session_id), mapping=monitor_state)
    client.expire(_monitor_session_key(session_id), ttl)
    client.sadd(_monitor_exam_sessions_key(exam_id), _normalize_session_id(session_id))
    client.expire(_monitor_exam_sessions_key(exam_id), ttl)
    return {
        "session_id": session_id,
        "exam_id": exam_id,
        "presence": "online",
        "ttl_seconds": ttl,
        "state": monitor_state,
    }


def mark_live_request(*, session_id, enabled, payload=None, ttl_seconds=None):
    client = get_runtime_redis()
    ttl = _runtime_ttl_seconds(ttl_seconds)
    key = _live_request_key(session_id)
    if not enabled:
        now = timezone.now().isoformat()
        request_state = {
            "enabled": "0",
            "state": "disabled",
            "updated_at": now,
        }
        request_state.update(
            _filter_reserved_payload(
                payload,
                {
                    "enabled",
                    "state",
                    "updated_at",
                    "session_id",
                    "ttl_seconds",
                },
            )
        )
        client.hset(key, mapping=_serialize_mapping(request_state))
        client.expire(key, ttl)
        return {"session_id": session_id, "enabled": False, "ttl_seconds": ttl, "state": request_state}

    now = timezone.now().isoformat()
    request_state = {
        "enabled": "1",
        "state": "enabled",
        "updated_at": now,
    }
    request_state.update(
        _filter_reserved_payload(
            payload,
            {
                "enabled",
                "state",
                "updated_at",
                "session_id",
                "ttl_seconds",
            },
        )
    )
    client.hset(key, mapping=_serialize_mapping(request_state))
    client.expire(key, ttl)
    return {"session_id": session_id, "enabled": True, "ttl_seconds": ttl, "state": request_state}


def acquire_live_slot(*, session_id, exam_id=None, max_slots=None, max_exam_slots=None):
    client = get_runtime_redis()
    quota = max_slots
    if quota is None:
        quota = getattr(settings, "PROCTORING_MAX_CONCURRENT_LIVE_VIEWS", 5)
    quota = max(int(quota), 0)
    exam_quota = max_exam_slots
    if exam_quota is None:
        exam_quota = getattr(settings, "PROCTORING_MAX_LIVE_VIEWS_PER_EXAM", 3)
    exam_quota = max(int(exam_quota), 0)
    member = _normalize_session_id(session_id)
    slots_key = _live_slots_key()
    exam_slots_key = _live_exam_slots_key(exam_id) if exam_id is not None else ""
    lease_seconds = max(int(getattr(settings, "PROCTORING_PRESENCE_TTL_SECONDS", 150)), 1)
    lease_until_ms = _current_timestamp_ms() + (lease_seconds * 1000)
    slots_ttl_seconds = lease_seconds * 2
    script = """
    local slots_key = KEYS[1]
    local exam_slots_key = KEYS[2]
    local member = ARGV[1]
    local quota = tonumber(ARGV[2])
    local exam_quota = tonumber(ARGV[3])
    local lease_until_ms = tonumber(ARGV[4])
    local now_ms = tonumber(ARGV[5])
    local slots_ttl_seconds = tonumber(ARGV[6])

    redis.call("ZREMRANGEBYSCORE", slots_key, "-inf", now_ms)
    if exam_slots_key ~= "" then
        redis.call("ZREMRANGEBYSCORE", exam_slots_key, "-inf", now_ms)
    end

    if redis.call("ZSCORE", slots_key, member) then
        redis.call("ZADD", slots_key, lease_until_ms, member)
        redis.call("EXPIRE", slots_key, slots_ttl_seconds)
        if exam_slots_key ~= "" then
            redis.call("ZADD", exam_slots_key, lease_until_ms, member)
            redis.call("EXPIRE", exam_slots_key, slots_ttl_seconds)
        end
        return 1
    end

    local current = redis.call("ZCARD", slots_key)
    if current >= quota then
        return 0
    end

    if exam_slots_key ~= "" then
        local exam_current = redis.call("ZCARD", exam_slots_key)
        if exam_current >= exam_quota then
            return 0
        end
    end

    redis.call("ZADD", slots_key, lease_until_ms, member)
    redis.call("EXPIRE", slots_key, slots_ttl_seconds)
    if exam_slots_key ~= "" then
        redis.call("ZADD", exam_slots_key, lease_until_ms, member)
        redis.call("EXPIRE", exam_slots_key, slots_ttl_seconds)
    end
    return 1
    """
    return bool(
        client.eval(
            script,
            2,
            slots_key,
            exam_slots_key,
            member,
            quota,
            exam_quota,
            lease_until_ms,
            _current_timestamp_ms(),
            slots_ttl_seconds,
        )
    )


def release_live_slot(*, session_id, exam_id=None):
    client = get_runtime_redis()
    member = _normalize_session_id(session_id)
    removed = bool(client.zrem(_live_slots_key(), member))
    if exam_id is not None:
        removed = bool(client.zrem(_live_exam_slots_key(exam_id), member)) or removed
    client.delete(_live_request_key(session_id))
    return removed


def get_runtime_snapshot(*, session_id, default=None, exam_id=None):
    client = get_runtime_redis()
    snapshot = dict(default or {})
    monitor_state = client.hgetall(_monitor_session_key(session_id)) or {}
    if monitor_state:
        snapshot.update(_decode_monitor_state(monitor_state))

    presence = client.get(_presence_key(session_id))
    if presence is not None:
        snapshot["presence"] = presence
        snapshot["online"] = presence == "online"

    live_request = client.hgetall(_live_request_key(session_id)) or {}
    if live_request:
        snapshot["live_request"] = {
            "enabled": _coerce_bool(live_request.get("enabled")),
            "updated_at": live_request.get("updated_at"),
            **{
                key: value
                for key, value in live_request.items()
                if key not in {"enabled", "updated_at"}
            },
        }
    live_slot_score = client.zscore(_live_slots_key(), _normalize_session_id(session_id))
    snapshot["live_slot_active"] = live_slot_score is not None and live_slot_score > _current_timestamp_ms()

    if exam_id is not None:
        snapshot["exam_id"] = exam_id
        snapshot["active_session_ids"] = sorted(client.smembers(_monitor_exam_sessions_key(exam_id)))

    snapshot.setdefault("session_id", session_id)
    return snapshot
