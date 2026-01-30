type EnvKey = 'VITE_API_URL' | 'VITE_WS_URL' | 'VITE_APP_URL'

const getEnv = (key: EnvKey) => {
  const value = import.meta.env[key]
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`)
  }
  return value.toString()
}

export const API_BASE = getEnv('VITE_API_URL')
export const WS_BASE = getEnv('VITE_WS_URL')
export const APP_BASE = getEnv('VITE_APP_URL').replace(/\/+$/, '')
