# EduExam VPS deploy

Production runs with Docker Compose and the existing Caddy reverse proxy on the VPS.

## Files that stay out of Git

- `deploy/.env.production`
- `deploy/livekit.yaml`

## Update after the first deploy

```bash
cd /opt/khaothi.fermat.vn
bash deploy/update.sh
```

The update script runs `git pull --ff-only`, rebuilds images, migrates Django, restarts the containers, syncs the `khaothi.fermat.vn` block into the dedicated ExamEdu Caddyfile, reloads Caddy, and verifies both the frontend and API.

By default the script expects the existing reverse proxy container and mounted Caddyfile from the ExamEdu stack:

- `CADDY_CONTAINER=examedu-caddy`
- `CADDYFILE_PATH=/opt/khaothi.fermat.vn/deploy/caddy/Caddyfile`
- `CADDY_CONFIG_IN_CONTAINER=/etc/caddy/Caddyfile`

Override those environment variables before running the script if the VPS reverse proxy layout changes.

## Tinh chỉnh tải (VPS 4 GB)

Các biến dưới đây đặt trong `deploy/.env.production`; bỏ trống thì dùng giá trị mặc định.

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `WEB_WORKERS` | `3` | Số tiến trình Uvicorn. Mỗi tiến trình ~150–250 MB RAM; nên đặt bằng số vCPU + 1. |
| `POSTGRES_SHARED_BUFFERS` | `512MB` | Bộ nhớ đệm của PostgreSQL. |
| `POSTGRES_MAX_CONNECTIONS` | `100` | PgBouncer chỉ mở ~25 kết nối thật nên không cần cao. |
| `REDIS_MAXMEMORY` | `512mb` | Khi đầy chỉ xoá key có TTL (cache/presence), không đụng hàng đợi Celery. |
| `PROCTORING_VIOLATION_COOLDOWN_SECONDS` | `5` | Cùng loại vi phạm lặp lại trong N giây chỉ ghi 1 lần. |
| `PROCTORING_VIOLATION_ESCALATE_AFTER` | `3` | Lần vi phạm thứ N cùng loại nâng case lên `critical` và báo lại admin. `0` = tắt. |
| `PROCTORING_NOTIFY_CANDIDATE_ON_VIOLATION` | `True` | Lưu 1 thông báo cho thí sinh mỗi loại vi phạm. |
| `PROCTORING_EVIDENCE_MAX_UPLOAD_BYTES` | `5242880` | Giới hạn kích thước ảnh bằng chứng khi upload qua backend. |
| `EXAM_RANDOM_POOL_CACHE_TTL_SECONDS` | `120` | Cache tập câu hỏi của đề ngẫu nhiên khi nhiều thí sinh vào thi cùng lúc. |

Nên bật `USE_S3_STORAGE=True` (Cloudflare R2/S3) để ảnh bằng chứng tải thẳng lên kho lưu trữ, không đi qua backend.

## Lưu ảnh vi phạm trên Cloudflare R2 (khuyến nghị)

Trình duyệt thí sinh nén ảnh (WebP) rồi **tải thẳng lên R2** bằng URL ký sẵn; backend chỉ ký URL và kiểm tra file (1 lệnh HEAD), không nhận dữ liệu ảnh. Chỉ ảnh vi phạm đi lên R2 — tài liệu, avatar… vẫn ở VPS.

1. Cloudflare Dashboard → **R2** → **Create bucket**, ví dụ `khaothi-evidence` (để **Private**, không bật public access).
2. **R2 → Manage R2 API Tokens → Create API token**: quyền *Object Read & Write*, giới hạn bucket trên. Lưu lại *Access Key ID*, *Secret Access Key* và endpoint `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.
3. Thêm vào `deploy/.env.production`:

   ```env
   PROCTORING_EVIDENCE_STORAGE=s3
   PROCTORING_EVIDENCE_S3_BUCKET=khaothi-evidence
   PROCTORING_EVIDENCE_S3_ENDPOINT_URL=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
   PROCTORING_EVIDENCE_S3_ACCESS_KEY_ID=...
   PROCTORING_EVIDENCE_S3_SECRET_ACCESS_KEY=...
   PROCTORING_EVIDENCE_S3_REGION=auto
   PROCTORING_EVIDENCE_ROOT_FOLDER=Vi phạm kỳ thi
   PROCTORING_EVIDENCE_RETENTION_DAYS=180
   ```

4. Triển khai lại (`bash deploy/update.sh`), kiểm tra kết nối (ghi + xoá 1 file thử, không đổi gì trên bucket):

   ```bash
   docker exec khaothi-backend python manage.py setup_evidence_bucket --check
   ```

   Có thể dán nguyên link bucket (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com/<bucket>`) vào `PROCTORING_EVIDENCE_S3_ENDPOINT_URL`; hệ thống tự tách tên bucket.

5. Cấu hình CORS + tự xoá cho bucket (token cần quyền **Admin Read & Write**; token chạy hằng ngày chỉ cần **Object Read & Write**):

   ```bash
   docker exec khaothi-backend python manage.py setup_evidence_bucket --origin https://khaothi.fermat.vn
   ```

   Lệnh này cho phép trình duyệt từ domain trên tải ảnh lên, và đặt lifecycle tự xoá mọi ảnh trong `Vi phạm kỳ thi/` sau 180 + 7 ngày (lớp dự phòng; tác vụ dọn dẹp của hệ thống xoá đúng hạn 180 ngày và đánh dấu trong DB). Thêm `--dry-run` để xem cấu hình trước.

Cây thư mục trong bucket (tự sinh, không cần tạo trước):

```
Vi phạm kỳ thi/<Năm>/<Tên bài thi (ID n)>/Đợt <DD-MM-YYYY>/<SBD - Họ tên>/<username>_<loại ảnh>_<giờ>_<mã>.webp
```

Giám thị/chấm thi xem ảnh qua link ký tạm thời (hết hạn sau `PROCTORING_EVIDENCE_URL_EXPIRE_SECONDS`, mặc định 1 giờ), nên bucket không cần public.

## Hết giờ làm bài

- Hết giờ: màn hình thí sinh bị khoá, chỉ còn đồng hồ đếm ngược `EXAM_SUBMISSION_GRACE_SECONDS` (mặc định 300 giây) và nút **Nộp bài ngay**. Câu chưa làm tính là sai.
- Hết thời gian ân hạn: trình duyệt tự nộp; nếu thí sinh đã đóng trình duyệt, Celery beat (`finalize-overdue-exam-sessions`, mỗi `EXAM_OVERDUE_FINALIZE_INTERVAL_SECONDS`) tự nộp. Cả hai trường hợp đều đánh dấu **nộp muộn** (`Submission.is_late`).

## MCP cho trợ lý AI (`https://khaothi.fermat.vn/mcp`)

Dịch vụ `mcp` (container `khaothi-mcp`, ~60–80 MB RAM) được `update.sh` build và kiểm tra (`/mcp/healthz`) cùng các dịch vụ khác; Caddy chuyển `/mcp*` vào container. Dịch vụ **không chứa tài khoản nào** — người dùng tạo mã truy cập trong **Hồ sơ → Kết nối AI (MCP)** (chỉ tài khoản quản trị) rồi gửi kèm header `Authorization: Bearer <mã>`.

Biến tuỳ chọn trong `deploy/.env.production`:

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `EDUEXAM_MCP_MODE` | `full` | `no-admin` chặn quản lý tài khoản/vai trò; `readonly` chỉ xem |
| `EDUEXAM_MCP_ALLOWED_HOSTS` | `khaothi.fermat.vn,khaothi-mcp:8765,127.0.0.1:*` | Host được phép (chống DNS rebinding) |

Tạo mã từ dòng lệnh: `docker exec khaothi-backend python manage.py create_api_token --user <email> --name "Claude" --days 90`
