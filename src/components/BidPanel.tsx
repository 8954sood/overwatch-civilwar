type BidPanelProps = {
  currentBid: number
  pendingAdd: number
  onAdd: (amount: number) => void
  onReset: () => void
  onSubmit: () => void
  myPoints: number
  rosterFull?: boolean
  biddingClosed?: boolean
  lockedByTeam?: boolean
}

export default function BidPanel({
  currentBid,
  pendingAdd,
  onAdd,
  onReset,
  onSubmit,
  myPoints,
  rosterFull = false,
  biddingClosed = false,
  lockedByTeam = false,
}: BidPanelProps) {
  const total = currentBid + pendingAdd
  const canBid =
    pendingAdd > 0 &&
    total <= myPoints &&
    !rosterFull &&
    !biddingClosed &&
    !lockedByTeam

  return (
    <div className="panel control-panel">
      <div>
        <div className="my-point-display">
          <span>잔여 포인트</span>
          <span className="my-point-val">{myPoints.toLocaleString()}</span>
        </div>

        <div className="pending-bid-box">
          입찰 예정 금액:
          <span className="pending-val">{total.toLocaleString()}</span>
          <span className="pending-sub"> (현재가 + {pendingAdd})</span>
        </div>

        <div className="btn-grid">
          <button className="btn" onClick={() => onAdd(10)}>
            +10
          </button>
          <button className="btn" onClick={() => onAdd(50)}>
            +50
          </button>
          <button className="btn" onClick={() => onAdd(100)}>
            +100
          </button>
          <button className="btn reset" onClick={onReset}>
            RESET
          </button>
        </div>
      </div>
      <button className="btn-bid" onClick={onSubmit} disabled={!canBid}>
        {canBid ? `${total.toLocaleString()} 포인트로 입찰` : '금액을 추가하세요'}
      </button>
      {!canBid && rosterFull ? (
        <div className="bid-warning">팀 인원이 가득 찼습니다.</div>
      ) : null}
      {!canBid && biddingClosed ? (
        <div className="bid-warning">입찰 시간이 종료되었습니다.</div>
      ) : null}
      {!canBid && lockedByTeam ? (
        <div className="bid-warning">연속 입찰은 불가능합니다.</div>
      ) : null}
      {!canBid && pendingAdd > 0 && !rosterFull ? (
        <div className="bid-warning">잔여 포인트를 초과했습니다.</div>
      ) : null}
    </div>
  )
}
