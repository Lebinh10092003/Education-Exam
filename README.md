# EduExam

EduExam la he thong thi truc tuyen gom:

- frontend Vite + React o thu muc goc
- backend Django API o thu muc `backend/`

Repo nay chi dung `1 README.md` nay de huong dan clone, cap nhat va chay du an tren bat ky may nao.

## Yeu cau moi truong

- Git
- Node.js 20+ va npm
- Python 3.12+
- PostgreSQL local
- Redis local la tuy chon

`Redis` khong bat buoc de chay CRUD/API co ban, nhung mot so tinh nang realtime hoac background co the can.

## Cau hinh database mac dinh

File `backend/.env.example` dang dung PostgreSQL local:

```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/eduexam
```

Neu may ban dung user, password, port hoac ten database khac, sua lai `DATABASE_URL` trong `backend/.env`.
Mac dinh repo dung filesystem local cho file upload. Neu ban khong dung MinIO/S3, giu:

```env
USE_S3_STORAGE=False
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_STORAGE_BUCKET_NAME=
AWS_S3_ENDPOINT_URL=
```

Chi khi nao ban chu dong dung object storage moi can bat `USE_S3_STORAGE=True` va dien cac bien `AWS_*`.

Database `eduexam` phai ton tai truoc khi chay `migrate`.

Neu may ban da co `psql` trong `PATH`, co the tao nhanh:

```powershell
psql -U postgres -c "CREATE DATABASE eduexam;"
```

## Lan dau clone va chay

### Cach nhanh cho Windows PowerShell

```powershell
git clone <repo-url>
cd Education-Exam

npm install

cd backend
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -e .
Copy-Item .env.example .env
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data
```

Sau do mo 2 cua so terminal:

Terminal 1, chay backend:

```powershell
cd Education-Exam\backend
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

Terminal 2, chay frontend:

```powershell
cd Education-Exam
npm run dev
```

### Cach nhanh cho macOS/Linux

```bash
git clone <repo-url>
cd Education-Exam

npm install

cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -e .
cp .env.example .env
python manage.py migrate
python manage.py reset_demo_data
```

Sau do mo 2 terminal:

Terminal 1, chay backend:

```bash
cd Education-Exam/backend
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

Terminal 2, chay frontend:

```bash
cd Education-Exam
npm run dev
```

Frontend thuong chay tai `http://127.0.0.1:5173`.
Backend thuong chay tai `http://127.0.0.1:8000`.

## Moi lan cap nhat du an tren may da co source

Neu may ban da clone repo tu truoc va muon cap nhat code moi nhat:

### Windows PowerShell

```powershell
cd Education-Exam
git pull
npm install

cd backend
.\.venv\Scripts\python.exe -m pip install -e .
.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py reset_demo_data
```

### macOS/Linux

```bash
cd Education-Exam
git pull
npm install

cd backend
source .venv/bin/activate
pip install -e .
python manage.py migrate
python manage.py reset_demo_data
```

`reset_demo_data` se xoa toan bo du lieu nghiep vu trong database hien tai roi tao lai bo data demo co dinh de test end-to-end.
Lenh nay se seed materials/proctoring files vao filesystem local theo cau hinh mac dinh, nen khong can MinIO de chay local.

## Tai khoan demo mac dinh

Lenh `reset_demo_data` hien tai tao:

- admin demo
- examiner
- proctor
- candidate, group, exam, session, result, materials, notifications, audit, proctoring data
- system permissions
- system roles
- role `administrator` cho tai khoan admin

Tai khoan dang nhap mac dinh:

- Email: `admin@example.com`
- Password: `admin123456`

Neu chi can admin demo va RBAC toi thieu, van co the dung:

```bash
cd backend
python manage.py seed_demo_data
```

## Chay lai du an sau khi da setup xong

Moi lan mo lai du an, chi can:

Backend:

### Windows PowerShell

```powershell
cd Education-Exam\backend
.\.venv\Scripts\python.exe manage.py runserver 0.0.0.0:8000
```

### macOS/Linux

```bash
cd Education-Exam/backend
source .venv/bin/activate
python manage.py runserver 0.0.0.0:8000
```

Frontend:

```bash
cd Education-Exam
npm run dev
```

## Cau hinh frontend khi can

Thong thuong frontend khong can them file `.env` khi chay local, vi Vite da proxy `/api` va `/ws` sang backend.

Neu frontend chay o host khac, tao `.env.local` o thu muc goc:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

## Cau truc chinh

- `src/`: frontend source code
- `backend/`: Django API, migrations, tests, settings
- `public/`: static asset frontend
- `dist/`: build output frontend

## Lenh huu ich

Frontend:

```bash
npm run dev
npm run build
npm run test -- src/app/routes.test.tsx
```

Backend:

```bash
cd backend
python manage.py check
python -m pytest tests -q
python manage.py spectacular --file openapi.yaml
```
