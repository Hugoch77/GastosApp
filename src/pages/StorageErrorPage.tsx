import { BackupImport } from '../components/BackupImport'
import { ConfirmButton } from '../components/ConfirmButton'
import { AlertIcon } from '../components/Icons'
import { ui } from '../components/styles'
import { STORAGE_KEY } from '../data/localStorageRepository'
import { downloadTextFile } from '../lib/download'
import { useGastosContext } from '../state/gastosContext'

/** Se muestra si los datos guardados no se pueden leer. Nunca los borra sin permiso. */
export function StorageErrorPage({ message }: { message: string }) {
  const { mutate } = useGastosContext()

  function downloadDamagedData() {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? ''
    downloadTextFile('gastosapp-datos-dañados.json', raw)
  }

  return (
    <main className="mx-auto max-w-md space-y-6 px-4 pt-[calc(2rem+env(safe-area-inset-top))] pb-10">
      <header className="space-y-2">
        <h1
          className="flex items-center gap-2 text-2xl font-bold"
          data-testid="page-title"
        >
          <AlertIcon className="size-7 text-amber-500" />
          No pudimos leer tus datos
        </h1>
        <p className={ui.muted}>{message}</p>
      </header>

      <section className="space-y-3">
        <h2 className={ui.sectionTitle}>Recuperar</h2>
        <BackupImport confirmReplace={false} goHomeAfterImport />
        <button
          type="button"
          className={ui.buttonSecondary}
          onClick={downloadDamagedData}
        >
          Descargar copia de los datos dañados
        </button>
      </section>

      <section className="space-y-3">
        <h2 className={ui.sectionTitle}>Empezar de cero</h2>
        <ConfirmButton
          label="Borrar datos y empezar de cero"
          confirmLabel="Sí, borrar todo"
          warning="Se perderán los datos guardados en este dispositivo. Descarga primero una copia si crees que podrías recuperarlos."
          onConfirm={() => mutate((repo) => repo.clearAll())}
          testId="clear-all"
        />
      </section>
    </main>
  )
}
