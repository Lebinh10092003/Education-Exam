# EduExam

EduExam la he thong thi truc tuyen gom:

- frontend Vite + React o thu muc goc repo
- backend Django API o thu muc `backend/`
- Redis cho websocket/realtime
- LiveKit cho webcam live trong proctoring

README nay chi huong dan cho Windows PowerShell va da duoc chinh theo trang thai hien tai cua du an.

## Chay tu clone moi

### Yeu cau moi truong

- Git
- Node.js 20+
- Python 3.12+
- Docker Desktop
- Windows PowerShell

### Dich vu local can co

De chay dung du an hien tai sau khi clone, local can:

- SQLite local cho database
- Redis local cho websocket va realtime monitoring
- LiveKit local cho webcam live proctoring
- Celery worker va Celery beat neu muon evidence proctoring tu dong bi don sau khi het han

PostgreSQL va MinIO hien khong bat buoc de chay local.

### Buoc 1: clone repo

```powershell
git clone https://github.com/Lebinh10092003/Education-Exam.git Education-Exam
cd Education-Exam
```

### Buoc 2: cai frontend, backend, env, va local services

```powershell
npm.cmd install

cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .

if (!(Test-Path .env)) { Copy-Item .env.example .env }

$dbPath = ((Join-Path (Resolve-Path .).Path "db.sqlite3") -replace '\\', '/')
$envContent = Get-Content .env
$envContent = $envContent -replace '^DATABASE_URL=.*', "DATABASE_URL=sqlite:///$dbPath"
$envContent = $envContent -replace '^REDIS_URL=.*', 'REDIS_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_BROKER_URL=.*', 'CELERY_BROKER_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_RESULT_BACKEND=.*', 'CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1'
$envContent = $envContent -replace '^FRONTEND_BASE_URL=.*', 'FRONTEND_BASE_URL=http://127.0.0.1:5173'
$envContent = $envContent -replace '^PROCTORING_MEDIA_PROVIDER=.*', 'PROCTORING_MEDIA_PROVIDER=livekit'
$envContent = $envContent -replace '^PROCTORING_MEDIA_URL=.*', 'PROCTORING_MEDIA_URL=ws://127.0.0.1:7880'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_KEY=.*', 'PROCTORING_MEDIA_API_KEY=devkey'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_SECRET=.*', 'PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456'
$envContent = $envContent -replace '^PROCTORING_MEDIA_ROOM_PREFIX=.*', 'PROCTORING_MEDIA_ROOM_PREFIX=eduexam-'
$envContent = $envContent -replace '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS=.*', 'PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_RETENTION_DAYS=.*', 'PROCTORING_EVIDENCE_RETENTION_DAYS=15'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=.*', 'PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600'
$envContent | Set-Content .env

if (-not (Select-String -Path .env -Pattern '^DATABASE_URL=' -Quiet)) { Add-Content .env "DATABASE_URL=sqlite:///$dbPath" }
if (-not (Select-String -Path .env -Pattern '^REDIS_URL=' -Quiet)) { Add-Content .env 'REDIS_URL=redis://127.0.0.1:6379/0' }
if (-not (Select-String -Path .env -Pattern '^CELERY_BROKER_URL=' -Quiet)) { Add-Content .env 'CELERY_BROKER_URL=redis://127.0.0.1:6379/0' }
if (-not (Select-String -Path .env -Pattern '^CELERY_RESULT_BACKEND=' -Quiet)) { Add-Content .env 'CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1' }
if (-not (Select-String -Path .env -Pattern '^FRONTEND_BASE_URL=' -Quiet)) { Add-Content .env 'FRONTEND_BASE_URL=http://127.0.0.1:5173' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_PROVIDER=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_PROVIDER=livekit' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_URL=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_URL=ws://127.0.0.1:7880' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_API_KEY=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_API_KEY=devkey' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_API_SECRET=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_ROOM_PREFIX=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_ROOM_PREFIX=eduexam-' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_EVIDENCE_RETENTION_DAYS=' -Quiet)) { Add-Content .env 'PROCTORING_EVIDENCE_RETENTION_DAYS=15' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=' -Quiet)) { Add-Content .env 'PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600' }

docker compose up -d redis livekit

.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data
```

### Buoc 3: mo backend va frontend

Backend:

```powershell
cd Education-Exam\backend
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Frontend:

```powershell
cd Education-Exam
npm.cmd run dev
```

Celery worker:

```powershell
cd Education-Exam\backend
.\.venv\Scripts\celery.exe -A config worker -l info --pool=solo
```

Celery beat:

```powershell
cd Education-Exam\backend
.\.venv\Scripts\celery.exe -A config beat -l info
```

Neu worker va beat dang chay, evidence proctoring het han se duoc don dinh ky theo `PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS`.
Neu can chay tay ngay lap tuc:

```powershell
cd Education-Exam\backend
.\.venv\Scripts\python.exe manage.py cleanup_expired_proctor_evidence
```

Truy cap:

- Frontend: `http://127.0.0.1:5173`
- Backend API: `http://127.0.0.1:8000/api/v1/`
- Swagger: `http://127.0.0.1:8000/api/docs/`

## Tai khoan demo mac dinh

Sau `reset_demo_data`, du an tao san:

- Administrator: `admin@example.com / admin123456`
- Examiner: `examiner1@example.com / admin123456`
- Proctor: `proctor1@example.com / admin123456`
- Candidate: `candidate01@example.com / admin123456`

## Cap nhat repo da clone san

```powershell
cd Education-Exam
git pull
npm.cmd install

cd backend
.\.venv\Scripts\python.exe -m pip install -e .
docker compose up -d redis livekit
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data
```

## Troubleshooting nhanh

Neu vao bai thi ma gap loi `could not establish signal connection: Failed to fetch`, thuong la LiveKit local chua chay:

```powershell
cd Education-Exam\backend
docker compose up -d redis livekit
```

Neu backend da chay tu truoc khi bat Redis hoac LiveKit, restart backend sau khi `docker compose up`.

Neu ban muon test webcam live va monitoring realtime, khong duoc bo qua Redis va LiveKit.

## Copy-paste nhanh

Block duoi day da bao gom clone, setup, migrate, seed demo data, va mo 2 cua so PowerShell de chay backend + frontend.

```powershell
git clone https://github.com/Lebinh10092003/Education-Exam.git Education-Exam
cd Education-Exam

$repo = (Resolve-Path .).Path

npm.cmd install

cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .

if (!(Test-Path .env)) { Copy-Item .env.example .env }

$dbPath = ((Join-Path (Resolve-Path .).Path "db.sqlite3") -replace '\\', '/')
$envContent = Get-Content .env
$envContent = $envContent -replace '^DATABASE_URL=.*', "DATABASE_URL=sqlite:///$dbPath"
$envContent = $envContent -replace '^REDIS_URL=.*', 'REDIS_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_BROKER_URL=.*', 'CELERY_BROKER_URL=redis://127.0.0.1:6379/0'
$envContent = $envContent -replace '^CELERY_RESULT_BACKEND=.*', 'CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1'
$envContent = $envContent -replace '^FRONTEND_BASE_URL=.*', 'FRONTEND_BASE_URL=http://127.0.0.1:5173'
$envContent = $envContent -replace '^PROCTORING_MEDIA_PROVIDER=.*', 'PROCTORING_MEDIA_PROVIDER=livekit'
$envContent = $envContent -replace '^PROCTORING_MEDIA_URL=.*', 'PROCTORING_MEDIA_URL=ws://127.0.0.1:7880'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_KEY=.*', 'PROCTORING_MEDIA_API_KEY=devkey'
$envContent = $envContent -replace '^PROCTORING_MEDIA_API_SECRET=.*', 'PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456'
$envContent = $envContent -replace '^PROCTORING_MEDIA_ROOM_PREFIX=.*', 'PROCTORING_MEDIA_ROOM_PREFIX=eduexam-'
$envContent = $envContent -replace '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS=.*', 'PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_RETENTION_DAYS=.*', 'PROCTORING_EVIDENCE_RETENTION_DAYS=15'
$envContent = $envContent -replace '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=.*', 'PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600'
$envContent | Set-Content .env

if (-not (Select-String -Path .env -Pattern '^DATABASE_URL=' -Quiet)) { Add-Content .env "DATABASE_URL=sqlite:///$dbPath" }
if (-not (Select-String -Path .env -Pattern '^REDIS_URL=' -Quiet)) { Add-Content .env 'REDIS_URL=redis://127.0.0.1:6379/0' }
if (-not (Select-String -Path .env -Pattern '^CELERY_BROKER_URL=' -Quiet)) { Add-Content .env 'CELERY_BROKER_URL=redis://127.0.0.1:6379/0' }
if (-not (Select-String -Path .env -Pattern '^CELERY_RESULT_BACKEND=' -Quiet)) { Add-Content .env 'CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1' }
if (-not (Select-String -Path .env -Pattern '^FRONTEND_BASE_URL=' -Quiet)) { Add-Content .env 'FRONTEND_BASE_URL=http://127.0.0.1:5173' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_PROVIDER=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_PROVIDER=livekit' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_URL=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_URL=ws://127.0.0.1:7880' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_API_KEY=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_API_KEY=devkey' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_API_SECRET=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_ROOM_PREFIX=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_ROOM_PREFIX=eduexam-' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS=' -Quiet)) { Add-Content .env 'PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_EVIDENCE_RETENTION_DAYS=' -Quiet)) { Add-Content .env 'PROCTORING_EVIDENCE_RETENTION_DAYS=15' }
if (-not (Select-String -Path .env -Pattern '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=' -Quiet)) { Add-Content .env 'PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600' }

docker compose up -d redis livekit

.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data

Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo\\backend'; .\\.venv\\Scripts\\python.exe manage.py runserver 0.0.0.0:8000"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo'; npm.cmd run dev"
```
