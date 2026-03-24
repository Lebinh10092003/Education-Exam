import pytest
from django.contrib.auth import get_user_model
from django.db import IntegrityError


@pytest.mark.django_db
def test_group_membership_is_unique_per_user_and_group():
    from apps.institutions.models import CandidateGroup, GroupMembership, School

    school = School.objects.create(name="School A", code="SCHA")
    user = get_user_model().objects.create_user(
        email="candidate@example.com",
        password="secret123",
    )
    group = CandidateGroup.objects.create(name="Group A")

    GroupMembership.objects.create(group=group, user=user)

    with pytest.raises(IntegrityError):
        GroupMembership.objects.create(group=group, user=user)
