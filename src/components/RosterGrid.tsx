import type { Player } from '../types'

type RosterGridProps = {
  roster: Player[]
  maxSlots?: number
  baseFilled?: number
}

export default function RosterGrid({
  roster,
  maxSlots = 5,
  baseFilled = 0,
}: RosterGridProps) {
  return (
    <div className="roster-grid">
      {Array.from({ length: maxSlots }).map((_, index) => {
        const filled = index < roster.length + baseFilled
        return (
          <div key={index} className={`roster-slot ${filled ? 'filled' : ''}`}>
            {filled ? 'P' : ''}
          </div>
        )
      })}
    </div>
  )
}
