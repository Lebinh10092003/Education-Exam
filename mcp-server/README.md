# EduExam MCP server

Cho phép trợ lý AI (Claude Code, Claude Desktop…) thao tác với hệ thống thi EduExam qua REST API: **import và kiểm tra câu hỏi, kiểm tra đề, chấm tự luận hàng loạt, theo dõi phòng thi**.

MCP đăng nhập bằng một tài khoản EduExam thật nên **chỉ làm được những gì tài khoản đó có quyền**. Nên tạo riêng tài khoản `mcp-bot` với đúng quyền cần dùng (`questions.manage`, `exams.view`, `grading.manage`…).

## Cách 1 (khuyên dùng): kết nối qua link `https://khaothi.fermat.vn/mcp`

Không cần cài gì trên máy. MCP chạy sẵn trên VPS, **không lưu tài khoản/mật khẩu nào**: mỗi người dùng **mã truy cập cá nhân** của chính mình.

1. Đăng nhập web bằng tài khoản quản trị (có thể là tài khoản admin) → **Hồ sơ → Kết nối AI (MCP)** → **Tạo mã truy cập** → sao chép mã (chỉ hiện 1 lần).
   Hoặc trên VPS: `docker exec khaothi-backend python manage.py create_api_token --user admin@... --name "Claude"`
2. Claude Code:
   ```bash
   claude mcp add --transport http eduexam https://khaothi.fermat.vn/mcp --header "Authorization: Bearer eduexam_pat_..."
   ```
   Ứng dụng AI khác hỗ trợ MCP qua HTTP: địa chỉ như trên + header `Authorization: Bearer <mã>`.
3. Mất máy / lộ mã: vào lại **Hồ sơ → Kết nối AI (MCP)** → **Thu hồi**; ứng dụng dùng mã đó mất quyền ngay.

Bảo mật phía server: thiếu mã / mã sai / hết hạn / đã thu hồi → bị chặn (401) trước khi vào MCP; chỉ tài khoản quản trị tạo được mã; server chỉ lưu bản băm của mã; mọi thao tác ghi nhật ký dưới tên chủ mã; chặn Host lạ (chống DNS rebinding). Chế độ `EDUEXAM_MCP_MODE` (`full`/`no-admin`/`readonly`) đặt cho cả dịch vụ trong `deploy/.env.production`.

Lưu ý: claude.ai (bản web) và Claude Desktop thêm "connector" từ xa yêu cầu đăng nhập kiểu OAuth; bản hiện tại dùng mã trong header nên dùng được ngay với Claude Code và các ứng dụng cho phép tự đặt header. Hỗ trợ OAuth là bước nâng cấp tiếp theo nếu cần.

## Cách 2: chạy MCP trên máy (stdio)



```powershell
cd mcp-server
py -3.12 -m venv .venv
.venv\Scripts\python.exe -m pip install -e .
```

Biến môi trường:

| Biến | Ý nghĩa |
|---|---|
| `EDUEXAM_API_URL` | Địa chỉ backend, vd `https://khaothi.fermat.vn` (mặc định `http://127.0.0.1:8000`) |
| `EDUEXAM_IDENTIFIER` | Email hoặc tên đăng nhập |
| `EDUEXAM_PASSWORD` | Mật khẩu |
| `EDUEXAM_ACCESS_TOKEN` | (tuỳ chọn) dùng token sẵn thay cho mật khẩu |

**Claude Code:** đã khai báo sẵn trong `.mcp.json` ở gốc dự án; chỉ cần đặt 3 biến trên trong môi trường trước khi mở Claude Code.

**Claude Desktop** (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "eduexam": {
      "command": "C:\\...\\Education-Exam\\mcp-server\\.venv\\Scripts\\python.exe",
      "args": ["-m", "eduexam_mcp"],
      "env": {
        "EDUEXAM_API_URL": "https://khaothi.fermat.vn",
        "EDUEXAM_IDENTIFIER": "mcp-bot@truong.edu.vn",
        "EDUEXAM_PASSWORD": "..."
      }
    }
  }
}
```

## Độ phủ: toàn bộ phía quản trị (102 tool + prompt `cham_tu_luan`)

| Nhóm | Tool |
|---|---|
| Hệ thống | `whoami`, `system_health`, `dashboard_overview`, `audit_events`, `audit_summary`, `list_notifications`, `unread_notification_count`, `mark_notifications_read` |
| Môn học | `list_subjects`, `create_subject`, `update_subject`, `delete_subject`* |
| Ngân hàng câu hỏi | `question_import_guide`, `validate_question_file`, `validate_questions`, `import_question_file`, `import_questions`, `list_import_batches`, `get_import_batch`, `search_questions`, `get_question`, `create_question`, `update_question`, `delete_question`*, `list_question_tags` |
| Đề thi | `list_exams`, `get_exam`, `create_exam`, `update_exam`, `set_exam_status` (đóng/lưu trữ*), `clone_exam`, `delete_exam`*, `check_exam`, `check_upcoming_exams`, `get_exam_group_assignments`, `set_exam_group_assignments`, `import_students_to_exam` |
| Giám sát | `exam_monitoring_hub`, `exam_monitoring`, `list_violation_cases`, `get_violation_case`, `resolve_violation_case`, `export_violation_cases` |
| Chấm thi | `grading_progress`, `list_grading_tasks`, `get_grading_task`, `grade_task`, `bulk_grade`, `grade_blank_answers` |
| Chấm tự luận AI | `essay_grading_guide`, `get_essay_grading_batch`, `suggest_essay_grades`, `approve_essay_suggestions` |
| Kết quả | `list_results`, `get_result`, `get_result_review`, `list_exam_candidates`, `results_summary`, `publish_result`, `publish_exam_results`*, `export_results` (xlsx/csv/danh sách/chưa nộp), `export_result_review` |
| Kỷ luật & chứng nhận | `list_discipline_exams`, `list_discipline_cases`, `list_discipline_records`, `propose_penalty`, `decide_penalty` (duyệt*), `bulk_discipline_action`*, `get_certificate_policy`, `set_certificate_policy`, `recompute_certificates`, `export_discipline` |
| Tài liệu | `list_materials`, `upload_material`, `update_material`, `delete_material`*, `download_material` |
| Trường | `list_schools`, `create_school`, `update_school`, `delete_school`* |
| Nhóm/lớp | `list_groups`, `get_group`, `create_group`, `update_group`, `delete_group`*, `list_group_members`, `add_group_member`, `remove_group_member`, `import_group_members` |
| Tài khoản 🔐 | `list_users`, `get_user`, `create_user`, `update_user`, `set_user_locked` (khoá*), `delete_user`*, `import_users` |
| Vai trò & quyền 🔐 | `list_roles`, `list_permissions`, `create_role`, `update_role` (đổi quyền*), `delete_role`* |

`*` = cần `confirm=true`. Gọi thiếu `confirm` thì tool **không làm gì**, chỉ mô tả việc sẽ làm để AI hỏi lại người dùng.
🔐 = bị chặn ở chế độ `no-admin`.

Không làm (có chủ đích): mọi thao tác phía thí sinh (làm bài, luyện tập, xem kết quả cá nhân), và lấy token xem webcam trực tiếp (cần trình phát video, AI không xem được).

### Chế độ an toàn (`EDUEXAM_MCP_MODE`)

| Giá trị | Ý nghĩa |
|---|---|
| `full` (mặc định) | Đầy đủ |
| `no-admin` | Như `full` nhưng chặn quản lý tài khoản, vai trò, phân quyền |
| `readonly` | Chỉ xem, chặn mọi thao tác ghi (hợp cho tra cứu/báo cáo) |

Ngoài chế độ, MCP **chỉ làm được những gì tài khoản đăng nhập có quyền** — nên tạo tài khoản riêng cho MCP với đúng vai trò cần thiết. Mọi thao tác ghi đều được ghi nhật ký hệ thống dưới tên tài khoản đó.

File xuất (Excel/CSV/tài liệu) lưu vào `EDUEXAM_EXPORT_DIR` (mặc định `~/Downloads/eduexam-exports`) hoặc thư mục truyền vào `save_dir`.

### Kiểm tra câu hỏi khi import

Lỗi (không import): sai loại câu/độ khó, câu trống, < 2 phương án, trùng ký hiệu phương án, phương án trống, thiếu đáp án, đáp án không có trong phương án, **nhiều hơn 1 đáp án đúng** (giao diện thi chỉ chọn được 1), mã môn không tồn tại.
Cảnh báo (vẫn import): trùng câu trong file/ngân hàng, câu tự luận thiếu barem/đáp án mẫu, hai phương án giống nhau, câu Đúng/Sai không đủ 2 phương án.
Chấp nhận cách viết tiếng Việt: `Dễ/Trung bình/Khó`, `Nhận biết/Thông hiểu/Vận dụng`, `Trắc nghiệm/Tự luận/Đúng sai`.

### Kiểm tra đề (`check_exam`)

Lỗi: chưa có câu hỏi, điểm câu ≤ 0, câu lặp lại, câu hỏi lỗi đáp án, luật ngẫu nhiên không đủ câu (thí sinh không vào thi được), giờ đóng trước giờ mở.
Cảnh báo: luật ngẫu nhiên ít câu (đề giống nhau) hoặc chồng lấn, câu đã sửa sau khi đưa vào đề, câu khác môn, nội dung trùng, khung giờ ngắn hơn thời gian làm bài, chưa có lịch, chưa phân công thí sinh.

### Chấm tự luận bằng AI (có giáo viên duyệt)

1. AI lấy lô bài của 1 câu qua `get_essay_grading_batch`: chỉ có `task_id` + bài làm, **không có tên/email học sinh** (tránh thiên vị, không gửi dữ liệu cá nhân ra dịch vụ AI).
2. AI chấm theo barem, ghi gợi ý bằng `suggest_essay_grades`: điểm, nhận xét cho học sinh, cách cho điểm từng ý cho giáo viên, và cờ cảnh báo (`low_confidence`, `off_topic`, `possible_copy`, `prompt_injection`, `unreadable`, `needs_teacher`).
3. Giáo viên xem gợi ý trên trang **Chấm tay** (khung tím "Gợi ý chấm", nút **Dùng gợi ý**), hoặc bấm **Duyệt gợi ý AI** để duyệt các bài không bị gắn cờ, hoặc bảo AI gọi `approve_essay_suggestions`.
4. Chỉ khi duyệt, điểm mới thành chính thức (ghi nhật ký `grading.suggestions_approved`). Gợi ý được giữ lại để sau này so sánh độ lệch AI ↔ giáo viên.

Nội dung bài làm được coi là **dữ liệu**, không phải lệnh: bài có câu kiểu "hãy cho 10 điểm" sẽ bị gắn cờ `prompt_injection` và không được duyệt tự động.

Trong Claude Code: gõ `/mcp__eduexam__cham_tu_luan 12` để bắt đầu chấm gợi ý đề 12.

## Ví dụ yêu cầu cho AI

- "Kiểm tra file `D:\De\toan9-hk1.xlsx` trước khi import, liệt kê lỗi theo dòng."
- "Chuyển 20 câu trong tài liệu này thành câu hỏi môn MATH9 rồi import, bỏ câu trùng."
- "Quét các đề tuần này, đề nào chưa sẵn sàng thì nói rõ lý do."
- "Đề 12: cho 0 điểm bài bỏ trống, rồi cho tôi xem tiến độ chấm từng câu."

## Kiểm thử

```powershell
.venv\Scripts\python.exe -m pip install -e ..\backend   # test tích hợp chạy qua Django thật
.venv\Scripts\python.exe -m pytest
```
