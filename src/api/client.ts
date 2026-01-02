const DEFAULT_BASE = 'http://localhost:8000'

export const API_BASE =
  import.meta.env.VITE_API_URL?.toString() ?? DEFAULT_BASE

const DEFAULT_WS = API_BASE.replace(/^http/, 'ws')
export const WS_BASE =
  import.meta.env.VITE_WS_URL?.toString() ?? DEFAULT_WS

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('adminToken')
  const auctionId = localStorage.getItem('auctionId')
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(auctionId ? { 'X-Auction-Id': auctionId } : {}),
      ...(options.headers ?? {}),
    },
    ...options,
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || response.statusText)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json() as Promise<T>
}

export function get<T>(path: string) {
  return request<T>(path)
}

export function post<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function patch<T>(path: string, body?: unknown) {
  return request<T>(path, {
    method: 'PATCH',
    body: body ? JSON.stringify(body) : undefined,
  })
}

export function del<T>(path: string) {
  return request<T>(path, { method: 'DELETE' })
}
