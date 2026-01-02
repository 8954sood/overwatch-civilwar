import { useEffect, useMemo, useState } from 'react'
import './App.css'
import {
  DashboardPage,
  CaptainPage,
  JoinPage,
  LoginPage,
  SetupPage,
  StreamerPage,
  WaitingPage,
} from './pages'

type RouteConfig = {
  element: JSX.Element
  className: string
}

const routes: Record<string, RouteConfig> = {
  '#/login': { element: <LoginPage />, className: 'page-login' },
  '#/dashboard': { element: <DashboardPage />, className: 'page-dashboard' },
  '#/join': { element: <JoinPage />, className: 'page-join' },
  '#/waiting': { element: <WaitingPage />, className: 'page-waiting' },
  '#/setup': { element: <SetupPage />, className: 'page-setup' },
  '#/streamer': { element: <StreamerPage />, className: 'page-streamer' },
  '#/captain': { element: <CaptainPage />, className: 'page-captain' },
}

function App() {
  const [hash, setHash] = useState(() => window.location.hash || '#/login')

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash || '#/login')
    window.addEventListener('hashchange', onHashChange)
    if (!window.location.hash) {
      window.location.hash = '#/login'
    }
    return () => window.removeEventListener('hashchange', onHashChange)
  }, [])

  const baseHash = useMemo(() => hash.split('?')[0], [hash])
  const route = useMemo(
    () => routes[baseHash] ?? routes['#/login'],
    [baseHash],
  )

  return <div className={`app ${route.className}`}>{route.element}</div>
}

export default App
