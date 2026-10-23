import type { ReactNode } from 'react'
import { useGoBack } from '../hooks/useGoBack'
import { BackIcon } from './Icons'

interface Props {
  title: string
  /** Ruta a la que regresar si no hay historial (p. ej. al abrir un enlace directo). */
  backTo?: string
  right?: ReactNode
}

export function PageHeader({ title, backTo, right }: Props) {
  return (
    <header className="sticky top-0 z-10 flex min-h-14 items-center gap-2 bg-slate-100/90 px-4 pt-[env(safe-area-inset-top)] backdrop-blur dark:bg-slate-950/90">
      {backTo && <BackButton fallback={backTo} />}
      <h1
        className="flex-1 truncate text-xl font-bold"
        data-testid="page-title"
      >
        {title}
      </h1>
      {right}
    </header>
  )
}

function BackButton({ fallback }: { fallback: string }) {
  const goBack = useGoBack(fallback)
  return (
    <button
      type="button"
      onClick={goBack}
      className="-ml-2 rounded-full p-2 active:bg-slate-200 dark:active:bg-slate-800"
      aria-label="Regresar"
    >
      <BackIcon />
    </button>
  )
}
