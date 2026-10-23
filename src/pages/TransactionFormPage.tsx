import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { ConfirmButton } from '../components/ConfirmButton'
import { Field } from '../components/Field'
import { NotFound } from '../components/NotFound'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/SegmentedControl'
import { ui } from '../components/styles'
import type { Transaction, TransactionInput } from '../data/schema'
import { activeCards, activeCategories } from '../data/selectors'
import { statementCutFor } from '../domain/billing'
import { isValidIsoDate } from '../domain/dates'
import {
  installmentSchedule,
  type InstallmentPayment,
} from '../domain/installments'
import { centsToInputValue, formatMXN, parseMXN } from '../domain/money'
import type { TransactionType } from '../domain/types'
import { useGoBack } from '../hooks/useGoBack'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useToday } from '../hooks/useToday'
import { formatDateWithYear, formatShortDate } from '../lib/format'
import { useGastos } from '../state/gastosContext'

const TYPE_OPTIONS: { value: TransactionType; label: string }[] = [
  { value: 'charge', label: 'Cargo' },
  { value: 'payment', label: 'Pago' },
  { value: 'refund', label: 'Devolución' },
]

const MONTH_CHOICES = [3, 6, 9, 12, 18, 24]
const DEFAULT_PAYMENT_DESCRIPTION = 'Pago a tarjeta'

/** Ruta /movimientos/nuevo o /movimientos/:id */
export function TransactionFormPage() {
  const { id } = useParams()
  const { data } = useGastos()
  const existing = id
    ? data.transactions.find((t) => t.id === id && t.deletedAt === null)
    : undefined

  if (id && !existing) {
    return (
      <NotFound
        message="Este movimiento no existe o fue eliminado."
        backTo="/movimientos"
      />
    )
  }
  // `key` reinicia el estado del formulario si cambia el movimiento a editar.
  return <TransactionForm key={id ?? 'new'} existing={existing} />
}

type Errors = Partial<
  Record<'amount' | 'description' | 'date' | 'months' | 'form', string>
>

function TransactionForm({ existing }: { existing?: Transaction }) {
  const today = useToday()
  const { data, mutate } = useGastos()
  const { card: selected } = useSelectedCard()
  const goBack = useGoBack('/movimientos')
  const cards = activeCards(data)

  const [cardId, setCardId] = useState(existing?.cardId ?? selected.id)
  const [type, setType] = useState<TransactionType>(existing?.type ?? 'charge')
  const [amountText, setAmountText] = useState(
    existing ? centsToInputValue(existing.amountCents) : '',
  )
  const [description, setDescription] = useState(existing?.description ?? '')
  const [date, setDate] = useState(existing?.date ?? today)
  const [categoryId, setCategoryId] = useState(existing?.categoryId ?? 'other')
  const [isInstallments, setIsInstallments] = useState(
    Boolean(existing?.installments),
  )
  const [monthsText, setMonthsText] = useState(
    String(existing?.installments?.months ?? 12),
  )
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const card = cards.find((c) => c.id === cardId) ?? selected
  const amountCents = parseMXN(amountText)
  const months = Number(monthsText)
  const usesInstallments = type === 'charge' && isInstallments

  function validate(): { input?: TransactionInput; errors: Errors } {
    const found: Errors = {}
    if (amountCents === null || amountCents <= 0)
      found.amount = 'Escribe un monto válido, p. ej. 1,250.50'
    if (type !== 'payment' && !description.trim())
      found.description = 'Escribe el comercio o concepto'
    if (!isValidIsoDate(date)) found.date = 'Elige una fecha válida'
    if (
      usesInstallments &&
      (!Number.isInteger(months) || months < 2 || months > 48)
    ) {
      found.months = 'Los meses deben ser entre 2 y 48'
    }
    if (Object.keys(found).length > 0 || amountCents === null)
      return { errors: found }

    return {
      errors: {},
      input: {
        cardId: card.id,
        type,
        date,
        amountCents,
        description: description.trim() || DEFAULT_PAYMENT_DESCRIPTION,
        categoryId: type === 'payment' ? null : categoryId,
        installments: usesInstallments ? { months } : null,
      },
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const { input, errors: found } = validate()
    setErrors(found)
    if (!input) return

    setSaving(true)
    try {
      await mutate((repo) =>
        existing
          ? repo.updateTransaction(existing.id, input)
          : repo.createTransaction(input),
      )
      goBack()
    } catch {
      setErrors({
        form: 'No se pudo guardar. Revisa los datos e intenta de nuevo.',
      })
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    goBack()
    await mutate((repo) => repo.deleteTransaction(existing.id))
  }

  // Ayudas en vivo: en qué estado entra el movimiento y cómo quedan las mensualidades.
  const statementHint =
    type !== 'payment' && isValidIsoDate(date)
      ? `Entra en el estado que corta el ${formatShortDate(statementCutFor(date, card))}`
      : undefined

  const schedule =
    usesInstallments &&
    amountCents &&
    months >= 2 &&
    months <= 48 &&
    isValidIsoDate(date)
      ? installmentSchedule(date, amountCents, months, card)
      : null

  return (
    <>
      <PageHeader
        title={existing ? 'Editar movimiento' : 'Nuevo movimiento'}
        backTo="/movimientos"
      />
      <form
        onSubmit={(e) => void handleSubmit(e)}
        className="space-y-5 px-4 pb-10"
        noValidate
      >
        <SegmentedControl
          label="Tipo de movimiento"
          options={TYPE_OPTIONS}
          value={type}
          onChange={setType}
          testId="transaction-type"
        />

        <Field label="Monto (MXN)" htmlFor="amount" error={errors.amount}>
          <input
            id="amount"
            inputMode="decimal"
            autoComplete="off"
            placeholder="0.00"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className={`${ui.input} text-2xl font-semibold tabular-nums ${errors.amount ? ui.inputError : ''}`}
            autoFocus={!existing}
          />
        </Field>

        <Field
          label={
            type === 'payment' ? 'Concepto (opcional)' : 'Comercio o concepto'
          }
          htmlFor="description"
          error={errors.description}
        >
          <input
            id="description"
            maxLength={80}
            placeholder={
              type === 'payment'
                ? DEFAULT_PAYMENT_DESCRIPTION
                : 'p. ej. Supermercado'
            }
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${ui.input} ${errors.description ? ui.inputError : ''}`}
          />
        </Field>

        <Field
          label="Fecha"
          htmlFor="date"
          error={errors.date}
          hint={statementHint}
        >
          <input
            id="date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className={`${ui.input} ${errors.date ? ui.inputError : ''}`}
          />
        </Field>

        {type !== 'payment' && (
          <Field label="Categoría" htmlFor="category">
            <select
              id="category"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className={ui.input}
            >
              {activeCategories(data).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.icon} {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {cards.length > 1 && (
          <Field label="Tarjeta" htmlFor="card">
            <select
              id="card"
              value={cardId}
              onChange={(e) => setCardId(e.target.value)}
              className={ui.input}
            >
              {cards.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </Field>
        )}

        {type === 'charge' && (
          <div className={`${ui.card} space-y-4`}>
            <label className="flex items-center justify-between gap-3">
              <span className="font-medium">A meses sin intereses</span>
              <input
                type="checkbox"
                checked={isInstallments}
                onChange={(e) => setIsInstallments(e.target.checked)}
                className="size-6 accent-indigo-600"
                data-testid="installments-toggle"
              />
            </label>

            {isInstallments && (
              <Field
                label="Número de meses"
                htmlFor="months"
                error={errors.months}
              >
                <div className="flex flex-wrap gap-2">
                  {MONTH_CHOICES.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMonthsText(String(m))}
                      className={`rounded-full px-3 py-1.5 text-sm font-medium ${
                        months === m
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-200 dark:bg-slate-800'
                      }`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
                <input
                  id="months"
                  inputMode="numeric"
                  value={monthsText}
                  onChange={(e) => setMonthsText(e.target.value)}
                  className={`${ui.input} ${errors.months ? ui.inputError : ''}`}
                />
              </Field>
            )}

            {schedule && <InstallmentsPreview schedule={schedule} />}
          </div>
        )}

        {errors.form && (
          <p className="text-sm text-red-600 dark:text-red-400" role="alert">
            {errors.form}
          </p>
        )}

        <button
          type="submit"
          className={ui.buttonPrimary}
          disabled={saving}
          data-testid="save-transaction"
        >
          {existing ? 'Guardar cambios' : 'Guardar'}
        </button>

        {existing && (
          <ConfirmButton
            label="Eliminar movimiento"
            confirmLabel="Sí, eliminar"
            warning="El movimiento dejará de contar en tus saldos."
            onConfirm={handleDelete}
            testId="delete-transaction"
          />
        )}
      </form>
    </>
  )
}

/** "12 mensualidades de $1,000.00. La primera se cobra en el corte del…" */
function InstallmentsPreview({ schedule }: { schedule: InstallmentPayment[] }) {
  const first = schedule[0]
  const last = schedule[schedule.length - 1]
  // El residuo de centavos se suma a las primeras mensualidades.
  const largerCount = schedule.filter(
    (p) => p.amountCents !== last.amountCents,
  ).length

  return (
    <p className={ui.muted} data-testid="installments-preview">
      {schedule.length} mensualidades de {formatMXN(last.amountCents)}
      {largerCount === 1 && ` (la primera de ${formatMXN(first.amountCents)})`}
      {largerCount > 1 &&
        ` (las primeras ${largerCount} de ${formatMXN(first.amountCents)})`}
      . La primera se cobra en el corte del {formatShortDate(first.cutDate)} y
      la última en el del {formatDateWithYear(last.cutDate)}.
    </p>
  )
}
