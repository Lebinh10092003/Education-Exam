import os
import sys
from pathlib import Path

import pytest
from rest_framework.test import APIClient
from rest_framework.test import APIRequestFactory

from tests.redis_fakes import FakePipeline

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def api_rf():
    return APIRequestFactory()


class RuntimeRedisStub:
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
        for key, score in list(bucket.items()):
            if score <= now_ms:
                bucket.pop(key, None)
        exam_bucket = None
        if exam_slots_key:
            exam_bucket = self.zsets.setdefault(exam_slots_key, {})
            for key, score in list(exam_bucket.items()):
                if score <= now_ms:
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


@pytest.fixture(autouse=True)
def stub_runtime_redis(monkeypatch):
    from apps.proctoring import runtime

    client = RuntimeRedisStub()
    cache_clear = getattr(runtime.get_runtime_redis, "cache_clear", None)
    if cache_clear is not None:
        cache_clear()
    monkeypatch.setattr(runtime.redis.Redis, "from_url", lambda *args, **kwargs: client)
    yield client
    cache_clear = getattr(runtime.get_runtime_redis, "cache_clear", None)
    if cache_clear is not None:
        cache_clear()


@pytest.fixture
def user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        email="admin@example.com",
        password="secret123",
        full_name="Admin User",
    )


@pytest.fixture
def candidate_user(db):
    from django.contrib.auth import get_user_model

    return get_user_model().objects.create_user(
        email="candidate@example.com",
        password="secret123",
        full_name="Candidate User",
    )


@pytest.fixture
def permission_grant(db):
    from apps.identity.models import Permission, Role, RolePermission, UserRole

    def grant(user, code, *, module=None, action=None, role_name="Administrator", role_slug="administrator"):
        resolved_module = module or code.split(".")[0]
        resolved_action = action or code.split(".")[1]
        permission, _ = Permission.objects.get_or_create(
            code=code,
            defaults={
                "module": resolved_module,
                "action": resolved_action,
                "is_system": True,
            },
        )
        role, _ = Role.objects.get_or_create(
            slug=role_slug,
            defaults={
                "name": role_name,
                "is_system": True,
            },
        )
        RolePermission.objects.get_or_create(role=role, permission=permission)
        UserRole.objects.get_or_create(user=user, role=role)
        return permission

    return grant


@pytest.fixture
def admin_user(db, permission_grant):
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(
        email="admin-ui@example.com",
        password="secret123",
        full_name="Administrator",
        is_staff=True,
    )
    for code in (
        "users.manage",
        "users.view",
        "roles.manage",
        "roles.view",
        "permissions.view",
        "schools.manage",
        "schools.view",
        "groups.manage",
        "groups.view",
        "subjects.manage",
        "subjects.view",
        "questions.manage",
        "questions.view",
        "exams.manage",
        "exams.view",
        "grading.manage",
        "grading.view",
        "results.manage",
        "results.view",
        "discipline.manage",
        "discipline.view",
        "proctoring.manage",
        "proctoring.view",
        "materials.manage",
        "materials.view",
        "notifications.manage",
        "notifications.view",
        "audit.manage",
        "audit.view",
    ):
        permission_grant(user, code)
    return user


@pytest.fixture
def admin_token(admin_user):
    from rest_framework_simplejwt.tokens import RefreshToken

    return str(RefreshToken.for_user(admin_user).access_token)


@pytest.fixture
def subject(db):
    from apps.academics.models import Subject

    return Subject.objects.create(
        name="Mathematics",
        code="MATH101",
        description="Advanced mathematical concepts",
        color="bg-blue-600",
    )
