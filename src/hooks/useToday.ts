import { useEffect, useState } from 'react'
import type { IsoDate } from '../domain/dates'
import { todayInMexico } from '../lib/today'

const CHECK_EVERY_MS = 60_000

/**
 * Fecha de hoy (CDMX) que se actualiza sola si la app queda abierta al pasar la
 * medianoche o si vuelve a primer plano otro día (común en una PWA en el celular).
 */
export function useToday(): IsoDate {
  const [today, setToday] = useState(todayInMexico)

  useEffect(() => {
    const refresh = () => setToday(todayInMexico())
    const interval = window.setInterval(refresh, CHECK_EVERY_MS)
    document.addEventListener('visibilitychange', refresh)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', refresh)
    }
  }, [])

  return today
}
