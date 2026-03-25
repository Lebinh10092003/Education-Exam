import pytest
from django.conf import settings


class FakeRedis:
    def __init__(self):
        self.values = {}
        self.hashes = {}
        self.sets = {}
        self.zsets = {}
        self.expiries = {}

    def set(self, key, value, ex=None):
        self.values[key] = value
        if ex is not None:
            self.expiries[key] = ex
        return True

    def get(self, key):
        return self.values.get(key)

    def hset(self, key, mapping=None, **kwargs):
        data = dict(mapping or {})
        data.update(kwargs)
        self.hashes.setdefault(key, {}).update(data)
        return len(data)

    def hgetall(self, key):
        return dict(self.hashes.get(key, {}))

    def expire(self, key, seconds):
        self.expiries[key] = seconds
        return True

    def ttl(self, key):
        return self.expiries.get(key)

    def delete(self, *keys):
        removed = 0
        for key in keys:
            removed += int(key in self.values)
            removed += int(key in self.hashes)
            removed += int(key in self.sets)
            removed += int(key in self.zsets)
            self.values.pop(key, None)
            self.hashes.pop(key, None)
            self.sets.pop(key, None)
            self.zsets.pop(key, None)
            self.expiries.pop(key, None)
        return removed

    def sadd(self, key, *values):
        bucket = self.sets.setdefault(key, set())
        before = len(bucket)
        bucket.update(values)
        return len(bucket) - before

    def srem(self, key, *values):
        bucket = self.sets.setdefault(key, set())
        removed = 0
        for value in values:
            if value in bucket:
                bucket.remove(value)
                removed += 1
        return removed

    def scard(self, key):
        return len(self.sets.get(key, set()))

    def sismember(self, key, value):
        return value in self.sets.get(key, set())

    def smembers(self, key):
        return set(self.sets.get(key, set()))

    def eval(self, script, numkeys, *args):
        slots_key = args[0]
        exam_slots_key = args[1]
        member = args[2]
        quota = int(args[3])
        exam_quota = int(args[4])
        lease_until_ms = int(args[5])
        now_ms = int(args[6])
        slots_ttl_seconds = int(args[7])

        bucket = self.zsets.setdefault(slots_key, {})
        expired = [key for key, score in bucket.items() if score <= now_ms]
        for key in expired:
            bucket.pop(key, None)
        exam_bucket = None
        if exam_slots_key:
            exam_bucket = self.zsets.setdefault(exam_slots_key, {})
            expired = [key for key, score in exam_bucket.items() if score <= now_ms]
            for key in expired:
                exam_bucket.pop(key, None)
        if member in bucket:
            bucket[member] = lease_until_ms
            self.expiries[slots_key] = slots_ttl_seconds
            if exam_bucket is not None:
                exam_bucket[member] = lease_until_ms
                self.expiries[exam_slots_key] = slots_ttl_seconds
            return 1
        if len(bucket) >= quota:
            return 0
        if exam_bucket is not None and len(exam_bucket) >= exam_quota:
            return 0
        bucket[member] = lease_until_ms
        self.expiries[slots_key] = slots_ttl_seconds
        if exam_bucket is not None:
            exam_bucket[member] = lease_until_ms
            self.expiries[exam_slots_key] = slots_ttl_seconds
        return 1

    def zadd(self, key, mapping):
        bucket = self.zsets.setdefault(key, {})
        before = len(bucket)
        bucket.update(mapping)
        return len(bucket) - before

    def zremrangebyscore(self, key, min_score, max_score):
        bucket = self.zsets.setdefault(key, {})
        removed = 0
        if min_score == "-inf":
            min_value = float("-inf")
        else:
            min_value = float(min_score)
        if max_score == "+inf":
            max_value = float("inf")
        else:
            max_value = float(max_score)
        for member, score in list(bucket.items()):
            if min_value <= score <= max_value:
                bucket.pop(member, None)
                removed += 1
        return removed

    def zcard(self, key):
        return len(self.zsets.get(key, {}))

    def zscore(self, key, member):
        return self.zsets.get(key, {}).get(member)

    def zrem(self, key, *members):
        bucket = self.zsets.setdefault(key, {})
        removed = 0
        for member in members:
            if member in bucket:
                bucket.pop(member, None)
                removed += 1
        return removed


@pytest.fixture
def fake_redis(monkeypatch):
    from apps.proctoring import runtime

    client = FakeRedis()
    monkeypatch.setattr(runtime, "get_runtime_redis", lambda: client)
    return client


def test_runtime_defaults_are_env_backed():
    assert settings.PROCTORING_PRESENCE_TTL_SECONDS == 150
    assert settings.PROCTORING_HEARTBEAT_INTERVAL_SECONDS == 60
    assert settings.PROCTORING_MAX_CONCURRENT_LIVE_VIEWS == 5
    assert settings.PROCTORING_MAX_LIVE_VIEWS_PER_EXAM == 3


def test_refresh_presence_sets_expected_ttl_state(fake_redis):
    from apps.proctoring import runtime

    runtime.refresh_presence(
        session_id=42,
        exam_id=7,
        payload={
            "question_index": 3,
            "camera_ready": True,
            "connection_status": "stable",
            "state": "offline",
            "updated_at": "2000-01-01T00:00:00Z",
        },
    )

    assert fake_redis.get("presence:session:42") == "online"
    assert fake_redis.ttl("presence:session:42") == settings.PROCTORING_PRESENCE_TTL_SECONDS

    monitor_state = fake_redis.hgetall("monitor:session:42")
    assert monitor_state["state"] == "online"
    assert monitor_state["connection_status"] == "stable"
    assert monitor_state["question_index"] == "3"
    assert fake_redis.smembers("monitor:exam:7:sessions") == {"42"}


def test_live_slot_acquire_and_release_enforces_quota(fake_redis):
    from apps.proctoring import runtime

    assert runtime.acquire_live_slot(session_id=1, max_slots=2) is True
    assert runtime.acquire_live_slot(session_id=2, max_slots=2) is True
    assert runtime.acquire_live_slot(session_id=3, max_slots=2) is False
    assert set(fake_redis.zsets["live:slots"]) == {"1", "2"}

    assert runtime.release_live_slot(session_id=1) is True
    assert set(fake_redis.zsets["live:slots"]) == {"2"}
    assert runtime.acquire_live_slot(session_id=3, max_slots=2) is True
    assert set(fake_redis.zsets["live:slots"]) == {"2", "3"}


def test_live_slot_acquire_enforces_exam_quota(fake_redis):
    from apps.proctoring import runtime

    assert runtime.acquire_live_slot(session_id=1, exam_id=11, max_slots=4, max_exam_slots=2) is True
    assert runtime.acquire_live_slot(session_id=2, exam_id=11, max_slots=4, max_exam_slots=2) is True
    assert runtime.acquire_live_slot(session_id=3, exam_id=11, max_slots=4, max_exam_slots=2) is False
    assert runtime.acquire_live_slot(session_id=4, exam_id=12, max_slots=4, max_exam_slots=2) is True

    assert set(fake_redis.zsets["live:slots"]) == {"1", "2", "4"}
    assert set(fake_redis.zsets["live:slots:exam:11"]) == {"1", "2"}
    assert set(fake_redis.zsets["live:slots:exam:12"]) == {"4"}

    assert runtime.release_live_slot(session_id=2, exam_id=11) is True
    assert runtime.acquire_live_slot(session_id=3, exam_id=11, max_slots=4, max_exam_slots=2) is True
    assert set(fake_redis.zsets["live:slots:exam:11"]) == {"1", "3"}


def test_live_slot_acquire_cleans_expired_leases_before_quota_check(fake_redis):
    from apps.proctoring import runtime

    fake_redis.zadd("live:slots", {"stale": 1})
    fake_redis.zadd("live:slots:exam:7", {"stale": 1})

    assert runtime.acquire_live_slot(session_id=99, exam_id=7, max_slots=1, max_exam_slots=1) is True
    assert set(fake_redis.zsets["live:slots"]) == {"99"}
    assert set(fake_redis.zsets["live:slots:exam:7"]) == {"99"}
    assert "stale" not in fake_redis.zsets["live:slots"]
    assert "stale" not in fake_redis.zsets["live:slots:exam:7"]


def test_mark_live_request_disabled_state_is_persisted(fake_redis):
    from apps.proctoring import runtime

    runtime.mark_live_request(
        session_id=5,
        enabled=True,
        payload={"reason": "admin", "enabled": False, "updated_at": "2000-01-01T00:00:00Z"},
    )
    runtime.mark_live_request(
        session_id=5,
        enabled=False,
        payload={"reason": "admin", "state": "enabled", "updated_at": "2000-01-01T00:00:00Z"},
    )

    live_request = fake_redis.hgetall("live:req:session:5")
    assert live_request["enabled"] == "0"
    assert live_request["state"] == "disabled"
    assert live_request["reason"] == "admin"

    snapshot = runtime.get_runtime_snapshot(session_id=5)
    assert snapshot["live_request"]["enabled"] is False
    assert snapshot["live_request"]["state"] == "disabled"
    assert snapshot["live_request"]["reason"] == "admin"


def test_runtime_snapshot_prefers_redis_state_when_present(fake_redis):
    from apps.proctoring import runtime

    fake_redis.hset(
        "monitor:session:9",
        mapping={
            "connection_status": "online",
            "question_index": "4",
            "camera_ready": "1",
            "screen_ready": "0",
            "live_state": "active",
        },
    )
    fake_redis.set("presence:session:9", "online", ex=settings.PROCTORING_PRESENCE_TTL_SECONDS)
    fake_redis.zadd("live:slots", {"9": runtime._current_timestamp_ms() + 60000})

    snapshot = runtime.get_runtime_snapshot(
        session_id=9,
        default={"connection_status": "offline", "question_index": 1, "camera_ready": False},
    )

    assert snapshot["connection_status"] == "online"
    assert snapshot["question_index"] == 4
    assert snapshot["camera_ready"] is True
    assert snapshot["screen_ready"] is False
    assert snapshot["live_state"] == "active"
    assert snapshot["presence"] == "online"
    assert snapshot["live_slot_active"] is True
