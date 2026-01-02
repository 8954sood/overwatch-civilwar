import { useMemo, useState } from 'react'
import PlayerList from '../components/PlayerList'
import TeamList from '../components/TeamList'
import { mockPlayers, mockTeams } from '../data/mockData'
import type { Player, Team } from '../types'

type ManualForm = {
  name: string
  tank: string
  dps: string
  supp: string
}

const initialForm: ManualForm = { name: '', tank: '', dps: '', supp: '' }

export default function SetupPage() {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [manualForm, setManualForm] = useState(initialForm)
  const [logText, setLogText] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>(
    mockTeams.map((team) => ({ ...team, roster: [] })),
  )

  const inviteLink = useMemo(
    () => 'https://chzzk-auction.com/invite/8F2A9C',
    [],
  )

  const handleAddManual = () => {
    if (!manualForm.name) {
      return
    }
    const newPlayer: Player = {
      id: crypto.randomUUID(),
      name: manualForm.name,
      tiers: {
        tank: manualForm.tank || 'N/A',
        dps: manualForm.dps || 'N/A',
        supp: manualForm.supp || 'N/A',
      },
      status: 'waiting',
    }
    setPlayers((prev) => [...prev, newPlayer])
    setManualForm(initialForm)
  }

  const handleParseLog = () => {
    if (!logText.trim()) {
      setPlayers(mockPlayers)
      return
    }
    const parsed = logText
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line, index) => {
        const tokens = line.split(/[\s,\/]+/).filter(Boolean)
        const [name, tank, dps, supp] = tokens
        return {
          id: `log-${index}`,
          name: name ?? `Player ${index + 1}`,
          tiers: {
            tank: tank ?? 'N/A',
            dps: dps ?? 'N/A',
            supp: supp ?? 'N/A',
          },
          status: 'waiting' as const,
        }
      })
    setPlayers(parsed)
  }

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== id))
  }

  const handlePointChange = (teamId: string, points: number) => {
    setTeams((prev) =>
      prev.map((team) => (team.id === teamId ? { ...team, points } : team)),
    )
  }

  const handleCopyInvite = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink)
      alert('초대 링크가 복사되었습니다.')
    } catch {
      alert('복사에 실패했습니다.')
    }
  }

  return (
    <div className="page setup-page">
      <div className="container">
        <div className="col-left">
          <div className="panel">
            <h2>
              ADD PLAYERS
              <span className="panel-sub">등록 방식 선택</span>
            </h2>
            <div className="seg-control">
              <button
                className={`seg-btn ${mode === 'manual' ? 'active' : ''}`}
                type="button"
                onClick={() => setMode('manual')}
              >
                수동 입력
              </button>
              <button
                className={`seg-btn ${mode === 'auto' ? 'active' : ''}`}
                type="button"
                onClick={() => setMode('auto')}
              >
                자동 파싱
              </button>
            </div>

            {mode === 'manual' ? (
              <div className="mode-area active">
                <input
                  type="text"
                  placeholder="이름 (Name)"
                  value={manualForm.name}
                  onChange={(event) =>
                    setManualForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                />
                <div className="inline-inputs">
                  <input
                    type="text"
                    placeholder="탱커 티어"
                    value={manualForm.tank}
                    onChange={(event) =>
                      setManualForm((prev) => ({
                        ...prev,
                        tank: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="딜러 티어"
                    value={manualForm.dps}
                    onChange={(event) =>
                      setManualForm((prev) => ({
                        ...prev,
                        dps: event.target.value,
                      }))
                    }
                  />
                  <input
                    type="text"
                    placeholder="서포터 티어"
                    value={manualForm.supp}
                    onChange={(event) =>
                      setManualForm((prev) => ({
                        ...prev,
                        supp: event.target.value,
                      }))
                    }
                  />
                </div>
                <button className="btn btn-add" onClick={handleAddManual}>
                  추가 (ADD)
                </button>
              </div>
            ) : (
              <div className="mode-area active">
                <textarea
                  placeholder="디스코드 로그 붙여넣기..."
                  value={logText}
                  onChange={(event) => setLogText(event.target.value)}
                />
                <button className="btn btn-add" onClick={handleParseLog}>
                  파싱 & 추가
                </button>
              </div>
            )}
          </div>

          <div className="panel grow">
            <h2>GAME SETTINGS</h2>
            <label className="field-label">진행 방식</label>
            <div className="radio-group">
              <label>
                <input type="radio" name="order" defaultChecked />
                순차 진행
              </label>
              <label>
                <input type="radio" name="order" />
                랜덤 진행
              </label>
            </div>

            <label className="field-label">초대 링크</label>
            <div className="invite-row">
              <input type="text" value={inviteLink} readOnly />
              <button className="btn" type="button" onClick={handleCopyInvite}>
                COPY
              </button>
            </div>

            <button
              className="start-btn"
              type="button"
              onClick={() => (window.location.hash = '#/streamer')}
            >
              START AUCTION
            </button>
          </div>
        </div>

        <div className="col-right">
          <PlayerList players={players} onRemove={handleRemovePlayer} />
          <TeamList teams={teams} onPointChange={handlePointChange} />
        </div>
      </div>
    </div>
  )
}
