from datetime import timedelta
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit

import environ

from .storage import build_storages, split_s3_endpoint

BASE_DIR = Path(__file__).resolve().parents[2]

env = environ.Env(
    DEBUG=(bool, False),
    SECRET_KEY=(str, "unsafe-dev-secret-key-for-eduexam-dev-1234567890"),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    DATABASE_URL=(str, f"sqlite:///{BASE_DIR / 'db.sqlite3'}"),
    DATABASE_CONN_MAX_AGE=(int, 60),
    DATABASE_CONN_HEALTH_CHECKS=(bool, True),
    DATABASE_DISABLE_SERVER_SIDE_CURSORS=(bool, False),
    REDIS_URL=(str, "redis://localhost:6379/0"),
    REDIS_CHANNEL_URL=(str, ""),
    REDIS_CACHE_URL=(str, ""),
    REDIS_RUNTIME_URL=(str, ""),
    REDIS_RUNTIME_MAX_CONNECTIONS=(int, 50),
    CELERY_BROKER_URL=(str, "redis://localhost:6379/0"),
    CELERY_RESULT_BACKEND=(str, "redis://localhost:6379/1"),
    CELERY_WORKER_CONCURRENCY=(int, 2),
    SIMPLE_JWT_UPDATE_LAST_LOGIN=(bool, True),
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
    PROCTORING_MONITORING_SNAPSHOT_TTL_SECONDS=(int, 10),
    PROCTORING_EVIDENCE_RETENTION_DAYS=(int, 180),
    PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=(int, 3600),
    NOTIFICATION_PERMISSION_RECIPIENT_CACHE_TTL_SECONDS=(int, 60),
    EXAM_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS=(int, 30),
    PRACTICE_DETAILS_RETENTION_DAYS=(int, 15),
    PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS=(int, 3600),
    PROCTORING_VIOLATION_COOLDOWN_SECONDS=(int, 5),
    PROCTORING_VIOLATION_ESCALATE_AFTER=(int, 3),
    PROCTORING_NOTIFY_CANDIDATE_ON_VIOLATION=(bool, True),
    PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES=(int, 5 * 1024 * 1024),
    EXAM_RANDOM_POOL_CACHE_TTL_SECONDS=(int, 120),
    EXAM_SUBMISSION_GRACE_SECONDS=(int, 300),
    EXAM_ANSWER_SYNC_TOLERANCE_SECONDS=(int, 30),
    EXAM_OVERDUE_FINALIZE_INTERVAL_SECONDS=(int, 60),
    PROCTORING_EVIDENCE_STORAGE=(str, "auto"),
    PROCTORING_EVIDENCE_ROOT_FOLDER=(str, "Vi phạm kỳ thi"),
    PROCTORING_EVIDENCE_S3_BUCKET=(str, ""),
    PROCTORING_EVIDENCE_S3_ENDPOINT_URL=(str, ""),
    PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID=(str, ""),
    PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY=(str, ""),
    PROCTORING_EVIDENCE_S3_REGION=(str, "auto"),
    PROCTORING_EVIDENCE_URL_EXPIRE_SECONDS=(int, 3600),
    PROCTORING_EVIDENCE_UPLOAD_URL_EXPIRE_SECONDS=(int, 300),
    EMAIL_HOST=(str, "localhost"),
    EMAIL_PORT=(int, 25),
    EMAIL_HOST_USER=(str, ""),
    EMAIL_HOST_PASSWORD=(str, ""),
    EMAIL_USE_TLS=(bool, False),
    EMAIL_USE_SSL=(bool, False),
    EMAIL_TIMEOUT=(int, 10),
    LOG_LEVEL=(str, "INFO"),
    SENTRY_DSN=(str, ""),
    SENTRY_ENVIRONMENT=(str, "production"),
    SENTRY_TRACES_SAMPLE_RATE=(float, 0.0),
    SECURE_HSTS_SECONDS=(int, 0),
    AUTH_LOGIN_IP_THROTTLE_RATE=(str, "300/min"),
    AUTH_LOGIN_ACCOUNT_THROTTLE_RATE=(str, "10/min"),
    AUTH_PASSWORD_RESET_IP_THROTTLE_RATE=(str, "30/hour"),
    AUTH_PASSWORD_RESET_EMAIL_THROTTLE_RATE=(str, "5/hour"),
    SCHEDULER_HEARTBEAT_INTERVAL_SECONDS=(int, 60),
    SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS=(int, 300),
)

environ.Env.read_env(BASE_DIR / ".env")

DEBUG = env("DEBUG")
SECRET_KEY = env("SECRET_KEY")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS")
REDIS_URL = env("REDIS_URL")


def _redis_url_with_db(url, db_index):
    parsed = urlsplit(url)
    if parsed.scheme not in {"redis", "rediss"}:
        return url
    return urlunsplit((parsed.scheme, parsed.netloc, f"/{db_index}", parsed.query, parsed.fragment))


REDIS_CHANNEL_URL = env("REDIS_CHANNEL_URL") or REDIS_URL
REDIS_CACHE_URL = env("REDIS_CACHE_URL") or _redis_url_with_db(REDIS_URL, 2)
REDIS_RUNTIME_URL = env("REDIS_RUNTIME_URL") or _redis_url_with_db(REDIS_URL, 3)
REDIS_RUNTIME_MAX_CONNECTIONS = env.int("REDIS_RUNTIME_MAX_CONNECTIONS")

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
    "apps.competitions",
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
DATABASES["default"]["CONN_MAX_AGE"] = env.int("DATABASE_CONN_MAX_AGE")
DATABASES["default"]["CONN_HEALTH_CHECKS"] = env.bool("DATABASE_CONN_HEALTH_CHECKS")
if env.bool("DATABASE_DISABLE_SERVER_SIDE_CURSORS"):
    DATABASES["default"]["DISABLE_SERVER_SIDE_CURSORS"] = True

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
# SMTP (dung khi EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend).
EMAIL_HOST = env("EMAIL_HOST")
EMAIL_PORT = env.int("EMAIL_PORT")
EMAIL_HOST_USER = env("EMAIL_HOST_USER")
EMAIL_HOST_PASSWORD = env("EMAIL_HOST_PASSWORD")
EMAIL_USE_TLS = env.bool("EMAIL_USE_TLS")
EMAIL_USE_SSL = env.bool("EMAIL_USE_SSL")
EMAIL_TIMEOUT = env.int("EMAIL_TIMEOUT")
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
PROCTORING_MONITORING_SNAPSHOT_TTL_SECONDS = env.int("PROCTORING_MONITORING_SNAPSHOT_TTL_SECONDS")
PROCTORING_EVIDENCE_RETENTION_DAYS = env.int("PROCTORING_EVIDENCE_RETENTION_DAYS")
PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS = env.int("PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS")
NOTIFICATION_PERMISSION_RECIPIENT_CACHE_TTL_SECONDS = env.int("NOTIFICATION_PERMISSION_RECIPIENT_CACHE_TTL_SECONDS")
EXAM_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS = env.int("EXAM_SESSION_ACTIVITY_WRITE_INTERVAL_SECONDS")
PRACTICE_DETAILS_RETENTION_DAYS = env.int("PRACTICE_DETAILS_RETENTION_DAYS")
PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS = env.int("PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS")
# Gop vi pham: cung loai vi pham trong N giay chi ghi 1 lan (0 = tat).
PROCTORING_VIOLATION_COOLDOWN_SECONDS = env.int("PROCTORING_VIOLATION_COOLDOWN_SECONDS")
# Lan vi pham thu N cung loai trong 1 phien se nang case len critical va bao lai admin (0 = tat).
PROCTORING_VIOLATION_ESCALATE_AFTER = env.int("PROCTORING_VIOLATION_ESCALATE_AFTER")
PROCTORING_NOTIFY_CANDIDATE_ON_VIOLATION = env.bool("PROCTORING_NOTIFY_CANDIDATE_ON_VIOLATION")
PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES = env.int("PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES")
# Cache danh sach cau hoi ung vien cho moi luat de ngau nhien, tranh query lai cho tung thi sinh.
EXAM_RANDOM_POOL_CACHE_TTL_SECONDS = env.int("EXAM_RANDOM_POOL_CACHE_TTL_SECONDS")
# Het gio lam bai -> thi sinh con N giay de bam nop; qua han he thong tu nop va danh dau nop muon.
EXAM_SUBMISSION_GRACE_SECONDS = env.int("EXAM_SUBMISSION_GRACE_SECONDS")
# Cho phep dong bo cau tra loi bi xep hang tren trinh duyet them N giay sau khi het gio.
EXAM_ANSWER_SYNC_TOLERANCE_SECONDS = env.int("EXAM_ANSWER_SYNC_TOLERANCE_SECONDS")
EXAM_OVERDUE_FINALIZE_INTERVAL_SECONDS = env.int("EXAM_OVERDUE_FINALIZE_INTERVAL_SECONDS")

# Gioi han tan suat dang nhap / quen mat khau (de trong = tat). Ca phong thi dung chung IP
# nen gioi han theo IP de rong; gioi han chat tinh theo tai khoan + IP.
AUTH_LOGIN_IP_THROTTLE_RATE = env("AUTH_LOGIN_IP_THROTTLE_RATE")
AUTH_LOGIN_ACCOUNT_THROTTLE_RATE = env("AUTH_LOGIN_ACCOUNT_THROTTLE_RATE")
AUTH_PASSWORD_RESET_IP_THROTTLE_RATE = env("AUTH_PASSWORD_RESET_IP_THROTTLE_RATE")
AUTH_PASSWORD_RESET_EMAIL_THROTTLE_RATE = env("AUTH_PASSWORD_RESET_EMAIL_THROTTLE_RATE")

# Celery beat ghi nhip tim moi N giay (qua worker); /health/ready/ bao loi neu nhip cu hon MAX_AGE (0 = bo qua).
SCHEDULER_HEARTBEAT_INTERVAL_SECONDS = env.int("SCHEDULER_HEARTBEAT_INTERVAL_SECONDS")
SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS = env.int("SCHEDULER_HEARTBEAT_MAX_AGE_SECONDS")

# Chay sau reverse proxy HTTPS (Caddy): tin X-Forwarded-Proto, cookie chi gui qua HTTPS.
if not DEBUG:
    SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
    SESSION_COOKIE_SECURE = True
    CSRF_COOKIE_SECURE = True
    SECURE_CONTENT_TYPE_NOSNIFF = True
    SECURE_REFERRER_POLICY = "same-origin"
    SECURE_HSTS_SECONDS = env.int("SECURE_HSTS_SECONDS")

LOGGING = {
    "version": 1,
    "disable_existing_loggers": False,
    "formatters": {
        "default": {"format": "%(asctime)s %(levelname)s %(name)s: %(message)s"},
    },
    "handlers": {
        "console": {"class": "logging.StreamHandler", "formatter": "default"},
    },
    "root": {"handlers": ["console"], "level": env("LOG_LEVEL").upper()},
    "loggers": {
        "django.request": {"handlers": ["console"], "level": "WARNING", "propagate": False},
    },
}

SENTRY_DSN = env("SENTRY_DSN")
if SENTRY_DSN:
    try:
        import sentry_sdk
    except ImportError:  # pragma: no cover - chi xay ra khi image cu chua cai sentry-sdk
        sentry_sdk = None
    if sentry_sdk is not None:
        sentry_sdk.init(
            dsn=SENTRY_DSN,
            environment=env("SENTRY_ENVIRONMENT"),
            traces_sample_rate=env.float("SENTRY_TRACES_SAMPLE_RATE"),
            send_default_pii=False,
        )

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
AUTH_USER_MODEL = "identity.User"

REST_FRAMEWORK = {
    "DEFAULT_AUTHENTICATION_CLASSES": (
        # Ma truy cap ca nhan cho MCP (Bearer eduexam_pat_...), dat truoc JWT.
        "apps.identity.api_tokens.ApiTokenAuthentication",
        "rest_framework_simplejwt.authentication.JWTAuthentication",
    ),
    "DEFAULT_PERMISSION_CLASSES": (
        "rest_framework.permissions.IsAuthenticated",
    ),
    "DEFAULT_SCHEMA_CLASS": "drf_spectacular.openapi.AutoSchema",
    "DEFAULT_PAGINATION_CLASS": "apps.platform_core.pagination.CustomPageNumberPagination",
    "PAGE_SIZE": 20,
    # Sau dung 1 reverse proxy (Caddy): lay IP cuoi trong X-Forwarded-For, khong tin gia tri client tu gui
    # (dung cho gioi han dang nhap theo IP).
    "NUM_PROXIES": 1,
    # Chi ap dung cho view khai bao ScopedRateThrottle (vd. phieu dang ky cong khai).
    "DEFAULT_THROTTLE_RATES": {
        "competition_registration": "10/hour",
    },
}

SIMPLE_JWT = {
    "ACCESS_TOKEN_LIFETIME": timedelta(minutes=30),
    "REFRESH_TOKEN_LIFETIME": timedelta(days=7),
    "ROTATE_REFRESH_TOKENS": True,
    "BLACKLIST_AFTER_ROTATION": True,
    "UPDATE_LAST_LOGIN": env.bool("SIMPLE_JWT_UPDATE_LAST_LOGIN"),
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
        "ExamModeEnum": "apps.exam_authoring.models.Exam.Mode",
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
CELERY_WORKER_CONCURRENCY = env.int("CELERY_WORKER_CONCURRENCY")
CELERY_TASK_TRACK_STARTED = True
CELERY_TASK_TIME_LIMIT = 60 * 30
CELERY_BEAT_SCHEDULE = {
    "cleanup-expired-proctor-evidence": {
        "task": "apps.proctoring.tasks.cleanup_expired_proctor_evidence_task",
        "schedule": PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS,
    },
    "finalize-overdue-exam-sessions": {
        "task": "apps.exam_delivery.tasks.finalize_overdue_exam_sessions_task",
        "schedule": EXAM_OVERDUE_FINALIZE_INTERVAL_SECONDS,
    },
    "cleanup-expired-practice-details": {
        "task": "apps.practice.tasks.cleanup_expired_practice_details_task",
        "schedule": PRACTICE_DETAILS_CLEANUP_INTERVAL_SECONDS,
    },
    "scheduler-heartbeat": {
        "task": "apps.platform_core.tasks.record_scheduler_heartbeat_task",
        "schedule": SCHEDULER_HEARTBEAT_INTERVAL_SECONDS,
    },
}

CHANNEL_LAYERS = {
    "default": {
        "BACKEND": "channels_redis.core.RedisChannelLayer",
        "CONFIG": {"hosts": [REDIS_CHANNEL_URL]},
    }
}

# Redis cache — giam tai query DB cho exam data va session metadata
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_CACHE_URL,
        "TIMEOUT": 300,  # 5 phut mac dinh
        "KEY_PREFIX": "eduexam",
        "OPTIONS": {
            "max_connections": 50,
        },
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

# Kho anh bang chung tach rieng khoi media chung: bat S3/R2 cho anh vi pham ma khong
# phai chuyen toan bo media (tai lieu, avatar...) khoi VPS.
PROCTORING_EVIDENCE_ROOT_FOLDER = env("PROCTORING_EVIDENCE_ROOT_FOLDER")
# Uu tien: PROCTORING_EVIDENCE_S3_BUCKET > ten bucket nam trong link endpoint > AWS_STORAGE_BUCKET_NAME.
PROCTORING_EVIDENCE_S3_ENDPOINT_URL, PROCTORING_EVIDENCE_S3_BUCKET = split_s3_endpoint(
    env("PROCTORING_EVIDENCE_S3_ENDPOINT_URL") or env("AWS_S3_ENDPOINT_URL"),
    env("PROCTORING_EVIDENCE_S3_BUCKET"),
)
PROCTORING_EVIDENCE_S3_BUCKET = PROCTORING_EVIDENCE_S3_BUCKET or env("AWS_STORAGE_BUCKET_NAME")
PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID = env("PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID") or env("AWS_ACCESS_KEY_ID")
PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY = env("PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY") or env("AWS_SECRET_ACCESS_KEY")
# Mac dinh "auto": co du endpoint + bucket + khoa R2/S3 thi luu anh vi pham len R2, thieu thi luu tren VPS.
# Dat "s3" de bat buoc dung R2 (thieu cau hinh se bao loi ngay khi khoi dong), "local" de luon luu VPS.
PROCTORING_EVIDENCE_STORAGE = (env("PROCTORING_EVIDENCE_STORAGE") or "auto").strip().lower()
if PROCTORING_EVIDENCE_STORAGE == "auto":
    PROCTORING_EVIDENCE_STORAGE = (
        "s3"
        if USE_S3_STORAGE
        or all(
            (
                PROCTORING_EVIDENCE_S3_ENDPOINT_URL,
                PROCTORING_EVIDENCE_S3_BUCKET,
                PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID,
                PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY,
            )
        )
        else "local"
    )
PROCTORING_EVIDENCE_S3_REGION = env("PROCTORING_EVIDENCE_S3_REGION")
PROCTORING_EVIDENCE_URL_EXPIRE_SECONDS = env.int("PROCTORING_EVIDENCE_URL_EXPIRE_SECONDS")
PROCTORING_EVIDENCE_UPLOAD_URL_EXPIRE_SECONDS = env.int("PROCTORING_EVIDENCE_UPLOAD_URL_EXPIRE_SECONDS")

STORAGES = build_storages(
    use_s3_storage=USE_S3_STORAGE,
    bucket_name=env("AWS_STORAGE_BUCKET_NAME"),
    evidence_storage=PROCTORING_EVIDENCE_STORAGE,
    evidence_s3_options={
        "bucket_name": PROCTORING_EVIDENCE_S3_BUCKET,
        "endpoint_url": PROCTORING_EVIDENCE_S3_ENDPOINT_URL or None,
        "access_key": PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID,
        "secret_key": PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY,
        "region_name": PROCTORING_EVIDENCE_S3_REGION,
        "signature_version": "s3v4",
        "querystring_auth": True,
        "querystring_expire": PROCTORING_EVIDENCE_URL_EXPIRE_SECONDS,
        "file_overwrite": False,
        "default_acl": None,
    },
)
