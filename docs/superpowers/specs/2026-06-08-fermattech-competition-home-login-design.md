# FermatTech Competition Home And Login Design

Date: 2026-06-08
Status: Approved for implementation planning

## Goal

Refresh the public website into a polished FermatTech competition introduction experience inspired by Coursera's clear marketplace pattern: strong hero, visible partner trust, discoverable categories, featured programs, and direct calls to action.

The homepage should present FermatTech as the organizer/representative for international student competitions, while moving candidate login into a separate `/login` page with guidance and support information from the organizing committee.

## Source Inputs

- Coursera homepage structure: prominent hero, primary CTA, partner/logo trust band, category exploration, and program cards.
- Fermat registration site: Fermat competition categories include English, Science, Informatics, and Math; examples include UEO and FMO.
- School Connect Online Vietnam page: SCO Olympiad in Vietnam, FermatTech as strategic partner, Vietnamese support, international awards, free materials, and competitions including IMO, ICO, IEIO, IFKO, IEO, ISO.
- AYSBC site and FermatTech AYSBC article: AYSBC is a STEM badge competition for students, associated with Science Centre Singapore themes, and in Vietnam is represented by FermatTech.
- User-provided login support text:
  - Check email for login information or contact BTC.
  - Zalo OA: https://zalo.me/fermattech
  - Hotline: 0969 627 162
  - Email: khaothi@fermat.vn
  - Closing: "Trân trọng,"

## Target Users

- Parents looking for a reliable competition for their children.
- Students searching for upcoming Olympiad/STEM opportunities and exam login.
- Schools or coordinators comparing international competition options.
- Competition operations/admin users who may still need to access the platform through login.

## Information Architecture

### Homepage `/`

The homepage becomes a competition marketplace and orientation page, not an embedded login page.

Sections:

1. Header
   - FermatTech brand mark.
   - Navigation: `Cuộc thi`, `Đối tác`, `Lộ trình`, `Hỗ trợ`.
   - Primary CTA: `Đăng ký cuộc thi`.
   - Secondary CTA/link: `Đăng nhập thí sinh` to `/login`.

2. Hero
   - Headline: `Khám phá các cuộc thi quốc tế cùng FermatTech`.
   - Supporting copy for parents, students, and schools.
   - CTAs:
     - `Đăng ký cuộc thi`
     - `Xem các kỳ thi`
     - `Đăng nhập thí sinh`
   - Visual: a clean, education-focused competition dashboard/cards composition, not a generic AI proctoring illustration.

3. Partner Trust Band
   - Display three partner/organization marks only:
     - School Connect Online
     - AYSBC
     - FermatTech
   - If real logo assets are unavailable, use refined text-logo tiles as placeholders with clear labels.

4. Competition Categories
   - Categories should support scanning like Coursera's category exploration.
   - Suggested categories:
     - Toán học
     - Tin học & Lập trình
     - Trí tuệ nhân tạo
     - Khoa học
     - Tiếng Anh
     - Tài chính & Khởi nghiệp

5. Featured Competitions
   - Card layout with concise metadata, suitable for parents and students.
   - Suggested cards:
     - FT-SCO Global Olympiad
     - SCO IMO / Math Olympiad
     - SCO ICO / Coding Olympiad
     - SCO IAIO / AI Olympiad
     - SCO IEO / English Olympiad
     - SCO ISO / Science Olympiad
     - AYSBC / Asia Young Scientist Badge Competition
   - Cards should show audience, format, benefits, and CTA.

6. Participation Journey
   - Five steps:
     - Choose competition.
     - Register student/school.
     - Receive email instructions.
     - Log in on exam day.
     - Receive result/certificate.

7. Benefits And Support
   - Benefits: international certificates, awards/medals where applicable, free or guided materials where applicable, detailed performance reports, STEM/AI/coding exposure.
   - Support panel with Zalo OA, hotline, and email.

8. Footer
   - FermatTech identity.
   - Contact details.
   - Links to registration, login, support, privacy/terms if available.

### Candidate Login Page `/login`

The current login form should live on a dedicated page.

Required content:

1. Organization logo row
   - School Connect Online
   - AYSBC
   - FermatTech

2. Login form
   - Reuse existing auth flow and redirect behavior.
   - Keep identifier/password fields.
   - Keep forgot-password link.
   - Keep submit loading state.

3. Candidate guidance
   - Text:
     - `Kiểm tra email để nhận thông tin đăng nhập hoặc liên hệ với BTC.`

4. Support block
   - Title: `LIÊN HỆ HỖ TRỢ`
   - Body:
     - `Mọi thắc mắc cần giải đáp, Phụ huynh có thể liên hệ với BTC qua:`
     - `Zalo OA: https://zalo.me/fermattech`
     - `Hotline: 0969 627 162`
     - `Email: khaothi@fermat.vn`
     - `Trân trọng,`

5. Back path
   - Link back to homepage/explore competitions.

## Visual Direction

- Use a clean Coursera-like rhythm: large confident hero, restrained white/blue base, organized content bands, strong category browsing, clear card hierarchy.
- Avoid a one-note blue or purple gradient interface. Use blue as the anchor, with green, amber, cyan, and slate accents for category distinction.
- Keep cards compact and structured, with 8px or smaller radius where possible.
- Use lucide icons for navigation actions and category meaning.
- Use full-width bands and constrained content, not nested cards or decorative floating blobs.
- Prioritize mobile readability: no overflowing nav labels, cards, or CTAs.

## Component And Code Impact

Expected frontend files:

- `src/app/pages/LandingPage.tsx`
  - Remove embedded login section.
  - Rebuild homepage content around FermatTech competitions.
  - Keep smooth-scroll behavior for homepage sections.
  - Route login CTA to `/login`.

- `src/app/pages/Login.tsx`
  - Convert existing public login route into branded candidate login page.
  - Add organization logo row, support guidance, and BTC contact details.
  - Keep existing auth behavior and redirects.

- `src/app/i18n/resources/vi/landing.ts`
  - Replace EduExam platform copy with FermatTech competition copy.

- `src/app/i18n/resources/en/landing.ts`
  - Provide English fallback copy for the same keys or adjust implementation to avoid broken translations.

Optional supporting files:

- Use existing UI components and lucide icons.
- Add small local arrays for competition/category content unless current data APIs already provide public competition listings.

## Error Handling And States

- Login errors should continue using current notification behavior.
- If user is already authenticated:
  - `/login` should show a concise signed-in state with a button to the correct portal.
  - Homepage CTA should point to the proper portal for authenticated users, while still allowing public browsing.
- External registration/support links should be safe anchors with `target="_blank"` and `rel="noreferrer"` where appropriate.

## Testing And Verification

Minimum verification:

- Run frontend tests/build after implementation.
- Manually verify:
  - `/` renders new homepage content.
  - `/login` renders the separate login page.
  - Login still redirects by profile role.
  - Navigation anchors scroll correctly.
  - Mobile and desktop screenshots have no text overlap or nav overflow.

Suggested commands:

- `npm run build`
- `npm test -- --runInBand` only if compatible with current Vitest setup; otherwise use the repo's existing `npm test` pattern.

## Open Decisions

- Real logo image assets are not currently identified in the repo. If unavailable, implementation should use polished text-logo tiles instead of broken external images.
- Registration CTA should initially link to a public registration destination from available Fermat/SCO sources, unless the product owner provides a dedicated FermatTech registration URL.
