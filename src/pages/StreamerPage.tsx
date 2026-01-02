import { useEffect, useMemo, useState } from 'react'
import AuctionStage from '../components/AuctionStage'
import ControlPanel from '../components/ControlPanel'
import LogBox from '../components/LogBox'
import TeamCard from '../components/TeamCard'
import {
  adminDecision,
  adminTimer,
  getGameState,
  listPlayers,
  listTeams,
  updateTeamPoints,
} from '../api/auctionApi'
import { connectAuctionSocket } from '../api/socket'
import type { GameState, Player, Team } from '../types'
import useSyncedTimer from '../hooks/useSyncedTimer'

export default function StreamerPage() {
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [state, setState] = useState<GameState | null>(null)
  const auctionId = localStorage.getItem('auctionId') ?? undefined

  const currentPlayer = state?.currentPlayer ?? null
  const displayTimer = useSyncedTimer(
    state?.timerValue ?? 0,
    state?.isTimerRunning ?? false,
  )
  const orderedPlayers = useMemo(
    () =>
      [...players].sort(
        (a, b) => (a.orderIndex ?? 9999) - (b.orderIndex ?? 9999),
      ),
    [players],
  )
  const queue = useMemo(
    () => orderedPlayers.filter((player) => player.status === 'waiting'),
    [orderedPlayers],
  )
  const unsold = useMemo(
    () => orderedPlayers.filter((player) => player.status === 'unsold'),
    [orderedPlayers],
  )

  useEffect(() => {
    let isMounted = true
    if (!auctionId) {
      window.location.hash = '#/dashboard'
      return () => {
        isMounted = false
      }
    }
    window.history.pushState(null, '', window.location.href)
    const blockBack = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', blockBack)
    Promise.all([listTeams(), listPlayers(), getGameState()])
      .then(([teamData, playerData, gameState]) => {
        if (!isMounted) return
        setTeams(teamData)
        setPlayers(playerData)
        setState(gameState)
      })
      .catch(() => {})

    const socket = connectAuctionSocket((message) => {
      const payloadAuctionId =
        (message.payload as { auctionId?: string }).auctionId ?? null
      if (payloadAuctionId && auctionId && payloadAuctionId !== auctionId) {
        return
      }
      if (message.event === 'lobby_update') {
        const payload = message.payload as { players: Player[]; teams: Team[] }
        setTeams(payload.teams ?? [])
        setPlayers(payload.players ?? [])
      }
      if (message.event === 'timer_sync') {
        const payload = message.payload as {
          timeLeft: number
          isRunning: boolean
        }
        setState((prev) => {
          if (!prev) {
            getGameState().then(setState).catch(() => {})
            return prev
          }
          return {
            ...prev,
            timerValue: payload.timeLeft,
            isTimerRunning: payload.isRunning,
          }
        })
        return
      }
      if (message.event === 'bid_update') {
        const payload = message.payload as {
          currentBid: number
          highBidder: string
          highBidderName?: string
          log?: string
        }
        const bidderName =
          payload.highBidderName ??
          teams.find((team) => team.id === payload.highBidder)?.name ??
          payload.highBidder
        if (bidderName === payload.highBidder) {
          console.warn('Bidder name mapping failed', {
            highBidder: payload.highBidder,
            teamIds: teams.map((team) => team.id),
          })
        }
        setState((prev) =>
          prev
            ? {
                ...prev,
                currentBid: payload.currentBid,
                highBidder: payload.highBidder
                  ? { id: payload.highBidder, name: bidderName }
                  : prev.highBidder,
                bidHistory: payload.log
                  ? [payload.log, ...prev.bidHistory]
                  : prev.bidHistory,
              }
            : prev,
        )
        return
      }
      if (message.event === 'state_sync') {
        setState(message.payload as GameState)
        return
      }
      if (message.event === 'round_end' || message.event === 'new_round') {
        getGameState().then(setState).catch(() => {})
      }
    }, auctionId)
    return () => {
      isMounted = false
      socket.close()
      window.removeEventListener('popstate', blockBack)
    }
  }, [])

  const handleTimerAction = async (action: 'start' | 'pause' | 'reset') => {
    try {
      const nextState = await adminTimer(action)
      setState(nextState)
    } catch (error) {
      alert(String(error))
    }
  }

  const handleDecision = async (action: 'sold' | 'pass') => {
    try {
      const nextState = await adminDecision(action)
      setState(nextState)
    } catch (error) {
      alert(String(error))
    }
  }

  const handlePointChange = async (teamId: string, points: number) => {
    try {
      const updated = await updateTeamPoints(teamId, points)
      setTeams((prev) =>
        prev.map((team) => (team.id === teamId ? updated : team)),
      )
    } catch (error) {
      alert(String(error))
    }
  }

  return (
    <div className="page auction-page streamer-page">
      <div className="col-left">
        <div className="panel scroll-area team-scroll">
          {teams.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              editablePoints
              onPointChange={handlePointChange}
            />
          ))}
        </div>
      </div>

      <div className="col-center">
        {currentPlayer ? (
          <AuctionStage
            player={currentPlayer}
            currentBid={state?.currentBid ?? 0}
            highBidder={state?.highBidder?.name}
            showStreamerLabel
          />
        ) : (
          <div className="panel auction-stage">
            <div className="stage-label">STREAMER VIEW</div>
            <div className="player-name">대기 중</div>
          </div>
        )}
        <div className="bottom-section">
          <LogBox title="LOG" entries={state?.bidHistory ?? []} accent="danger" />
          <ControlPanel
            timerValue={displayTimer.toFixed(2)}
            onTimerAction={handleTimerAction}
            onDecision={handleDecision}
          />
        </div>
      </div>

      <div className="col-right">
        <div className="panel queue-panel">
          <div className="header-title">QUEUE LIST</div>
          <div className="scroll-area">
            {queue.map((player) => (
              <div key={player.id} className="list-item">
                <span>{player.name}</span>
                <span className="list-badges">
                  {player.tiers.tank}/{player.tiers.dps}/{player.tiers.supp}
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="panel unsold-panel">
          <div className="header-title danger">UNSOLD</div>
          <div className="scroll-area">
            {unsold.map((player) => (
              <div key={player.id} className="list-item">
                <span>{player.name}</span>
                <span className="list-badges">
                  {player.tiers.tank}/{player.tiers.dps}/{player.tiers.supp}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
