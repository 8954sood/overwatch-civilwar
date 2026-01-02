import type { Player, Team } from '../types'

export const mockPlayers: Player[] = [
  {
    id: 'p1',
    name: 'Player_Genji',
    tiers: { tank: 'Dia 1', dps: 'GM 5', supp: 'Plat 2' },
    status: 'bidding',
  },
  {
    id: 'p2',
    name: 'Runner',
    tiers: { tank: 'D2', dps: 'P1', supp: 'G4' },
    status: 'waiting',
  },
  {
    id: 'p3',
    name: 'Faker',
    tiers: { tank: 'CH', dps: 'CH', supp: 'CH' },
    status: 'waiting',
  },
]

export const mockTeams: Team[] = [
  {
    id: 't1',
    name: 'TEAM 1',
    captainName: 'User1',
    points: 350,
    roster: [
      {
        id: 'p10',
        name: 'A',
        tiers: { tank: 'D', dps: 'G', supp: 'P' },
      },
    ],
  },
  {
    id: 't2',
    name: 'TEAM 2 (Me)',
    captainName: 'Captain2',
    points: 800,
    roster: [],
    isMe: true,
  },
  {
    id: 't3',
    name: 'TEAM 3',
    captainName: 'Captain3',
    points: 1200,
    roster: [
      {
        id: 'p11',
        name: 'Run',
        tiers: { tank: 'G', dps: 'P', supp: 'D' },
      },
    ],
  },
]
