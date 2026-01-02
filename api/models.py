from __future__ import annotations

from datetime import datetime
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from .db import Base
except ImportError:  # Allows running from api folder.
    from db import Base


class Auction(Base):
    __tablename__ = "auctions"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="DRAFT")
    invite_code: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Team(Base):
    __tablename__ = "teams"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    auction_id: Mapped[str] = mapped_column(String, ForeignKey("auctions.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    captain_name: Mapped[str] = mapped_column(String, nullable=False)
    points: Mapped[int] = mapped_column(Integer, default=0)
    captain_tank: Mapped[str] = mapped_column(String, nullable=False)
    captain_dps: Mapped[str] = mapped_column(String, nullable=False)
    captain_supp: Mapped[str] = mapped_column(String, nullable=False)

    roster: Mapped[list["Player"]] = relationship(
        back_populates="sold_to_team", lazy="selectin"
    )


class Player(Base):
    __tablename__ = "players"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    auction_id: Mapped[str] = mapped_column(String, ForeignKey("auctions.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    tank_tier: Mapped[str] = mapped_column(String, nullable=False)
    dps_tier: Mapped[str] = mapped_column(String, nullable=False)
    supp_tier: Mapped[str] = mapped_column(String, nullable=False)
    status: Mapped[str] = mapped_column(String, default="waiting")
    sold_to_team_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("teams.id"), nullable=True
    )
    sold_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    order_index: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sold_to_team: Mapped["Team | None"] = relationship(back_populates="roster")


class GameState(Base):
    __tablename__ = "game_state"

    auction_id: Mapped[str] = mapped_column(
        String, ForeignKey("auctions.id"), primary_key=True
    )
    phase: Mapped[str] = mapped_column(String, default="SETUP")
    current_player_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("players.id"), nullable=True
    )
    current_bid: Mapped[int] = mapped_column(Integer, default=0)
    high_bidder_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("teams.id"), nullable=True
    )
    timer_value: Mapped[float] = mapped_column(Float, default=15.0)
    is_timer_running: Mapped[bool] = mapped_column(Boolean, default=False)
    last_bid_team_id: Mapped[str | None] = mapped_column(
        String, ForeignKey("teams.id"), nullable=True
    )

    current_player: Mapped["Player | None"] = relationship(
        foreign_keys=[current_player_id], lazy="selectin"
    )
    high_bidder: Mapped["Team | None"] = relationship(
        foreign_keys=[high_bidder_id], lazy="selectin"
    )


class BidLog(Base):
    __tablename__ = "bid_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    auction_id: Mapped[str] = mapped_column(String, ForeignKey("auctions.id"), index=True)
    message: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class AdminSession(Base):
    __tablename__ = "admin_sessions"

    token: Mapped[str] = mapped_column(String, primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
