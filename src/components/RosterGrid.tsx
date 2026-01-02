import type { Player } from '../types'

type RosterGridProps = {
  roster: Player[]
  maxSlots?: number
}

export default function RosterGrid({ roster, maxSlots = 5 }: RosterGridProps) {
  return (
    <div className="roster-grid">
      {Array.from({ length: maxSlots }).map((_, index) => {
        const filled = index < roster.length
        return (
          <div key={index} className={`roster-slot ${filled ? 'filled' : ''}`}>
            {filled ? 'P' : ''}
          </div>
        )
      })}
    </div>
  )
}
