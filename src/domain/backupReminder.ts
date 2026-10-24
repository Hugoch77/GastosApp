/**
 * Cuándo recordar que se descargue un respaldo.
 *
 * Solo se recuerda si hay cambios que aún no están respaldados y ya pasaron
 * `BACKUP_REMINDER_DAYS` desde el último respaldo (o desde el primer cambio, si nunca
 * se ha descargado uno).
 */
import { daysBetween, type IsoDate } from './dates'

export const BACKUP_REMINDER_DAYS = 14

export interface BackupState {
  today: IsoDate
  /** Día del último respaldo; null si nunca se ha descargado uno */
  lastBackupDate: IsoDate | null
  /** Día del primer cambio sin respaldar; null si todo está respaldado */
  firstUnsavedChangeDate: IsoDate | null
}

export function needsBackupReminder(state: BackupState): boolean {
  if (state.firstUnsavedChangeDate === null) return false
  const since = state.lastBackupDate ?? state.firstUnsavedChangeDate
  return daysBetween(since, state.today) >= BACKUP_REMINDER_DAYS
}
