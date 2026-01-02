import { del, get, patch, post } from './client'
import type { GameState, Player, Team } from '../types'

export type JoinLobbyPayload = {
  teamName: string
  captain: string
  tiers: { tank: string; dps: string; supp: string }
}

export type StartGamePayload = {
  playerList: Array<{ id?: string; name: string; tiers: Player['tiers'] }>
  orderType: 'seq' | 'rand'
}

export function listPlayers() {
  return get<Player[]>('/players')
}

export function listTeams() {
  return get<Team[]>('/teams')
}

export function createPlayer(payload: { name: string; tiers: Player['tiers'] }) {
  return post<Player>('/players', payload)
}

export function deletePlayer(playerId: string) {
  return del<void>(`/players/${playerId}`)
}

export function parseLog(text: string) {
  return post<Array<{ name: string; tiers: Player['tiers'] }>>('/players/parse-log', {
    text,
  })
}

export function joinLobby(payload: JoinLobbyPayload) {
  return post<Team>('/lobby/join', payload)
}

export function adminLogin(id: string, password: string) {
  return post<{ token: string }>('/auth/login', { id, password })
}

export function validateInvite(code: string) {
  return get<{ valid: boolean; auctionId?: string }>(`/invite/validate/${code}`)
}

export function createAuction(title: string) {
  return post<{
    id: string
    title: string
    status: string
    inviteCode: string
    inviteLink: string
    createdAt: string
  }>('/auctions', { title })
}

export function listAuctions() {
  return get<
    Array<{
      id: string
      title: string
      status: string
      inviteCode: string
      createdAt: string
    }>
  >('/auctions')
}

export function getAuction(auctionId: string) {
  return get<{
    id: string
    title: string
    status: string
    inviteCode: string
    createdAt: string
  }>(`/auctions/${auctionId}`)
}

export function updateTeamPoints(teamId: string, points: number) {
  return patch<Team>(`/teams/${teamId}/points`, { points })
}

export function startGame(payload: StartGamePayload) {
  return post<GameState>('/game/start', payload)
}

export function getGameState() {
  return get<GameState>('/game/state')
}

export function bid(teamId: string, amount: number) {
  return post<GameState>('/game/bid', { teamId, amount })
}

export function adminTimer(action: 'start' | 'pause' | 'reset', value?: number) {
  return post<GameState>('/game/admin/timer', { action, value })
}

export function adminDecision(action: 'sold' | 'pass') {
  return post<GameState>('/game/admin/decision', { action })
}
