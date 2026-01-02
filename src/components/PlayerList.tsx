import type { Player } from '../types'

type PlayerListProps = {
  players: Player[]
  onRemove?: (id: string) => void
}

export default function PlayerList({ players, onRemove }: PlayerListProps) {
  return (
    <div className="half-panel">
      <div className="list-header">
        <span>AUCTION LIST</span>
        <span>{players.length} Players</span>
      </div>
      <div className="scroll-area">
        {players.map((player) => (
          <div key={player.id} className="list-item">
            <span className="list-name">{player.name}</span>
            <div className="list-right">
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
              {onRemove ? (
                <button
                  className="list-remove"
                  type="button"
                  onClick={() => onRemove(player.id)}
                >
                  ✕
                </button>
              ) : null}
            </div>
          </div>
        ))}
        {players.length === 0 ? (
          <div className="list-empty">등록된 선수가 없습니다.</div>
        ) : null}
      </div>
    </div>
  )
}
