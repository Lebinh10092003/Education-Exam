import pytest
from django.core.management import call_command


@pytest.mark.django_db(transaction=True)
def test_reset_demo_data_command_rebuilds_full_dataset(settings, tmp_path):
    from django.contrib.auth import get_user_model

    from apps.academics.models import Subject
    from apps.exam_authoring.models import Exam
    from apps.grading.models import ManualGradingTask, Result
    from apps.identity.models import Role
    from apps.institutions.models import CandidateGroup, School
    from apps.materials.models import Material
    from apps.notifications.models import Notification
    from apps.platform_core.models import AuditEvent
    from apps.proctoring.models import ProctorEvent, ViolationCase
    from apps.question_bank.models import Question

    settings.MEDIA_ROOT = tmp_path / "media"

    Subject.objects.create(name="Junk Subject", code="JUNK")

    call_command("reset_demo_data", verbosity=0)

    user_model = get_user_model()

    assert not Subject.objects.filter(code="JUNK").exists()
    assert user_model.objects.count() == 16
    assert Role.objects.filter(slug="administrator").exists()
    assert user_model.objects.filter(email="admin@example.com").exists()
    assert user_model.objects.filter(email="candidate01@example.com").exists()

    assert School.objects.count() == 2
    assert CandidateGroup.objects.count() == 4
    assert Subject.objects.count() == 4
    assert Question.objects.count() == 16
    assert Exam.objects.count() == 5
    assert Exam.objects.filter(mode=Exam.Mode.CLASS).count() == 1
    assert Material.objects.count() == 6

    assert Result.objects.count() == 3
    assert ManualGradingTask.objects.count() == 2
    assert ManualGradingTask.objects.filter(status=ManualGradingTask.Status.PENDING).count() == 1
    assert Result.objects.filter(publish_state=Result.PublishState.PUBLISHED).count() == 1

    assert Notification.objects.count() >= 7
    assert AuditEvent.objects.count() >= 8
    assert ProctorEvent.objects.count() == 2
    assert ViolationCase.objects.count() == 2
