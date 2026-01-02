import { useEffect, useMemo, useState } from 'react'
import AuctionStage from '../components/AuctionStage'
import BidPanel from '../components/BidPanel'
import LogBox from '../components/LogBox'
import TeamCard from '../components/TeamCard'
import { bid, getGameState, listPlayers, listTeams } from '../api/auctionApi'
import { connectAuctionSocket } from '../api/socket'
import type { GameState, Player, Team } from '../types'
import useSyncedTimer from '../hooks/useSyncedTimer'

export default function CaptainPage() {
  const [pendingAdd, setPendingAdd] = useState(0)
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

  const myTeam = useMemo(() => {
    const raw = localStorage.getItem('myTeamInfo')
    if (raw) {
      try {
        const parsed = JSON.parse(raw) as Team
        return teams.find((team) => team.id === parsed.id) ?? parsed
      } catch {
        return teams[0]
      }
    }
    return teams[0]
  }, [teams])

  const rosterCount = (myTeam?.roster?.length ?? 0) + 1
  const rosterFull = rosterCount >= 5
  const biddingClosed = (state?.timerValue ?? 0) <= 0 || !state?.isTimerRunning

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

    return () => {
      isMounted = false
      socket.close()
    }
  }, [])

  const handleSubmit = async () => {
    const currentBid = state?.currentBid ?? 0
    const total = currentBid + pendingAdd
    if (!myTeam?.id) {
      alert('팀 정보를 찾을 수 없습니다.')
      return
    }
    if (biddingClosed) {
      alert('입찰 시간이 종료되었습니다.')
      return
    }
    if (rosterFull) {
      alert('팀 인원이 가득 찼습니다.')
      return
    }
    if (pendingAdd <= 0) {
      alert('최소 입찰 단위를 선택해 주세요.')
      return
    }
    if (total > (myTeam?.points ?? 0)) {
      alert('잔여 포인트를 초과했습니다.')
      return
    }
    try {
      const nextState = await bid(myTeam.id, pendingAdd)
      setState(nextState)
      setPendingAdd(0)
    } catch (error) {
      alert(String(error))
    }
  }

  return (
    <div className="page auction-page captain-page">
      <div className="col-left">
        <div className="panel scroll-area team-scroll">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>

      <div className="col-center">
        {currentPlayer ? (
          <AuctionStage
            player={currentPlayer}
            currentBid={state?.currentBid ?? 0}
            highBidder={state?.highBidder?.name}
            timerLabel={`TIME: ${displayTimer.toFixed(2)}s`}
          />
        ) : (
          <div className="panel auction-stage">
            <div className="player-name">대기 중</div>
          </div>
        )}
        <div className="bottom-section">
          <LogBox title="LOG" entries={state?.bidHistory ?? []} />
          <BidPanel
            currentBid={state?.currentBid ?? 0}
            pendingAdd={pendingAdd}
            myPoints={myTeam?.points ?? 0}
            rosterFull={rosterFull}
            biddingClosed={biddingClosed}
            onAdd={(amount) => setPendingAdd((prev) => prev + amount)}
            onReset={() => setPendingAdd(0)}
            onSubmit={handleSubmit}
          />
        </div>
      </div>

      <div className="col-right">
        <div className="panel queue-panel">
          <div className="header-title">WAITING LIST</div>
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
