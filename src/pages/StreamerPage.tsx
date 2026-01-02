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

  const currentPlayer = state?.currentPlayer ?? null
  const displayTimer = useSyncedTimer(
    state?.timerValue ?? 0,
    state?.isTimerRunning ?? false,
  )
  const queue = useMemo(
    () => players.filter((player) => player.status === 'waiting'),
    [players],
  )
  const unsold = useMemo(
    () => players.filter((player) => player.status === 'unsold'),
    [players],
  )

  useEffect(() => {
    let isMounted = true
    Promise.all([listTeams(), listPlayers(), getGameState()])
      .then(([teamData, playerData, gameState]) => {
        if (!isMounted) return
        setTeams(teamData)
        setPlayers(playerData)
        setState(gameState)
      })
      .catch(() => {})

    const socket = connectAuctionSocket((message) => {
      if (message.event === 'lobby_update') {
        const payload = message.payload as { players: Player[]; teams: Team[] }
        setTeams(payload.teams ?? [])
        setPlayers(payload.players ?? [])
      }
      if (
        message.event === 'bid_update' ||
        message.event === 'timer_sync' ||
        message.event === 'round_end' ||
        message.event === 'new_round' ||
        message.event === 'state_sync'
      ) {
        getGameState().then(setState).catch(() => {})
      }
    })
    const poller = window.setInterval(() => {
      Promise.all([listTeams(), listPlayers(), getGameState()])
        .then(([teamData, playerData, gameState]) => {
          if (!isMounted) return
          setTeams(teamData)
          setPlayers(playerData)
          setState(gameState)
        })
        .catch(() => {})
    }, 1000)
    return () => {
      isMounted = false
      socket.close()
      window.clearInterval(poller)
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
