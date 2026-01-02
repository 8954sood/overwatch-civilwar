from __future__ import annotations

from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, Field


class BaseSchema(BaseModel):
    model_config = ConfigDict(populate_by_name=True)


class PlayerTier(BaseSchema):
    tank: str
    dps: str
    supp: str


class PlayerBase(BaseSchema):
    name: str
    tiers: PlayerTier


class PlayerCreate(PlayerBase):
    id: str | None = None


class PlayerUpdate(BaseSchema):
    name: Optional[str] = None
    tiers: Optional[PlayerTier] = None
    status: Optional[str] = None
    sold_to_team_id: Optional[str] = Field(default=None, alias="soldToTeamId")
    sold_price: Optional[int] = Field(default=None, alias="soldPrice")
    order_index: Optional[int] = Field(default=None, alias="orderIndex")


class PlayerOut(PlayerBase):
    id: str
    status: str
    sold_to_team_id: Optional[str] = Field(default=None, alias="soldToTeamId")
    sold_price: Optional[int] = Field(default=None, alias="soldPrice")
    order_index: Optional[int] = Field(default=None, alias="orderIndex")

    class Config:
        from_attributes = True


class TeamBase(BaseSchema):
    name: str
    captain_name: str = Field(..., alias="captainName")
    points: int = 0
    captain_stats: PlayerTier = Field(..., alias="captainStats")


class TeamCreate(TeamBase):
    id: str | None = None


class TeamUpdate(BaseSchema):
    name: Optional[str] = None
    captain_name: Optional[str] = Field(default=None, alias="captainName")
    points: Optional[int] = None
    captain_stats: Optional[PlayerTier] = Field(default=None, alias="captainStats")


class TeamOut(TeamBase):
    id: str
    roster: list[PlayerOut] = []

    class Config:
        from_attributes = True


class TeamSlim(BaseSchema):
    id: str
    name: str

    class Config:
        from_attributes = True


class GameStateOut(BaseSchema):
    phase: str
    current_player: Optional[PlayerOut] = Field(default=None, alias="currentPlayer")
    current_bid: int = Field(..., alias="currentBid")
    high_bidder: Optional[TeamSlim] = Field(default=None, alias="highBidder")
    timer_value: float = Field(..., alias="timerValue")
    is_timer_running: bool = Field(..., alias="isTimerRunning")
    bid_history: list[str] = Field(default_factory=list, alias="bidHistory")

    class Config:
        from_attributes = True


class BidLogOut(BaseSchema):
    message: str
    created_at: str

    class Config:
        from_attributes = True


class JoinLobbyRequest(BaseSchema):
    team_name: str = Field(..., alias="teamName")
    captain: str
    tiers: PlayerTier
    invite_code: str = Field(..., alias="inviteCode")


class StartGameRequest(BaseSchema):
    player_list: list[PlayerCreate] = Field(..., alias="playerList")
    order_type: Literal["seq", "rand"] = Field(..., alias="orderType")


class BidRequest(BaseSchema):
    team_id: str = Field(..., alias="teamId")
    amount: int


class AdminTimerRequest(BaseSchema):
    action: Literal["start", "pause", "reset"]
    value: float | None = None


class AdminDecisionRequest(BaseSchema):
    action: Literal["sold", "pass"]


class ParseLogRequest(BaseSchema):
    text: str


class AdminLoginRequest(BaseSchema):
    admin_id: str = Field(..., alias="id")
    password: str


class AdminLoginResponse(BaseSchema):
    token: str


class InviteCreateResponse(BaseSchema):
    code: str
    link: str


class InviteValidateResponse(BaseSchema):
    valid: bool
