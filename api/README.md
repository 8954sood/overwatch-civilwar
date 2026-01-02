# CHZZK Auction API

FastAPI + SQLite backend for the auction system.

## Setup

```bash
python -m venv .venv
.\.venv\Scripts\activate
pip install -r requirements.txt
```

## Run

From repo root:

```bash
uvicorn api.main:app --reload --port 8000
```

From the api folder:

```bash
uvicorn main:app --reload --port 8000
```

## Environment

- `DATABASE_URL` (optional, default: `sqlite:///./auction.db`)
- `ADMIN_ID` / `ADMIN_PW` (admin login)
- `INVITE_BASE_URL` (default: `http://localhost:5173/#/join?invite=`)

## Key Endpoints

- `POST /players` `GET /players`
- `POST /teams` `GET /teams`
- `POST /lobby/join`
- `POST /game/start`
- `POST /game/bid`
- `POST /game/admin/timer`
- `POST /game/admin/decision`
- `GET /game/state`
- `WS /ws` (server events)

## Auth

- `POST /auth/login` with `{ "id": "...", "password": "..." }`
- Admin-only endpoints require `Authorization: Bearer <token>`
- `POST /invite/create` issues invite codes
- `GET /invite/validate/{code}` validates invite code

Note: invite codes are single-use. If you already created a SQLite DB before this change,
remove `auction.db` so the new columns are created.
