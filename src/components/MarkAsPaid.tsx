import { useState, type FormEvent } from 'react'
import type { IsoDate } from '../domain/dates'
import { centsToInputValue, formatMXN, parseMXN } from '../domain/money'
import { checkPaymentDate, type PaymentDateCheck } from '../domain/payments'
import { useRecordPayments } from '../hooks/useRecordPayments'
import { useToday } from '../hooks/useToday'
import { formatShortDate } from '../lib/format'
import { Field } from './Field'
import { ui } from './styles'

export interface PaymentToMark {
  cardId: string
  /** Se muestra solo si hay varias tarjetas */
  name: string
  amountCents: number
}

interface Props {
  /** Una tarjeta: el monto se puede cambiar (pago parcial). Varias: montos fijos. */
  payments: PaymentToMark[]
  /** Desde esta fecha el pago cuenta para el estado facturado (inicio del periodo actual). */
  minDate: IsoDate
  label: string
  testId: string
}

function dateError(check: PaymentDateCheck, minDate: IsoDate): string | null {
  switch (check) {
    case 'ok':
      return null
    case 'invalid':
      return 'Elige una fecha válida'
    case 'future':
      return 'La fecha no puede ser posterior a hoy'
    case 'before-cut':
      return `Ese pago es del estado anterior. Elige una fecha desde el ${formatShortDate(minDate)}`
  }
}

/**
 * Atajo "Ya pagué": registra el pago del estado facturado sin ir al formulario completo.
 * Primero muestra un botón; al tocarlo, pide confirmar monto y fecha (hoy por defecto).
 */
export function MarkAsPaid({ payments, minDate, label, testId }: Props) {
  const today = useToday()
  const recordPayments = useRecordPayments()
  const single = payments.length === 1

  const [open, setOpen] = useState(false)
  const [amountText, setAmountText] = useState('')
  const [date, setDate] = useState<string>(today)
  const [errors, setErrors] = useState<{
    amount?: string
    date?: string
    form?: string
  }>({})
  const [saving, setSaving] = useState(false)

  if (payments.length === 0) return null

  if (!open) {
    return (
      <button
        type="button"
        className={ui.buttonPrimary}
        onClick={() => {
          // Al abrir se parte de lo pendiente y de hoy.
          setAmountText(centsToInputValue(payments[0].amountCents))
          setDate(today)
          setErrors({})
          setOpen(true)
        }}
        data-testid={testId}
      >
        {label}
      </button>
    )
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const amountCents = single ? parseMXN(amountText) : null
    const found: typeof errors = {}
    if (single && (amountCents === null || amountCents <= 0)) {
      found.amount = 'Escribe un monto válido, p. ej. 1,250.50'
    }
    const dateMessage = dateError(
      checkPaymentDate(date, today, minDate),
      minDate,
    )
    if (dateMessage) found.date = dateMessage
    setErrors(found)
    if (Object.keys(found).length > 0) return

    const toRecord =
      single && amountCents !== null
        ? [{ cardId: payments[0].cardId, amountCents }]
        : payments
    setSaving(true)
    try {
      await recordPayments(toRecord, date)
      // Al guardar, el panel cambia solo (p. ej. a "Estás al corriente").
      setOpen(false)
    } catch {
      setErrors({ form: 'No se pudo guardar el pago. Intenta de nuevo.' })
    } finally {
      setSaving(false)
    }
  }

  const total = payments.reduce((sum, p) => sum + p.amountCents, 0)

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-4 rounded-xl bg-brand-50 p-4 ring-1 ring-brand-200 dark:bg-brand-950/40 dark:ring-brand-900"
      noValidate
      data-testid={`${testId}-form`}
    >
      {single ? (
        <Field
          label="Monto pagado (MXN)"
          htmlFor={`${testId}-amount`}
          error={errors.amount}
          hint="Si pagaste otra cantidad, cámbiala aquí."
        >
          <input
            id={`${testId}-amount`}
            inputMode="decimal"
            autoComplete="off"
            value={amountText}
            onChange={(e) => setAmountText(e.target.value)}
            className={`${ui.input} text-xl font-semibold tabular-nums ${errors.amount ? ui.inputError : ''}`}
          />
        </Field>
      ) : (
        <div className="space-y-1">
          <p className={ui.label}>Se registrará un pago en cada tarjeta:</p>
          <ul className="space-y-1" data-testid={`${testId}-list`}>
            {payments.map((p) => (
              <li key={p.cardId} className="flex justify-between gap-2">
                <span className="truncate">{p.name}</span>
                <span className="font-semibold tabular-nums">
                  {formatMXN(p.amountCents)}
                </span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between gap-2 border-t border-brand-200 pt-1 dark:border-brand-900">
            <span>Total</span>
            <span className="font-semibold tabular-nums">
              {formatMXN(total)}
            </span>
          </p>
        </div>
      )}

      <Field
        label="Fecha del pago"
        htmlFor={`${testId}-date`}
        error={errors.date}
      >
        <input
          id={`${testId}-date`}
          type="date"
          value={date}
          min={minDate}
          max={today}
          onChange={(e) => setDate(e.target.value)}
          className={`${ui.input} ${errors.date ? ui.inputError : ''}`}
        />
      </Field>

      {errors.form && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errors.form}
        </p>
      )}

      <div className="flex gap-2">
        <button
          type="button"
          className={ui.buttonSecondary}
          onClick={() => setOpen(false)}
        >
          Cancelar
        </button>
        <button
          type="submit"
          className={ui.buttonPrimary}
          disabled={saving}
          data-testid={`${testId}-confirm`}
        >
          Registrar pago
        </button>
      </div>
    </form>
  )
}
