/**
 * Cliente HTTP de la API de sincronización (carpeta api/ del repositorio).
 *
 * Toda respuesta se valida con Zod antes de usarse: nunca se guarda en el
 * dispositivo algo que no cumpla el mismo esquema que LocalStorage.
 */
import { z } from 'zod'
import { CardSchema, CategorySchema, TransactionSchema } from './schema'
import type { SyncChanges } from './sync'

/** Dirección de la API publicada; para desarrollo se cambia con VITE_API_URL. */
export const DEFAULT_API_URL = 'https://gastosapp-api-wk0x.onrender.com'

// El servidor gratuito se duerme y tarda hasta ~1 minuto en despertar.
const REQUEST_TIMEOUT_MS = 90_000

/** Credenciales incorrectas o sesión cerrada/expirada (HTTP 401). */
export class SyncAuthError extends Error {}
/** Sin internet o el servidor no respondió a tiempo. */
export class SyncNetworkError extends Error {}
/** El servidor respondió con un error o con datos inválidos. */
export class SyncServerError extends Error {}

const LoginResponseSchema = z.object({ token: z.string().min(1) })
const ErrorResponseSchema = z.object({ detail: z.string() })
const SyncResponseSchema = z.object({
  cursor: z.int().min(0),
  cards: z.array(CardSchema),
  categories: z.array(CategorySchema),
  transactions: z.array(TransactionSchema),
})

export interface SyncResult {
  cursor: number
  changes: SyncChanges
}

export interface SyncApi {
  /** Regresa el token de la sesión nueva. */
  login(email: string, password: string, deviceName: string): Promise<string>
  logout(token: string): Promise<void>
  logoutAll(token: string): Promise<void>
  sync(token: string, cursor: number, changes: SyncChanges): Promise<SyncResult>
}

export function createSyncApi(
  baseUrl: string,
  fetchFn: typeof fetch = (...args) => fetch(...args),
): SyncApi {
  async function request(
    path: string,
    body: unknown,
    token?: string,
  ): Promise<unknown> {
    let response: Response
    try {
      response = await fetchFn(`${baseUrl}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      })
    } catch {
      throw new SyncNetworkError(
        'No se pudo conectar con el servidor. Revisa tu conexión.',
      )
    }

    if (response.status === 204) return null
    const json: unknown = await response.json().catch(() => null)
    if (response.ok) return json

    const detail = ErrorResponseSchema.safeParse(json)
    const message = detail.success ? detail.data.detail : null
    if (response.status === 401) {
      throw new SyncAuthError(message ?? 'Vuelve a iniciar sesión')
    }
    throw new SyncServerError(
      `El servidor respondió con un error (${response.status}).`,
    )
  }

  function parse<T>(schema: z.ZodType<T>, json: unknown): T {
    const result = schema.safeParse(json)
    if (!result.success) {
      throw new SyncServerError('El servidor respondió con datos inválidos.')
    }
    return result.data
  }

  return {
    async login(email, password, deviceName) {
      const json = await request('/auth/login', { email, password, deviceName })
      return parse(LoginResponseSchema, json).token
    },

    async logout(token) {
      await request('/auth/logout', {}, token)
    },

    async logoutAll(token) {
      await request('/auth/logout-all', {}, token)
    },

    async sync(token, cursor, changes) {
      const json = await request('/sync', { cursor, ...changes }, token)
      const { cursor: newCursor, ...remote } = parse(SyncResponseSchema, json)
      return { cursor: newCursor, changes: remote }
    },
  }
}
