export type PlayerTier = {
  tank: string
  dps: string
  supp: string
}

export type Player = {
  id: string
  name: string
  tiers: PlayerTier
  status?: 'waiting' | 'bidding' | 'sold' | 'unsold'
}

export type Team = {
  id: string
  name: string
  captainName: string
  points: number
  captainStats?: PlayerTier
  roster: Player[]
  isMe?: boolean
}

export type TeamSlim = {
  id: string
  name: string
}

export type GameState = {
  phase: 'SETUP' | 'WAITING' | 'AUCTION' | 'ENDED'
  currentPlayer: Player | null
  currentBid: number
  highBidder: TeamSlim | null
  timerValue: number
  isTimerRunning: boolean
  bidHistory: string[]
}
