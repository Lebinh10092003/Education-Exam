from pathlib import Path

from .base import *  # noqa: F403,F401


SECRET_KEY = "test-secret-key-for-eduexam-suite-1234567890"
DEBUG = False
DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": Path(BASE_DIR) / "test.sqlite3",  # noqa: F405
    }
}
PASSWORD_HASHERS = [
    "django.contrib.auth.hashers.MD5PasswordHasher",
]
CELERY_TASK_ALWAYS_EAGER = True
CELERY_TASK_EAGER_PROPAGATES = True
CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels.layers.InMemoryChannelLayer",
    }
}
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "eduexam-tests",
    }
}
EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage",
    },
    "evidence": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
}
PROCTORING_EVIDENCE_STORAGE = "local"
USE_S3_STORAGE = False


PROCTORING_SKIP_RESOURCE_CHECK = True
# Cache test dung chung giua cac test va id sqlite co the lap lai -> tat gop vi pham mac dinh.
PROCTORING_VIOLATION_COOLDOWN_SECONDS = 0
EXAM_RANDOM_POOL_CACHE_TTL_SECONDS = 0
