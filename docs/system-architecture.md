# Cấu trúc và kiến trúc hệ thống EduExam

## 1. Tổng quan

EduExam là hệ thống thi trực tuyến gồm hai cổng làm việc chính:

- Cổng quản trị dành cho quản trị viên, giám khảo và giám thị.
- Cổng thí sinh dành cho người làm bài, luyện tập, xem kết quả và tài liệu.

Về mặt kỹ thuật, hệ thống đang chạy theo mô hình monolith tách module:

- Frontend: Vite + React + React Router + i18next.
- Backend: Django + Django REST Framework + Channels.
- Realtime: Redis + Django Channels WebSocket.
- Live webcam proctoring: LiveKit.
- Tác vụ nền: Celery worker + Celery beat.
- Lưu trữ dữ liệu: PostgreSQL qua PgBouncer (local bằng Docker Compose và production); chỉ rơi về SQLite khi không đặt `DATABASE_URL`.
- Lưu trữ file: local media hoặc S3-compatible storage (MinIO local, Cloudflare R2 cho bằng chứng giám sát).
- Tích hợp AI: MCP server (`mcp-server/`) gọi REST API bằng mã truy cập cá nhân (PAT).

## 2. Sơ đồ kiến trúc chạy thực tế

```text
React/Vite frontend
  |- REST API -> Django REST Framework
  |- WebSocket -> Django Channels
  |- live media request -> Django -> LiveKit token/room

Django backend
  |- PostgreSQL (qua PgBouncer)
  |- Redis (channel layer + Celery broker/result backend)
  |- Local media hoặc S3-compatible storage
  |- Celery worker/beat cho cleanup định kỳ

LiveKit
  |- webcam live theo yêu cầu trong proctoring
```

## 3. Cấu trúc repo chính

```text
Education-Exam/
|- src/                    # frontend Vite + React
|- public/                 # static assets frontend
|- backend/                # Django backend
|  |- apps/                # các module nghiệp vụ
|  |- config/              # cấu hình Django/ASGI/Celery/URL
|  |- tests/               # test backend
|  |- openapi.yaml         # schema API
|  |- docker-compose.yml   # postgres, pgbouncer, redis, minio, livekit
|- mcp-server/             # MCP server cho trợ lý AI (stdio hoặc HTTP từ xa)
|- deploy/                 # compose production, Caddy, TURN, backup/restore/rollback
|- .github/workflows/      # CI: pytest backend + MCP, typecheck/test/build frontend
|- docs/                   # tài liệu hệ thống hiện trạng
|- README.md               # hướng dẫn setup và chạy local
```

## 4. Cấu trúc frontend

Frontend nằm ở `src/` và tổ chức theo hướng ứng dụng nghiệp vụ:

- `src/app/App.tsx`: khởi tạo `ThemeProvider`, `AuthProvider`, router và bridge i18n cho UI cũ.
- `src/app/routes.tsx`: định nghĩa toàn bộ route (trang công khai, cổng quản trị, cổng thí sinh), lazy-load từng trang.
- `src/app/pages/take-exam/`: các thành phần tách ra từ màn hình làm bài (`TakeExam.tsx`).
- `src/app/auth/`: quản lý đăng nhập, bootstrap phiên, profile, điều hướng theo vai trò.
- `src/app/components/layouts/`: shell giao diện cho admin và candidate.
- `src/app/pages/`: các màn hình nghiệp vụ chính.
- `src/app/lib/`: HTTP client, storage token/locale, notify, preview tài liệu, proctoring media helpers.
- `src/app/i18n/`: tài nguyên đa ngôn ngữ Việt/Anh.
- `src/app/components/ui/`: thư viện UI dùng lại.

### 4.1. Route frontend hiện tại

#### Trang công khai

- `/`: trang chủ cuộc thi (danh sách cuộc thi, tra cứu kết quả công khai)
- `/register`: phiếu đăng ký dự thi
- `/login`, `/forgot-password`, `/reset-password`: xác thực

#### Cổng quản trị

- `/dashboard`: dashboard
- `/users`: quản lý người dùng
- `/groups`: nhóm thí sinh
- `/groups/:id/members`: thành viên nhóm
- `/subjects`: môn học
- `/competitions`: cuộc thi và phiếu đăng ký dự thi
- `/question-bank`: ngân hàng câu hỏi
- `/exams`: danh sách kỳ thi/lớp học
- `/exams/create`: tạo mới kỳ thi/lớp học
- `/exams/:id`: chi tiết kỳ thi
- `/exams/:id/edit`: chỉnh sửa kỳ thi
- `/exams/:id/assign`: phân công/gán đối tượng
- `/exams/:id/monitor`: chuyển hướng sang tab giám sát của chi tiết kỳ thi
- `/exams/monitoring`: trung tâm giám sát
- `/manual-grading`: chấm tự luận
- `/materials`: thư viện tài liệu
- `/results`: kết quả và báo cáo
- `/results/:id/review`: xem lại bài làm của một kết quả
- `/discipline`: kỷ luật và chứng chỉ
- `/discipline/exams/:id`: bảng xử lý kỷ luật theo kỳ thi
- `/roles-permissions`: vai trò và quyền
- `/notifications`: trung tâm thông báo
- `/audit`: audit và bảo mật
- `/profile`: hồ sơ cá nhân

#### Cổng thí sinh

- `/candidate`, `/candidate/dashboard`: dashboard
- `/candidate/exams`: bài thi của tôi
- `/candidate/exams/:id/instructions`: hướng dẫn trước khi vào thi
- `/candidate/exam/:id`: phiên làm bài thi
- `/candidate/practice`: luyện tập
- `/candidate/practice/sessions/:id`: phiên luyện tập
- `/candidate/practice/sessions/:id/review`: xem lại bài luyện tập
- `/candidate/results`: kết quả cá nhân
- `/candidate/results/:id`: chi tiết kết quả
- `/candidate/materials`: tài liệu học tập
- `/candidate/notifications`: thông báo
- `/candidate/profile`: hồ sơ thí sinh
- `/candidate/help`: trung tâm trợ giúp

## 5. Cấu trúc backend

Backend là Django monolith chia theo app nghiệp vụ trong `backend/apps/`.

### 5.1. Khối hạ tầng

- `config/settings/`: cấu hình base, local, test, storage.
- `config/urls.py`: tập hợp toàn bộ route API.
- `config/asgi.py`: cấu hình HTTP + WebSocket.
- `config/celery.py`: cấu hình Celery.
- `platform_core`: model nền, health check, dashboard overview, audit event, middleware request id.

### 5.2. Các app nghiệp vụ

- `identity`: user, profile, vai trò, quyền, đăng nhập JWT, mã truy cập cá nhân (PAT) cho MCP, quên mật khẩu, đổi mật khẩu, seed/reset demo data.
- `institutions`: trường, nhóm thí sinh, thành viên nhóm.
- `academics`: môn học.
- `question_bank`: câu hỏi, tag, phiên bản câu hỏi, đáp án, import câu hỏi, lỗi import.
- `exam_authoring`: kỳ thi, phiên bản đề, item đề, random rule, lịch thi, phân công thi.
- `exam_delivery`: phiên thi, câu hỏi trong phiên, câu trả lời, autosave, nộp bài.
- `grading`: tác vụ chấm tự luận, điểm tự luận, kết quả thi, publish kết quả.
- `discipline`: đề xuất mức phạt, hồ sơ kỷ luật, log thao tác, chính sách chứng chỉ, kết quả chứng chỉ.
- `proctoring`: capability client, trạng thái media, heartbeat, sự kiện giám sát, bằng chứng, case vi phạm, review case.
- `materials`: tài liệu học tập.
- `notifications`: thông báo người dùng và thao tác đã đọc/chưa đọc.
- `practice`: phiên luyện tập, autosave luyện tập, review luyện tập, cleanup dữ liệu chi tiết hết hạn.
- `competitions`: cuộc thi công khai trên trang chủ, phiếu đăng ký dự thi, duyệt và xuất danh sách đăng ký.

## 6. API và realtime

### 6.1. REST API

Toàn bộ API đi qua tiền tố `api/v1/`. Các nhóm chính:

- `auth/*`, `profile/*`, `api-tokens`
- `users`, `roles`, `permissions`
- `schools`, `groups`, `subjects`
- `questions`, `question-tags`, `question-imports`
- `exams`, `exam-sessions`, `my-exams`, `my-dashboard/overview`
- `grading/tasks`, `results`, `my-results`
- `discipline/*`
- `proctoring/*`
- `materials`, `my-materials`
- `notifications/*`
- `practice/*`
- `competitions`, `competition-registrations`
- Công khai (không cần đăng nhập): `public/competitions`, `public/competition-registrations`, `public-results/lookup`
- `dashboard/overview`, `audit/events/*`, `health/*`

Schema đầy đủ sinh tự động tại `/api/schema/` (Swagger `/api/docs/`) và được lưu lại ở `backend/openapi.yaml`. Test `tests/platform_core/test_schema.py` chạy `spectacular --fail-on-warn`, nên view mới phải khai báo được request/response.

### 6.2. WebSocket

Hệ thống hiện có hai kênh WebSocket chính:

- `ws/monitoring/exams/<exam_id>/`: realtime cho màn hình giám sát kỳ thi.
- `ws/proctoring/sessions/<session_id>/control/`: kênh điều khiển phiên thi để yêu cầu xem live webcam, cập nhật trạng thái giám sát.

## 7. Dữ liệu nghiệp vụ chính

Các thực thể trung tâm của hệ thống hiện tại:

- Người dùng, profile, role, permission
- Trường, nhóm thí sinh, thành viên nhóm
- Môn học
- Câu hỏi, đáp án, tag, revision, lô import
- Kỳ thi/lớp học, lịch thi, tập câu hỏi, rule random, phân công
- Phiên thi, câu trả lời, autosave, submission
- Tác vụ chấm, điểm và kết quả
- Sự kiện giám sát, bằng chứng, case vi phạm, quyết định xử lý
- Hồ sơ kỷ luật và chính sách chứng chỉ
- Tài liệu học tập
- Thông báo
- Phiên luyện tập và review luyện tập
- Audit event hệ thống

## 8. Luồng tích hợp chính

### 8.1. Luồng quản trị đề thi

1. Quản trị viên/giám khảo tạo môn học, ngân hàng câu hỏi và cấu hình kỳ thi.
2. Hệ thống sinh cấu trúc đề, lịch thi, rule random và phân công nhóm/thí sinh.
3. Khi kỳ thi mở, thí sinh vào phiên thi qua `exam_delivery`.
4. Kết quả khách quan, chấm tay, giám sát và kỷ luật được tổng hợp về báo cáo cuối.

### 8.2. Luồng làm bài có giám sát

1. Thí sinh mở trang hướng dẫn trước thi.
2. Khi vào bài thi có proctoring, frontend yêu cầu camera, microphone, screen share và fullscreen.
3. Frontend gửi heartbeat, event và evidence về backend.
4. Backend phát snapshot và delta realtime cho màn hình giám sát.
5. Giám thị chỉ yêu cầu webcam live khi cần; webcam không publish liên tục mặc định.
6. Các vi phạm có thể được gom thành case để xử lý kỷ luật sau đó.

### 8.3. Luồng luyện tập

1. Thí sinh chọn đề luyện từ catalog.
2. Hệ thống tạo `PracticeSession`, lưu đáp án và autosave định kỳ.
3. Sau khi nộp, thí sinh xem review gồm đáp án đúng/sai.
4. Dữ liệu chi tiết luyện tập được cleanup theo chính sách retention.

## 9. Khả năng nền và vận hành

### 9.1. Bảo mật và phân quyền

- JWT access/refresh token.
- Điều hướng frontend theo vai trò.
- RBAC backend với role và permission riêng.
- Audit event cho các luồng quan trọng.

### 9.2. Đa ngôn ngữ

- Backend hỗ trợ `vi` và `en`.
- Frontend dùng i18next và có `LanguageSwitcher`.
- Có `LegacyUiTranslationBridge` để đồng bộ các phần UI cũ.

### 9.3. Tác vụ nền định kỳ

- Dọn file bằng chứng proctoring hết hạn.
- Dọn dữ liệu chi tiết luyện tập hết hạn.
- Đồng bộ vòng đời kỳ thi theo lịch.

### 9.4. Dữ liệu demo

Hệ thống có sẵn lệnh:

- `reset_demo_data`
- `seed_demo_data`

để phục vụ kiểm thử end-to-end trên môi trường local.
