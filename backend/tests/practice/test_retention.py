from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone


def _create_objective_question(*, subject, admin_user, question_text):
    from apps.question_bank.services import create_question

    return create_question(
        subject=subject,
        created_by=admin_user,
        difficulty="easy",
        question_type="multiple_choice",
        question_text=question_text,
        options=[{"key": "A", "text": "Choice A"}, {"key": "B", "text": "Choice B"}],
        correct_option_keys=["A"],
    )


@pytest.mark.django_db
def test_cleanup_command_purges_expired_practice_details_but_keeps_summary(candidate_user, subject, admin_user):
    from apps.practice.models import PracticeSession
    from apps.practice.services import create_practice_autosave_snapshot, create_practice_session, submit_practice_session

    _create_objective_question(subject=subject, admin_user=admin_user, question_text="Retention question")
    session = create_practice_session(candidate=candidate_user, subject=subject)
    create_practice_autosave_snapshot(session=session, payload={"current_question_index": 0})
    submit_practice_session(session=session)
    PracticeSession.objects.filter(pk=session.pk).update(
        details_retention_until=timezone.now() - timezone.timedelta(minutes=1)
    )
    out = StringIO()

    call_command("cleanup_expired_practice_details", stdout=out)

    session.refresh_from_db()
    assert session.correct_count == 0
    assert session.total_count == 1
    assert session.details_purged_at is not None
    assert session.questions.count() == 0
    assert session.autosave_snapshots.count() == 0
    assert "Processed 1 expired practice sessions; deleted 1; failed 0." in out.getvalue()
