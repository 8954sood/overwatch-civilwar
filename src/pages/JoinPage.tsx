import { useEffect, useState } from 'react'
import { joinLobby, validateInvite } from '../api/auctionApi'

const initialTier = { tank: '', dps: '', supp: '' }

export default function JoinPage() {
  const [teamName, setTeamName] = useState('')
  const [captainName, setCaptainName] = useState('')
  const [tiers, setTiers] = useState(initialTier)
  const [inviteCode, setInviteCode] = useState('')
  const [inviteValid, setInviteValid] = useState(false)
  const [inviteChecked, setInviteChecked] = useState(false)

  useEffect(() => {
    const hash = window.location.hash
    const query = hash.includes('?') ? hash.split('?')[1] : ''
    const params = new URLSearchParams(query)
    const fromUrl = params.get('invite')?.toUpperCase()
    const stored = localStorage.getItem('inviteCode')?.toUpperCase()
    const code = fromUrl || stored || ''
    if (!code) {
      setInviteChecked(true)
      return
    }
    validateInvite(code)
      .then((res) => {
        if (res.valid) {
          setInviteCode(code)
          setInviteValid(true)
          localStorage.setItem('inviteCode', code)
          if (res.auctionId) {
            localStorage.setItem('auctionId', res.auctionId)
          }
        } else {
          localStorage.removeItem('inviteCode')
          localStorage.removeItem('auctionId')
        }
      })
      .catch(() => {})
      .finally(() => setInviteChecked(true))
  }, [])

  const handleJoin = async () => {
    if (!teamName || !captainName || !tiers.tank || !tiers.dps || !tiers.supp) {
      alert('모든 정보를 입력해 주세요.')
      return
    }
    if (!inviteValid) {
      alert('유효한 초대 코드가 필요합니다.')
      return
    }
    try {
      const team = await joinLobby({
        teamName,
        captain: captainName,
        tiers,
        inviteCode,
      })
      localStorage.setItem('myTeamInfo', JSON.stringify(team))
      if (team.auctionId) {
        localStorage.setItem('auctionId', team.auctionId)
      }
      window.location.hash = '#/waiting'
    } catch (error) {
      alert(String(error))
    }
  }

  return (
    <div className="page centered join-page">
      <div className="join-container">
        <div className="invite-badge">
          {inviteChecked
            ? inviteValid
              ? `INVITE CODE: ${inviteCode}`
              : 'INVITE CODE: INVALID'
            : 'INVITE CODE: CHECKING...'}
        </div>
        <div className="panel join-panel">
          <h1>AUCTION ENTRY</h1>
          <p className="sub-text">
            팀장으로 경매에 참여하려면
            <br />
            아래 정보를 입력해 주세요.
          </p>
          <div className="form-group">
            <label>TEAM NAME (팀명)</label>
            <input
              type="text"
              placeholder="예) TEAM 감자"
              value={teamName}
              onChange={(event) => setTeamName(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label>CAPTAIN NAME (팀장 닉네임)</label>
            <input
              type="text"
              placeholder="닉네임 입력"
              value={captainName}
              onChange={(event) => setCaptainName(event.target.value)}
            />
          </div>
          <div className="form-group">
            <label>MY TIERS (포지션별 티어)</label>
            <div className="tier-grid">
              <div className="tier-input-box">
                <span className="tier-icon">
                  <img className="role-icon sm" src="/tank_role.webp" alt="Tank" />
                </span>
                <input
                  type="text"
                  placeholder="TANK"
                  value={tiers.tank}
                  onChange={(event) =>
                    setTiers((prev) => ({ ...prev, tank: event.target.value }))
                  }
                />
              </div>
              <div className="tier-input-box">
                <span className="tier-icon">
                  <img className="role-icon sm" src="/damage_role.webp" alt="DPS" />
                </span>
                <input
                  type="text"
                  placeholder="DPS"
                  value={tiers.dps}
                  onChange={(event) =>
                    setTiers((prev) => ({ ...prev, dps: event.target.value }))
                  }
                />
              </div>
              <div className="tier-input-box">
                <span className="tier-icon">
                  <img className="role-icon sm" src="/support_role.webp" alt="Support" />
                </span>
                <input
                  type="text"
                  placeholder="SUPP"
                  value={tiers.supp}
                  onChange={(event) =>
                    setTiers((prev) => ({ ...prev, supp: event.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <button className="btn-join" onClick={handleJoin} disabled={!inviteValid}>
            입장하기 (ENTER)
          </button>
        </div>
        <div className="page-footer">CHZZK OVERWATCH AUCTION SYSTEM</div>
      </div>
    </div>
  )
}
