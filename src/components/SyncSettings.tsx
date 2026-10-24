import { useState, type FormEvent } from 'react'
import { useToday } from '../hooks/useToday'
import { formatTimestamp } from '../lib/format'
import { useSync } from '../state/syncContext'
import { ConfirmButton } from './ConfirmButton'
import { Field } from './Field'
import { ui } from './styles'

/** Nombre sugerido para reconocer la sesión en la lista del servidor. */
function guessDeviceName(userAgent: string): string {
  return /Android|iPhone|iPad|Mobile/i.test(userAgent)
    ? 'Celular'
    : 'Computadora'
}

/** Inicio de sesión o estado de la sincronización (Ajustes y Bienvenida). */
export function SyncSettings() {
  const { session } = useSync()
  return session ? <SyncStatusPanel /> : <LoginForm />
}

function LoginForm() {
  const { login, error: syncError } = useSync()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [deviceName, setDeviceName] = useState(() =>
    guessDeviceName(navigator.userAgent),
  )
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      await login(email, password, deviceName.trim())
    } catch (caught) {
      setError(
        caught instanceof Error ? caught.message : 'No se pudo iniciar sesión',
      )
      setSubmitting(false)
    }
  }

  // Un error de sincronización sin sesión = la sesión expiró o se cerró en otro lado.
  const message = error ?? syncError

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className={`${ui.card} space-y-4`}
      data-testid="sync-login-form"
    >
      <p className={ui.muted}>
        Inicia sesión para usar los mismos datos en tu celular y tu computadora.
      </p>
      <Field label="Correo" htmlFor="sync-email">
        <input
          id="sync-email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={ui.input}
        />
      </Field>
      <Field label="Contraseña" htmlFor="sync-password">
        <input
          id="sync-password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className={ui.input}
        />
      </Field>
      <Field
        label="Nombre de este dispositivo"
        htmlFor="sync-device"
        hint="Para reconocerlo, p. ej. “Celular” o “Computadora”."
      >
        <input
          id="sync-device"
          maxLength={60}
          value={deviceName}
          onChange={(e) => setDeviceName(e.target.value)}
          className={ui.input}
        />
      </Field>

      {message && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
          data-testid="sync-login-error"
        >
          {message}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className={ui.buttonPrimary}
        data-testid="sync-login"
      >
        {submitting ? 'Conectando…' : 'Iniciar sesión'}
      </button>
      {submitting && (
        <p className={ui.muted}>
          Si el servidor estaba dormido puede tardar hasta un minuto.
        </p>
      )}
    </form>
  )
}

function SyncStatusPanel() {
  const today = useToday()
  const { session, status, error, pendingChanges, syncNow, logout, logoutAll } =
    useSync()
  const [logoutAllError, setLogoutAllError] = useState<string | null>(null)
  if (!session) return null

  let statusText: string
  if (status === 'syncing') {
    statusText = 'Sincronizando…'
  } else if (status === 'error' && error) {
    statusText = error
  } else if (session.lastSyncAt) {
    statusText = `Última sincronización: ${formatTimestamp(session.lastSyncAt, today)}`
  } else {
    statusText = 'Aún no se sincroniza.'
  }

  async function handleLogoutAll() {
    setLogoutAllError(null)
    try {
      await logoutAll()
    } catch (caught) {
      setLogoutAllError(
        caught instanceof Error ? caught.message : 'No se pudo cerrar sesión',
      )
    }
  }

  return (
    <div className="space-y-3">
      <div className={`${ui.card} space-y-1`} data-testid="sync-account">
        <p className="font-medium">{session.email}</p>
        <p className={ui.muted}>Este dispositivo: {session.deviceName}</p>
        <p
          className={`text-sm ${
            status === 'error'
              ? 'text-amber-700 dark:text-amber-400'
              : 'text-slate-500 dark:text-slate-400'
          }`}
          data-testid="sync-status"
          data-status={status}
        >
          {statusText}
        </p>
        {pendingChanges > 0 && status !== 'syncing' && (
          <p className={ui.muted} data-testid="sync-pending">
            {pendingChanges === 1
              ? '1 cambio por subir'
              : `${pendingChanges} cambios por subir`}
          </p>
        )}
      </div>

      <button
        type="button"
        disabled={status === 'syncing'}
        onClick={() => void syncNow()}
        className={ui.buttonPrimary}
        data-testid="sync-now"
      >
        Sincronizar ahora
      </button>
      <button
        type="button"
        onClick={() => void logout()}
        className={ui.buttonSecondary}
        data-testid="sync-logout"
      >
        Cerrar sesión en este dispositivo
      </button>
      <ConfirmButton
        label="Cerrar sesión en todos los dispositivos"
        confirmLabel="Sí, cerrar todas"
        warning="Tendrás que volver a iniciar sesión en cada dispositivo. Úsalo si perdiste tu celular. Tus datos no se borran."
        onConfirm={handleLogoutAll}
        testId="sync-logout-all"
      />
      {logoutAllError && (
        <p
          role="alert"
          className="text-sm text-red-600 dark:text-red-400"
          data-testid="sync-logout-all-error"
        >
          {logoutAllError}
        </p>
      )}
    </div>
  )
}
