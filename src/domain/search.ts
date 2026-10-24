/** Búsqueda de texto tolerante a mayúsculas y acentos ("cafe" encuentra "Café"). */

export function normalizeText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

/** true si `text` contiene todas las palabras de `query` (en cualquier orden). */
export function matchesQuery(text: string, query: string): boolean {
  const haystack = normalizeText(text)
  return normalizeText(query)
    .split(/\s+/)
    .filter(Boolean)
    .every((word) => haystack.includes(word))
}
