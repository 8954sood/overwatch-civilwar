import type { Player } from '../types'

type AuctionStageProps = {
  player: Player
  currentBid: number
  highBidder?: string
  timerLabel?: string
  showStreamerLabel?: boolean
}

export default function AuctionStage({
  player,
  currentBid,
  highBidder,
  timerLabel,
  showStreamerLabel = false,
}: AuctionStageProps) {
  return (
    <div className="panel auction-stage">
      {showStreamerLabel ? (
        <div className="stage-label">STREAMER VIEW</div>
      ) : null}
      {timerLabel ? <div className="stage-timer">{timerLabel}</div> : null}
      <div className="player-name">{player.name}</div>
      <div className="tier-container">
        <div className="tier-card tank">
          <div className="tier-label">
            <img className="role-icon" src="/tank_role.webp" alt="Tank role" />
            TANK
          </div>
          <div className="tier-value">{player.tiers.tank}</div>
        </div>
        <div className="tier-card dps">
          <div className="tier-label">
            <img className="role-icon" src="/damage_role.webp" alt="DPS role" />
            DPS
          </div>
          <div className="tier-value">{player.tiers.dps}</div>
        </div>
        <div className="tier-card supp">
          <div className="tier-label">
            <img className="role-icon" src="/support_role.webp" alt="Support role" />
            SUPP
          </div>
          <div className="tier-value">{player.tiers.supp}</div>
        </div>
      </div>
      <div className="bid-price">{currentBid.toLocaleString()}</div>
      {highBidder ? (
        <div className="bidder-name">최고 입찰자 {highBidder}</div>
      ) : null}
    </div>
  )
}
