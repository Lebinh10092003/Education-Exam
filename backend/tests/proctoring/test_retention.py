from io import StringIO
from pathlib import Path

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.core.management import call_command
from django.utils import timezone

from .utils import build_active_session


@pytest.mark.django_db
def test_admin_case_detail_hides_expired_evidence_from_file_url(
    api_client,
    admin_token,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.services import create_proctor_evidence, record_proctor_event

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    event = record_proctor_event(
        session=session,
        event_type="fullscreen_exit",
        severity="critical",
        metadata={"message": "Candidate exited fullscreen."},
        reported_by=candidate_user,
    )
    case = event.violation_cases.first()
    evidence = create_proctor_evidence(
        session=session,
        event=event,
        evidence_type="screen_capture",
        file=SimpleUploadedFile("capture.png", b"expired-bytes", content_type="image/png"),
        metadata={"source": "screen"},
        uploaded_by=candidate_user,
    )
    evidence.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    evidence.save(update_fields=["expires_at", "updated_at"])
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")

    response = api_client.get(f"/api/v1/proctoring/cases/{case.id}/")

    assert response.status_code == 200
    assert response.json()["evidence_items"][0]["id"] == evidence.id
    assert response.json()["evidence_items"][0]["file_url"] == ""
    assert response.json()["evidence_items"][0]["deleted_at"] is None


@pytest.mark.django_db
def test_cleanup_command_deletes_expired_evidence_file_and_marks_record_deleted(
    settings,
    tmp_path,
    subject,
    admin_user,
    candidate_user,
):
    from apps.proctoring.models import ProctorEvidence
    from apps.proctoring.services import create_proctor_evidence, record_proctor_event

    settings.MEDIA_ROOT = tmp_path / "media"
    settings.MEDIA_ROOT.mkdir(parents=True, exist_ok=True)

    _, session = build_active_session(
        subject=subject,
        admin_user=admin_user,
        candidate_user=candidate_user,
    )
    event = record_proctor_event(
        session=session,
        event_type="tab_switch",
        severity="warning",
        metadata={"message": "Candidate switched tabs."},
        reported_by=candidate_user,
    )
    evidence = create_proctor_evidence(
        session=session,
        event=event,
        evidence_type="screen_capture",
        file=SimpleUploadedFile("capture.png", b"cleanup-bytes", content_type="image/png"),
        metadata={"source": "screen"},
        uploaded_by=candidate_user,
    )
    file_path = Path(evidence.file.path)
    evidence.expires_at = timezone.now() - timezone.timedelta(minutes=1)
    evidence.save(update_fields=["expires_at", "updated_at"])
    out = StringIO()

    call_command("cleanup_expired_proctor_evidence", stdout=out)

    evidence.refresh_from_db()
    assert ProctorEvidence.objects.filter(id=evidence.id, deleted_at__isnull=False).exists()
    assert evidence.deletion_error == ""
    assert not evidence.file
    assert not file_path.exists()
    assert "Processed 1 expired evidence records; deleted 1; failed 0." in out.getvalue()
