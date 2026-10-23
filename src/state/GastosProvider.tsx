import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { StorageCorruptedError } from '../data/localStorageRepository'
import type { GastosRepository } from '../data/repository'
import {
  GastosContext,
  type GastosContextValue,
  type LoadState,
} from './gastosContext'

interface Props {
  repository: GastosRepository
  children: ReactNode
}

/** Lee los datos del repositorio y los traduce a un LoadState. */
async function loadState(repository: GastosRepository): Promise<LoadState> {
  try {
    return { status: 'ready', data: await repository.getData() }
  } catch (error) {
    if (error instanceof StorageCorruptedError) {
      return { status: 'corrupted', message: error.message }
    }
    throw error
  }
}

export function GastosProvider({ repository, children }: Props) {
  const [state, setState] = useState<LoadState>({ status: 'loading' })

  // Carga inicial. `cancelled` evita aplicar un resultado si el componente ya se
  // desmontó (React StrictMode monta, desmonta y vuelve a montar en desarrollo).
  useEffect(() => {
    let cancelled = false
    void loadState(repository).then((next) => {
      if (!cancelled) setState(next)
    })
    return () => {
      cancelled = true
    }
  }, [repository])

  const mutate = useCallback<GastosContextValue['mutate']>(
    async (operation) => {
      try {
        return await operation(repository)
      } finally {
        setState(await loadState(repository))
      }
    },
    [repository],
  )

  const value = useMemo(() => ({ state, mutate }), [state, mutate])

  return <GastosContext value={value}>{children}</GastosContext>
}
