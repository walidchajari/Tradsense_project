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
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```
Backend `.env` in `backend/.env`:
```
GOOGLE_CLIENT_ID=your_google_client_id
FMP_API_KEY=YOUR_FMP_API_KEY
ADMIN_EMAIL=admin@tradesense.ai
ADMIN_PASSWORD=admin123
DATABASE_URL=postgresql://user:pass@host:5432/dbname
PAYPAL_CLIENT_ID=your_paypal_client_id
PAYPAL_CLIENT_SECRET=your_paypal_client_secret
PAYPAL_MODE=sandbox
PAYPAL_CURRENCY=USD
```

## Deploy (Vercel + Render)

### Backend (Render)
- Create a new Render Web Service from this repo.
- Build Command: `pip install -r backend/requirements.txt`
- Start Command: `uvicorn backend.app.main:app --host 0.0.0.0 --port $PORT`
- Set env vars in Render:
  - `DATABASE_URL` (use a Render Postgres database)
  - `ADMIN_EMAIL`, `ADMIN_PASSWORD`
  - `GOOGLE_CLIENT_ID`
  - `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET`, `PAYPAL_MODE`, `PAYPAL_CURRENCY`
  - Optional: `REDIS_URL` or `CELERY_BROKER_URL` if you enable background tasks

### Frontend (Vercel)
- Import the repo in Vercel and set Root Directory to `frontend`.
- Build Command: `npm run build`
- Output Directory: `dist`
- Set env vars in Vercel:
  - `VITE_API_BASE_URL` (your Render backend URL)
  - `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`
  - `VITE_GOOGLE_CLIENT_ID` (if using Google login)
