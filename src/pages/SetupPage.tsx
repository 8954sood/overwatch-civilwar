import { useEffect, useState } from 'react'
import PlayerList from '../components/PlayerList'
import TeamList from '../components/TeamList'
import {
  createPlayer,
  deletePlayer,
  createInvite,
  listPlayers,
  listTeams,
  parseLog,
  startGame,
  updateTeamPoints,
} from '../api/auctionApi'
import { connectAuctionSocket } from '../api/socket'
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
  const [orderType, setOrderType] = useState<'seq' | 'rand'>('seq')
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<Team[]>([])

  const [inviteLink, setInviteLink] = useState('')
  const [inviteCode, setInviteCode] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      window.location.hash = '#/login'
      return
    }
    let isMounted = true
    Promise.all([listPlayers(), listTeams(), createInvite()])
      .then(([playerData, teamData, invite]) => {
        if (!isMounted) return
        setPlayers(playerData)
        setTeams(teamData)
        setInviteLink(invite.link)
        setInviteCode(invite.code)
      })
      .catch(() => {
        localStorage.removeItem('adminToken')
        window.location.hash = '#/login'
      })

    const socket = connectAuctionSocket((message) => {
      if (message.event === 'lobby_update') {
        const payload = message.payload as { players: Player[]; teams: Team[] }
        setPlayers(payload.players ?? [])
        setTeams(payload.teams ?? [])
      }
    })
    return () => {
      isMounted = false
      socket.close()
    }
  }, [])

  const handleAddManual = async () => {
    if (!manualForm.name) {
      return
    }
    try {
      const newPlayer = await createPlayer({
        name: manualForm.name,
        tiers: {
          tank: manualForm.tank || 'N/A',
          dps: manualForm.dps || 'N/A',
          supp: manualForm.supp || 'N/A',
        },
      })
      setPlayers((prev) => {
        if (prev.some((player) => player.id === newPlayer.id)) {
          return prev
        }
        return [...prev, newPlayer]
      })
      setManualForm(initialForm)
    } catch (error) {
      alert(String(error))
    }
  }

  const handleParseLog = async () => {
    if (!logText.trim()) {
      return
    }
    try {
      const parsed = await parseLog(logText)
      const created = await Promise.all(
        parsed.map((entry) => createPlayer(entry)),
      )
      setPlayers((prev) => {
        const seen = new Set(prev.map((player) => player.id))
        const merged = [...prev]
        created.forEach((player) => {
          if (!seen.has(player.id)) {
            seen.add(player.id)
            merged.push(player)
          }
        })
        return merged
      })
      setLogText('')
    } catch (error) {
      alert(String(error))
      return
    }
  }

  const handleRemovePlayer = (id: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== id))
    deletePlayer(id).catch(() => {})
  }

  const handlePointChange = async (teamId: string, points: number) => {
    try {
      const updated = await updateTeamPoints(teamId, points)
      setTeams((prev) =>
        prev.map((team) => (team.id === teamId ? updated : team)),
      )
    } catch (error) {
      alert(String(error))
    }
  }

  const handleCopyInvite = async () => {
    if (!inviteLink) {
      try {
        const invite = await createInvite()
        setInviteLink(invite.link)
        setInviteCode(invite.code)
      } catch {
        alert('초대 링크 발급에 실패했습니다.')
        return
      }
    }
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
                <input
                  type="radio"
                  name="order"
                  checked={orderType === 'seq'}
                  onChange={() => setOrderType('seq')}
                />
                순차 진행
              </label>
              <label>
                <input
                  type="radio"
                  name="order"
                  checked={orderType === 'rand'}
                  onChange={() => setOrderType('rand')}
                />
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
            {inviteCode ? (
              <div className="invite-code">INVITE CODE: {inviteCode}</div>
            ) : null}

            <button
              className="start-btn"
              type="button"
              onClick={async () => {
                try {
                  await startGame({
                    playerList: players.map((player) => ({
                      id: player.id,
                      name: player.name,
                      tiers: player.tiers,
                    })),
                    orderType,
                  })
                  window.location.hash = '#/streamer'
                } catch (error) {
                  alert(String(error))
                }
              }}
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
