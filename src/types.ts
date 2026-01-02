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
  roster: Player[]
  isMe?: boolean
}
