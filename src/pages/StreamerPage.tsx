import { useEffect, useMemo, useState } from 'react'
import AuctionStage from '../components/AuctionStage'
import ControlPanel from '../components/ControlPanel'
import LogBox from '../components/LogBox'
import TeamCard from '../components/TeamCard'
import { mockPlayers, mockTeams } from '../data/mockData'
import type { Team } from '../types'

export default function StreamerPage() {
  const [teams, setTeams] = useState<Team[]>(mockTeams)
  const [logs, setLogs] = useState<string[]>([])
  const [timer, setTimer] = useState(15)
  const [isRunning, setIsRunning] = useState(false)

  const currentPlayer = useMemo(() => mockPlayers[0], [])
  const queue = useMemo(() => mockPlayers.slice(1), [])

  useEffect(() => {
    if (!isRunning) {
      return
    }
    const interval = window.setInterval(() => {
      setTimer((prev) => {
        const next = Number((prev - 0.01).toFixed(2))
        if (next <= 0) {
          setIsRunning(false)
          return 0
        }
        return next
      })
    }, 10)
    return () => window.clearInterval(interval)
  }, [isRunning])

  const handleTimerAction = (action: 'start' | 'pause' | 'reset') => {
    if (action === 'start') {
      setIsRunning(true)
    }
    if (action === 'pause') {
      setIsRunning(false)
    }
    if (action === 'reset') {
      setIsRunning(false)
      setTimer(15)
    }
  }

  const handleDecision = (action: 'sold' | 'pass') => {
    const message =
      action === 'sold'
        ? 'ADMIN: 강제 낙찰 처리했습니다.'
        : 'ADMIN: 강제 유찰 처리했습니다.'
    setLogs((prev) => [message, ...prev])
    handleTimerAction('reset')
  }

  const handlePointChange = (teamId: string, points: number) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, points } : team)),
    )
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
        <AuctionStage
          player={currentPlayer}
          currentBid={1200}
          showStreamerLabel
        />
        <div className="bottom-section">
          <LogBox title="LOG" entries={logs} accent="danger" />
          <ControlPanel
            timerValue={timer.toFixed(2)}
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
        </div>
      </div>
    </div>
  )
}
