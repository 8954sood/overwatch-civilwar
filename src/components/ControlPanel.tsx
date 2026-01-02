type ControlPanelProps = {
  timerValue: string
  onTimerAction: (action: 'start' | 'pause' | 'reset') => void
  onDecision: (action: 'sold' | 'pass') => void
}

export default function ControlPanel({
  timerValue,
  onTimerAction,
  onDecision,
}: ControlPanelProps) {
  return (
    <div className="panel admin-controls">
      <div>
        <div className="timer-box">{timerValue}</div>
        <div className="timer-ctrl">
          <button className="btn-t" onClick={() => onTimerAction('start')}>
            ▶ START / RESUME
          </button>
          <button className="btn-t" onClick={() => onTimerAction('pause')}>
            ⏸ PAUSE
          </button>
          <button className="btn-t" onClick={() => onTimerAction('reset')}>
            ⟳ RESET
          </button>
        </div>
      </div>
      <div className="btn-group">
        <button className="btn btn-sold" onClick={() => onDecision('sold')}>
          낙찰 (SOLD)
        </button>
        <button className="btn btn-pass" onClick={() => onDecision('pass')}>
          유찰 (PASS)
        </button>
      </div>
    </div>
  )
}
