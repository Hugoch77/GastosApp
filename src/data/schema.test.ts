import { describe, expect, it } from 'vitest'
import type { Transaction as DomainTransaction } from '../domain/types'
import {
  AppDataSchema,
  TransactionInputSchema,
  type Transaction,
} from './schema'
import { sampleAppData, sampleCard, sampleTransaction } from './testing'

// Verificación en tiempo de compilación (tsc): un movimiento guardado se puede pasar
// directamente a la lógica de dominio. Si los tipos divergen, `npm run typecheck` falla.
const toDomain = (t: Transaction): DomainTransaction => t

function issuesFor(data: unknown): string[] {
  const result = AppDataSchema.safeParse(data)
  return result.success ? [] : result.error.issues.map((i) => i.path.join('.'))
}

describe('AppDataSchema', () => {
  it('acepta datos válidos', () => {
    expect(issuesFor(sampleAppData())).toEqual([])
    expect(toDomain(sampleTransaction()).amountCents).toBe(123456)
  })

  it.each([
    ['monto con decimales', { amountCents: 10.5 }],
    ['monto cero', { amountCents: 0 }],
    ['monto negativo', { amountCents: -100 }],
    ['fecha inexistente', { date: '2026-02-30' }],
    ['fecha con hora', { date: '2026-10-10T10:00:00Z' }],
    ['tipo desconocido', { type: 'cashback' }],
    ['descripción vacía', { description: '   ' }],
    ['MSI de 1 mes', { installments: { months: 1 } }],
    ['MSI en un pago', { type: 'payment', installments: { months: 3 } }],
  ])('rechaza movimiento con %s', (_label, overrides) => {
    const data = sampleAppData({
      transactions: [sampleTransaction(overrides as Partial<Transaction>)],
    })
    expect(issuesFor(data).length).toBeGreaterThan(0)
  })

  it.each([
    ['día de corte 0', { cutDay: 0 }],
    ['día de corte 32', { cutDay: 32 }],
    ['día de pago con decimales', { dueDay: 5.5 }],
  ])('rechaza tarjeta con %s', (_label, overrides) => {
    expect(
      issuesFor(sampleAppData({ cards: [sampleCard(overrides)] })),
    ).toContain(`cards.0.${Object.keys(overrides)[0]}`)
  })

  it('rechaza una versión de esquema distinta', () => {
    expect(issuesFor({ ...sampleAppData(), schemaVersion: 99 })).toContain(
      'schemaVersion',
    )
  })

  it('rechaza ids duplicados', () => {
    const data = sampleAppData({
      transactions: [sampleTransaction(), sampleTransaction()],
    })
    expect(issuesFor(data)).toContain('transactions.1.id')
  })

  it('rechaza referencias a tarjetas o categorías inexistentes', () => {
    const data = sampleAppData({
      transactions: [sampleTransaction({ cardId: 'nope', categoryId: 'nope' })],
    })
    expect(issuesFor(data)).toEqual(
      expect.arrayContaining([
        'transactions.0.cardId',
        'transactions.0.categoryId',
      ]),
    )
  })

  it('rechaza una tarjeta activa borrada', () => {
    const data = sampleAppData({
      cards: [sampleCard({ deletedAt: '2026-10-02T00:00:00.000Z' })],
      transactions: [],
    })
    expect(issuesFor(data)).toContain('settings.activeCardId')
  })

  it('descarta campos desconocidos (p. ej. exportedAt de un respaldo)', () => {
    const parsed = AppDataSchema.parse({ ...sampleAppData(), exportedAt: 'x' })
    expect(parsed).not.toHaveProperty('exportedAt')
  })
})

describe('TransactionInputSchema', () => {
  it('recorta espacios de la descripción', () => {
    const input = TransactionInputSchema.parse({
      cardId: 'card-1',
      date: '2026-10-10',
      description: '  Café  ',
      amountCents: 5500,
      type: 'charge',
      categoryId: 'food',
      installments: null,
    })
    expect(input.description).toBe('Café')
  })
})
