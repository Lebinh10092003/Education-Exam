from django.core.exceptions import ImproperlyConfigured


STATICFILES_STORAGE = {
    "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"
}


def build_storages(*, use_s3_storage: bool, bucket_name: str):
    if use_s3_storage:
        if not bucket_name:
            raise ImproperlyConfigured(
                "AWS_STORAGE_BUCKET_NAME must be set when USE_S3_STORAGE=True."
            )
        return {
            "default": {"BACKEND": "storages.backends.s3.S3Storage"},
            "staticfiles": STATICFILES_STORAGE,
        }

    return {
        "default": {
            "BACKEND": "django.core.files.storage.FileSystemStorage",
        },
        "staticfiles": STATICFILES_STORAGE,
    }
