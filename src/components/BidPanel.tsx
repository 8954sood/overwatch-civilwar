type BidPanelProps = {
  currentBid: number
  pendingAdd: number
  onAdd: (amount: number) => void
  onReset: () => void
  onSubmit: () => void
  myPoints: number
}

export default function BidPanel({
  currentBid,
  pendingAdd,
  onAdd,
  onReset,
  onSubmit,
  myPoints,
}: BidPanelProps) {
  const total = currentBid + pendingAdd
  const canBid = pendingAdd > 0 && total <= myPoints

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
      {!canBid && pendingAdd > 0 ? (
        <div className="bid-warning">잔여 포인트를 초과했습니다.</div>
      ) : null}
    </div>
  )
}
