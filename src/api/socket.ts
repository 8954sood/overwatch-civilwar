import { WS_BASE } from './client'

export type AuctionEvent = {
  event: string
  payload: unknown
}

export function connectAuctionSocket(
  onEvent: (event: AuctionEvent) => void,
  auctionId?: string,
) {
  const query = auctionId ? `?auctionId=${encodeURIComponent(auctionId)}` : ''
  const socket = new WebSocket(`${WS_BASE}/ws${query}`)

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
