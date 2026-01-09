# TradeSense AI

Modern trading platform frontend + FastAPI backend.

## Stack
- Vite + React + TypeScript
- Tailwind CSS + shadcn-ui
- FastAPI + SQLAlchemy (backend)

## Local Development

Frontend:
```sh
cd frontend
npm install
npm run dev
```

Backend:
```sh
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --host 0.0.0.0 --port 8001
```

## Environment
Frontend `.env` in `frontend/.env`:
```
VITE_API_BASE_URL=http://localhost:8001
VITE_GOOGLE_CLIENT_ID=your_google_client_id
```
Backend `.env` in `backend/.env`:
```
GOOGLE_CLIENT_ID=your_google_client_id
FMP_API_KEY=YOUR_FMP_API_KEY
ADMIN_EMAIL=admin@tradesense.ai
ADMIN_PASSWORD=admin123
```
