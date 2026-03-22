import os
import sys
from pathlib import Path

import pytest
from rest_framework.test import APIClient
from rest_framework.test import APIRequestFactory


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
        "proctoring.manage",
        "proctoring.view",
        "materials.manage",
        "materials.view",
        "notifications.manage",
        "notifications.view",
        "audit.manage",
        "audit.view",
        "exam_periods.manage",
        "exam_periods.view",
        "exam_rooms.manage",
        "exam_rooms.view",
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
