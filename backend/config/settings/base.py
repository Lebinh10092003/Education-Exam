from datetime import timedelta
from pathlib import Path

import environ

from .storage import build_storages

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, "unsafe-dev-secret-key-for-eduexam-dev-1234567890"),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DATABASE_URL=(str, f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
    REDIS_URL=(str, "redis://localhost:6379/0"),
    CELERY_BROKER_URL=(str, "redis://localhost:6379/0"),
    CELERY_RESULT_BACKEND=(str, "redis://localhost:6379/1"),
    USE_S3_STORAGE=(bool, False),
    AWS_ACCESS_KEY_ID=(str, ""),
    AWS_SECRET_ACCESS_KEY=(str, ""),
    AWS_STORAGE_BUCKET_NAME=(str, ""),
    AWS_S3_ENDPOINT_URL=(str, ""),
    AWS_S3_REGION_NAME=(str, "us-east-1"),
    EMAIL_BACKEND=(str, "django.core.mail.backends.console.EmailBackend"),
    DEFAULT_FROM_EMAIL=(str, "no-reply@eduexam.local"),
    FRONTEND_BASE_URL=(str, "http://127.0.0.1:5173"),
    PROCTORING_MEDIA_PROVIDER=(str, "livekit"),
    PROCTORING_MEDIA_URL=(str, "ws://127.0.0.1:7880"),
    PROCTORING_MEDIA_API_KEY=(str, "devkey"),
    PROCTORING_MEDIA_API_SECRET=(str, "devsecret-livekit-token-signing-key-123456"),
    PROCTORING_MEDIA_ROOM_PREFIX=(str, "eduexam-"),
    PROCTORING_MEDIA_TOKEN_TTL_SECONDS=(int, 900),
    PROCTORING_HEARTBEAT_INTERVAL_SECONDS=(int, 60),
    PROCTORING_PRESENCE_TTL_SECONDS=(int, 150),
    PROCTORING_MAX_CONCURRENT_LIVE_VIEWS=(int, 5),
    PROCTORING_MAX_LIVE_VIEWS_PER_EXAM=(int, 3),
    PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS=(int, 90),
    PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS=(int, 150),
    PROCTORING_EVIDENCE_RETENTION_DAYS=(int, 15),
    PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=(int, 3600),
    PRACTICE_DETAILS_RETENTION_DAYS=(int, 15),
    PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS=(int, 3600),
)

environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env("DEBUG")
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
REDIS_URL = env("REDIS_URL")

INSTALLED_APPS = [
    "daphne",
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "rest_framework",
    "rest_framework_simplejwt.token_blacklist",
    "channels",
    "drf_spectacular",
    "storages",
    "apps.platform_core",
    "apps.identity",
    "apps.institutions",
    "apps.academics",
    "apps.question_bank",
    "apps.exam_authoring",
    "apps.exam_delivery",
    "apps.grading",
    "apps.discipline",
    "apps.proctoring",
    "apps.materials",
    "apps.notifications",
    "apps.practice",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "apps.platform_core.middleware.RequestIdMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.locale.LocaleMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    }
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {
    "default": env.db("DATABASE_URL"),
}

AUTH_PASSWORD_VALIDATORS = [
    {
        "NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator",
    },
    {
        "NAME": "django.contrib.auth.password_validation.MinimumLengthValidator",
    },
]

LANGUAGE_CODE = "vi"
LANGUAGES = [
    ("vi", "Vietnamese"),
    ("en", "English"),
]
LOCALE_PATHS = [BASE_DIR / "locale"]
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_I18N = True
USE_TZ = True

STATIC_URL = "/static/"
STATIC_ROOT = BASE_DIR / "staticfiles"
MEDIA_URL = "/media/"
MEDIA_ROOT = BASE_DIR / "media"
EMAIL_BACKEND = env("EMAIL_BACKEND")
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")
FRONTEND_BASE_URL = env("FRONTEND_BASE_URL")
PROCTORING_MEDIA_PROVIDER = env("PROCTORING_MEDIA_PROVIDER")
PROCTORING_MEDIA_URL = env("PROCTORING_MEDIA_URL")
PROCTORING_MEDIA_API_KEY = env("PROCTORING_MEDIA_API_KEY")
PROCTORING_MEDIA_API_SECRET = env("PROCTORING_MEDIA_API_SECRET")
PROCTORING_MEDIA_ROOM_PREFIX = env("PROCTORING_MEDIA_ROOM_PREFIX")
PROCTORING_MEDIA_TOKEN_TTL_SECONDS = env.int("PROCTORING_MEDIA_TOKEN_TTL_SECONDS")
PROCTORING_HEARTBEAT_INTERVAL_SECONDS = env.int("PROCTORING_HEARTBEAT_INTERVAL_SECONDS")
PROCTORING_PRESENCE_TTL_SECONDS = env.int("PROCTORING_PRESENCE_TTL_SECONDS")
PROCTORING_MAX_CONCURRENT_LIVE_VIEWS = env.int("PROCTORING_MAX_CONCURRENT_LIVE_VIEWS")
PROCTORING_MAX_LIVE_VIEWS_PER_EXAM = env.int("PROCTORING_MAX_LIVE_VIEWS_PER_EXAM")
PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS = env.int("PROCTORING_HEARTBEAT_UNSTABLE_AFTER_SECONDS")
PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS = env.int("PROCTORING_HEARTBEAT_OFFLINE_AFTER_SECONDS")
PROCTORING_EVIDENCE_RETENTION_DAYS = env.int("PROCTORING_EVIDENCE_RETENTION_DAYS")
PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS = env.int("PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS")
PRACTICE_DETAILS_RETENTION_DAYS = env.int("PRACTICE_DETAILS_RETENTION_DAYS")
PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS = env.int("PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS")

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "identity.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "rest_framework.pagination.PageNumberPagination",
    "PAGE_SIZE": 20,
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": True,
}

SPECTACULAR_SETTINGS = {
    "TITLE": "EduExam API",
    "DESCRIPTION": "Django API for the EduExam online examination platform.",
    "VERSION": "0.1.0",
    "ENUM_NAME_OVERRIDES": {
        "UserStatusEnum": "apps.identity.models.User.Status",
        "QuestionImportBatchStatusEnum": "apps.question_bank.models.QuestionImportBatch.Status",
        "QuestionImportSourceFormatEnum": "apps.question_bank.models.QuestionImportBatch.SourceFormat",
        "ExamStatusEnum": "apps.exam_authoring.models.Exam.Status",
        "ExamItemSourceEnum": "apps.exam_authoring.models.ExamItem.Source",
        "ExamSessionStatusEnum": "apps.exam_delivery.models.ExamSession.Status",
        "SubmissionSourceEnum": "apps.exam_delivery.models.Submission.Source",
        "ManualGradingTaskStatusEnum": "apps.grading.models.ManualGradingTask.Status",
        "ResultWorkflowStatusEnum": "apps.grading.models.Result.WorkflowStatus",
        "ResultPublishStateEnum": "apps.grading.models.Result.PublishState",
        "ClientCapabilityTypeEnum": "apps.proctoring.models.ClientCapability.ClientType",
        "SessionHeartbeatConnectionStatusEnum": "apps.proctoring.models.SessionHeartbeat.ConnectionStatus",
        "ProctorEventTypeEnum": "apps.proctoring.models.ProctorEvent.EventType",
        "ProctorEventSeverityEnum": "apps.proctoring.models.ProctorEvent.Severity",
        "ProctoringMediaStatePublishStatusEnum": "apps.proctoring.models.ProctoringMediaState.PublishStatus",
        "ProctoringMediaStateCaptureStatusEnum": "apps.proctoring.models.ProctoringMediaState.CaptureStatus",
        "ProctorEvidenceTypeEnum": "apps.proctoring.models.ProctorEvidence.EvidenceType",
        "ViolationCaseStatusEnum": "apps.proctoring.models.ViolationCase.Status",
        "ViolationReviewDecisionEnum": "apps.proctoring.models.ViolationReview.Decision",
        "PracticeSessionStatusEnum": "apps.practice.models.PracticeSession.Status",
    },
}

CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CELERY_RESULT_BACKEND = env("CELERY_RESULT_BACKEND")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 60 * 30
CELERY_BEAT_SCHEDULE = {
    "cleanup-expired-proctor-evidence": {
        "task": "apps.proctoring.tasks.cleanup_expired_proctor_evidence_task",
        "schedule": PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS,
    },
    "cleanup-expired-practice-details": {
        "task": "apps.practice.tasks.cleanup_expired_practice_details_task",
        "schedule": PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS,
    },
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_URL]},
    }
}

USE_S3_STORAGE = env("USE_S3_STORAGE")
if USE_S3_STORAGE:
    AWS_ACCESS_KEY_ID = env("AWS_ACCESS_KEY_ID")
    AWS_SECRET_ACCESS_KEY = env("AWS_SECRET_ACCESS_KEY")
    AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME")
    AWS_S3_ENDPOINT_URL = env("AWS_S3_ENDPOINT_URL")
    AWS_S3_REGION_NAME = env("AWS_S3_REGION_NAME")
    AWS_QUERYSTRING_AUTH = True

STORAGES = build_storages(
    use_s3_storage=USE_S3_STORAGE,
    bucket_name=env("AWS_STORAGE_BUCKET_NAME"),
)
