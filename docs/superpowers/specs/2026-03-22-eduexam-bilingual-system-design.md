# EduExam Bilingual System Design

## Summary

EduExam will support Vietnamese and English across the full system, including frontend UI, backend API messages, and forgot/reset-password email flow. Vietnamese (`vi`) will be the default system language. The selected language is stored locally on the current device and sent to the backend through `Accept-Language`.

Dynamic business data such as exam names, room names, material titles, and other user-authored content will remain unchanged. Only system-owned labels, helper text, validation messages, notifications, and email templates will be translated.

## Goals

- Provide `vi/en` language switching on public auth pages and authenticated admin/candidate shells.
- Persist language locally on the current browser/device only.
- Return translated API validation and detail messages from Django based on request locale.
- Implement real forgot/reset-password flow with bilingual email subject/body and reset UI.
- Keep API payload shapes and database content stable.

## Non-Goals

- Translating user-authored or seeded business content in the database.
- Persisting language preference on the user profile or server side.
- Introducing per-tenant or per-organization locale policy.
- Reworking existing page information architecture while adding translations.

## Current State

- Frontend has no i18n framework and currently hardcodes copy in pages, layouts, and notification helpers.
- `src/app/lib/http.ts` is the single request gateway and is the right place to attach `Accept-Language`.
- Backend currently sets `LANGUAGE_CODE = "en-us"` and does not use `LocaleMiddleware`.
- Several serializers and services hardcode English validation/detail messages.
- Forgot-password exists only as a generic API acknowledgement and page; reset token/email/reset page do not yet exist.

## Recommended Approach

Use Django i18n on the backend and `react-i18next` on the frontend.

This is the cleanest fit for the existing stack:

- Django already has mature locale middleware, translation catalogs, and email/template support.
- The frontend now spans many admin/candidate pages, making ad hoc dictionaries or manual toggles too expensive to maintain.
- `react-i18next` supports structured namespaces, runtime switching, and gradual rollout without blocking lazy routes.

## Architecture

### Frontend

Add a frontend i18n bootstrap centered around `react-i18next`.

Core pieces:

- `src/app/i18n/index.ts` to initialize `i18next`
- `src/app/i18n/resources/vi/*`
- `src/app/i18n/resources/en/*`
- a local storage key such as `eduexam.locale`
- a reusable `LanguageSwitcher` component for public and authenticated layouts

Namespaces will be organized by domain instead of a single large translation file:

- `common`
- `auth`
- `navigation`
- `dashboard`
- `users`
- `groups`
- `subjects`
- `questionBank`
- `exams`
- `grading`
- `materials`
- `results`
- `notifications`
- `audit`
- `candidate`
- `profile`

Frontend bootstrap rules:

- default locale is always `vi`
- locale is read from local storage first
- if the key is missing, start in `vi`
- do not infer locale from browser language
- language changes update UI immediately and affect subsequent API requests

Language switcher placement:

- login page
- forgot-password page
- admin header
- candidate header

### Backend

Use Django’s built-in translation system.

Settings changes:

- set `LANGUAGE_CODE = "vi"`
- define `LANGUAGES = [("vi", "Vietnamese"), ("en", "English")]`
- enable `LocaleMiddleware`
- define `LOCALE_PATHS`

Request locale behavior:

- frontend sends `Accept-Language`
- backend resolves locale from request headers
- fallback is `vi`

Message strategy:

- convert hardcoded system messages to `gettext`/`gettext_lazy`
- preserve field names and response schema
- only translate message text, not response structure

### HTTP Boundary

`src/app/lib/http.ts` will become the locale propagation boundary.

Responsibilities:

- attach `Accept-Language` to every request, including unauthenticated requests
- ensure auth refresh requests also carry the current locale
- continue owning token refresh and auth error propagation

This keeps locale handling out of individual pages.

## Forgot Password and Reset Password

The current forgot-password implementation is incomplete for the requested scope. This design upgrades it to a full working flow.

### Backend Flow

Add password reset flow in `identity`:

- forgot-password endpoint accepts email and always returns a generic success message
- if a matching account exists, backend generates a reset token
- backend sends a bilingual email in the locale of the current request
- add a reset-password endpoint that validates token + uid and sets the new password

Expected behavior:

- the API never reveals whether an email exists
- token generation should use Django’s built-in secure token mechanisms
- reset emails should include a frontend URL for the reset form

### Frontend Flow

Add a reset-password page and route:

- `GET /reset-password` frontend page with token inputs from URL
- submit new password + confirmation to backend reset endpoint
- show translated success/error states

This turns forgot-password from a placeholder into a real bilingual authentication flow.

## Data Ownership and Translation Rules

Translate:

- page titles
- labels
- helper text
- button text
- form validation text
- toast/alert titles and messages
- backend `detail` messages
- email subject/body/call-to-action

Do not translate:

- exam names
- room names
- material titles or descriptions authored by users
- audit descriptions already derived from stored business content unless they are system-owned templates
- arbitrary database content

If a message mixes system text and dynamic values, translate only the system template and interpolate the dynamic values.

## UI Integration Boundaries

The first translation layer should cover shared surfaces before deep page content:

1. public auth pages
2. admin layout navigation and header
3. candidate layout navigation and header
4. shared components such as page headers, badges, empty states, loading text, and notifications
5. feature pages by domain

This reduces key duplication and keeps new pages from reintroducing hardcoded English.

## Backend Translation Priorities

Prioritize system messages in these areas first:

- auth login/change-password/forgot-password/reset-password
- identity management self-action guards and lock/unlock errors
- exam delivery validation
- grading validation
- exam authoring validation
- question bank validation
- proctoring validation
- notification and audit detail messages owned by the system

System-generated audit or notification descriptions should move to translated templates where practical. Existing stored records remain as-is.

## Email Design

Email delivery will support bilingual subject/body templates.

Needed pieces:

- default sender configuration in settings
- reset-password email subject templates for `vi/en`
- plain-text email body templates for `vi/en`
- frontend reset URL setting in backend env/settings

Local development can continue to use console or locmem email backends. The production path should remain SMTP-compatible.

## Error Handling

Frontend:

- missing translation key falls back to Vietnamese
- backend API errors are shown as returned; once translated server-side, frontend automatically displays the correct locale
- locale switching must not log users out or invalidate current route state

Backend:

- if a translation catalog misses a string, Django falls back to source text
- forgot-password still returns generic success even if sending fails internally, unless policy requires surfacing operational failure
- reset-password token validation errors must remain generic and translated

## Testing Strategy

### Frontend

- verify switching language on login and forgot-password pages
- verify switching language in admin and candidate headers
- verify locale persists after reload via local storage
- verify `Accept-Language` header is sent by `apiRequest`
- verify route-level lazy pages render translated shared UI

### Backend

- verify `Accept-Language: vi` returns Vietnamese messages
- verify `Accept-Language: en` returns English messages
- verify forgot-password email subject/body match requested locale
- verify reset-password token flow works end-to-end

### Regression

- auth/login/session refresh behavior remains unchanged
- candidate/admin routing remains unchanged
- `reset_demo_data` and other local setup flows keep working
- dynamic DB content remains unmodified

## Rollout Plan

1. Introduce frontend i18n bootstrap and storage-backed locale selection.
2. Add Django locale settings and translation plumbing.
3. Translate auth pages and auth backend responses.
4. Implement real forgot/reset-password flow and bilingual emails.
5. Translate admin/candidate layouts and common UI components.
6. Translate feature pages by domain.
7. Sweep remaining backend validation and system-generated messages.

## Risks and Mitigations

### Risk: Partial translation coverage creates mixed-language UI

Mitigation:

- start with shared layouts/components and auth surfaces first
- use namespace structure to track coverage by domain

### Risk: Backend and frontend translations drift

Mitigation:

- keep frontend text for UI-owned copy only
- keep backend text for API-owned/system-owned messages only
- use `Accept-Language` as the single contract between layers

### Risk: Forgot-password flow grows beyond current placeholder design

Mitigation:

- implement a minimal secure reset flow using Django primitives
- avoid building account recovery features beyond email token reset

## Acceptance Criteria

- Users can switch between Vietnamese and English from public auth pages and authenticated headers.
- The selected language is remembered on the current device via local storage.
- Frontend sends the selected locale on all API requests.
- Backend returns translated system messages for both `vi` and `en`.
- Forgot-password sends a bilingual reset email according to request locale.
- Reset-password completes successfully through the frontend and backend flow.
- Dynamic business data remains unchanged and is not auto-translated.
