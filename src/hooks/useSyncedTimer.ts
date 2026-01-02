import { useEffect, useRef, useState } from 'react'

export default function useSyncedTimer(
  timerValue: number,
  isRunning: boolean,
) {
  const [display, setDisplay] = useState(timerValue)
  const baseValueRef = useRef(timerValue)
  const baseTimeRef = useRef(performance.now())
  const rafRef = useRef<number | null>(null)

  useEffect(() => {
    baseValueRef.current = timerValue
    baseTimeRef.current = performance.now()
    setDisplay(timerValue)
  }, [timerValue, isRunning])

  useEffect(() => {
    if (!isRunning) {
      return
    }

    const tick = () => {
      const elapsed = (performance.now() - baseTimeRef.current) / 1000
      const next = Math.max(0, baseValueRef.current - elapsed)
      setDisplay(next)
      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [isRunning])

  return display
}
