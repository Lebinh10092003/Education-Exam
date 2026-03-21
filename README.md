# EduExam Online Examination Platform

EduExam la nen tang thi truc tuyen gom:

- frontend Vite + React o thu muc goc
- backend Django API o thu muc `backend/`

File nay dung de huong dan cai dat nhanh sau khi clone tu Git.

## Yeu cau moi truong

- Node.js 20+ va npm
- Python 3.12+
- Docker Desktop hoac Docker Engine

## 1. Clone repo

```bash
git clone <repo-url>
cd "EduExam Online Examination Platform"
```

## 2. Cai dat frontend

Chay o thu muc goc:

```bash
npm install
```

Frontend dev server dung Vite va mac dinh proxy API sang `http://127.0.0.1:8000`.

## 3. Cai dat backend

Chuyen vao thu muc backend:

```bash
cd backend
python -m venv .venv
```

Kich hoat virtual environment:

- PowerShell: `.\.venv\Scripts\Activate.ps1`
- macOS/Linux: `source .venv/bin/activate`

Cai dependency:

```bash
pip install -e .
```

Tao file moi truong:

```bash
cp .env.example .env
```

Neu dung PowerShell, co the thay bang:

```powershell
Copy-Item .env.example .env
```

## 4. Khoi dong dich vu phu tro

Van o thu muc `backend/`:

```bash
docker compose up -d
```

Lenh nay khoi tao:

- PostgreSQL tren cong `5432`
- Redis tren cong `6379`
- MinIO tren cong `9000` va console `9001`

## 5. Khoi tao du lieu backend

Van o thu muc `backend/`:

```bash
python manage.py migrate
python manage.py seed_demo_data
```

## 6. Chay du an

Backend:

```bash
cd backend
python manage.py runserver 0.0.0.0:8000
```

Frontend:

```bash
npm.cmd install
npm.cmd run dev

```

Sau do mo frontend tai URL duoc Vite in ra, thuong la `http://127.0.0.1:5173`.

## 7. Cau hinh frontend khi can

Thong thuong frontend khong can them file `.env` khi chay local, vi Vite da proxy `/api` va `/ws` sang backend.

Neu ban chay frontend o mot host khac, co the tao file `.env.local` o thu muc goc:

```env
VITE_API_BASE_URL=http://127.0.0.1:8000
VITE_WS_BASE_URL=ws://127.0.0.1:8000
```

## Cau truc chinh

- `src/`: frontend source code
- `backend/`: Django API, test, docker compose, tai lieu backend
- `public/`: static asset cho frontend
- `dist/`: build output frontend, khong commit len Git

## Lenh huu ich

Frontend:

```bash
npm run dev
npm run build
```

Backend:

```bash
cd backend
python manage.py check
python -m pytest tests -q
python manage.py spectacular --file openapi.yaml
```

Chi tiet API backend va cac round chuc nang da co san trong [backend/README.md](backend/README.md).
