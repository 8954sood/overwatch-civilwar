from __future__ import annotations

import asyncio
import os
import random
import re
import time
import uuid
import threading
from datetime import datetime
from typing import Iterable

from fastapi import Depends, FastAPI, Header, HTTPException, WebSocket, WebSocketDisconnect, status
from fastapi.middleware.cors import CORSMiddleware
import anyio
from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from .db import Base, SessionLocal, engine, get_db
    from .models import AdminSession, BidLog, GameState, InviteCode, Player, Team
    from .schemas import (
        AdminDecisionRequest,
        AdminTimerRequest,
        BidLogOut,
        BidRequest,
        GameStateOut,
        JoinLobbyRequest,
        ParseLogRequest,
        PlayerCreate,
        PlayerOut,
        PlayerUpdate,
        StartGameRequest,
        TeamCreate,
        TeamOut,
        TeamSlim,
        TeamUpdate,
        AdminLoginRequest,
        AdminLoginResponse,
        InviteCreateResponse,
        InviteValidateResponse,
    )
    from .ws import ConnectionManager
except ImportError:  # Allows running "uvicorn main:app" from the api folder.
    from db import Base, SessionLocal, engine, get_db
    from models import AdminSession, BidLog, GameState, InviteCode, Player, Team
    from schemas import (
        AdminDecisionRequest,
        AdminTimerRequest,
        BidLogOut,
        BidRequest,
        GameStateOut,
        JoinLobbyRequest,
        ParseLogRequest,
        PlayerCreate,
        PlayerOut,
        PlayerUpdate,
        StartGameRequest,
        TeamCreate,
        TeamOut,
        TeamSlim,
        TeamUpdate,
        AdminLoginRequest,
        AdminLoginResponse,
        InviteCreateResponse,
        InviteValidateResponse,
    )
    from ws import ConnectionManager

DEFAULT_TIMER = 20.0
MAX_TIMER = 20.0
BONUS_TIME_ON_BID = 2.0
ADMIN_ID = os.getenv("ADMIN_ID", "admin")
ADMIN_PW = os.getenv("ADMIN_PW", "admin")
INVITE_BASE_URL = os.getenv("INVITE_BASE_URL", "http://localhost:5173/#/join?invite=")

app = FastAPI(title="CHZZK Auction API", version="0.1.0")
manager = ConnectionManager()
timer_lock = threading.Lock()
timer_stop_event = threading.Event()
timer_thread: threading.Thread | None = None
app.state.broadcast_queue = asyncio.Queue()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _ensure_game_state(db: Session) -> GameState:
    state = db.get(GameState, 1)
    if state:
        return state
    state = GameState(id=1)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def _require_admin(db: Session, authorization: str | None) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing admin token")
    token = authorization.replace("Bearer ", "", 1).strip()
    session = db.get(AdminSession, token)
    if not session:
        raise HTTPException(status_code=401, detail="Invalid admin token")


def _timer_loop() -> None:
    tick = 0.05
    last_time = time.monotonic()
    while not timer_stop_event.is_set():
        time.sleep(tick)
        now = time.monotonic()
        elapsed = now - last_time
        last_time = now
        db = SessionLocal()
        try:
            state = db.get(GameState, 1)
            if not state or not state.is_timer_running:
                timer_stop_event.set()
                break
            next_value = max(0.0, state.timer_value - elapsed)
            state.timer_value = next_value
            if next_value <= 0:
                state.is_timer_running = False
                timer_stop_event.set()
            db.commit()
            _broadcast(
                "timer_sync",
                {"timeLeft": state.timer_value, "isRunning": state.is_timer_running},
            )
        finally:
            db.close()


def _start_timer_thread() -> None:
    global timer_thread
    with timer_lock:
        if timer_thread and timer_thread.is_alive():
            return
        timer_stop_event.clear()
        timer_thread = threading.Thread(target=_timer_loop, daemon=True)
        timer_thread.start()


def _log(db: Session, message: str) -> None:
    db.add(BidLog(message=message))
    db.commit()


def _players_out(players: Iterable[Player]) -> list[dict]:
    return [_player_to_out(player).model_dump(by_alias=True) for player in players]


def _teams_out(teams: Iterable[Team]) -> list[dict]:
    return [_team_to_out(team).model_dump(by_alias=True) for team in teams]


def _broadcast(event: str, payload: dict) -> None:
    if not manager.active_connections:
        return
    queue: asyncio.Queue = app.state.broadcast_queue
    loop: asyncio.AbstractEventLoop = app.state.loop
    asyncio.run_coroutine_threadsafe(
        queue.put({"event": event, "payload": payload}), loop
    )


def _player_to_out(player: Player) -> PlayerOut:
    return PlayerOut(
        id=player.id,
        name=player.name,
        tiers={"tank": player.tank_tier, "dps": player.dps_tier, "supp": player.supp_tier},
        status=player.status,
        sold_to_team_id=player.sold_to_team_id,
        sold_price=player.sold_price,
        order_index=player.order_index,
    )


def _team_to_out(team: Team) -> TeamOut:
    return TeamOut(
        id=team.id,
        name=team.name,
        captain_name=team.captain_name,
        points=team.points,
        captain_stats={
            "tank": team.captain_tank,
            "dps": team.captain_dps,
            "supp": team.captain_supp,
        },
        roster=[_player_to_out(player) for player in team.roster],
    )


def _team_to_slim(team: Team | None) -> TeamSlim | None:
    if not team:
        return None
    return TeamSlim(id=team.id, name=team.name)


def _state_to_out(state: GameState, bid_history: list[str]) -> GameStateOut:
    current_player = _player_to_out(state.current_player) if state.current_player else None
    high_bidder = _team_to_slim(state.high_bidder)
    return GameStateOut(
        phase=state.phase,
        current_player=current_player,
        current_bid=state.current_bid,
        high_bidder=high_bidder,
        timer_value=state.timer_value,
        is_timer_running=state.is_timer_running,
        bid_history=bid_history,
    )


def _state_payload(db: Session) -> dict:
    state = _ensure_game_state(db)
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    return _state_to_out(state, history).model_dump(by_alias=True)


def _lobby_payload(db: Session) -> dict:
    players = db.scalars(select(Player).order_by(Player.order_index.is_(None), Player.order_index)).all()
    teams = db.scalars(select(Team)).all()
    return {"teams": _teams_out(teams), "players": _players_out(players)}


def _roster_count(db: Session, team_id: str) -> int:
    return (
        db.query(Player).filter(Player.sold_to_team_id == team_id).count()
    )


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        _ensure_game_state(db)
    finally:
        db.close()
    app.state.loop = asyncio.get_event_loop()

    async def broadcast_worker() -> None:
        while True:
            message = await app.state.broadcast_queue.get()
            await manager.broadcast(message)

    app.state.loop.create_task(broadcast_worker())


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.post("/auth/login", response_model=AdminLoginResponse)
def login(payload: AdminLoginRequest, db: Session = Depends(get_db)) -> AdminLoginResponse:
    if payload.admin_id != ADMIN_ID or payload.password != ADMIN_PW:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    token = str(uuid.uuid4())
    db.add(AdminSession(token=token))
    db.commit()
    return AdminLoginResponse(token=token)

 
@app.post("/invite/create", response_model=InviteCreateResponse)
def create_invite(
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> InviteCreateResponse:
    _require_admin(db, authorization)
    code = uuid.uuid4().hex[:6].upper()
    db.add(InviteCode(code=code))
    db.commit()
    return InviteCreateResponse(code=code, link=f"{INVITE_BASE_URL}{code}")


@app.get("/invite/validate/{code}", response_model=InviteValidateResponse)
def validate_invite(code: str, db: Session = Depends(get_db)) -> InviteValidateResponse:
    invite = db.get(InviteCode, code.upper())
    return InviteValidateResponse(valid=invite is not None and invite.used_by_team_id is None)


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket) -> None:
    await manager.connect(websocket)
    try:
        db = next(get_db())
        try:
            await websocket.send_json({"event": "lobby_update", "payload": _lobby_payload(db)})
            await websocket.send_json({"event": "state_sync", "payload": _state_payload(db)})
        finally:
            db.close()

        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)


@app.post("/players", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def create_player(
    payload: PlayerCreate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> PlayerOut:
    _require_admin(db, authorization)
    player_id = payload.id or str(uuid.uuid4())
    player = Player(
        id=player_id,
        name=payload.name,
        tank_tier=payload.tiers.tank,
        dps_tier=payload.tiers.dps,
        supp_tier=payload.tiers.supp,
    )
    db.add(player)
    db.commit()
    db.refresh(player)
    _broadcast("lobby_update", _lobby_payload(db))
    return _player_to_out(player)


@app.get("/players", response_model=list[PlayerOut])
def list_players(db: Session = Depends(get_db)) -> list[PlayerOut]:
    players = db.scalars(select(Player).order_by(Player.order_index.is_(None), Player.order_index)).all()
    return [_player_to_out(player) for player in players]


@app.get("/players/{player_id}", response_model=PlayerOut)
def get_player(player_id: str, db: Session = Depends(get_db)) -> PlayerOut:
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    return _player_to_out(player)


@app.patch("/players/{player_id}", response_model=PlayerOut)
def update_player(
    player_id: str,
    payload: PlayerUpdate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> PlayerOut:
    _require_admin(db, authorization)
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    if payload.name is not None:
        player.name = payload.name
    if payload.tiers is not None:
        player.tank_tier = payload.tiers.tank
        player.dps_tier = payload.tiers.dps
        player.supp_tier = payload.tiers.supp
    if payload.status is not None:
        player.status = payload.status
    if payload.sold_to_team_id is not None:
        player.sold_to_team_id = payload.sold_to_team_id
    if payload.sold_price is not None:
        player.sold_price = payload.sold_price
    if payload.order_index is not None:
        player.order_index = payload.order_index
    db.commit()
    db.refresh(player)
    _broadcast("lobby_update", _lobby_payload(db))
    return _player_to_out(player)


@app.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(
    player_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    _require_admin(db, authorization)
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    db.delete(player)
    db.commit()
    _broadcast("lobby_update", _lobby_payload(db))


@app.post("/players/parse-log", response_model=list[PlayerCreate])
def parse_log(
    payload: ParseLogRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> list[PlayerCreate]:
    _require_admin(db, authorization)
    def normalize_tier_prefix(prefix: str) -> str:
        mapping = {
            "그랜드마스터": "그마",
            "그마": "그마",
            "그": "그마",
            "챔피언": "챔",
            "챔": "챔",
            "마스터": "마",
            "마": "마",
            "다이아": "다",
            "다야": "다",
            "다": "다",
            "플레티넘": "플",
            "플레": "플",
            "플": "플",
            "골드": "골",
            "골": "골",
            "실버": "실",
            "실": "실",
            "브론즈": "브",
            "브": "브",
        }
        return mapping.get(prefix, prefix)

    def extract_tiers(text: str) -> list[str]:
        normalized = text.replace(",", " ").replace("/", " ")
        normalized = normalized.replace("탱", " 탱").replace("딜", " 딜").replace("힐", " 힐")
        rank_tokens = re.findall(
            r"(그랜드마스터|그마|그|챔피언|챔|마스터|마|다이아|다야|다|플레티넘|플레|플|골드|골|실버|실|브론즈|브)\s*(\d+)",
            normalized,
        )
        role_tokens = re.findall(r"(탱|딜|힐)\s*(\d+)", normalized)

        tiers: list[str] = []
        if len(rank_tokens) >= 3:
            for prefix, number in rank_tokens[:3]:
                tiers.append(f"{normalize_tier_prefix(prefix)}{number}")
            return tiers

        base_prefix = normalize_tier_prefix(rank_tokens[0][0]) if rank_tokens else ""
        tank = f"{base_prefix}{rank_tokens[0][1]}" if rank_tokens else ""
        dps = ""
        supp = ""
        for role, number in role_tokens:
            value = f"{base_prefix}{number}" if base_prefix else "N/A"
            if role == "탱":
                tank = value
            if role == "딜":
                dps = value
            if role == "힐":
                supp = value

        tiers = [tank or "N/A", dps or "N/A", supp or "N/A"]
        return tiers

    def has_tiers(text: str) -> bool:
        return bool(
            re.search(
                r"(그랜드마스터|그마|그|챔피언|챔|마스터|마|다이아|다야|다|플레티넘|플레|플|골드|골|실버|실|브론즈|브)\s*\d+",
                text,
            )
            or re.search(r"(탱|딜|힐)\s*\d+", text)
        )

    def clean_line(text: str) -> str:
        cleaned = text.strip()
        if "—" in cleaned:
            cleaned = cleaned.split("—", 1)[0].strip()
        return cleaned

    players: list[PlayerCreate] = []
    pending_name: str | None = None

    for raw in payload.text.splitlines():
        line = clean_line(raw)
        if not line:
            continue

        if has_tiers(line):
            tiers = extract_tiers(line)
            name = pending_name or re.sub(
                r"(그랜드마스터|그마|그|챔피언|챔|마스터|마|다이아|다야|다|플레티넘|플레|플|골드|골|실버|실|브론즈|브)\s*\d+|(탱|딜|힐)\s*\d+",
                "",
                line,
            ).strip()
            if not name:
                name = "Unknown"
            players.append(
                PlayerCreate(
                    name=name,
                    tiers={"tank": tiers[0], "dps": tiers[1], "supp": tiers[2]},
                )
            )
            pending_name = None
        else:
            pending_name = line

    return players


@app.post("/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(
    payload: TeamCreate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> TeamOut:
    _require_admin(db, authorization)
    team_id = payload.id or str(uuid.uuid4())
    team = Team(
        id=team_id,
        name=payload.name,
        captain_name=payload.captain_name,
        points=payload.points,
        captain_tank=payload.captain_stats.tank,
        captain_dps=payload.captain_stats.dps,
        captain_supp=payload.captain_stats.supp,
    )
    db.add(team)
    db.commit()
    db.refresh(team)
    _broadcast("lobby_update", _lobby_payload(db))
    return _team_to_out(team)


@app.post("/lobby/join", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def join_lobby(payload: JoinLobbyRequest, db: Session = Depends(get_db)) -> TeamOut:
    invite = db.get(InviteCode, payload.invite_code.upper())
    if not invite:
        raise HTTPException(status_code=403, detail="Invalid invite code")
    if invite.used_by_team_id:
        raise HTTPException(status_code=409, detail="Invite code already used")
    team = Team(
        id=str(uuid.uuid4()),
        name=payload.team_name,
        captain_name=payload.captain,
        points=1000,
        captain_tank=payload.tiers.tank,
        captain_dps=payload.tiers.dps,
        captain_supp=payload.tiers.supp,
    )
    db.add(team)
    invite.used_by_team_id = team.id
    invite.used_at = datetime.utcnow()
    db.commit()
    db.refresh(team)
    _broadcast("lobby_update", _lobby_payload(db))
    return _team_to_out(team)


@app.get("/teams", response_model=list[TeamOut])
def list_teams(db: Session = Depends(get_db)) -> list[TeamOut]:
    teams = db.scalars(select(Team)).all()
    return [_team_to_out(team) for team in teams]


@app.get("/teams/{team_id}", response_model=TeamOut)
def get_team(team_id: str, db: Session = Depends(get_db)) -> TeamOut:
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    return _team_to_out(team)


@app.patch("/teams/{team_id}", response_model=TeamOut)
def update_team(
    team_id: str,
    payload: TeamUpdate,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> TeamOut:
    _require_admin(db, authorization)
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if payload.name is not None:
        team.name = payload.name
    if payload.captain_name is not None:
        team.captain_name = payload.captain_name
    if payload.points is not None:
        team.points = payload.points
    if payload.captain_stats is not None:
        team.captain_tank = payload.captain_stats.tank
        team.captain_dps = payload.captain_stats.dps
        team.captain_supp = payload.captain_stats.supp
    db.commit()
    db.refresh(team)
    _broadcast("point_change", {"teamId": team.id, "newPoints": team.points})
    _broadcast("lobby_update", _lobby_payload(db))
    return _team_to_out(team)


@app.patch("/teams/{team_id}/points", response_model=TeamOut)
def update_team_points(
    team_id: str,
    payload: dict,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> TeamOut:
    _require_admin(db, authorization)
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if "points" not in payload:
        raise HTTPException(status_code=400, detail="Missing points")
    team.points = int(payload["points"])
    db.commit()
    db.refresh(team)
    _log(db, f"POINT UPDATE: {team.name} -> {team.points}")
    _broadcast("point_change", {"teamId": team.id, "newPoints": team.points})
    _broadcast("lobby_update", _lobby_payload(db))
    return _team_to_out(team)

 
@app.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(
    team_id: str,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
):
    _require_admin(db, authorization)
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()
    _broadcast("lobby_update", _lobby_payload(db))


@app.get("/game/state", response_model=GameStateOut)
def get_game_state(db: Session = Depends(get_db)) -> GameStateOut:
    state = _ensure_game_state(db)
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    return _state_to_out(state, history)


@app.get("/game/logs", response_model=list[BidLogOut])
def get_game_logs(db: Session = Depends(get_db)) -> list[BidLogOut]:
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(100)).all()
    return [
        BidLogOut(message=log.message, created_at=log.created_at.isoformat())
        for log in logs
    ]


@app.post("/game/start", response_model=GameStateOut)
def start_game(
    payload: StartGameRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> GameStateOut:
    _require_admin(db, authorization)
    if not payload.player_list:
        raise HTTPException(status_code=400, detail="Player list is empty")

    db.query(Player).delete()
    db.query(BidLog).delete()
    db.commit()

    players: list[Player] = []
    for entry in payload.player_list:
        player = Player(
            id=entry.id or str(uuid.uuid4()),
            name=entry.name,
            tank_tier=entry.tiers.tank,
            dps_tier=entry.tiers.dps,
            supp_tier=entry.tiers.supp,
            status="waiting",
        )
        players.append(player)
    if payload.order_type == "rand":
        random.shuffle(players)
    for idx, player in enumerate(players):
        player.order_index = idx
        db.add(player)
    db.commit()

    state = _ensure_game_state(db)
    state.phase = "AUCTION"
    state.current_bid = 0
    state.high_bidder_id = None
    state.timer_value = DEFAULT_TIMER
    state.is_timer_running = False
    timer_stop_event.set()

    current_player = players[0]
    current_player.status = "bidding"
    state.current_player_id = current_player.id

    db.commit()
    db.refresh(state)
    _log(db, "GAME STARTED")
    _broadcast("game_started", {})
    _broadcast(
        "new_round",
        {
            "player": _player_to_out(current_player).model_dump(by_alias=True),
            "endTime": time.time() + state.timer_value,
        },
    )
    _broadcast("lobby_update", _lobby_payload(db))
    return _state_to_out(state, ["GAME STARTED"])


@app.post("/game/bid", response_model=GameStateOut)
def bid(payload: BidRequest, db: Session = Depends(get_db)) -> GameStateOut:
    state = _ensure_game_state(db)
    team = db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if state.timer_value <= 0 or not state.is_timer_running:
        raise HTTPException(status_code=400, detail="Bidding is closed")
    if _roster_count(db, team.id) >= 4:
        raise HTTPException(status_code=400, detail="Roster is full")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid amount")

    new_bid = state.current_bid + payload.amount
    if new_bid > team.points:
        raise HTTPException(status_code=400, detail="Not enough points")

    state.current_bid = new_bid
    state.high_bidder_id = team.id
    state.timer_value = min(MAX_TIMER, state.timer_value + BONUS_TIME_ON_BID)
    db.commit()
    _log(db, f"{team.name} bid {new_bid}")
    _broadcast(
        "bid_update",
        {"currentBid": state.current_bid, "highBidder": team.id, "log": f"{team.name} bid {new_bid}"},
    )
    _broadcast(
        "timer_sync",
        {"timeLeft": state.timer_value, "isRunning": state.is_timer_running},
    )

    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    return _state_to_out(state, history)


@app.post("/game/admin/timer", response_model=GameStateOut)
def admin_timer(
    payload: AdminTimerRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> GameStateOut:
    _require_admin(db, authorization)
    state = _ensure_game_state(db)
    if payload.action == "start":
        state.is_timer_running = True
    elif payload.action == "pause":
        state.is_timer_running = False
        timer_stop_event.set()
    elif payload.action == "reset":
        state.is_timer_running = False
        state.timer_value = payload.value if payload.value is not None else DEFAULT_TIMER
        timer_stop_event.set()
    db.commit()
    if payload.action == "start":
        _start_timer_thread()
    _log(db, f"TIMER {payload.action.upper()}")
    _broadcast(
        "timer_sync",
        {"timeLeft": state.timer_value, "isRunning": state.is_timer_running},
    )
    _broadcast("state_sync", _state_payload(db))
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    return _state_to_out(state, history)


@app.post("/game/admin/decision", response_model=GameStateOut)
def admin_decision(
    payload: AdminDecisionRequest,
    db: Session = Depends(get_db),
    authorization: str | None = Header(default=None),
) -> GameStateOut:
    _require_admin(db, authorization)
    state = _ensure_game_state(db)
    if not state.current_player_id:
        raise HTTPException(status_code=400, detail="No active player")

    player = db.get(Player, state.current_player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")

    if payload.action == "sold":
        if not state.high_bidder_id:
            raise HTTPException(status_code=400, detail="No high bidder")
        team = db.get(Team, state.high_bidder_id)
        if not team:
            raise HTTPException(status_code=404, detail="Team not found")
        if _roster_count(db, team.id) >= 4:
            raise HTTPException(status_code=400, detail="Roster is full")
        player.status = "sold"
        player.sold_to_team_id = team.id
        player.sold_price = state.current_bid
        team.points -= state.current_bid
        _log(db, f"SOLD {player.name} to {team.name} for {state.current_bid}")
    else:
        player.status = "unsold"
        _log(db, f"PASS {player.name}")

    state.current_bid = 0
    state.high_bidder_id = None

    next_player = db.scalars(
        select(Player)
        .where(Player.status == "waiting")
        .order_by(Player.order_index)
    ).first()
    if next_player:
        next_player.status = "bidding"
        state.current_player_id = next_player.id
    else:
        unsold_players = db.scalars(
            select(Player)
            .where(Player.status == "unsold")
            .order_by(Player.order_index)
        ).all()
        if unsold_players:
            for player_item in unsold_players:
                player_item.status = "waiting"
            next_unsold = unsold_players[0]
            next_unsold.status = "bidding"
            state.current_player_id = next_unsold.id
            state.phase = "AUCTION"
            _log(db, "UNSOLD REQUEUE")
        else:
            state.current_player_id = None
            state.phase = "ENDED"

    db.commit()
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    _broadcast(
        "round_end",
        {
            "result": payload.action,
            "player": _player_to_out(player).model_dump(by_alias=True),
            "price": player.sold_price,
            "teamId": player.sold_to_team_id,
        },
    )
    if state.current_player_id:
        next_player = db.get(Player, state.current_player_id)
        if next_player:
            _broadcast(
                "new_round",
                {
                    "player": _player_to_out(next_player).model_dump(by_alias=True),
                    "endTime": time.time() + state.timer_value,
                },
            )
    _broadcast("lobby_update", _lobby_payload(db))
    return _state_to_out(state, history)
