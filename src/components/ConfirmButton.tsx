import { useState } from 'react'
import { ui } from './styles'

interface Props {
  label: string
  confirmLabel: string
  warning: string
  onConfirm: () => void | Promise<void>
  testId?: string
}

/** Botón destructivo en dos pasos: primero pide confirmación en la misma pantalla. */
export function ConfirmButton({
  label,
  confirmLabel,
  warning,
  onConfirm,
  testId,
}: Props) {
  const [asking, setAsking] = useState(false)

  if (!asking) {
    return (
      <button
        type="button"
        className={ui.buttonDanger}
        onClick={() => setAsking(true)}
        data-testid={testId}
      >
        {label}
      </button>
    )
  }

  return (
    <div className="space-y-3 rounded-xl bg-red-50 p-4 ring-1 ring-red-200 dark:bg-red-950/40 dark:ring-red-900">
      <p className="text-sm text-red-800 dark:text-red-200">{warning}</p>
      <div className="flex gap-2">
        <button
          type="button"
          className={ui.buttonSecondary}
          onClick={() => setAsking(false)}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="block w-full rounded-xl bg-red-600 px-4 py-3 font-semibold text-white active:bg-red-700"
          onClick={() => void onConfirm()}
          data-testid={testId && `${testId}-confirm`}
        >
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
