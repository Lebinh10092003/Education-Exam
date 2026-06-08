# Group Members Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated admin group members page with full roster fields, import, add/edit/delete/detail actions, and admin-visible credentials for newly created/imported candidate accounts.

**Architecture:** Extend `identity.Profile` with roster fields and an admin-visible password field, expose those fields through the existing group membership API, and move member operations from the `/groups` dialog to a new `/groups/:id/members` page. Keep `/groups` as the group overview and use existing API/request/dialog/UI patterns.

**Tech Stack:** Django + DRF + pytest backend, React + Vite + Vitest frontend, Docker production deploy.

---

## Chunk 1: Backend Roster Data and API

### Task 1: Add profile fields

**Files:**
- Modify: `backend/apps/identity/models.py`
- Create: `backend/apps/identity/migrations/0006_profile_roster_credentials.py`

- [ ] Add `ward`, `national_exam_subject`, `exam_block`, `candidate_number`, and `visible_password` to `Profile`.
- [ ] Add a migration with blank allowed for all new fields.

### Task 2: Expand group membership serialization

**Files:**
- Modify: `backend/apps/institutions/api/serializers.py`
- Modify: `backend/apps/institutions/api/views.py`
- Test: `backend/tests/institutions/test_group_memberships_api.py`

- [ ] Write tests for the membership endpoint returning full roster fields.
- [ ] Use `select_related("user", "user__profile", "user__profile__school")` for membership lists.
- [ ] Add search support for name, email, username, phone, candidate number, and school name.
- [ ] Serialize `username`, `visible_password`, `date_of_birth`, `school`, `ward`, `national_exam_subject`, `exam_block`, `candidate_number`, `email`, and `phone_number`.

### Task 3: Store visible passwords and roster fields

**Files:**
- Modify: `backend/apps/identity/api/serializers.py`
- Modify: `backend/apps/institutions/services.py`
- Test: `backend/tests/institutions/test_group_memberships_api.py`

- [ ] Extend `UserSerializer` create/update to accept roster profile fields and update `visible_password` only when a password is provided.
- [ ] Extend group CSV import to accept `ward`, `national_exam_subject`, `exam_block`, `candidate_number`, `username`, and `password`.
- [ ] Keep `school_code` canonical; allow `school` lookup by existing school name.
- [ ] Store generated/imported password in `Profile.visible_password` for newly imported users.

---

## Chunk 2: Frontend Route and Page

### Task 4: Route and group card navigation

**Files:**
- Modify: `src/app/routes.ts`
- Modify: `src/app/pages/GroupManagement.tsx`
- Test: `src/app/routes.test.tsx`
- Test: `src/app/pages/GroupManagement.test.tsx`

- [ ] Add lazy route for `GroupMembersPage`.
- [ ] Register `/groups/:id/members`.
- [ ] Replace the group member dialog action with a `Thanh vien` button linking to the new page.
- [ ] Keep group create/edit/delete on `/groups`.

### Task 5: Build `GroupMembersPage`

**Files:**
- Create: `src/app/pages/GroupMembersPage.tsx`
- Test: `src/app/pages/GroupMembersPage.test.tsx`

- [ ] Load group detail from `/api/v1/groups/:id/`.
- [ ] Load paginated members from `/api/v1/groups/:id/memberships/` with search and page.
- [ ] Render roster table columns: `STT`, `Ho ten`, `Ngay sinh`, `Truong`, `Xa/Phuong`, `Mon thi quoc gia`, `Khoi thi`, `SBD`, `Email lien lac`, `SDT lien lac`, `Tai khoan`, `Mat khau`, actions.
- [ ] Add CSV import controls and summary.
- [ ] Add dialog for create/edit/detail candidate with full fields and password handling.
- [ ] Add remove-from-group and delete-account actions.

### Task 6: Update import template

**Files:**
- Modify: `src/app/lib/importTemplates.ts`

- [ ] Update group member import template headers to include the new roster fields.

---

## Chunk 3: Verification and Deploy

### Task 7: Run focused tests

**Commands:**
- `cd backend; pytest tests/institutions/test_group_memberships_api.py -q`
- `npm test -- GroupManagement GroupMembersPage routes`
- `npm run build`

- [ ] Fix any backend test failures.
- [ ] Fix any frontend test/build failures.

### Task 8: Commit and deploy

**Commands:**
- `git status --short`
- `git add ... && git commit -m "Add group members roster page"`
- `git push vps main`
- `ssh root@103.142.27.69 "cd /opt/khaothi.fermat.vn && bash deploy/update.sh"`
- `curl.exe -fsS -o NUL -w "FRONTEND_HTTP_STATUS:%{http_code}\n" https://khaothi.fermat.vn/groups`
- `curl.exe -fsS -w "\nAPI_HTTP_STATUS:%{http_code}\n" https://khaothi.fermat.vn/api/v1/health/live/`

- [ ] Commit implementation.
- [ ] Deploy to VPS.
- [ ] Verify frontend and API health.
