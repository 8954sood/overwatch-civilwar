import { WS_BASE } from './client'

export type AuctionEvent = {
  event: string
  payload: unknown
}

export function connectAuctionSocket(
  onEvent: (event: AuctionEvent) => void,
) {
  const socket = new WebSocket(`${WS_BASE}/ws`)

  socket.addEventListener('message', (message) => {
    try {
      const parsed = JSON.parse(message.data) as AuctionEvent
      onEvent(parsed)
    } catch {
      // Ignore malformed messages.
    }
  })

  return socket
}
