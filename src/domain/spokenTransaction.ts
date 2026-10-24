/**
 * Convierte una frase dictada en los campos de un movimiento, con reglas simples
 * (sin IA). El resultado solo PRELLENA el formulario: el usuario revisa y guarda.
 *
 * Ejemplos:
 *   "250 en Rappi ayer"              → cargo $250.00, "Rappi", ayer, Comida
 *   "Llantas 9 mil 220 a 6 meses"    → cargo $9,220.00, "Llantas", 6 MSI
 *   "pagué 3,000 a la tarjeta"       → pago $3,000.00
 *   "devolución de 199.90 Amazon el 12 de octubre"
 *
 * Cada paso busca un fragmento (tipo, meses, fecha, monto), lo interpreta y lo quita
 * del texto; lo que sobra es la descripción.
 */
import {
  addDays,
  dayOfWeek,
  isValidIsoDate,
  parseIsoDate,
  shiftMonth,
  toIsoDate,
  type IsoDate,
} from './dates'
import { normalizeText } from './search'
import type { TransactionType } from './types'

export interface SpokenTransaction {
  type: TransactionType
  /** null si no se entendió ningún monto */
  amountCents: number | null
  /** Vacía en pagos (el formulario usa "Pago a tarjeta") */
  description: string
  date: IsoDate
  /** Meses sin intereses; null si es de contado */
  months: number | null
  /** null si no se pudo adivinar */
  categoryId: string | null
}

export interface CategoryOption {
  id: string
  name: string
}

const MONTH_NAMES = [
  'enero',
  'febrero',
  'marzo',
  'abril',
  'mayo',
  'junio',
  'julio',
  'agosto',
  'septiembre',
  'octubre',
  'noviembre',
  'diciembre',
]

// Índice = día de la semana de dayOfWeek() (0 = domingo).
const WEEKDAY_NAMES = [
  'domingo',
  'lunes',
  'martes',
  'miercoles',
  'jueves',
  'viernes',
  'sabado',
]

/** Plazos de MSI que el reconocimiento de voz a veces escribe con letra. */
const MONTH_COUNT_WORDS: Record<string, number> = {
  dos: 2,
  tres: 3,
  seis: 6,
  nueve: 9,
  doce: 12,
  dieciocho: 18,
  veinticuatro: 24,
}

// Mismas palabras clave que tools/excel_to_json.py. Se revisan en orden: la primera
// que aparezca al inicio de una palabra decide la categoría ("interne" → "Internet").
const CATEGORY_KEYWORDS: [categoryId: string, keywords: string[]][] = [
  [
    'food',
    [
      'ubereats',
      'uber eats',
      'rappi',
      'didi food',
      'tacos',
      'comida',
      'pizza',
      'restaurante',
      'cafe',
      'birria',
      'cena',
      'desayuno',
      'sushi',
      'cerveza',
    ],
  ],
  [
    'subscriptions',
    [
      'netflix',
      'spotify',
      'disney',
      'hbo',
      'prime video',
      'game pass',
      'youtube',
      'icloud',
      'antivirus',
    ],
  ],
  ['fuel', ['gasolina']],
  [
    'transport',
    [
      'uber',
      'didi',
      'dott',
      'lime',
      'taxi',
      'caseta',
      'estacionamiento',
      'placas',
      'multa',
      'llantas',
      'carro',
      'bus',
    ],
  ],
  [
    'groceries',
    [
      'walmart',
      'soriana',
      'chedraui',
      'costco',
      'sams',
      'oxxo',
      'super',
      'heb',
    ],
  ],
  [
    'utilities',
    [
      'cfe',
      'luz',
      'agua',
      'interne',
      'telmex',
      'izzi',
      'totalplay',
      'cel',
      'telefono',
      'telcel',
      'recarga',
    ],
  ],
  [
    'health',
    [
      'farmacia',
      'medic',
      'dentalia',
      'dentista',
      'dientes',
      'doctor',
      'hospital',
      'gym',
    ],
  ],
  [
    'entertainment',
    ['steam', 'juego', 'xbox', 'playstation', 'nintendo', 'cine', 'tiktok'],
  ],
  ['clothing', ['shein', 'ropa', 'zapatos', 'tenis']],
  ['home', ['lavadora', 'roomba', 'ferreteria', 'home depot', 'cafetera']],
  ['education', ['maestria', 'curso', 'udemy', 'libro']],
  [
    'travel',
    ['volaris', 'vivaaerobus', 'aeromexico', 'airbnb', 'hotel', 'vuelo'],
  ],
]

/** Palabras de enlace que sobran al inicio o al final de la descripción. */
const CONNECTOR_WORDS =
  'en|de|del|por|para|a|al|el|la|los|las|un|una|unos|unas|con|y'

/** Texto que se va recortando conforme se interpretan sus partes. */
class Remaining {
  text: string

  constructor(text: string) {
    this.text = text
  }

  /** Busca `pattern`; si lo encuentra, lo quita del texto y regresa el match. */
  take(pattern: RegExp): RegExpExecArray | null {
    const match = pattern.exec(this.text)
    if (match) {
      this.text =
        this.text.slice(0, match.index) +
        ' ' +
        this.text.slice(match.index + match[0].length)
    }
    return match
  }
}

// `\b` de JavaScript solo entiende letras ASCII: en "pagué" no ve el final de la
// palabra. Estos límites sí reconocen letras con acento.
const WORD_START = String.raw`(?<![\p{L}\d])`
const WORD_END = String.raw`(?![\p{L}\d])`

/** Alguna de las palabras de `alternatives`; `atStart` = solo al inicio de la frase. */
function word(alternatives: string, atStart = false): RegExp {
  const start = atStart ? String.raw`^\s*` : WORD_START
  return new RegExp(`${start}(${alternatives})${WORD_END}`, 'iu')
}

function extractType(rest: Remaining): TransactionType {
  if (rest.take(word('pago|pagu[eé]|abono|abon[eé]', true))) return 'payment'
  if (rest.take(word('devoluci[oó]n|reembolso'))) return 'refund'
  // Verbos que solo confirman que es un cargo.
  rest.take(word('gast[eé]|compr[eé]|gasto|compra|cargo', true))
  return 'charge'
}

function extractMonths(rest: Remaining): number | null {
  const words = Object.keys(MONTH_COUNT_WORDS).join('|')
  const match =
    rest.take(
      new RegExp(
        `\\b(?:a|en)\\s+(\\d{1,2}|${words})\\s+meses(?:\\s+sin\\s+intereses)?\\b`,
        'i',
      ),
    ) ?? rest.take(/\b(\d{1,2})\s*msi\b/i)
  if (!match) return null

  const raw = match[1].toLowerCase()
  const months = MONTH_COUNT_WORDS[raw] ?? Number(raw)
  return months >= 2 && months <= 48 ? months : null
}

/** Fecha más reciente (hoy o antes) con ese día del mes, opcionalmente de un mes dado. */
function pastDateWithDay(
  today: IsoDate,
  day: number,
  month: number | null,
): IsoDate | null {
  const now = parseIsoDate(today)
  const candidates =
    month === null
      ? // Este mes o los anteriores ("el 31" un 23 de octubre → 31 de agosto).
        Array.from({ length: 12 }, (_, i) =>
          shiftMonth(now.year, now.month, -i),
        )
      : [now.year, now.year - 1].map((year) => ({ year, month }))

  for (const { year, month: m } of candidates) {
    const date = toIsoDate(year, m, day)
    if (isValidIsoDate(date) && date <= today) return date
  }
  return null
}

function extractDate(rest: Remaining, today: IsoDate): IsoDate {
  if (rest.take(/\b(antier|anteayer|antes de ayer)\b/i))
    return addDays(today, -2)
  if (rest.take(/\bayer\b/i)) return addDays(today, -1)
  if (rest.take(/\bhoy\b/i)) return today

  const weekday = rest.take(
    /\bel\s+(lunes|martes|mi[eé]rcoles|jueves|viernes|s[aá]bado|domingo)(\s+pasado)?\b/i,
  )
  if (weekday) {
    const target = WEEKDAY_NAMES.indexOf(normalizeText(weekday[1]))
    let daysBack = (dayOfWeek(today) - target + 7) % 7
    if (daysBack === 0 && weekday[2]) daysBack = 7
    return addDays(today, -daysBack)
  }

  const monthNames = MONTH_NAMES.join('|')
  const dayOfMonth = rest.take(
    new RegExp(`\\bel\\s+(\\d{1,2})(?:\\s+de\\s+(${monthNames}))?\\b`, 'i'),
  )
  if (dayOfMonth) {
    const month = dayOfMonth[2]
      ? MONTH_NAMES.indexOf(dayOfMonth[2].toLowerCase()) + 1
      : null
    return pastDateWithDay(today, Number(dayOfMonth[1]), month) ?? today
  }
  return today
}

function extractAmount(rest: Remaining): number | null {
  // "9 mil 220", "2 mil", "1 mil 500 con 50"
  const thousands = rest.take(
    /\$?\s*(\d{1,3})\s+mil(?:\s+(\d{1,3}))?(?:\s+con\s+(\d{1,2}))?/i,
  )
  if (thousands) {
    const pesos = Number(thousands[1]) * 1000 + Number(thousands[2] ?? 0)
    return pesos * 100 + Number(thousands[3] ?? 0)
  }

  // "$1,250.50", "250", "250 con 50" (con 50 = 50 centavos)
  const plain = rest.take(
    /\$?\s*(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s+con\s+(\d{1,2}))?/,
  )
  if (!plain) return null
  const pesos = Number(plain[1].replace(/,/g, ''))
  const cents = plain[2]
    ? Number(plain[2].padEnd(2, '0'))
    : Number(plain[3] ?? 0)
  const total = pesos * 100 + cents
  return total > 0 ? total : null
}

function cleanDescription(text: string): string {
  const connectors = new RegExp(
    `^(?:(?:${CONNECTOR_WORDS})\\s+)+|(?:\\s+(?:${CONNECTOR_WORDS}))+$`,
    'gi',
  )
  const cleaned = text
    .replace(/\bpesos?\b/gi, ' ')
    .replace(/[.,;:!?¿¡]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(connectors, '')
    .trim()
  return (cleaned.charAt(0).toUpperCase() + cleaned.slice(1)).slice(0, 80)
}

/** true si `keyword` aparece al inicio de una palabra ("cel" sí en "recarga cel", no en "excel"). */
function containsWordStartingWith(text: string, keyword: string): boolean {
  const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(?:^|[^a-z0-9])${escaped}`).test(text)
}

/** Primero, el nombre de una categoría dicho tal cual; luego, palabras clave. */
export function guessCategory(
  text: string,
  categories: CategoryOption[],
): string | null {
  const normalized = normalizeText(text)
  const byName = categories.find((c) =>
    containsWordStartingWith(normalized, normalizeText(c.name)),
  )
  if (byName) return byName.id

  const available = new Set(categories.map((c) => c.id))
  for (const [categoryId, keywords] of CATEGORY_KEYWORDS) {
    if (
      available.has(categoryId) &&
      keywords.some((k) => containsWordStartingWith(normalized, k))
    ) {
      return categoryId
    }
  }
  return null
}

export function parseSpokenTransaction(
  text: string,
  today: IsoDate,
  categories: CategoryOption[],
): SpokenTransaction {
  const rest = new Remaining(text)
  // El orden importa: meses y fecha van antes del monto para que "a 6 meses"
  // o "el 15" no se confundan con la cantidad.
  const type = extractType(rest)
  const months = type === 'charge' ? extractMonths(rest) : null
  const date = extractDate(rest, today)
  const amountCents = extractAmount(rest)
  const description = type === 'payment' ? '' : cleanDescription(rest.text)

  return {
    type,
    amountCents,
    description,
    date,
    months,
    categoryId:
      type === 'payment' ? null : guessCategory(description, categories),
  }
}
