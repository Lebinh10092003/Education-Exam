from urllib.parse import urlsplit, urlunsplit

from django.core.exceptions import ImproperlyConfigured


STATICFILES_STORAGE = {
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}

LOCAL_STORAGE = {"BACKEND": "django.core.files.storage.FileSystemStorage"}


def split_s3_endpoint(endpoint_url: str, bucket_name: str = ""):
    """
    Nguoi dung hay dan nguyen link bucket tren dashboard R2
    (https://<account>.r2.cloudflarestorage.com/<bucket>). boto3 can endpoint KHONG kem
    ten bucket, nen tach phan duong dan ra lam ten bucket (neu chua dat rieng).
    """
    endpoint_url = (endpoint_url or "").strip()
    bucket_name = (bucket_name or "").strip()
    if not endpoint_url:
        return "", bucket_name
    parsed = urlsplit(endpoint_url)
    path_bucket = parsed.path.strip("/").split("/")[0] if parsed.path.strip("/") else ""
    clean_endpoint = urlunsplit((parsed.scheme, parsed.netloc, "", "", ""))
    return clean_endpoint, bucket_name or path_bucket


def build_evidence_storage(*, evidence_storage: str, evidence_s3_options: dict | None):
    if evidence_storage == "s3":
        options = dict(evidence_s3_options or {})
        if not options.get("bucket_name"):
            raise ImproperlyConfigured(
                "PROCTORING_EVIDENCE_S3_BUCKET (or AWS_STORAGE_BUCKET_NAME) must be set when "
                "PROCTORING_EVIDENCE_STORAGE=s3."
            )
        return {"BACKEND": "storages.backends.s3.S3Storage", "OPTIONS": options}
    if evidence_storage not in {"", "local"}:
        raise ImproperlyConfigured("PROCTORING_EVIDENCE_STORAGE must be 'local' or 's3'.")
    return dict(LOCAL_STORAGE)


def build_storages(
    *,
    use_s3_storage: bool,
    bucket_name: str,
    evidence_storage: str = "local",
    evidence_s3_options: dict | None = None,
):
    if use_s3_storage:
        if not bucket_name:
            raise ImproperlyConfigured(
                "AWS_STORAGE_BUCKET_NAME must be set when USE_S3_STORAGE=True."
            )
        default_storage = {"BACKEND": "storages.backends.s3.S3Storage"}
    else:
        default_storage = dict(LOCAL_STORAGE)

    return {
        "default": default_storage,
        "staticfiles": STATICFILES_STORAGE,
        "evidence": build_evidence_storage(
            evidence_storage=evidence_storage,
            evidence_s3_options=evidence_s3_options,
        ),
    }
