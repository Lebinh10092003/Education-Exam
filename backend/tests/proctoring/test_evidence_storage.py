from io import StringIO

import pytest
from django.core.management import call_command
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from .utils import build_active_session


class StubS3Client:
    def __init__(self, head=None):
        self.head = head
        self.calls = []

    def generate_presigned_url(self, **kwargs):
        self.calls.append(("presign", kwargs))
        return "https://bucket.example.r2.cloudflarestorage.com/signed"

    def head_object(self, **kwargs):
        from botocore.exceptions import ClientError

        self.calls.append(("head", kwargs))
        if self.head is None:
            raise ClientError({"Error": {"Code": "404"}}, "HeadObject")
        return self.head

    def delete_object(self, **kwargs):
        self.calls.append(("delete", kwargs))

    def head_bucket(self, **kwargs):
        self.calls.append(("head_bucket", kwargs))
        if getattr(self, "bucket_error", None):
            raise self.bucket_error

    def put_object(self, **kwargs):
        self.calls.append(("put", kwargs))
        self.head = {"ContentLength": 2, "ContentType": kwargs.get("ContentType", "")}

    def put_bucket_cors(self, **kwargs):
        self.calls.append(("cors", kwargs))

    def put_bucket_lifecycle_configuration(self, **kwargs):
        self.calls.append(("lifecycle", kwargs))


@pytest.fixture
def s3_evidence(settings, monkeypatch):
    from apps.proctoring import evidence_storage

    settings.PROCTORING_EVIDENCE_STORAGE = "s3"
    settings.PROCTORING_EVIDENCE_S3_BUCKET = "eduexam-evidence"
    settings.PROCTORING_EVIDENCE_S3_ENDPOINT_URL = "https://account.r2.cloudflarestorage.com"
    settings.PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID = "a" * 32
    settings.PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY = "b" * 64
    client = StubS3Client()
    monkeypatch.setattr(evidence_storage, "get_evidence_s3_client", lambda: client)
    return client


@pytest.mark.django_db
def test_evidence_directory_follows_year_exam_round_candidate_layout(settings, subject, admin_user, candidate_user):
    from apps.identity.models import Profile
    from apps.proctoring.evidence_storage import build_evidence_directory, build_evidence_object_key

    settings.PROCTORING_EVIDENCE_ROOT_FOLDER = "Vi phạm kỳ thi"
    Profile.objects.update_or_create(user=candidate_user, defaults={"candidate_number": "SBD0042"})
    candidate_user.full_name = "Nguyễn Văn A"
    candidate_user.save(update_fields=["full_name"])
    exam, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    session.candidate.refresh_from_db()
    started = timezone.localtime(session.started_at)

    directory = build_evidence_directory(session)
    key = build_evidence_object_key(session=session, evidence_type="webcam_snapshot", ext="webp")

    assert directory == (
        f"Vi phạm kỳ thi/{started.year}/{exam.name} (ID {exam.id})/"
        f"Đợt {started:%d-%m-%Y}/SBD0042 - Nguyễn Văn A"
    )
    assert key.startswith(directory + "/")
    assert key.endswith(".webp")


@pytest.mark.django_db
def test_s3_presign_uses_bucket_and_signed_content_type(s3_evidence, subject, admin_user, candidate_user):
    from apps.proctoring.services import generate_evidence_presigned_url

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)

    target = generate_evidence_presigned_url(
        session=session,
        evidence_type="screen_capture",
        file_name="screen_capture.webp",
        content_type="image/webp",
    )

    assert target["upload_method"] == "s3"
    assert target["content_type"] == "image/webp"
    kind, kwargs = s3_evidence.calls[0]
    assert kind == "presign"
    assert kwargs["Params"]["Bucket"] == "eduexam-evidence"
    assert kwargs["Params"]["Key"] == target["object_key"]
    assert kwargs["Params"]["ContentType"] == "image/webp"


@pytest.mark.django_db
def test_s3_confirm_checks_object_exists(s3_evidence, subject, admin_user, candidate_user):
    from apps.proctoring.services import confirm_evidence_upload, generate_evidence_presigned_url

    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    key = generate_evidence_presigned_url(
        session=session, evidence_type="webcam_snapshot", file_name="a.webp", content_type="image/webp"
    )["object_key"]

    with pytest.raises(ValidationError):
        confirm_evidence_upload(session=session, evidence_type="webcam_snapshot", object_key=key)

    s3_evidence.head = {"ContentLength": 42_000, "ContentType": "image/webp"}
    evidence = confirm_evidence_upload(session=session, evidence_type="webcam_snapshot", object_key=key)
    assert evidence.file.name == key
    assert evidence.metadata["stored_size"] == 42_000


@pytest.mark.django_db
def test_s3_confirm_deletes_oversized_or_non_image_objects(settings, s3_evidence, subject, admin_user, candidate_user):
    from apps.proctoring.services import confirm_evidence_upload, generate_evidence_presigned_url

    settings.PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES = 1000
    _, session = build_active_session(subject=subject, admin_user=admin_user, candidate_user=candidate_user)
    key = generate_evidence_presigned_url(
        session=session, evidence_type="webcam_snapshot", file_name="a.webp", content_type="image/webp"
    )["object_key"]
    s3_evidence.head = {"ContentLength": 5000, "ContentType": "image/webp"}

    with pytest.raises(ValidationError):
        confirm_evidence_upload(session=session, evidence_type="webcam_snapshot", object_key=key)

    assert ("delete", {"Bucket": "eduexam-evidence", "Key": key}) in s3_evidence.calls


def test_setup_evidence_bucket_applies_cors_and_retention(settings, s3_evidence):
    settings.PROCTORING_EVIDENCE_RETENTION_DAYS = 180
    settings.PROCTORING_EVIDENCE_ROOT_FOLDER = "Vi phạm kỳ thi"

    call_command("setup_evidence_bucket", "--origin", "https://khaothi.fermat.vn", stdout=StringIO())

    calls = dict(s3_evidence.calls)
    assert calls["cors"]["CORSConfiguration"]["CORSRules"][0]["AllowedOrigins"] == ["https://khaothi.fermat.vn"]
    rule = calls["lifecycle"]["LifecycleConfiguration"]["Rules"][0]
    assert rule["Filter"]["Prefix"] == "Vi phạm kỳ thi/"
    assert rule["Expiration"]["Days"] == 187



def test_setup_evidence_bucket_check_only_round_trips_a_test_object(s3_evidence):
    out = StringIO()
    call_command("setup_evidence_bucket", "--check", stdout=out)

    kinds = [kind for kind, _ in s3_evidence.calls]
    assert kinds == ["head_bucket", "put", "head", "delete"]
    assert "cors" not in kinds
    assert "hoat dong binh thuong" in out.getvalue()


def test_setup_evidence_bucket_explains_wrong_credentials(s3_evidence):
    from botocore.exceptions import ClientError
    from django.core.management.base import CommandError

    s3_evidence.bucket_error = ClientError({"Error": {"Code": "InvalidAccessKeyId", "Message": "bad"}}, "HeadBucket")

    with pytest.raises(CommandError, match="Access Key ID sai"):
        call_command("setup_evidence_bucket", "--check", stdout=StringIO())


@pytest.mark.parametrize(
    ("endpoint", "bucket", "expected"),
    [
        (
            "https://7434d745c58a48a09fac57b92aab5253.r2.cloudflarestorage.com/exam-education",
            "",
            ("https://7434d745c58a48a09fac57b92aab5253.r2.cloudflarestorage.com", "exam-education"),
        ),
        (
            "https://acc.r2.cloudflarestorage.com/exam-education/",
            "other-bucket",
            ("https://acc.r2.cloudflarestorage.com", "other-bucket"),
        ),
        ("https://acc.r2.cloudflarestorage.com", "b1", ("https://acc.r2.cloudflarestorage.com", "b1")),
        ("", "b1", ("", "b1")),
    ],
)
def test_split_s3_endpoint_extracts_bucket_from_pasted_r2_url(endpoint, bucket, expected):
    from config.settings.storage import split_s3_endpoint

    assert split_s3_endpoint(endpoint, bucket) == expected
