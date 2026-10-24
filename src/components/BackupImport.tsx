import { useState, type ChangeEvent } from 'react'
import { useNavigate } from 'react-router'
import { useGastosContext } from '../state/gastosContext'
import { useSync } from '../state/syncContext'
import { ui } from './styles'

interface Props {
  /** Pedir confirmación antes de reemplazar los datos actuales. */
  confirmReplace?: boolean
  /** Ir al panel al terminar (desde la bienvenida o la pantalla de error). */
  goHomeAfterImport?: boolean
}

type Message = { ok: boolean; text: string }

/** Selecciona un archivo JSON de respaldo y lo importa (reemplaza todos los datos). */
export function BackupImport({
  confirmReplace = true,
  goHomeAfterImport = false,
}: Props) {
  const { mutate } = useGastosContext()
  const { requestFullSync } = useSync()
  const navigate = useNavigate()
  const [pendingJson, setPendingJson] = useState<string | null>(null)
  const [message, setMessage] = useState<Message | null>(null)

  async function importJson(json: string) {
    setPendingJson(null)
    const result = await mutate((repo) => repo.importBackup(json))
    // Con sesión, lo importado se combina con la cuenta (gana lo más reciente).
    if (result.ok) requestFullSync()
    if (result.ok && goHomeAfterImport) {
      void navigate('/', { replace: true })
      return
    }
    setMessage(
      result.ok
        ? { ok: true, text: 'Respaldo importado correctamente.' }
        : { ok: false, text: result.error },
    )
  }

  async function handleFile(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    event.target.value = '' // permite volver a elegir el mismo archivo
    if (!file) return

    setMessage(null)
    const json = await file.text()
    if (confirmReplace) {
      setPendingJson(json)
    } else {
      await importJson(json)
    }
  }

  return (
    <div className="space-y-3">
      <label className={`${ui.buttonSecondary} cursor-pointer`}>
        Importar respaldo
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => void handleFile(e)}
          data-testid="import-file"
        />
      </label>

      {pendingJson !== null && (
        <div className="space-y-3 rounded-xl bg-amber-50 p-4 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:ring-amber-900">
          <p className="text-sm text-amber-900 dark:text-amber-100">
            Esto reemplazará <strong>todos</strong> los datos de este
            dispositivo por los del respaldo.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              className={ui.buttonSecondary}
              onClick={() => setPendingJson(null)}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={ui.buttonPrimary}
              onClick={() => void importJson(pendingJson)}
              data-testid="import-confirm"
            >
              Reemplazar
            </button>
          </div>
        </div>
      )}

      {message && (
        <p
          role="status"
          data-testid="import-message"
          className={`text-sm whitespace-pre-wrap ${
            message.ok
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-red-600 dark:text-red-400'
          }`}
        >
          {message.text}
        </p>
      )}
    </div>
  )
}
