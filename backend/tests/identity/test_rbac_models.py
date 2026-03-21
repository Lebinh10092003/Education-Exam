import pytest


@pytest.mark.django_db
def test_user_can_receive_custom_role_permissions():
    from apps.identity.models import Permission, Role, RolePermission, UserRole

    permission = Permission.objects.create(
        module="users",
        action="manage",
        code="users.manage",
    )
    role = Role.objects.create(
        name="Administrator",
        slug="administrator",
        is_system=True,
    )
    RolePermission.objects.create(role=role, permission=permission)
    from django.contrib.auth import get_user_model

    user = get_user_model().objects.create_user(
        email="admin@example.com",
        password="secret123",
    )
    UserRole.objects.create(user=user, role=role)

    assert user.has_platform_permission("users.manage") is True


@pytest.mark.django_db
def test_profile_can_link_user_to_school():
    from apps.identity.models import Profile
    from apps.institutions.models import School
    from django.contrib.auth import get_user_model

    school = School.objects.create(name="School A", code="SCHA")
    user = get_user_model().objects.create_user(
        email="student@example.com",
        password="secret123",
    )
    profile = Profile.objects.create(user=user, school=school)

    assert profile.school == school
