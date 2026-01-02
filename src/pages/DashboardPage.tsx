import { useEffect, useState } from 'react'
import { createAuction, listAuctions } from '../api/auctionApi'

type AuctionItem = {
  id: string
  title: string
  status: string
  inviteCode: string
  createdAt: string
}

export default function DashboardPage() {
  const [auctions, setAuctions] = useState<AuctionItem[]>([])

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      window.location.hash = '#/login'
      return
    }
    listAuctions()
      .then(setAuctions)
      .catch(() => {
        localStorage.removeItem('adminToken')
        window.location.hash = '#/login'
      })
  }, [])

  const handleCreateAuction = async () => {
    const title = `Auction ${new Date().toLocaleDateString()}`
    try {
      const created = await createAuction(title)
      localStorage.setItem('auctionId', created.id)
      localStorage.setItem('inviteLink', created.inviteLink)
      window.location.hash = '#/setup'
    } catch (error) {
      alert(String(error))
    }
  }

  return (
    <div className="page dashboard-page">
      <header className="header">
        <div className="logo">CHZZK ADMIN</div>
        <div className="user-profile">
          <span>Admin</span>
          <button
            className="logout-btn"
            type="button"
            onClick={() => {
              localStorage.removeItem('adminToken')
              window.location.hash = '#/login'
            }}
          >
            LOGOUT
          </button>
        </div>
      </header>

      <div className="container">
        <div className="section-title">DASHBOARD</div>
        <div className="top-grid">
          <div className="stat-card">
            <div className="stat-label">TOTAL SEASONS</div>
            <div className="stat-value">{auctions.length}</div>
            <div className="stat-trend">+1 this session</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">AVG. BID PRICE</div>
            <div className="stat-value">-</div>
            <div className="stat-trend" style={{ color: '#888' }}>
              Not tracked
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-label">TOTAL PLAYERS</div>
            <div className="stat-value">-</div>
            <div className="stat-trend">Joined History</div>
          </div>

          <button className="action-card" type="button" onClick={handleCreateAuction}>
            <div className="action-icon">+</div>
            <div className="action-text">NEW AUCTION</div>
            <div className="action-sub">새로운 경매 세션 생성</div>
          </button>
        </div>

        <div className="section-title">
          <span>RECENT HISTORY</span>
          <span className="section-sub">최근 5건 표시</span>
        </div>
        <div className="log-panel">
          <div className="log-header">
            <div>DATE</div>
            <div>TITLE (SEASON)</div>
            <div>STATUS</div>
            <div>INVITE</div>
            <div>ID</div>
          </div>
          {auctions.slice(0, 5).map((item) => (
            <div key={item.id} className="log-item">
              <div className="col-date">{new Date(item.createdAt).toLocaleDateString()}</div>
              <div className="col-title">{item.title}</div>
              <div>
                <div
                  className={`status-badge ${
                    item.status === 'DRAFT' ? 'status-live' : 'status-end'
                  }`}
                >
                  {item.status}
                </div>
              </div>
              <div className="col-stat">••••••</div>
              <div className="col-stat">{item.id.slice(0, 6)}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
