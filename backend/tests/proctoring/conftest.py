import pytest

from tests.redis_fakes import FakePipeline


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

    def zscore(self, key, member):
        return self.zsets.get(key, {}).get(member)

    def pipeline(self, transaction=True):
        return FakePipeline(self)

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
