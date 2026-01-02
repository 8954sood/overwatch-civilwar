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

- `POST /auth/login`
- `POST /auctions` `GET /auctions` `GET /auctions/{id}`
- `POST /players` `GET /players` (requires `X-Auction-Id`)
- `POST /teams` `GET /teams` (requires `X-Auction-Id`)
- `POST /lobby/join`
- `POST /game/start` (requires `X-Auction-Id`)
- `POST /game/bid`
- `POST /game/admin/timer` (requires `X-Auction-Id`)
- `POST /game/admin/decision` (requires `X-Auction-Id`)
- `GET /game/state` (requires `X-Auction-Id`)
- `WS /ws?auctionId=...` (server events)

## Auth

- `POST /auth/login` with `{ "id": "...", "password": "..." }`
- Admin-only endpoints require `Authorization: Bearer <token>`
- `GET /invite/validate/{code}` validates invite code

Note: schema changed for multi-auction support. If you already created a SQLite DB before this change,
remove `auction.db` so the new tables are created.

Note: schema changed again (last bid tracking). Remove `auction.db` if you see errors about missing columns.
