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
  const lockedByTeam = state?.highBidder?.id === myTeam?.id

  useEffect(() => {
    let isMounted = true
    if (!auctionId) {
      window.location.hash = '#/join'
      return () => {
        isMounted = false
      }
    }
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
    if (lockedByTeam) {
      alert('연속 입찰은 불가능합니다.')
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
            lockedByTeam={lockedByTeam}
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
