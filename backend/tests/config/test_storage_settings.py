import pytest
from django.core.exceptions import ImproperlyConfigured

from config.settings.storage import build_storages


def test_build_storages_defaults_to_filesystem_even_if_bucket_name_is_present():
    storages = build_storages(use_s3_storage=False, bucket_name="eduexam")

    assert storages["default"]["BACKEND"] == "django.core.files.storage.FileSystemStorage"


def test_build_storages_requires_bucket_name_when_s3_is_explicitly_enabled():
    with pytest.raises(ImproperlyConfigured):
        build_storages(use_s3_storage=True, bucket_name="")
