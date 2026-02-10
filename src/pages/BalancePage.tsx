import type { DragEvent } from 'react'
import { useEffect, useMemo, useState } from 'react'
import { parseLog } from '../api/auctionApi'
import type { Player } from '../types'

type ManualForm = {
  name: string
  tank: string
  dps: string
  supp: string
}

type BalanceTeam = {
  id: string
  name: string
  roster: Player[]
}

type DragPayload = {
  playerId: string
  fromTeamId: string | null
}

const TEAM_SIZE = 5
const initialForm: ManualForm = { name: '', tank: '', dps: '', supp: '' }

const tierBases: Array<{ keywords: string[]; value: number }> = [
  { keywords: ['CH', 'CHAMP'], value: 10 },
  { keywords: ['GM', 'GRANDMASTER'], value: 9 },
  { keywords: ['M', 'MASTER'], value: 8 },
  { keywords: ['D', 'DIA', 'DIAMOND'], value: 7 },
  { keywords: ['P', 'PLAT', 'PLATINUM'], value: 6 },
  { keywords: ['G', 'GOLD'], value: 5 },
  { keywords: ['S', 'SILVER'], value: 4 },
  { keywords: ['B', 'BRONZE'], value: 3 },
  { keywords: ['I', 'IRON'], value: 2 },
]

const createId = () => {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

const parseTierValue = (value: string) => {
  const normalized = value.replace(/\s+/g, '').toUpperCase()
  if (!normalized || normalized === 'N/A') {
    return 0
  }
  const base =
    tierBases.find((entry) =>
      entry.keywords.some((keyword) => normalized.startsWith(keyword)),
    )?.value ?? 1
  const divisionMatch = normalized.match(/(\d+)/)
  if (!divisionMatch) {
    return base
  }
  const division = Number(divisionMatch[1])
  if (Number.isNaN(division)) {
    return base
  }
  const normalizedDivision = Math.min(5, Math.max(1, division))
  return base + (6 - normalizedDivision) * 0.1
}

const scorePlayer = (player: Player) => {
  const tank = parseTierValue(player.tiers.tank)
  const dps = parseTierValue(player.tiers.dps)
  const supp = parseTierValue(player.tiers.supp)
  return {
    tank,
    dps,
    supp,
    total: tank + dps + supp,
  }
}

const calculateTeamTotals = (team: BalanceTeam) =>
  team.roster.reduce(
    (totals, player) => {
      const { tank, dps, supp } = scorePlayer(player)
      return {
        tank: totals.tank + tank,
        dps: totals.dps + dps,
        supp: totals.supp + supp,
      }
    },
    { tank: 0, dps: 0, supp: 0 },
  )

const autoBalanceTeams = (players: Player[], teams: BalanceTeam[]) => {
  const teamCount = teams.length
  if (teamCount === 0) {
    return teams
  }
  const totalScores = players.reduce(
    (totals, player) => {
      const { tank, dps, supp } = scorePlayer(player)
      return {
        tank: totals.tank + tank,
        dps: totals.dps + dps,
        supp: totals.supp + supp,
      }
    },
    { tank: 0, dps: 0, supp: 0 },
  )
  const targetTotals = {
    tank: totalScores.tank / teamCount,
    dps: totalScores.dps / teamCount,
    supp: totalScores.supp / teamCount,
  }
  const sortedPlayers = [...players].sort(
    (a, b) => scorePlayer(b).total - scorePlayer(a).total,
  )
  const teamTotals = teams.map(() => ({ tank: 0, dps: 0, supp: 0, count: 0 }))
  const nextTeams = teams.map((team) => ({ ...team, roster: [] as Player[] }))

  sortedPlayers.forEach((player) => {
    const playerScore = scorePlayer(player)
    let bestIndex = -1
    let bestCost = Number.POSITIVE_INFINITY
    teamTotals.forEach((totals, index) => {
      if (totals.count >= TEAM_SIZE) {
        return
      }
      const nextTotals = {
        tank: totals.tank + playerScore.tank,
        dps: totals.dps + playerScore.dps,
        supp: totals.supp + playerScore.supp,
      }
      const cost =
        Math.abs(nextTotals.tank - targetTotals.tank) +
        Math.abs(nextTotals.dps - targetTotals.dps) +
        Math.abs(nextTotals.supp - targetTotals.supp)
      if (cost < bestCost) {
        bestCost = cost
        bestIndex = index
      }
    })
    if (bestIndex === -1) {
      return
    }
    nextTeams[bestIndex].roster.push(player)
    teamTotals[bestIndex] = {
      tank: teamTotals[bestIndex].tank + playerScore.tank,
      dps: teamTotals[bestIndex].dps + playerScore.dps,
      supp: teamTotals[bestIndex].supp + playerScore.supp,
      count: teamTotals[bestIndex].count + 1,
    }
  })

  return nextTeams
}

const getDragPayload = (event: DragEvent<HTMLElement>) => {
  const raw = event.dataTransfer.getData('text/plain')
  if (!raw) {
    return null
  }
  try {
    return JSON.parse(raw) as DragPayload
  } catch {
    return null
  }
}

export default function BalancePage() {
  const [mode, setMode] = useState<'manual' | 'auto'>('manual')
  const [manualForm, setManualForm] = useState(initialForm)
  const [logText, setLogText] = useState('')
  const [players, setPlayers] = useState<Player[]>([])
  const [teams, setTeams] = useState<BalanceTeam[]>([])
  const [teamName, setTeamName] = useState('')

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      window.location.hash = '#/login'
    }
  }, [])

  const assignedPlayerIds = useMemo(() => {
    const ids = new Set<string>()
    teams.forEach((team) => {
      team.roster.forEach((player) => ids.add(player.id))
    })
    return ids
  }, [teams])

  const poolPlayers = useMemo(
    () => players.filter((player) => !assignedPlayerIds.has(player.id)),
    [players, assignedPlayerIds],
  )

  const canAutoBalance = players.length > 0 && players.length % TEAM_SIZE === 0

  const handleAddManual = () => {
    if (!manualForm.name.trim()) {
      return
    }
    const newPlayer: Player = {
      id: createId(),
      name: manualForm.name.trim(),
      tiers: {
        tank: manualForm.tank || 'N/A',
        dps: manualForm.dps || 'N/A',
        supp: manualForm.supp || 'N/A',
      },
    }
    setPlayers((prev) => [...prev, newPlayer])
    setManualForm(initialForm)
  }

  const handleParseLog = async () => {
    if (!logText.trim()) {
      return
    }
    try {
      const parsed = await parseLog(logText)
      setPlayers((prev) => {
        const existing = new Set(prev.map((player) => player.name))
        const next = [...prev]
        parsed.forEach((entry) => {
          if (existing.has(entry.name)) {
            return
          }
          existing.add(entry.name)
          next.push({ id: createId(), name: entry.name, tiers: entry.tiers })
        })
        return next
      })
      setLogText('')
    } catch (error) {
      alert(String(error))
    }
  }

  const handleRemovePlayer = (playerId: string) => {
    setPlayers((prev) => prev.filter((player) => player.id !== playerId))
    setTeams((prev) =>
      prev.map((team) => ({
        ...team,
        roster: team.roster.filter((player) => player.id !== playerId),
      })),
    )
  }

  const handleAddTeam = () => {
    if (!teamName.trim()) {
      return
    }
    setTeams((prev) => [
      ...prev,
      { id: createId(), name: teamName.trim(), roster: [] },
    ])
    setTeamName('')
  }

  const handleAutoBalance = () => {
    if (!canAutoBalance) {
      alert('자동 밸런스는 5의 배수 인원일 때만 가능합니다.')
      return
    }
    const requiredTeams = players.length / TEAM_SIZE
    setTeams((prev) => {
      const nextTeams = [...prev]
      while (nextTeams.length < requiredTeams) {
        nextTeams.push({
          id: createId(),
          name: `TEAM ${nextTeams.length + 1}`,
          roster: [],
        })
      }
      const activeTeams = nextTeams.slice(0, requiredTeams)
      const balancedTeams = autoBalanceTeams(players, activeTeams)
      return nextTeams.map((team, index) =>
        index < requiredTeams ? balancedTeams[index] : { ...team, roster: [] },
      )
    })
  }

  const handleDropToTeam = (
    payload: DragPayload,
    teamId: string,
    targetPlayerId?: string,
  ) => {
    const player = players.find((item) => item.id === payload.playerId)
    if (!player) {
      return
    }
    setTeams((prev) => {
      const nextTeams = prev.map((team) => ({
        ...team,
        roster: [...team.roster],
      }))
      const sourceTeamIndex = payload.fromTeamId
        ? nextTeams.findIndex((team) => team.id === payload.fromTeamId)
        : -1
      const targetTeamIndex = nextTeams.findIndex((team) => team.id === teamId)
      if (targetTeamIndex === -1) {
        return prev
      }
      if (sourceTeamIndex === targetTeamIndex) {
        return prev
      }
      const removeFromSource = () => {
        if (sourceTeamIndex === -1) {
          return
        }
        nextTeams[sourceTeamIndex].roster = nextTeams[
          sourceTeamIndex
        ].roster.filter((member) => member.id !== player.id)
      }

      if (targetPlayerId) {
        const targetIndex = nextTeams[targetTeamIndex].roster.findIndex(
          (member) => member.id === targetPlayerId,
        )
        if (targetIndex === -1) {
          return prev
        }
        const targetPlayer = nextTeams[targetTeamIndex].roster[targetIndex]
        if (sourceTeamIndex !== -1) {
          const sourceIndex = nextTeams[sourceTeamIndex].roster.findIndex(
            (member) => member.id === player.id,
          )
          if (sourceIndex === -1) {
            return prev
          }
          nextTeams[sourceTeamIndex].roster[sourceIndex] = targetPlayer
        }
        nextTeams[targetTeamIndex].roster[targetIndex] = player
        return nextTeams
      }

      if (nextTeams[targetTeamIndex].roster.length >= TEAM_SIZE) {
        return prev
      }
      removeFromSource()
      nextTeams[targetTeamIndex].roster.push(player)
      return nextTeams
    })
  }

  const handleDropToPool = (payload: DragPayload) => {
    if (!payload.fromTeamId) {
      return
    }
    setTeams((prev) =>
      prev.map((team) =>
        team.id === payload.fromTeamId
          ? {
              ...team,
              roster: team.roster.filter((player) => player.id !== payload.playerId),
            }
          : team,
      ),
    )
  }

  return (
    <div className="page setup-page balance-page">
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
        </div>

        <div className="col-right">
          <div className="panel balance-panel">
            <div className="balance-toolbar">
              <div className="balance-actions">
                <div className="balance-team-input">
                  <input
                    type="text"
                    placeholder="팀 이름"
                    value={teamName}
                    onChange={(event) => setTeamName(event.target.value)}
                  />
                  <button className="btn" type="button" onClick={handleAddTeam}>
                    TEAM 추가
                  </button>
                </div>
                <button
                  className="btn auto-balance"
                  type="button"
                  onClick={handleAutoBalance}
                  disabled={!canAutoBalance}
                >
                  자동 밸런스
                </button>
              </div>
              <div className="balance-note">
                자동 밸런스는 5명 단위 인원만 가능합니다.
              </div>
            </div>

            <div className="balance-body">
              <div
                className="balance-pool"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const payload = getDragPayload(event)
                  if (payload) {
                    handleDropToPool(payload)
                  }
                }}
              >
                <div className="balance-section-title">
                  대기 인원 ({poolPlayers.length})
                </div>
                <div className="balance-player-list">
                  {poolPlayers.map((player) => (
                    <div
                      key={player.id}
                      className="balance-player"
                      draggable
                      onDragStart={(event) => {
                        event.dataTransfer.setData(
                          'text/plain',
                          JSON.stringify({ playerId: player.id, fromTeamId: null }),
                        )
                      }}
                    >
                      <div className="balance-player-info">
                        <span className="balance-player-name">{player.name}</span>
                        <span className="balance-player-tiers">
                          T:{player.tiers.tank} D:{player.tiers.dps} H:{player.tiers.supp}
                        </span>
                      </div>
                      <button
                        className="list-remove"
                        type="button"
                        onClick={() => handleRemovePlayer(player.id)}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {poolPlayers.length === 0 ? (
                    <div className="balance-empty">대기 중인 인원이 없습니다.</div>
                  ) : null}
                </div>
              </div>

              <div className="balance-teams">
                {teams.map((team) => {
                  const totals = calculateTeamTotals(team)
                  const balanceScore = totals.tank + totals.dps + totals.supp
                  return (
                    <div
                      key={team.id}
                      className="balance-team-card"
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault()
                        const payload = getDragPayload(event)
                        if (payload) {
                          handleDropToTeam(payload, team.id)
                        }
                      }}
                    >
                      <div className="balance-team-header">
                        <div>
                          <div className="balance-team-name">{team.name}</div>
                          <div className="balance-team-count">
                            {team.roster.length}/{TEAM_SIZE}
                          </div>
                        </div>
                        <div className="balance-team-score">
                          <span className="score-label">BAL</span>
                          <span className="score-value">
                            {balanceScore.toFixed(1)}
                          </span>
                        </div>
                      </div>
                      <div className="balance-roster">
                        {team.roster.map((player) => (
                          <div
                            key={player.id}
                            className="balance-player team-member"
                            draggable
                            onDragStart={(event) => {
                              event.dataTransfer.setData(
                                'text/plain',
                                JSON.stringify({
                                  playerId: player.id,
                                  fromTeamId: team.id,
                                }),
                              )
                            }}
                            onDragOver={(event) => event.preventDefault()}
                            onDrop={(event) => {
                              event.preventDefault()
                              const payload = getDragPayload(event)
                              if (payload) {
                                handleDropToTeam(payload, team.id, player.id)
                              }
                            }}
                          >
                            <div className="balance-player-info">
                              <span className="balance-player-name">{player.name}</span>
                              <span className="balance-player-tiers">
                                T:{player.tiers.tank} D:{player.tiers.dps} H:
                                {player.tiers.supp}
                              </span>
                            </div>
                          </div>
                        ))}
                        {team.roster.length === 0 ? (
                          <div className="balance-empty">드래그로 배정하세요.</div>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
                {teams.length === 0 ? (
                  <div className="balance-empty">팀을 추가해 주세요.</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
