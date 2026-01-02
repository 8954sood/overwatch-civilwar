import { useEffect, useMemo, useState } from 'react'
import AuctionStage from '../components/AuctionStage'
import BidPanel from '../components/BidPanel'
import LogBox from '../components/LogBox'
import RosterGrid from '../components/RosterGrid'
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

  const displayTeams = useMemo(
    () =>
      teams.map((team) => ({
        ...team,
        isMe: team.id === myTeam?.id,
      })),
    [teams, myTeam?.id],
  )

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
          {displayTeams.map((team) => (
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
        ) : state?.phase === 'ENDED' ? (
          <div className="panel auction-stage final-rosters">
            <div className="stage-label">FINAL TEAMS</div>
            <div className="final-roster-grid scroll-area">
              {teams.map((team) => (
                <div key={team.id} className="final-team-card">
                  <div className="final-team-header">
                    <div className="final-team-name">{team.name}</div>
                    <div className="final-team-captain">{team.captainName}</div>
                  </div>
                  <RosterGrid roster={team.roster} baseFilled={1} />
                  <div className="final-team-list">
                    <div className="final-team-player captain">
                      {team.captainName} (Captain)
                    </div>
                    {team.roster.map((player) => (
                      <div key={player.id} className="final-team-player">
                        {player.name}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="panel auction-stage">
            <div className="stage-label">CAPTAIN VIEW</div>
            <div className="player-name">WAITING</div>
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
