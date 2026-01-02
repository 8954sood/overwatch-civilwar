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

## Key Endpoints

- `POST /players` `GET /players`
- `POST /teams` `GET /teams`
- `POST /lobby/join`
- `POST /game/start`
- `POST /game/bid`
- `POST /game/admin/timer`
- `POST /game/admin/decision`
- `GET /game/state`
