# Script tu dong cai dat va khoi dong du an EduExam tren Windows PowerShell

# Xoa bien moi truong VIRTUAL_ENV de tranh ghi de vao venv cha (neu co)
$env:VIRTUAL_ENV = $null

$repo = (Resolve-Path .).Path

Write-Host "=============================================" -ForegroundColor Green
Write-Host "   BAT DAU CAI DAT & KHOI DONG EDUEXAM   " -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green

# 0. Don dep cac tien trinh cu dang chay de tranh khoa file (file lock)
Write-Host ">>> [0/6] Kiem tra va don dep cac tien trinh cu..." -ForegroundColor Cyan
Get-Process | Where-Object { $_.Path -like "*Education-Exam*" } | ForEach-Object {
    try {
        Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue
    } catch {}
}

# 1. Cai dat cac thu vien Frontend
Write-Host ""
Write-Host ">>> [1/6] Dang cai dat thu vien Frontend (npm)..." -ForegroundColor Cyan
npm.cmd install

# 2. Tao moi truong ao Python va cai dat thu vien Backend
Write-Host ""
Write-Host ">>> [2/6] Dang khoi tao Python Virtual Environment cho Backend..." -ForegroundColor Cyan

# Kiem tra dung lenh python (py hoac python)
$pythonCmd = "py"
if (!(Get-Command "py" -ErrorAction SilentlyContinue)) {
    $pythonCmd = "python"
}

cd backend

# Kiem tra xem .venv co bi loi khong
$recreateVenv = $false
if (!(Test-Path .venv)) {
    $recreateVenv = $true
} else {
    if (Test-Path .\.venv\Scripts\python.exe) {
        # Chay thu de kiem tra pip
        $testPip = & .\.venv\Scripts\python.exe -c "from pip._internal.cli.main import main" 2>$null
        if ($LASTEXITCODE -ne 0) {
            Write-Host ">>> Phat hien .venv bi loi, dang tien hanh khoi tao lai..." -ForegroundColor Yellow
            $recreateVenv = $true
        }
    } else {
        $recreateVenv = $true
    }
}

if ($recreateVenv) {
    if (Test-Path .venv) {
        Remove-Item -Recurse -Force .venv -ErrorAction SilentlyContinue
    }
    Write-Host ">>> Dang tao moi thu muc .venv bang $pythonCmd..." -ForegroundColor Cyan
    & $pythonCmd -m venv .venv
}

# Nang cap pip va cai dat backend
.\.venv\Scripts\python.exe -m pip install --upgrade pip
.\.venv\Scripts\python.exe -m pip install -e .

# 3. Cau hinh file .env tu dong
Write-Host ""
Write-Host ">>> [3/6] Dang tao va cau hinh file .env..." -ForegroundColor Cyan
if (!(Test-Path .env)) {
    Copy-Item .env.example .env
}

$envContent = Get-Content .env
$envContent = $envContent -replace '^DATABASE_URL=.*', 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/eduexam'
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

# Bo sung cac cau hinh neu chua ton tai
$keys = @(
    @{ Pattern = '^DATABASE_URL='; Value = 'DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5432/eduexam' },
    @{ Pattern = '^REDIS_URL='; Value = "REDIS_URL=redis://127.0.0.1:6379/0" },
    @{ Pattern = '^CELERY_BROKER_URL='; Value = "CELERY_BROKER_URL=redis://127.0.0.1:6379/0" },
    @{ Pattern = '^CELERY_RESULT_BACKEND='; Value = "CELERY_RESULT_BACKEND=redis://127.0.0.1:6379/1" },
    @{ Pattern = '^FRONTEND_BASE_URL='; Value = "FRONTEND_BASE_URL=http://127.0.0.1:5173" },
    @{ Pattern = '^PROCTORING_MEDIA_PROVIDER='; Value = "PROCTORING_MEDIA_PROVIDER=livekit" },
    @{ Pattern = '^PROCTORING_MEDIA_URL='; Value = "PROCTORING_MEDIA_URL=ws://127.0.0.1:7880" },
    @{ Pattern = '^PROCTORING_MEDIA_API_KEY='; Value = "PROCTORING_MEDIA_API_KEY=devkey" },
    @{ Pattern = '^PROCTORING_MEDIA_API_SECRET='; Value = "PROCTORING_MEDIA_API_SECRET=devsecret-livekit-token-signing-key-123456" },
    @{ Pattern = '^PROCTORING_MEDIA_ROOM_PREFIX='; Value = "PROCTORING_MEDIA_ROOM_PREFIX=eduexam-" },
    @{ Pattern = '^PROCTORING_MEDIA_TOKEN_TTL_SECONDS='; Value = "PROCTORING_MEDIA_TOKEN_TTL_SECONDS=900" },
    @{ Pattern = '^PROCTORING_EVIDENCE_RETENTION_DAYS='; Value = "PROCTORING_EVIDENCE_RETENTION_DAYS=15" },
    @{ Pattern = '^PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS='; Value = "PROCTORING_EVIDENCE_CLEANUP_INTERVAL_SECONDS=3600" }
)
foreach ($key in $keys) {
    if (-not (Select-String -Path .env -Pattern $key.Pattern -Quiet)) {
        Add-Content .env $key.Value
    }
}

# 4. Khoi dong Docker cho cac dich vu local (Redis, LiveKit)
Write-Host ""
Write-Host ">>> [4/6] Dang khoi dong PostgreSQL, Redis va LiveKit qua Docker..." -ForegroundColor Cyan
docker compose up -d postgres redis livekit

# Cho PostgreSQL san sang truoc khi migrate
Write-Host ">>> Dang cho PostgreSQL khoi dong (10s)..." -ForegroundColor Yellow
Start-Sleep -Seconds 10
if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "WARNING: Docker Desktop chua duoc bat hoac gap loi!" -ForegroundColor Yellow
    Write-Host "Ban can bat Docker Desktop de chay Redis & LiveKit (tinh nang Live Webcam & Proctoring)." -ForegroundColor Yellow
    Write-Host "Neu chi can test backend co ban, he thong van tiep tuc khoi dong..." -ForegroundColor Yellow
    Write-Host ""
}

# 5. Migrate Database va Reset Demo Data
Write-Host ""
Write-Host ">>> [5/6] Thuc hien Database Migrations va reset du lieu demo..." -ForegroundColor Cyan
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data

# 6. Khoi dong Backend va Frontend trong 2 cua so moi
Write-Host ""
Write-Host ">>> [6/6] Khởi động Backend và Frontend..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo\backend'; .\.venv\Scripts\daphne.exe -b 0.0.0.0 -p 8000 config.asgi:application"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$repo'; npm.cmd run dev"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "   DU AN DA KHOI DONG THANH CONG!          " -ForegroundColor Green
Write-Host "   - Frontend: http://127.0.0.1:5173" -ForegroundColor Green
Write-Host "   - Backend (Daphne ASGI): http://127.0.0.1:8000" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
