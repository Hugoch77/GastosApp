/**
 * Context de React con los datos de la app.
 *
 * Un Context permite que cualquier componente lea los datos sin pasarlos como props
 * por cada nivel. El provider vive en GastosProvider.tsx; aquí solo el contrato y el hook.
 */
import { createContext, useContext } from 'react'
import type { GastosRepository } from '../data/repository'
import type { AppData } from '../data/schema'

export type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; data: AppData }
  | { status: 'corrupted'; message: string }

export interface GastosContextValue {
  state: LoadState
  /**
   * Ejecuta una operación del repositorio y recarga los datos al terminar.
   * Ej.: `await mutate((repo) => repo.createTransaction(input))`
   */
  mutate: <T>(operation: (repo: GastosRepository) => Promise<T>) => Promise<T>
}

export const GastosContext = createContext<GastosContextValue | null>(null)

export function useGastosContext(): GastosContextValue {
  const value = useContext(GastosContext)
  if (!value) {
    throw new Error('useGastosContext debe usarse dentro de <GastosProvider>')
  }
  return value
}

/** Para pantallas que solo se muestran con los datos ya cargados. */
export function useGastos(): { data: AppData } & Pick<
  GastosContextValue,
  'mutate'
> {
  const { state, mutate } = useGastosContext()
  if (state.status !== 'ready') {
    throw new Error('useGastos se usó antes de que los datos estuvieran listos')
  }
  return { data: state.data, mutate }
}
