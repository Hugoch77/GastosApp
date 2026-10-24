/**
 * "Compartir" texto a la app desde otra (Web Share Target, Android).
 *
 * El manifest (`share_target` en vite.config.ts) le pide al sistema abrir
 * `./?compartido-texto=...`. Las rutas de la app viven en el hash, así que antes de
 * montar React se convierte esa URL en la del formulario prellenado:
 * `./#/movimientos/nuevo?texto=...`.
 */

/** Deben coincidir con `share_target.params` de vite.config.ts. */
export const SHARE_PARAMS = {
  title: 'compartido-titulo',
  text: 'compartido-texto',
  url: 'compartido-enlace',
} as const

/**
 * Junta lo compartido en un solo texto. Cada app llena los campos distinto:
 * unas mandan todo en `text`, otras repiten lo mismo en `title` o lo ponen en `url`.
 */
export function sharedText(params: URLSearchParams): string {
  const title = params.get(SHARE_PARAMS.title)?.trim() ?? ''
  const text = params.get(SHARE_PARAMS.text)?.trim() ?? ''
  const url = params.get(SHARE_PARAMS.url)?.trim() ?? ''

  // El enlace solo se usa si no llegó nada más (suele ser una página web, no un gasto).
  const parts = [title, text].filter(Boolean)
  if (parts.length === 0) return url
  // Si un campo ya contiene al otro, no se repite.
  if (parts.length === 2 && (text.includes(title) || title.includes(text)))
    return title.length >= text.length ? title : text
  return parts.join(' ')
}

/**
 * URL del formulario a la que hay que ir si la app se abrió desde "Compartir";
 * `null` si se abrió de forma normal.
 */
export function shareTargetRedirect(url: URL): string | null {
  const isShare = Object.values(SHARE_PARAMS).some((name) =>
    url.searchParams.has(name),
  )
  if (!isShare) return null

  const text = sharedText(url.searchParams)
  const form = text
    ? `#/movimientos/nuevo?texto=${encodeURIComponent(text)}`
    : '#/movimientos/nuevo'
  // Se conserva la carpeta (p. ej. /GastosApp/) y se quitan los parámetros.
  return url.pathname + form
}
