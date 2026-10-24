import { daysBetween } from '../domain/dates'
import { useBackupStatus, useExportBackup } from '../hooks/useBackup'
import { useToday } from '../hooks/useToday'
import { AlertIcon } from './Icons'

/** Aviso en el panel cuando hay cambios sin respaldar desde hace tiempo. */
export function BackupReminder() {
  const today = useToday()
  const { lastBackupDate, shouldRemind } = useBackupStatus()
  const exportBackup = useExportBackup()

  if (!shouldRemind) return null

  const message =
    lastBackupDate === null
      ? 'Aún no has descargado un respaldo de tus datos.'
      : `Tu último respaldo fue hace ${daysBetween(lastBackupDate, today)} días y tienes cambios nuevos.`

  return (
    <section
      className="flex flex-col gap-3 rounded-2xl bg-amber-50 p-4 text-sm text-amber-900 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:ring-amber-900"
      data-testid="backup-reminder"
    >
      <p className="flex gap-2">
        <AlertIcon className="size-5 shrink-0" />
        <span>{message} Tus datos solo viven en este dispositivo.</span>
      </p>
      <button
        type="button"
        onClick={() => void exportBackup()}
        className="self-start rounded-xl bg-amber-600 px-4 py-2 font-semibold text-white active:bg-amber-700"
        data-testid="backup-reminder-download"
      >
        Descargar respaldo
      </button>
    </section>
  )
}
