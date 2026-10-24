import { backupFileName } from '../data/backup'
import { firstUnsavedChangeAt } from '../data/selectors'
import { needsBackupReminder } from '../domain/backupReminder'
import { downloadTextFile } from '../lib/download'
import { todayInMexico } from '../lib/today'
import { useGastos } from '../state/gastosContext'
import { useToday } from './useToday'

/** Regresa una función que descarga el respaldo y registra la fecha. */
export function useExportBackup(): () => Promise<void> {
  const today = useToday()
  const { mutate } = useGastos()

  return async () => {
    const json = await mutate((repo) => repo.exportBackup())
    downloadTextFile(backupFileName(today), json)
  }
}

export interface BackupStatus {
  /** Día del último respaldo en la Ciudad de México; null si nunca */
  lastBackupDate: string | null
  shouldRemind: boolean
}

export function useBackupStatus(): BackupStatus {
  const today = useToday()
  const { data } = useGastos()

  // Los instantes se guardan en UTC; para contar días se pasan a fecha de CDMX.
  const toDate = (timestamp: string | null) =>
    timestamp === null ? null : todayInMexico(new Date(timestamp))

  const lastBackupDate = toDate(data.settings.lastBackupAt)
  return {
    lastBackupDate,
    shouldRemind: needsBackupReminder({
      today,
      lastBackupDate,
      firstUnsavedChangeDate: toDate(firstUnsavedChangeAt(data)),
    }),
  }
}
