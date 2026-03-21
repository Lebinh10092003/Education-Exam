# EduExam Round 1 Foundation Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the initial Django backend foundation for the existing EduExam React frontend, including project scaffold, core settings, infrastructure wiring, a custom user model, JWT auth, health endpoints, and the first shared platform utilities.

**Architecture:** Create a separate `backend/` Django project with split settings, DRF, SimpleJWT, Channels, Celery, Redis, S3-compatible storage hooks, and focused apps (`platform_core`, `identity`). Keep the backend API-first, with REST endpoints under `/api/v1/` and WebSocket/Celery wiring ready for later rounds.

**Tech Stack:** Python, Django, Django REST Framework, SimpleJWT, PostgreSQL, Redis, Celery, Channels, django-storages, boto3, drf-spectacular, pytest, pytest-django

**Preconditions**

- This workspace is currently not a Git repository, so commit checkpoints cannot run yet.
- Execute this plan in the current workspace unless the project is moved into a Git repository later.
- Backend files should live under `backend/` so they do not interfere with the existing Vite frontend.

## Chunk 1: Project Scaffold and Infrastructure Wiring

### Task 1: Create backend project skeleton and dependency manifests

**Files:**
- Create: `backend/pyproject.toml`
- Create: `backend/manage.py`
- Create: `backend/config/__init__.py`
- Create: `backend/config/settings/__init__.py`
- Create: `backend/config/settings/base.py`
- Create: `backend/config/settings/local.py`
- Create: `backend/config/settings/test.py`
- Create: `backend/config/urls.py`
- Create: `backend/config/asgi.py`
- Create: `backend/config/wsgi.py`
- Create: `backend/config/celery.py`
- Create: `backend/.env.example`
- Create: `backend/pytest.ini`
- Create: `backend/tests/conftest.py`

- [ ] **Step 1: Write the failing smoke test for settings bootstrap**

```python
def test_health_settings_loaded(client):
    response = client.get("/api/v1/health/live/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run test to verify it fails**

Run: `python -m pytest backend/tests/platform_core/test_health_api.py -q`
Expected: FAIL because the backend project and endpoint do not exist yet.

- [ ] **Step 3: Create the Django project skeleton and dependency manifest**

```toml
[project]
name = "eduexam-backend"
dependencies = [
  "Django>=5.1,<5.2",
  "djangorestframework>=3.15,<3.16",
  "djangorestframework-simplejwt>=5.3,<5.4",
  "channels>=4.1,<4.2",
  "channels-redis>=4.2,<4.3",
  "celery[redis]>=5.4,<5.5",
  "django-environ>=0.12,<0.13",
  "django-storages[s3]>=1.14,<1.15",
  "drf-spectacular>=0.28,<0.29",
  "boto3>=1.37,<1.38",
  "psycopg[binary]>=3.2,<3.3",
  "redis>=5.2,<5.3",
  "pytest>=8.3,<8.4",
  "pytest-django>=4.9,<5.0",
]
```

- [ ] **Step 4: Add split settings and app bootstrap**

```python
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.local")
application = get_asgi_application()
```

```python
# backend/tests/conftest.py
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.test")
```

- [ ] **Step 5: Run the smoke test again**

Run: `python -m pytest backend/tests/platform_core/test_health_api.py -q`
Expected: Still FAIL because the health app is not wired yet, but Django imports should succeed.

### Task 2: Add local infrastructure configuration for Postgres, Redis, Celery, Channels, and S3-compatible storage

**Files:**
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/settings/local.py`
- Modify: `backend/config/asgi.py`
- Modify: `backend/config/celery.py`
- Create: `backend/docker-compose.yml`

- [ ] **Step 1: Add environment-driven infrastructure settings**

```python
DATABASES = {"default": env.db("DATABASE_URL")}
CELERY_BROKER_URL = env("CELERY_BROKER_URL")
CHANNEL_LAYERS = {"default": {"BACKEND": "channels_redis.core.RedisChannelLayer"}}
AWS_STORAGE_BUCKET_NAME = env("AWS_STORAGE_BUCKET_NAME", default="")
```

- [ ] **Step 2: Add local service definitions**

```yaml
services:
  postgres:
  redis:
  minio:
```

- [ ] **Step 3: Verify Django still boots with local defaults**

Run: `python backend/manage.py check`
Expected: PASS with no configuration import errors.

## Chunk 2: Shared Platform Core

### Task 3: Create the `platform_core` app with common base models, API envelope helpers, and health endpoints

**Files:**
- Create: `backend/apps/platform_core/__init__.py`
- Create: `backend/apps/platform_core/apps.py`
- Create: `backend/apps/platform_core/models.py`
- Create: `backend/apps/platform_core/api/__init__.py`
- Create: `backend/apps/platform_core/api/serializers.py`
- Create: `backend/apps/platform_core/api/views.py`
- Create: `backend/apps/platform_core/api/urls.py`
- Create: `backend/tests/platform_core/test_health_api.py`
- Modify: `backend/config/settings/base.py`
- Modify: `backend/config/urls.py`

- [ ] **Step 1: Write the health endpoint tests**

```python
def test_liveness_endpoint_returns_ok(client):
    response = client.get("/api/v1/health/live/")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_readiness_endpoint_returns_component_statuses(client):
    response = client.get("/api/v1/health/ready/")
    assert response.status_code == 200
    assert "components" in response.json()
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `python -m pytest backend/tests/platform_core/test_health_api.py -q`
Expected: FAIL with missing app, URL, or view errors.

- [ ] **Step 3: Implement the minimal platform core app**

```python
class TimeStampedModel(models.Model):
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
```

```python
class LivenessView(APIView):
    def get(self, request):
        return Response({"status": "ok"})
```

- [ ] **Step 4: Wire routes into `/api/v1/health/...`**

```python
urlpatterns = [
    path("api/v1/health/", include("apps.platform_core.api.urls")),
]
```

- [ ] **Step 5: Run platform core tests**

Run: `python -m pytest backend/tests/platform_core/test_health_api.py -q`
Expected: PASS.

### Task 4: Add request correlation and audit-ready middleware hooks

**Files:**
- Create: `backend/apps/platform_core/middleware.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/platform_core/test_request_context.py`

- [ ] **Step 1: Write tests for request ID propagation**

```python
def test_response_contains_request_id_header(client):
    response = client.get("/api/v1/health/live/")
    assert "X-Request-ID" in response
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `python -m pytest backend/tests/platform_core/test_request_context.py -q`
Expected: FAIL because middleware is not registered yet.

- [ ] **Step 3: Implement middleware and settings registration**

```python
request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
response["X-Request-ID"] = request_id
```

- [ ] **Step 4: Run the request context tests**

Run: `python -m pytest backend/tests/platform_core/test_request_context.py -q`
Expected: PASS.

## Chunk 3: Identity Foundation and JWT Auth

### Task 5: Add the `identity` app with custom user model and profile

**Files:**
- Create: `backend/apps/identity/__init__.py`
- Create: `backend/apps/identity/apps.py`
- Create: `backend/apps/identity/models.py`
- Create: `backend/apps/identity/admin.py`
- Create: `backend/apps/identity/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/identity/test_user_model.py`

- [ ] **Step 1: Write model tests for the custom user model**

```python
def test_create_user_uses_email_as_identifier(db):
    user = User.objects.create_user(email="admin@example.com", password="secret123")
    assert user.email == "admin@example.com"
    assert user.check_password("secret123")
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `python -m pytest backend/tests/identity/test_user_model.py -q`
Expected: FAIL because the custom user model is not defined yet.

- [ ] **Step 3: Implement user manager, user model, and profile model**

```python
class User(AbstractBaseUser, PermissionsMixin, TimeStampedModel):
    email = models.EmailField(unique=True)
    full_name = models.CharField(max_length=255)
    is_active = models.BooleanField(default=True)
    USERNAME_FIELD = "email"
```

- [ ] **Step 4: Create and apply migrations**

Run: `python backend/manage.py makemigrations identity`
Expected: Migration file created.

Run: `python backend/manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run the user model tests**

Run: `python -m pytest backend/tests/identity/test_user_model.py -q`
Expected: PASS.

### Task 6: Expose JWT auth and profile endpoints through DRF

**Files:**
- Create: `backend/apps/identity/api/__init__.py`
- Create: `backend/apps/identity/api/serializers.py`
- Create: `backend/apps/identity/api/views.py`
- Create: `backend/apps/identity/api/urls.py`
- Modify: `backend/config/urls.py`
- Create: `backend/tests/identity/test_auth_api.py`

- [ ] **Step 1: Write auth API tests**

```python
def test_login_returns_access_and_refresh_tokens(api_client, user):
    response = api_client.post("/api/v1/auth/login/", {"email": user.email, "password": "secret123"})
    assert response.status_code == 200
    assert "access" in response.json()
    assert "refresh" in response.json()
```

```python
def test_profile_endpoint_requires_authentication(api_client):
    response = api_client.get("/api/v1/profile/")
    assert response.status_code == 401
```

- [ ] **Step 2: Run the auth API tests to verify failure**

Run: `python -m pytest backend/tests/identity/test_auth_api.py -q`
Expected: FAIL because auth URLs and serializers do not exist yet.

- [ ] **Step 3: Implement JWT login, refresh, and profile views**

```python
urlpatterns = [
    path("auth/login/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path("profile/", ProfileView.as_view(), name="profile-detail"),
]
```

- [ ] **Step 4: Run the auth API tests**

Run: `python -m pytest backend/tests/identity/test_auth_api.py -q`
Expected: PASS.

## Chunk 4: Developer Experience and Verification

### Task 7: Add seed command, API schema, and backend README

**Files:**
- Create: `backend/apps/identity/management/__init__.py`
- Create: `backend/apps/identity/management/commands/__init__.py`
- Create: `backend/apps/identity/management/commands/seed_demo_data.py`
- Modify: `backend/config/urls.py`
- Create: `backend/README.md`

- [ ] **Step 1: Add API schema and docs endpoints**

```python
path("api/schema/", SpectacularAPIView.as_view(), name="api-schema")
path("api/docs/", SpectacularSwaggerView.as_view(url_name="api-schema"), name="api-docs")
```

- [ ] **Step 2: Add a minimal seed command**

```python
call_command("seed_demo_data")
```

- [ ] **Step 3: Write backend usage documentation**

Document:
- required environment variables
- local service startup
- migrate command
- seed command
- test command

- [ ] **Step 4: Run final round verification**

Run: `python backend/manage.py check`
Expected: PASS.

Run: `python -m pytest backend/tests -q`
Expected: PASS with all Round 1 tests green.

Run: `python backend/manage.py spectacular --file backend/openapi.yaml`
Expected: PASS and generate schema file.

- [ ] **Step 5: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, create a checkpoint commit after Round 1.
