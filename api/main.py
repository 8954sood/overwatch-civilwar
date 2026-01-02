from __future__ import annotations

import random
import uuid
from datetime import datetime

from fastapi import Depends, FastAPI, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

try:
    from .db import Base, engine, get_db
    from .models import BidLog, GameState, Player, Team
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
    )
except ImportError:  # Allows running "uvicorn main:app" from the api folder.
    from db import Base, engine, get_db
    from models import BidLog, GameState, Player, Team
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
    )

DEFAULT_TIMER = 15.0

app = FastAPI(title="CHZZK Auction API", version="0.1.0")


def _ensure_game_state(db: Session) -> GameState:
    state = db.get(GameState, 1)
    if state:
        return state
    state = GameState(id=1)
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


def _log(db: Session, message: str) -> None:
    db.add(BidLog(message=message))
    db.commit()


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


@app.on_event("startup")
def on_startup() -> None:
    Base.metadata.create_all(bind=engine)
    db = next(get_db())
    try:
        _ensure_game_state(db)
    finally:
        db.close()


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "time": datetime.utcnow().isoformat()}


@app.post("/players", response_model=PlayerOut, status_code=status.HTTP_201_CREATED)
def create_player(payload: PlayerCreate, db: Session = Depends(get_db)) -> PlayerOut:
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
    player_id: str, payload: PlayerUpdate, db: Session = Depends(get_db)
) -> PlayerOut:
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
    return _player_to_out(player)


@app.delete("/players/{player_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_player(player_id: str, db: Session = Depends(get_db)):
    player = db.get(Player, player_id)
    if not player:
        raise HTTPException(status_code=404, detail="Player not found")
    db.delete(player)
    db.commit()


@app.post("/players/parse-log", response_model=list[PlayerCreate])
def parse_log(payload: ParseLogRequest) -> list[PlayerCreate]:
    players: list[PlayerCreate] = []
    for line in payload.text.splitlines():
        line = line.strip()
        if not line:
            continue
        tokens = [tok for tok in line.replace("/", " ").replace(",", " ").split(" ") if tok]
        name = tokens[0] if tokens else "Unknown"
        tiers = tokens[1:4] if len(tokens) >= 4 else ["N/A", "N/A", "N/A"]
        players.append(
            PlayerCreate(
                name=name,
                tiers={"tank": tiers[0], "dps": tiers[1], "supp": tiers[2]},
            )
        )
    return players


@app.post("/teams", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def create_team(payload: TeamCreate, db: Session = Depends(get_db)) -> TeamOut:
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
    return _team_to_out(team)


@app.post("/lobby/join", response_model=TeamOut, status_code=status.HTTP_201_CREATED)
def join_lobby(payload: JoinLobbyRequest, db: Session = Depends(get_db)) -> TeamOut:
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
    db.commit()
    db.refresh(team)
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
def update_team(team_id: str, payload: TeamUpdate, db: Session = Depends(get_db)) -> TeamOut:
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
    return _team_to_out(team)


@app.patch("/teams/{team_id}/points", response_model=TeamOut)
def update_team_points(team_id: str, payload: dict, db: Session = Depends(get_db)) -> TeamOut:
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if "points" not in payload:
        raise HTTPException(status_code=400, detail="Missing points")
    team.points = int(payload["points"])
    db.commit()
    db.refresh(team)
    _log(db, f"POINT UPDATE: {team.name} -> {team.points}")
    return _team_to_out(team)


@app.delete("/teams/{team_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_team(team_id: str, db: Session = Depends(get_db)):
    team = db.get(Team, team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    db.delete(team)
    db.commit()


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
def start_game(payload: StartGameRequest, db: Session = Depends(get_db)) -> GameStateOut:
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

    current_player = players[0]
    current_player.status = "bidding"
    state.current_player_id = current_player.id

    db.commit()
    db.refresh(state)
    _log(db, "GAME STARTED")
    return _state_to_out(state, ["GAME STARTED"])


@app.post("/game/bid", response_model=GameStateOut)
def bid(payload: BidRequest, db: Session = Depends(get_db)) -> GameStateOut:
    state = _ensure_game_state(db)
    team = db.get(Team, payload.team_id)
    if not team:
        raise HTTPException(status_code=404, detail="Team not found")
    if payload.amount <= 0:
        raise HTTPException(status_code=400, detail="Invalid bid amount")

    new_bid = state.current_bid + payload.amount
    if new_bid > team.points:
        raise HTTPException(status_code=400, detail="Not enough points")

    state.current_bid = new_bid
    state.high_bidder_id = team.id
    db.commit()
    _log(db, f"{team.name} bid {new_bid}")

    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    return _state_to_out(state, history)


@app.post("/game/admin/timer", response_model=GameStateOut)
def admin_timer(payload: AdminTimerRequest, db: Session = Depends(get_db)) -> GameStateOut:
    state = _ensure_game_state(db)
    if payload.action == "start":
        state.is_timer_running = True
    elif payload.action == "pause":
        state.is_timer_running = False
    elif payload.action == "reset":
        state.is_timer_running = False
        state.timer_value = payload.value if payload.value is not None else DEFAULT_TIMER
    db.commit()
    _log(db, f"TIMER {payload.action.upper()}")
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    return _state_to_out(state, history)


@app.post("/game/admin/decision", response_model=GameStateOut)
def admin_decision(
    payload: AdminDecisionRequest, db: Session = Depends(get_db)
) -> GameStateOut:
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
        state.current_player_id = None
        state.phase = "ENDED"

    db.commit()
    logs = db.scalars(select(BidLog).order_by(BidLog.id.desc()).limit(50)).all()
    history = [log.message for log in logs]
    db.refresh(state)
    return _state_to_out(state, history)
