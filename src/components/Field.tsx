import type { ReactNode } from 'react'
import { ui } from './styles'

interface Props {
  label: string
  htmlFor: string
  error?: string
  hint?: ReactNode
  children: ReactNode
}

/** Etiqueta + campo + mensaje de ayuda o de error. */
export function Field({ label, htmlFor, error, hint, children }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className={ui.label}>
        {label}
      </label>
      {children}
      {error ? (
        <p
          className="text-sm text-red-600 dark:text-red-400"
          data-testid={`${htmlFor}-error`}
        >
          {error}
        </p>
      ) : (
        hint && <p className={ui.muted}>{hint}</p>
      )}
    </div>
  )
}
