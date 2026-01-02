import { useMemo, useState } from 'react'
import AuctionStage from '../components/AuctionStage'
import BidPanel from '../components/BidPanel'
import LogBox from '../components/LogBox'
import TeamCard from '../components/TeamCard'
import { mockPlayers, mockTeams } from '../data/mockData'

export default function CaptainPage() {
  const [pendingAdd, setPendingAdd] = useState(0)
  const [currentBid, setCurrentBid] = useState(1200)
  const [logs, setLogs] = useState<string[]>([
    'Connected to Server',
    'TEAM 3 bid 1,200',
  ])

  const currentPlayer = useMemo(() => mockPlayers[0], [])
  const queue = useMemo(() => mockPlayers.slice(1), [])
  const myTeam = useMemo(
    () => mockTeams.find((team) => team.isMe) ?? mockTeams[0],
    [],
  )

  const handleSubmit = () => {
    const total = currentBid + pendingAdd
    if (pendingAdd <= 0) {
      alert('최소 입찰 단위를 선택해 주세요.')
      return
    }
    if (total > myTeam.points) {
      alert('잔여 포인트를 초과했습니다.')
      return
    }
    setCurrentBid(total)
    setLogs((prev) => [`${myTeam.name} bid ${total.toLocaleString()}`, ...prev])
    setPendingAdd(0)
  }

  return (
    <div className="page auction-page captain-page">
      <div className="col-left">
        <div className="panel scroll-area team-scroll">
          {mockTeams.map((team) => (
            <TeamCard key={team.id} team={team} />
          ))}
        </div>
      </div>

      <div className="col-center">
        <AuctionStage
          player={currentPlayer}
          currentBid={currentBid}
          highBidder="TEAM 3"
          timerLabel="TIME: 15.00s"
        />
        <div className="bottom-section">
          <LogBox title="LOG" entries={logs} />
          <BidPanel
            currentBid={currentBid}
            pendingAdd={pendingAdd}
            myPoints={myTeam.points}
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
        </div>
      </div>
    </div>
  )
}
