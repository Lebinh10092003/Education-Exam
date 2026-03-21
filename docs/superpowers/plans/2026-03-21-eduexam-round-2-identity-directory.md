# EduExam Round 2 Identity and Directory Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first real admin data layer for EduExam: schools, candidate groups, group memberships, subjects, custom roles and permissions, and authenticated user-management APIs that match the current frontend administration screens.

**Architecture:** Extend the existing Round 1 backend with three focused areas: `institutions` for schools and groups, `academics` for subjects, and expanded `identity` for custom RBAC and user-management endpoints. Keep API contracts RESTful under `/api/v1/`, use DRF serializers and generic views, and centralize permission evaluation in reusable identity helpers.

**Tech Stack:** Python, Django, Django REST Framework, SimpleJWT, drf-spectacular, pytest, pytest-django

---

**Preconditions**

- Round 1 foundation is already implemented in `backend/`.
- The workspace is still not a Git repository, so commit steps remain informational only.
- Round 2 should not yet touch exam authoring or delivery models.

## Chunk 1: Domain Apps and Data Model

### Task 1: Create `institutions` and `academics` apps with school, group, membership, and subject models

**Files:**
- Create: `backend/apps/institutions/__init__.py`
- Create: `backend/apps/institutions/apps.py`
- Create: `backend/apps/institutions/models.py`
- Create: `backend/apps/institutions/admin.py`
- Create: `backend/apps/institutions/migrations/__init__.py`
- Create: `backend/apps/academics/__init__.py`
- Create: `backend/apps/academics/apps.py`
- Create: `backend/apps/academics/models.py`
- Create: `backend/apps/academics/admin.py`
- Create: `backend/apps/academics/migrations/__init__.py`
- Modify: `backend/config/settings/base.py`
- Create: `backend/tests/institutions/test_models.py`
- Create: `backend/tests/academics/test_models.py`

- [ ] **Step 1: Write the failing model tests**

```python
def test_group_membership_is_unique_per_user_and_group(db):
    school = School.objects.create(name="School A", code="SCHA")
    user = User.objects.create_user(email="candidate@example.com", password="secret123")
    group = CandidateGroup.objects.create(name="Group A", school=school)
    GroupMembership.objects.create(group=group, user=user)
    with pytest.raises(IntegrityError):
        GroupMembership.objects.create(group=group, user=user)
```

```python
def test_subject_code_is_unique(db):
    Subject.objects.create(name="Mathematics", code="MATH101")
    with pytest.raises(IntegrityError):
        Subject.objects.create(name="Math Clone", code="MATH101")
```

- [ ] **Step 2: Run the model tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_models.py backend/tests/academics/test_models.py -q`
Expected: FAIL because the apps and models do not exist yet.

- [ ] **Step 3: Implement the core models**

```python
class School(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, unique=True)
    description = models.TextField(blank=True)
    is_active = models.BooleanField(default=True)
```

```python
class CandidateGroup(TimeStampedModel):
    name = models.CharField(max_length=255)
    school = models.ForeignKey(School, null=True, blank=True, on_delete=models.SET_NULL)
```

```python
class Subject(TimeStampedModel):
    name = models.CharField(max_length=255)
    code = models.CharField(max_length=64, unique=True)
    color = models.CharField(max_length=32, default="bg-blue-600")
```

- [ ] **Step 4: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations institutions academics`
Expected: New migration files created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 5: Re-run the model tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_models.py backend/tests/academics/test_models.py -q`
Expected: PASS.

### Task 2: Extend identity models for school-aware profiles and custom RBAC records

**Files:**
- Modify: `backend/apps/identity/models.py`
- Modify: `backend/apps/identity/admin.py`
- Create: `backend/tests/identity/test_rbac_models.py`

- [ ] **Step 1: Write failing RBAC model tests**

```python
def test_user_can_receive_custom_role_permissions(db):
    permission = Permission.objects.create(module="users", action="manage", code="users.manage")
    role = Role.objects.create(name="Administrator", slug="administrator", is_system=True)
    RolePermission.objects.create(role=role, permission=permission)
    user = User.objects.create_user(email="admin@example.com", password="secret123")
    UserRole.objects.create(user=user, role=role)
    assert user.has_platform_permission("users.manage") is True
```

```python
def test_profile_can_link_user_to_school(db):
    school = School.objects.create(name="School A", code="SCHA")
    user = User.objects.create_user(email="student@example.com", password="secret123")
    profile = Profile.objects.create(user=user, school=school)
    assert profile.school == school
```

- [ ] **Step 2: Run RBAC tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_rbac_models.py -q`
Expected: FAIL because the RBAC records and school-aware profile fields do not exist yet.

- [ ] **Step 3: Implement role, permission, role-permission, and user-role models**

```python
class Permission(TimeStampedModel):
    module = models.CharField(max_length=64)
    action = models.CharField(max_length=64)
    code = models.CharField(max_length=128, unique=True)
```

```python
class UserRole(TimeStampedModel):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name="user_roles")
    role = models.ForeignKey(Role, on_delete=models.CASCADE, related_name="user_roles")
```

- [ ] **Step 4: Add `school`, `status`, and helper methods to identity models**

```python
class Profile(TimeStampedModel):
    school = models.ForeignKey("institutions.School", null=True, blank=True, on_delete=models.SET_NULL)
```

```python
def has_platform_permission(self, code: str) -> bool:
    ...
```

- [ ] **Step 5: Create and apply migrations**

Run: `backend\.venv\Scripts\python backend\manage.py makemigrations identity`
Expected: New migration file created.

Run: `backend\.venv\Scripts\python backend\manage.py migrate`
Expected: PASS.

- [ ] **Step 6: Re-run RBAC tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_rbac_models.py -q`
Expected: PASS.

## Chunk 2: Permission Evaluation and API Surface

### Task 3: Add reusable DRF permission helpers for custom permission codes

**Files:**
- Create: `backend/apps/identity/permissions.py`
- Create: `backend/tests/identity/test_permission_helpers.py`

- [ ] **Step 1: Write failing permission helper tests**

```python
def test_manage_permission_class_allows_user_with_custom_code(api_rf, admin_user):
    request = api_rf.get("/api/v1/users/")
    request.user = admin_user
    view = DummyProtectedView()
    assert view.check_permissions(request) is None
```

- [ ] **Step 2: Run the tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_permission_helpers.py -q`
Expected: FAIL because the permission helper does not exist yet.

- [ ] **Step 3: Implement permission-code-aware DRF permission classes**

```python
class HasAPIModelPermission(BasePermission):
    permission_code = ""
```

- [ ] **Step 4: Re-run the permission helper tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_permission_helpers.py -q`
Expected: PASS.

### Task 4: Build CRUD APIs for schools, groups, memberships, and subjects

**Files:**
- Create: `backend/apps/institutions/api/__init__.py`
- Create: `backend/apps/institutions/api/serializers.py`
- Create: `backend/apps/institutions/api/views.py`
- Create: `backend/apps/institutions/api/urls.py`
- Create: `backend/apps/academics/api/__init__.py`
- Create: `backend/apps/academics/api/serializers.py`
- Create: `backend/apps/academics/api/views.py`
- Create: `backend/apps/academics/api/urls.py`
- Modify: `backend/config/urls.py`
- Create: `backend/tests/institutions/test_api.py`
- Create: `backend/tests/academics/test_api.py`

- [ ] **Step 1: Write failing API tests**

```python
def test_school_list_requires_authentication(client):
    response = client.get("/api/v1/schools/")
    assert response.status_code == 401
```

```python
def test_authenticated_admin_can_create_subject(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.post("/api/v1/subjects/", {...}, format="json")
    assert response.status_code == 201
```

- [ ] **Step 2: Run the API tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_api.py backend/tests/academics/test_api.py -q`
Expected: FAIL because the routes and views do not exist yet.

- [ ] **Step 3: Implement serializers, query filters, and viewsets**

```python
class SchoolViewSet(ModelViewSet):
    queryset = School.objects.all()
    search_fields = ("name", "code")
```

```python
class CandidateGroupViewSet(ModelViewSet):
    def get_queryset(self):
        ...
```

```python
class SubjectViewSet(ModelViewSet):
    search_fields = ("name", "code", "description")
```

- [ ] **Step 4: Add routers under `/api/v1/`**

```python
router.register("schools", SchoolViewSet, basename="schools")
router.register("groups", CandidateGroupViewSet, basename="groups")
router.register("subjects", SubjectViewSet, basename="subjects")
```

- [ ] **Step 5: Re-run the API tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/institutions/test_api.py backend/tests/academics/test_api.py -q`
Expected: PASS.

## Chunk 3: User Management and RBAC APIs

### Task 5: Build user list/detail/create/update APIs with role assignment and lock/unlock actions

**Files:**
- Modify: `backend/apps/identity/api/serializers.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/identity/api/urls.py`
- Create: `backend/tests/identity/test_user_management_api.py`

- [ ] **Step 1: Write failing user-management API tests**

```python
def test_admin_can_list_users_with_search_and_role_filter(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/users/?search=jane&role=examiner")
    assert response.status_code == 200
```

```python
def test_admin_can_lock_and_unlock_user(api_client, admin_token, candidate_user):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    lock_response = api_client.post(f"/api/v1/users/{candidate_user.id}/lock/")
    assert lock_response.status_code == 200
```

- [ ] **Step 2: Run the user-management tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_user_management_api.py -q`
Expected: FAIL because the user-management routes do not exist yet.

- [ ] **Step 3: Implement serializers and views for user CRUD plus custom actions**

```python
class UserViewSet(ModelViewSet):
    search_fields = ("email", "full_name")

    @action(detail=True, methods=["post"])
    def lock(self, request, pk=None):
        ...
```

- [ ] **Step 4: Re-run user-management tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_user_management_api.py -q`
Expected: PASS.

### Task 6: Expose role and permission catalog APIs plus deterministic seed data

**Files:**
- Modify: `backend/apps/identity/api/serializers.py`
- Modify: `backend/apps/identity/api/views.py`
- Modify: `backend/apps/identity/api/urls.py`
- Modify: `backend/apps/identity/management/commands/seed_demo_data.py`
- Create: `backend/tests/identity/test_role_api.py`

- [ ] **Step 1: Write failing role API and seed tests**

```python
def test_seed_command_creates_system_roles_and_permissions():
    call_command("seed_demo_data")
    assert Role.objects.filter(slug="administrator").exists()
    assert Permission.objects.filter(code="users.manage").exists()
```

```python
def test_role_list_endpoint_returns_permissions(api_client, admin_token):
    api_client.credentials(HTTP_AUTHORIZATION=f"Bearer {admin_token}")
    response = api_client.get("/api/v1/roles/")
    assert response.status_code == 200
```

- [ ] **Step 2: Run role tests to verify failure**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_role_api.py -q`
Expected: FAIL because the role endpoints and seed behavior do not exist yet.

- [ ] **Step 3: Implement role and permission read/write APIs and update seed command**

```python
SYSTEM_PERMISSION_MATRIX = {
    "users.manage": ...,
    "groups.manage": ...,
    "subjects.manage": ...,
}
```

- [ ] **Step 4: Re-run the role tests**

Run: `backend\.venv\Scripts\python -m pytest backend/tests/identity/test_role_api.py -q`
Expected: PASS.

## Chunk 4: Verification and Developer Notes

### Task 7: Document Round 2 behavior and verify the whole slice

**Files:**
- Modify: `backend/README.md`
- Modify: `backend/openapi.yaml`

- [ ] **Step 1: Update backend README**

Document:
- Round 2 apps and endpoints
- how to seed roles and admin users
- example login and authenticated API flow

- [ ] **Step 2: Run full verification**

Run: `backend\.venv\Scripts\python backend\manage.py check`
Expected: PASS.

Run: `backend\.venv\Scripts\python -m pytest backend/tests -q`
Expected: PASS with all Round 1 and Round 2 tests green.

Run: `backend\.venv\Scripts\python backend\manage.py spectacular --file backend\openapi.yaml`
Expected: PASS with schema including schools, groups, subjects, users, roles, and permissions.

- [ ] **Step 3: Checkpoint note**

Because this workspace is not under Git, record completion in the session log instead of committing. If Git is initialized later, checkpoint after Round 2.
