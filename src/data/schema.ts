/**
 * Esquema de los datos guardados (LocalStorage y respaldos JSON).
 *
 * Los tipos de TypeScript se derivan de los esquemas con `z.infer`, así la validación
 * y los tipos nunca se desincronizan.
 */
import { z } from 'zod'
import { isValidIsoDate } from '../domain/dates'

// Mensajes de error de Zod en español.
z.config(z.locales.es())

export const CURRENT_SCHEMA_VERSION = 3

const id = z.string().min(1)
const timestamp = z.iso.datetime()
const isoDate = z.string().refine(isValidIsoDate, {
  error: 'Fecha inválida, se esperaba AAAA-MM-DD',
})
const dayOfMonth = z.int().min(1).max(31)

export const CardSchema = z.object({
  id,
  name: z.string().trim().min(1).max(40),
  cutDay: dayOfMonth,
  /** true: los movimientos del día de corte entran al estado siguiente */
  cutDayInNextPeriod: z.boolean(),
  dueDay: dayOfMonth,
  paymentBufferDays: z.int().min(0).max(10),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
})

export const CategorySchema = z.object({
  id,
  name: z.string().trim().min(1).max(30),
  /** Un emoji; algunos ocupan varias unidades de texto (p. ej. con tono de piel). */
  icon: z.string().trim().min(1).max(16),
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
})

const TransactionFieldsSchema = z.object({
  id,
  cardId: id,
  date: isoDate,
  description: z.string().trim().min(1).max(80),
  /** Siempre positivo; el signo lo da `type`. */
  amountCents: z.int().positive(),
  type: z.enum(['charge', 'payment', 'refund']),
  categoryId: id.nullable(),
  installments: z.object({ months: z.int().min(2).max(48) }).nullable(),
  createdAt: timestamp,
  updatedAt: timestamp,
  deletedAt: timestamp.nullable(),
})

function onlyChargesHaveInstallments(t: {
  type: string
  installments: unknown
}): boolean {
  return t.type === 'charge' || t.installments === null
}
const installmentsRule = {
  error: 'Solo los cargos pueden ser a meses sin intereses',
  path: ['installments'],
}

export const TransactionSchema = TransactionFieldsSchema.refine(
  onlyChargesHaveInstallments,
  installmentsRule,
)

export const SettingsSchema = z.object({
  activeCardId: id.nullable(),
  extraHolidays: z.array(isoDate),
  /** Cuándo se descargó o importó el último respaldo */
  lastBackupAt: timestamp.nullable(),
})

export const AppDataSchema = z
  .object({
    schemaVersion: z.literal(CURRENT_SCHEMA_VERSION),
    settings: SettingsSchema,
    cards: z.array(CardSchema),
    categories: z.array(CategorySchema),
    transactions: z.array(TransactionSchema),
  })
  .superRefine((data, ctx) => {
    const report = (message: string, path: (string | number)[]) =>
      ctx.addIssue({ code: 'custom', message, path })

    for (const key of ['cards', 'categories', 'transactions'] as const) {
      const seen = new Set<string>()
      data[key].forEach((item, index) => {
        if (seen.has(item.id))
          report(`id duplicado: ${item.id}`, [key, index, 'id'])
        seen.add(item.id)
      })
    }

    const cardIds = new Set(data.cards.map((c) => c.id))
    const categoryIds = new Set(data.categories.map((c) => c.id))
    data.transactions.forEach((t, index) => {
      if (!cardIds.has(t.cardId)) {
        report(`tarjeta inexistente: ${t.cardId}`, [
          'transactions',
          index,
          'cardId',
        ])
      }
      if (t.categoryId !== null && !categoryIds.has(t.categoryId)) {
        report(`categoría inexistente: ${t.categoryId}`, [
          'transactions',
          index,
          'categoryId',
        ])
      }
    })

    const { activeCardId } = data.settings
    const activeCard = data.cards.find((c) => c.id === activeCardId)
    if (
      activeCardId !== null &&
      (!activeCard || activeCard.deletedAt !== null)
    ) {
      report(`tarjeta activa inexistente: ${activeCardId}`, [
        'settings',
        'activeCardId',
      ])
    }
  })

/** Lo que el usuario captura al crear o editar una tarjeta. */
export const CardInputSchema = CardSchema.pick({
  name: true,
  cutDay: true,
  cutDayInNextPeriod: true,
  dueDay: true,
  paymentBufferDays: true,
})

/** Lo que el usuario captura al crear o editar una categoría. */
export const CategoryInputSchema = CategorySchema.pick({
  name: true,
  icon: true,
})

/** Lo que el usuario captura al crear o editar un movimiento. */
export const TransactionInputSchema = TransactionFieldsSchema.pick({
  cardId: true,
  date: true,
  description: true,
  amountCents: true,
  type: true,
  categoryId: true,
  installments: true,
}).refine(onlyChargesHaveInstallments, installmentsRule)

export type Card = z.infer<typeof CardSchema>
export type Category = z.infer<typeof CategorySchema>
export type Transaction = z.infer<typeof TransactionSchema>
export type Settings = z.infer<typeof SettingsSchema>
export type AppData = z.infer<typeof AppDataSchema>
export type CardInput = z.infer<typeof CardInputSchema>
export type CategoryInput = z.infer<typeof CategoryInputSchema>
export type TransactionInput = z.infer<typeof TransactionInputSchema>
