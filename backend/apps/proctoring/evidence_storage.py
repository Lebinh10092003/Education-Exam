"""
Luu tru anh bang chung vi pham.

Cay thu muc (S3/R2 khong co thu muc that, "thu muc" chi la tien to cua key nen
tu sinh ra khi tai file len, khong can goi API tao thu muc):

    <PROCTORING_EVIDENCE_ROOT_FOLDER>/<Nam>/<Ky thi (ID id)>/<Dot DD-MM-YYYY>/<SBD - Ho ten>/<file>.webp

He thong chua co khai niem "dot thi" rieng: moi bai thi chi co 1 khung gio mo/dong.
"Dot" duoc xac dinh theo ngay thi sinh bat dau lam bai (gio Viet Nam), nen 1 bai thi
mo lai vao ngay khac se tu tach thanh dot moi.
"""

import re
import uuid
from functools import lru_cache
from urllib.parse import urlencode

from django.conf import settings
from django.urls import reverse
from django.utils import timezone
from rest_framework.exceptions import ValidationError

from apps.platform_core.i18n import t

ALLOWED_EVIDENCE_EXTENSIONS = {"jpg", "jpeg", "png", "webp"}
ALLOWED_EVIDENCE_CONTENT_TYPES = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
}
_UNSAFE_SEGMENT_CHARS = re.compile(r'[\\/:*?"<>|#%&+{}\[\]^`~\x00-\x1f\x7f]')
_MAX_SEGMENT_LENGTH = 80


def sanitize_path_segment(value) -> str:
    if not value:
        return "default"
    sanitized = _UNSAFE_SEGMENT_CHARS.sub("_", str(value))
    sanitized = re.sub(r"\s+", " ", sanitized).strip().strip(".")
    return sanitized[:_MAX_SEGMENT_LENGTH].strip() or "default"


def evidence_storage_uses_s3() -> bool:
    return getattr(settings, "PROCTORING_EVIDENCE_STORAGE", "local") == "s3"


def _candidate_folder_name(session) -> str:
    candidate = session.candidate
    profile = getattr(candidate, "profile", None)
    candidate_number = (getattr(profile, "candidate_number", "") or "").strip() if profile else ""
    full_name = (candidate.full_name or "").strip()
    label = " - ".join(part for part in (candidate_number or candidate.username, full_name) if part)
    return sanitize_path_segment(label or candidate.username)


def build_evidence_directory(session) -> str:
    started_at = timezone.localtime(session.started_at or timezone.now())
    exam = session.exam
    parts = [
        getattr(settings, "PROCTORING_EVIDENCE_ROOT_FOLDER", "") or "Vi phạm kỳ thi",
        str(started_at.year),
        f"{exam.name} (ID {exam.id})",
        f"Đợt {started_at:%d-%m-%Y}",
        _candidate_folder_name(session),
    ]
    return "/".join(sanitize_path_segment(part) for part in parts)


def _file_name_prefix(session) -> str:
    return f"{sanitize_path_segment(session.candidate.username)}_"


def resolve_evidence_extension(*, file_name="", content_type=""):
    ext = ALLOWED_EVIDENCE_CONTENT_TYPES.get((content_type or "").lower())
    if ext is None and "." in (file_name or ""):
        ext = file_name.rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EVIDENCE_EXTENSIONS:
        raise ValidationError(t(vi="Định dạng ảnh bằng chứng không được hỗ trợ.", en="Unsupported evidence file type."))
    return ext


def build_evidence_object_key(*, session, evidence_type, ext, now=None) -> str:
    now = timezone.localtime(now or timezone.now())
    attempt = f"_lan{session.attempt_number}" if session.attempt_number and session.attempt_number > 1 else ""
    file_name = (
        f"{_file_name_prefix(session)}{sanitize_path_segment(evidence_type)}{attempt}"
        f"_{now:%H%M%S}_{uuid.uuid4().hex[:10]}.{ext}"
    )
    return f"{build_evidence_directory(session)}/{file_name}"


def assert_evidence_key_belongs_to_session(*, session, object_key):
    """Chan ghi/khai bao file ngoai thu muc cua dung thi sinh/phien thi hoac sai dinh dang."""
    key = str(object_key or "")
    directory, _, file_name = key.rpartition("/")
    ext = file_name.rsplit(".", 1)[-1].lower() if "." in file_name else ""
    if (
        not key
        or key.startswith("/")
        or "\\" in key
        or any(part in {"", ".", ".."} for part in key.split("/"))
        or directory != build_evidence_directory(session)
        or not file_name.startswith(_file_name_prefix(session))
        or ext not in ALLOWED_EVIDENCE_EXTENSIONS
    ):
        raise ValidationError(t(vi="Khóa tệp bằng chứng không hợp lệ.", en="Invalid evidence object key."))
    return key


@lru_cache(maxsize=1)
def get_evidence_s3_client():
    """Tao boto3 client 1 lan/tien trinh (tao moi moi request ton ~10-50 ms CPU)."""
    import boto3
    from botocore.config import Config

    return boto3.client(
        "s3",
        aws_access_key_id=settings.PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID or None,
        aws_secret_access_key=settings.PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY or None,
        endpoint_url=settings.PROCTORING_EVIDENCE_S3_ENDPOINT_URL or None,
        region_name=settings.PROCTORING_EVIDENCE_S3_REGION or None,
        config=Config(signature_version="s3v4", retries={"max_attempts": 3, "mode": "standard"}),
    )


def build_upload_target(*, session, evidence_type, file_name, content_type, request=None):
    ext = resolve_evidence_extension(file_name=file_name, content_type=content_type)
    content_type = next(
        (mime for mime, mime_ext in ALLOWED_EVIDENCE_CONTENT_TYPES.items() if mime_ext == ext),
        "image/jpeg",
    )
    object_key = build_evidence_object_key(session=session, evidence_type=evidence_type, ext=ext)

    if evidence_storage_uses_s3():
        upload_url = get_evidence_s3_client().generate_presigned_url(
            ClientMethod="put_object",
            Params={
                "Bucket": settings.PROCTORING_EVIDENCE_S3_BUCKET,
                "Key": object_key,
                "ContentType": content_type,
            },
            ExpiresIn=int(getattr(settings, "PROCTORING_EVIDENCE_UPLOAD_URL_EXPIRE_SECONDS", 300)),
        )
        method = "s3"
    else:
        url_path = reverse("proctoring-session-evidence-mock-upload", kwargs={"session_id": session.id})
        relative_url = f"{url_path}?{urlencode({'key': object_key})}"
        upload_url = request.build_absolute_uri(relative_url) if request else relative_url
        method = "backend"

    return {
        "upload_url": upload_url,
        "object_key": object_key,
        "content_type": content_type,
        "upload_method": method,
    }


def verify_uploaded_evidence(*, object_key):
    """
    Kiem tra file da thuc su nam tren kho (1 lenh HEAD, khong tai file ve).
    File qua lon hoac khong phai anh se bi xoa va tu choi.
    """
    max_bytes = int(getattr(settings, "PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES", 5 * 1024 * 1024))
    if evidence_storage_uses_s3():
        from botocore.exceptions import ClientError

        client = get_evidence_s3_client()
        bucket = settings.PROCTORING_EVIDENCE_S3_BUCKET
        try:
            head = client.head_object(Bucket=bucket, Key=object_key)
        except ClientError:
            raise ValidationError(t(vi="Không tìm thấy ảnh bằng chứng đã tải lên.", en="Uploaded evidence was not found."))
        size = int(head.get("ContentLength") or 0)
        content_type = (head.get("ContentType") or "").lower()
        if size > max_bytes or content_type not in ALLOWED_EVIDENCE_CONTENT_TYPES:
            client.delete_object(Bucket=bucket, Key=object_key)
            raise ValidationError(t(vi="Ảnh bằng chứng không hợp lệ hoặc quá lớn.", en="Evidence file is invalid or too large."))
        return {"size": size, "content_type": content_type}

    from .models import select_evidence_storage

    storage = select_evidence_storage()
    if not storage.exists(object_key):
        raise ValidationError(t(vi="Không tìm thấy ảnh bằng chứng đã tải lên.", en="Uploaded evidence was not found."))
    size = storage.size(object_key)
    if size > max_bytes:
        storage.delete(object_key)
        raise ValidationError(t(vi="Ảnh bằng chứng không hợp lệ hoặc quá lớn.", en="Evidence file is invalid or too large."))
    return {"size": size, "content_type": ""}


def build_bucket_cors_rules(*, allowed_origins):
    return {
        "CORSRules": [
            {
                "AllowedOrigins": list(allowed_origins),
                "AllowedMethods": ["PUT", "GET", "HEAD"],
                "AllowedHeaders": ["Content-Type"],
                "ExposeHeaders": ["ETag"],
                "MaxAgeSeconds": 3600,
            }
        ]
    }


def build_bucket_lifecycle_rules(*, root_folder, expire_days):
    return {
        "Rules": [
            {
                "ID": "eduexam-evidence-retention",
                "Status": "Enabled",
                "Filter": {"Prefix": f"{sanitize_path_segment(root_folder)}/"},
                "Expiration": {"Days": int(expire_days)},
                "AbortIncompleteMultipartUpload": {"DaysAfterInitiation": 1},
            }
        ]
    }
