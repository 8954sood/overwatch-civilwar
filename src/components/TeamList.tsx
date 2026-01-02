import type { Team } from '../types'

type TeamListProps = {
  teams: Team[]
  onPointChange?: (teamId: string, points: number) => void
}

export default function TeamList({ teams, onPointChange }: TeamListProps) {
  return (
    <div className="half-panel">
      <div className="list-header">
        <span>CONNECTED TEAMS</span>
        <span className="list-sub">실시간 갱신</span>
      </div>
      <div className="scroll-area">
        {teams.map((team) => (
          <div key={team.id} className="list-item">
            <div className="team-row">
              <div>
                <div className="team-name">{team.name}</div>
                <div className="team-captain">캡틴 {team.captainName}</div>
              </div>
              <div className="point-container editable">
                <span className="point-view">{team.points} P</span>
                {onPointChange ? (
                  <input
                    type="number"
                    className="point-edit"
                    defaultValue={team.points}
                    onBlur={(event) =>
                      onPointChange(team.id, Number(event.currentTarget.value))
                    }
                  />
                ) : null}
              </div>
            </div>
          </div>
        ))}
        {teams.length === 0 ? (
          <div className="list-empty">접속 중인 팀이 없습니다.</div>
        ) : null}
      </div>
    </div>
  )
}
