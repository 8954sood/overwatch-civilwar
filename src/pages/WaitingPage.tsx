import { useEffect, useMemo, useState } from 'react'
import { connectAuctionSocket } from '../api/socket'
import { getGameState, listPlayers } from '../api/auctionApi'
import type { Player, Team } from '../types'

type StoredTeamInfo = {
  id?: string
  name: string
  points: number
}

export default function WaitingPage() {
  const [players, setPlayers] = useState<Player[]>([])
  const auctionId = localStorage.getItem('auctionId') ?? undefined

  const myInfo = useMemo(() => {
    const raw = localStorage.getItem('myTeamInfo')
    if (!raw) {
      return { name: 'GUEST', points: 1000 }
    }
    try {
      return JSON.parse(raw) as StoredTeamInfo
    } catch {
      return { name: 'GUEST', points: 1000 }
    }
  }, [])

  const [myPoints, setMyPoints] = useState(myInfo.points)

  useEffect(() => {
    let isMounted = true
    if (!auctionId) {
      return () => {
        isMounted = false
      }
    }
    window.history.pushState(null, '', window.location.href)
    const blockBack = () => {
      window.history.pushState(null, '', window.location.href)
    }
    window.addEventListener('popstate', blockBack)
    listPlayers()
      .then((data) => {
        if (isMounted) {
          setPlayers(data)
        }
      })
      .catch(() => {})

    getGameState()
      .then((gameState) => {
        if (gameState.phase === 'AUCTION') {
          window.location.hash = '#/captain'
        }
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
        setPlayers(payload.players ?? [])
          const team = payload.teams?.find((t) => t.id === myInfo.id)
          if (team) {
            setMyPoints(team.points)
            localStorage.setItem('myTeamInfo', JSON.stringify(team))
          }
        }
        if (message.event === 'point_change') {
          const payload = message.payload as { teamId: string; newPoints: number }
          if (payload.teamId === myInfo.id) {
            setMyPoints(payload.newPoints)
          }
        }
        if (message.event === 'game_started') {
          window.location.hash = '#/captain'
        }
    }, auctionId)
    return () => {
      isMounted = false
      socket.close()
      window.removeEventListener('popstate', blockBack)
    }
  }, [])

  return (
    <div className="page waiting-page">
      <div className="header">
        <h1>AUCTION WAITING ROOM</h1>
        <div className="status-badge">
          <span className="pulse-dot" />
          WAITING FOR HOST...
        </div>
      </div>

      <div className="content-grid">
        <div className="col-info">
          <div className="panel">
            <h2>MY STATUS</h2>
            <div className="sub-label">TEAM NAME</div>
            <div className="status-name">{myInfo.name}</div>
            <div className="sub-label">STARTING POINTS</div>
            <div className="my-point">{myPoints.toLocaleString()} P</div>
          </div>

          <div className="panel rules-panel">
            <h2>AUCTION RULES</h2>
            <div className="rule-item">1. 호스트 시작 후 경매가 진행됩니다.</div>
            <div className="rule-item">2. 입찰은 10/50/100 단위로 가능합니다.</div>
            <div className="rule-item">3. 낙찰된 선수는 취소할 수 없습니다.</div>
            <div className="rule-item">4. 포인트가 0이면 입찰이 제한됩니다.</div>
          </div>
        </div>

        <div className="col-list">
          <div className="list-header">AUCTION LIST</div>
          <div className="scroll-area">
            {players.length === 0 ? (
              <div className="list-empty">명단이 아직 공개되지 않았습니다.</div>
            ) : (
              players.map((player) => (
                <div key={player.id} className="list-item">
                  <span className="list-name">{player.name}</span>
                  <span className="tier-badges">
                    <span className="list-badge">
                      <img className="role-icon sm" src="/tank_role.webp" alt="Tank" />
                      {player.tiers.tank}
                    </span>
                    <span className="list-badge">
                      <img className="role-icon sm" src="/damage_role.webp" alt="DPS" />
                      {player.tiers.dps}
                    </span>
                    <span className="list-badge">
                      <img className="role-icon sm" src="/support_role.webp" alt="Support" />
                      {player.tiers.supp}
                    </span>
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      <button
        className="sim-btn"
        type="button"
        onClick={() => (window.location.hash = '#/captain')}
      >
        [Dev] Force Start Game
      </button>
    </div>
  )
}
