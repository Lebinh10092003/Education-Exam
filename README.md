# EduExam - Hệ Thống Thi Trực Tuyến 🚀

EduExam là hệ thống thi trực tuyến hiện đại với các thành phần:
- **Frontend**: Vite + React (ở thư mục gốc)
- **Backend**: Django API (ở thư mục `backend/`)
- **Redis**: Dành cho websocket và realtime monitoring
- **LiveKit**: Dành cho webcam live trong proctoring (giám thị tự động/giám sát trực tiếp)

---

## ⚡ Chạy Dự Án Nhanh Nhất (Chỉ 1 Dòng Lệnh)

Bạn chỉ cần mở **PowerShell** tại thư mục dự án, sao chép duy nhất dòng dưới đây và chạy (không copy ký tự prompt `>`):

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass; .\run.ps1
```

---

## ⚡ Lệnh Chạy Dự Án Dự Phòng (Nếu Không Muốn Chạy File .ps1)

> [!IMPORTANT]
> **Yêu cầu trước khi chạy:**
> - Máy tính chạy hệ điều hành **Windows**.
> - Đã cài đặt **Git**, **Node.js 20+**, **Python 3.12+**, và **Docker Desktop** (đã khởi động Docker).

Nếu không muốn chạy qua file `run.ps1` ở trên, bạn mở **PowerShell** tại thư mục gốc của dự án và chạy khối lệnh dưới đây:

```powershell
# 1. Xác định đường dẫn thư mục dự án
$repo = (Resolve-Path .).Path

# 2. Cài đặt các thư viện Frontend
Write-Host ">>> [1/6] Đang cài đặt thư viện Frontend (npm)..." -ForegroundColor Cyan
npm.cmd install

# 3. Tạo môi trường ảo Python và cài đặt thư viện Backend
Write-Host ">>> [2/6] Đang khởi tạo Python Virtual Environment..." -ForegroundColor Cyan
cd backend
if (!(Test-Path .venv)) {
    py -m venv .venv
}
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .

# 4. Cấu hình file .env tự động
Write-Host ">>> [3/6] Đang tạo và cấu hình file .env..." -ForegroundColor Cyan
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
}

$envContent = Get-Content .env
$envContent = $envContent -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6432/eduexam'
$envContent = $envContent -replace '^DATABASE_CONN_MAX_AGE=.*', 'DATABASE_CONN_MAX_AGE=0'
$envContent = $envContent -replace '^DATABASE_DISABLE_SERVER_SIDE_CURSORS=.*', 'DATABASE_DISABLE_SERVER_SIDE_CURSORS=True'
$envContent = $envContent -replace '^REDIS_URL=.*', 'REDIS_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_BROKER_URL=.*', 'CELERY_BROKER_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_RESULT_BACKEND=.*', 'CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1'
$envContent = $envContent -replace '^CELERY_WORKER_CONCURRENCY=.*', 'CELERY_WORKER_CONCURRENCY=2'
$envContent = $envContent -replace '^SIMPLE_JWT_UPDATE_LAST_LOGIN=.*', 'SIMPLE_JWT_UPDATE_LAST_LOGIN=True'
$envContent = $envContent -replace '^FRONTEND_BASE_URL=.*', 'FRONTEND_BASE_URL=http://127.0.0.1:5173'
$envContent = $envContent -replace '^PROCTORING_MEDIA_PROVIDER=.*', 'PROCTORING_MEDIA_PROVIDER=livekit'
$envContent = $envContent -replace '^PROCTORING_MEDIA_URL=.*', 'PROCTORING_MEDIA_URL=ws://127.0.0.1:7880'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_KEY=.*', 'PROCTORING_MEDIA_API_KEY=devkey'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_SECRET=.*', 'PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456'
$envContent = $envContent -replace '^PROCTORING_MEDIA_ROOM_PREFIX=.*', 'PROCTORING_MEDIA_ROOM_PREFIX=eduexam-'
$envContent = $envContent -replace '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS=.*', 'PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_RETENTION_DAYS=.*', 'PROCTORING_EVIDENCE_RETENTION_DAYS=180'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=.*', 'PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600'
$envContent | Set-Content .env

# Bổ sung các giá trị cấu hình nếu chưa có trong file .env
$keys = @(
    @{ Pattern = '^DATABASE_URL='; Value = 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:6432/eduexam' },
    @{ Pattern = '^DATABASE_CONN_MAX_AGE='; Value = 'DATABASE_CONN_MAX_AGE=0' },
    @{ Pattern = '^DATABASE_DISABLE_SERVER_SIDE_CURSORS='; Value = 'DATABASE_DISABLE_SERVER_SIDE_CURSORS=True' },
    @{ Pattern = '^REDIS_URL='; Value = "REDIS_URL=redis://127.0.0.1:6379/0" },
    @{ Pattern = '^CELERY_BROKER_URL='; Value = "CELERY_BROKER_URL=redis://127.0.0.1:6379/0" },
    @{ Pattern = '^CELERY_RESULT_BACKEND='; Value = "CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1" },
    @{ Pattern = '^CELERY_WORKER_CONCURRENCY='; Value = "CELERY_WORKER_CONCURRENCY=2" },
    @{ Pattern = '^SIMPLE_JWT_UPDATE_LAST_LOGIN='; Value = "SIMPLE_JWT_UPDATE_LAST_LOGIN=True" },
    @{ Pattern = '^FRONTEND_BASE_URL='; Value = "FRONTEND_BASE_URL=http://127.0.0.1:5173" },
    @{ Pattern = '^PROCTORING_MEDIA_PROVIDER='; Value = "PROCTORING_MEDIA_PROVIDER=livekit" },
    @{ Pattern = '^PROCTORING_MEDIA_URL='; Value = "PROCTORING_MEDIA_URL=ws://127.0.0.1:7880" },
    @{ Pattern = '^PROCTORING_MEDIA_API_KEY='; Value = "PROCTORING_MEDIA_API_KEY=devkey" },
    @{ Pattern = '^PROCTORING_MEDIA_API_SECRET='; Value = "PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456" },
    @{ Pattern = '^PROCTORING_MEDIA_ROOM_PREFIX='; Value = "PROCTORING_MEDIA_ROOM_PREFIX=eduexam-" },
    @{ Pattern = '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS='; Value = "PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900" },
    @{ Pattern = '^PROCTORING_EVIDENCE_RETENTION_DAYS='; Value = "PROCTORING_EVIDENCE_RETENTION_DAYS=180" },
    @{ Pattern = '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS='; Value = "PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600" }
)
foreach ($key in $keys) {
    if (-not (Select-String -Path .env -Pattern $key.Pattern -Quiet)) {
        Add-Content .env $key.Value
    }
}

# 5. Khởi động PostgreSQL, Redis và LiveKit qua Docker
Write-Host ">>> [4/6] Đang khởi động PostgreSQL, Redis & LiveKit qua Docker..." -ForegroundColor Cyan
docker compose up -d postgres pgbouncer redis livekit
Start-Sleep -Seconds 10  # Chờ PostgreSQL sẵn sàng

# 6. Migrate Database và Reset Demo Data
Write-Host ">>> [5/6] Thực hiện Database Migrations và reset dữ liệu demo..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data

# 7. Khởi động Backend (Daphne ASGI) và Frontend trong 2 cửa sổ mới
Write-Host ">>> [6/6] Khởi động Backend và Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo\backend'; .\.venv\Scripts\daphne.exe -b 0.0.0.0 -p 8000 config.asgi:application"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo'; npm.cmd run dev"

Write-Host ">>> HOÀN THÀNH! Dự án đã được chạy thành công." -ForegroundColor Green
```

---

## 🌐 Các Địa Chỉ Truy Cập

- 🖥️ **Frontend**: [http://127.0.0.1:5173](http://127.0.0.1:5173)
- ⚙️ **Backend API**: [http://127.0.0.1:8000/api/v1/](http://127.0.0.1:8000/api/v1/)
- 📖 **Tài liệu API (Swagger)**: [http://127.0.0.1:8000/api/docs/](http://127.0.0.1:8000/api/docs/)

---

## 🛠️ Kiến Trúc Hệ Thống

```mermaid
graph TD
    A[Vite + React Frontend] <-->|REST API / WebSockets| B[Django Backend API]
    B <--> C[(SQLite Database)]
    B <--> D[(Redis Broker / Cache)]
    A <-->|WebRTC Live Video| E[LiveKit Server]
    B <-->|Token Signing| E
```

---

## 🛠️ Các Lệnh Chạy Thủ Công (Từng Bước)

Nếu bạn không muốn chạy khối lệnh tự động ở trên hoặc cần chạy lại từng dịch vụ riêng lẻ:

### Khởi động các dịch vụ phụ trợ (Docker)
```powershell
docker compose up -d postgres pgbouncer redis livekit
```

### Chạy Backend Daphne (ASGI — khuyến nghị)
```powershell
cd backend
.\.venv\Scripts\daphne.exe -b 0.0.0.0 -p 8000 config.asgi:application
```

### Chạy Backend Django (dev-only, không dùng cho load test)
```powershell
cd backend
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### Chạy Frontend Vite
```powershell
npm run dev
```

### Chạy Celery Worker (xử lý tác vụ nền)
```powershell
cd backend
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

### Chạy Celery Beat (lịch trình dọn dẹp dữ liệu proctoring hết hạn)
```powershell
cd backend
.\.venv\Scripts\celery.exe -A config beat -l info
```

---

## ❌ Khắc Phục Lỗi Nhanh

* **Lỗi `could not establish signal connection: Failed to fetch` khi vào phòng thi:**
  Lỗi này xảy ra do LiveKit chưa được bật hoặc khởi động thất bại. Hãy khởi động lại:
  ```powershell
  cd backend
  docker compose up -d redis livekit
  ```
  Sau đó hãy khởi động lại server Backend để nhận diện kết nối mới.

* **Lỗi môi trường Python:**
  Đảm bảo bạn đang sử dụng Python 3.12 trở lên. Nếu lệnh `py` không hoạt động, hãy thay thế bằng `python` hoặc `python3`.

* **Lỗi `Error 10061 connecting to 127.0.0.1:6379` (Redis) hoặc kết nối PostgreSQL bị từ chối:**
  Docker Desktop chưa được khởi động. Hãy mở Docker Desktop trước, sau đó chạy:
  ```powershell
  cd backend
  docker compose up -d postgres pgbouncer redis livekit
  ```
