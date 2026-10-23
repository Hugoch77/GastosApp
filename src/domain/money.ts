/**
 * Dinero en centavos (enteros). Nunca se usan flotantes para montos:
 * 0.1 + 0.2 !== 0.3 en JavaScript, pero 10 + 20 === 30 siempre.
 */

const mxnFormatter = new Intl.NumberFormat('es-MX', {
  style: 'currency',
  currency: 'MXN',
})

// "1234.56", "1,234.5", "1234", ".5", "1,234." (sin signo; máximo 2 decimales)
const MXN_INPUT_PATTERN = /^(\d{1,3}(?:,\d{3})+|\d+)?(?:\.(\d{0,2}))?$/

export function assertCents(cents: number): void {
  if (!Number.isSafeInteger(cents)) {
    throw new Error(`Monto inválido, se esperaban centavos enteros: ${cents}`)
  }
}

/** 123456 → "$1,234.56" */
export function formatMXN(cents: number): string {
  assertCents(cents)
  // Dividir entre 100 solo para mostrar es seguro: el resultado no se usa en cálculos.
  return mxnFormatter.format(cents / 100)
}

/**
 * Convierte lo que el usuario escribe a centavos, sin pasar por flotantes.
 * Acepta "$", espacios y comas de miles. Regresa `null` si el texto no es un monto válido.
 */
export function parseMXN(text: string): number | null {
  const cleaned = text.replace(/[$\s]/g, '')
  const match = MXN_INPUT_PATTERN.exec(cleaned)
  if (!match || !/\d/.test(cleaned)) return null

  const pesos = Number((match[1] ?? '0').replace(/,/g, ''))
  const centavos = Number((match[2] ?? '').padEnd(2, '0'))
  const cents = pesos * 100 + centavos
  return Number.isSafeInteger(cents) ? cents : null
}

/** 123456 → "1234.56", para precargar un campo de texto al editar. */
export function centsToInputValue(cents: number): string {
  assertCents(cents)
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const pesos = Math.floor(abs / 100)
  const centavos = String(abs % 100).padStart(2, '0')
  return `${sign}${pesos}.${centavos}`
}
