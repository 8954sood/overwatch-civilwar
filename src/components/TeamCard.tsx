import { useEffect, useState } from 'react'
import type { Team } from '../types'
import RosterGrid from './RosterGrid'

type TeamCardProps = {
  team: Team
  showRoster?: boolean
  editablePoints?: boolean
  onPointChange?: (teamId: string, points: number) => void
}

export default function TeamCard({
  team,
  showRoster = true,
  editablePoints = false,
  onPointChange,
}: TeamCardProps) {
  const [draftPoints, setDraftPoints] = useState(team.points)

  useEffect(() => {
    setDraftPoints(team.points)
  }, [team.points])

  const handleBlur = () => {
    if (!onPointChange || Number.isNaN(draftPoints)) {
      return
    }
    onPointChange(team.id, draftPoints)
  }

  return (
    <div
      className={`team-card ${team.isMe ? 'my-team' : ''} ${
        showRoster ? '' : 'no-roster'
      }`}
    >
      <div className="team-header">
        <div>
          <div className="team-name">{team.name}</div>
          <div className="team-captain">CAPTAIN {team.captainName}</div>
        </div>
        <div className={`point-container ${editablePoints ? 'editable' : ''}`}>
          <span className="point-view">{team.points} P</span>
          {editablePoints ? (
            <input
              type="number"
              className="point-edit"
              value={draftPoints}
              onChange={(event) => setDraftPoints(Number(event.target.value))}
              onBlur={handleBlur}
            />
          ) : null}
        </div>
      </div>
      {showRoster ? (
        <>
          <RosterGrid roster={team.roster} />
          <div className="roster-details">
            {team.roster.length === 0 ? (
              <div className="roster-empty">Empty</div>
            ) : (
              team.roster.map((player) => (
                <div key={player.id} className="detail-row">
                  <span>{player.name}</span>
                  <span className="detail-tier">
                    T:{player.tiers.tank} D:{player.tiers.dps} H:{player.tiers.supp}
                  </span>
                </div>
              ))
            )}
          </div>
        </>
      ) : null}
    </div>
  )
}
