# FermatTech Competition Home Login Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a Coursera-inspired FermatTech competition homepage and move candidate login into a branded standalone `/login` page with BTC support guidance.

**Architecture:** Keep the existing React/Vite routing and auth flow. Rebuild `LandingPage.tsx` as a public competition discovery page, update `Login.tsx` as the dedicated candidate login surface, and refresh landing/auth translations so public copy matches FermatTech.

**Tech Stack:** React 18, React Router 7, react-i18next, next-themes, Tailwind CSS v4, shadcn-style UI components, lucide-react icons, Vitest.

---

## Chunk 1: Public Competition Experience

### Task 1: Refresh Landing Translations

**Files:**
- Modify: `src/app/i18n/resources/vi/landing.ts`
- Modify: `src/app/i18n/resources/en/landing.ts`

- [ ] **Step 1: Replace public landing copy with FermatTech competition copy**

Keep the existing default export structure but update keys for:
- `nav`
- `hero`
- `partners`
- `categories`
- `competitions`
- `journey`
- `benefits`
- `support`
- `faqs`
- `footer`

- [ ] **Step 2: Preserve compatibility for removed old keys only if still referenced**

After `LandingPage.tsx` is rewritten, old EduExam-specific sections such as `security` and `mockBrowser` should not be referenced by the public homepage.

- [ ] **Step 3: Check no raw i18n keys are likely to render**

Run: `rg "t\\(\" src\\app\\pages\\LandingPage.tsx src\\app\\pages\\Login.tsx`

Expected: all landing keys referenced by the page exist in both VI and EN resources.

### Task 2: Rebuild Homepage UI

**Files:**
- Modify: `src/app/pages/LandingPage.tsx`

- [ ] **Step 1: Remove embedded login form state and submit handler**

Remove `identifier`, `password`, `handleLogin`, `Label`, `Input`, `Loader2`, and the login section from the homepage.

- [ ] **Step 2: Add local content arrays**

Add arrays for categories, partners, competitions, journey steps, and benefits. Use translation keys for labels and descriptions.

- [ ] **Step 3: Build the new header and hero**

Header requirements:
- FermatTech brand.
- Nav buttons scroll to `competitions`, `partners`, `journey`, and `support`.
- `Đăng ký cuộc thi` opens a public registration link.
- `Đăng nhập thí sinh` routes to `/login`.

Hero requirements:
- Main headline about international competitions with FermatTech.
- CTA buttons for registration, competition browsing, and login.
- Right-side visual uses UI cards/dashboard composition, not an external logo dependency.

- [ ] **Step 4: Build homepage sections**

Add sections for:
- Partner trust band with School Connect Online, AYSBC, FermatTech.
- Category exploration.
- Featured competitions.
- Participation journey.
- Benefits and support.
- Footer.

- [ ] **Step 5: Keep authenticated CTA behavior**

If authenticated, show a portal CTA that uses `getDefaultRouteForProfile(profile)`. Public browsing must remain available.

### Task 3: Add Lightweight Landing Tests

**Files:**
- Create: `src/app/pages/LandingPage.test.tsx`

- [ ] **Step 1: Write render test for core public content**

Render `LandingPage` inside `MemoryRouter`, `AuthContext.Provider`, and `ThemeProvider`.

Assert the page contains:
- `Khám phá các cuộc thi quốc tế cùng FermatTech`
- `School Connect Online`
- `AYSBC`
- `Đăng nhập thí sinh`

- [ ] **Step 2: Write navigation-link test for login CTA**

Assert at least one `Đăng nhập thí sinh` link has `href="/login"`.

- [ ] **Step 3: Run focused test**

Run: `npm test -- src/app/pages/LandingPage.test.tsx`

Expected: PASS.

---

## Chunk 2: Candidate Login Experience

### Task 4: Refresh Login Page UI

**Files:**
- Modify: `src/app/pages/Login.tsx`

- [ ] **Step 1: Preserve auth behavior**

Keep:
- `login(identifier.trim(), password)`
- `notify.success`
- error handling through `normalizeLoginErrorMessage`
- redirect with `getDefaultRouteForProfile(profile)`
- forgot password link

- [ ] **Step 2: Replace visual layout**

Build a two-column responsive login page:
- Left side: FermatTech competition context, logo row for School Connect Online / AYSBC / FermatTech, support instructions.
- Right side: login form card.

- [ ] **Step 3: Add required BTC guidance**

Add exact user-provided support content:
- `Kiểm tra email để nhận thông tin đăng nhập hoặc liên hệ với BTC.`
- `LIÊN HỆ HỖ TRỢ`
- `Mọi thắc mắc cần giải đáp, Phụ huynh có thể liên hệ với BTC qua:`
- `Zalo OA: https://zalo.me/fermattech`
- `Hotline: 0969 627 162`
- `Email: khaothi@fermat.vn`
- `Trân trọng,`

- [ ] **Step 4: Update defaults for candidate login**

Default demo identifier should be `candidate@example.com`; retain password `admin123456` for local development.

### Task 5: Add Lightweight Login Tests

**Files:**
- Create: `src/app/pages/Login.test.tsx`

- [ ] **Step 1: Write render test for required BTC guidance**

Render `Login` inside `MemoryRouter`, `AuthContext.Provider`, and `ThemeProvider`.

Assert the page contains:
- `School Connect Online`
- `AYSBC`
- `FermatTech`
- `Kiểm tra email để nhận thông tin đăng nhập hoặc liên hệ với BTC.`
- `0969 627 162`
- `khaothi@fermat.vn`

- [ ] **Step 2: Write submit test for redirect behavior**

Mock `login` to resolve a candidate profile and assert it is called with `candidate@example.com`, `admin123456`.

- [ ] **Step 3: Run focused test**

Run: `npm test -- src/app/pages/Login.test.tsx`

Expected: PASS.

---

## Chunk 3: Verification And Polish

### Task 6: Run Frontend Verification

**Files:**
- Verify only.

- [ ] **Step 1: Run focused tests**

Run:
- `npm test -- src/app/pages/LandingPage.test.tsx src/app/pages/Login.test.tsx`

Expected: PASS.

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: PASS with Vite production build.

- [ ] **Step 3: Start dev server**

Run: `npm run dev -- --host 127.0.0.1`

Expected: server starts on an available Vite URL.

- [ ] **Step 4: Verify desktop and mobile screenshots**

Use browser automation to check:
- `/`
- `/login`
- desktop width around 1440px
- mobile width around 390px

Expected:
- no obvious text overlap
- no nav overflow
- page content appears FermatTech-focused
- login page contains BTC support content

- [ ] **Step 5: Final status**

Report changed files, tests/build results, dev URL, and any known caveats. Do not include unrelated dirty worktree changes such as `backend/.env.example`.
