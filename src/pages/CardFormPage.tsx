import { useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ConfirmButton } from '../components/ConfirmButton'
import { Field } from '../components/Field'
import { AlertIcon } from '../components/Icons'
import { NotFound } from '../components/NotFound'
import { PageHeader } from '../components/PageHeader'
import { SegmentedControl } from '../components/SegmentedControl'
import { ui } from '../components/styles'
import type { Card, CardInput } from '../data/schema'
import { activeCards } from '../data/selectors'
import { getBillingCycle } from '../domain/billing'
import { daysBetween } from '../domain/dates'
import { useGoBack } from '../hooks/useGoBack'
import { useToday } from '../hooks/useToday'
import { formatLongDate } from '../lib/format'
import { useGastos } from '../state/gastosContext'

/** Normalmente hay al menos 20 días entre el corte y la fecha límite de pago. */
const MIN_EXPECTED_GRACE_DAYS = 20
const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

type CutDayRule = 'same' | 'next'
const CUT_DAY_RULE_OPTIONS: { value: CutDayRule; label: string }[] = [
  { value: 'same', label: 'En ese corte' },
  { value: 'next', label: 'Al siguiente' },
]

/** Ruta /tarjetas/nueva o /tarjetas/:id */
export function CardFormPage() {
  const { id } = useParams()
  const { data } = useGastos()
  const existing = id ? activeCards(data).find((c) => c.id === id) : undefined

  if (id && !existing) {
    return (
      <NotFound
        message="Esta tarjeta no existe o fue eliminada."
        backTo="/ajustes"
      />
    )
  }
  return (
    <>
      <PageHeader
        title={existing ? 'Editar tarjeta' : 'Nueva tarjeta'}
        backTo="/ajustes"
      />
      <CardForm key={id ?? 'new'} existing={existing} />
    </>
  )
}

type Errors = Partial<
  Record<'name' | 'cutDay' | 'dueDay' | 'buffer' | 'form', string>
>

interface CardFormProps {
  existing?: Card
  /** Primera tarjeta: no hay a dónde regresar y al guardar se va al panel. */
  onboarding?: boolean
}

export function CardForm({ existing, onboarding = false }: CardFormProps) {
  const today = useToday()
  const { data, mutate } = useGastos()
  const navigate = useNavigate()
  const goBack = useGoBack('/ajustes')

  const [name, setName] = useState(existing?.name ?? '')
  const [cutDayText, setCutDayText] = useState(
    existing ? String(existing.cutDay) : '',
  )
  const [dueDayText, setDueDayText] = useState(
    existing ? String(existing.dueDay) : '',
  )
  const [cutDayRule, setCutDayRule] = useState<CutDayRule>(
    existing?.cutDayInNextPeriod ? 'next' : 'same',
  )
  const [bufferText, setBufferText] = useState(
    String(existing?.paymentBufferDays ?? 2),
  )
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const cutDay = Number(cutDayText)
  const dueDay = Number(dueDayText)
  const cutDayInNextPeriod = cutDayRule === 'next'
  const paymentBufferDays = Number(bufferText)
  const isBufferValid =
    Number.isInteger(paymentBufferDays) &&
    paymentBufferDays >= 0 &&
    paymentBufferDays <= 10

  // Vista previa en vivo con la configuración capturada.
  const preview =
    cutDay && dueDay && isBufferValid
      ? getBillingCycle(today, {
          cutDay,
          cutDayInNextPeriod,
          dueDay,
          paymentBufferDays,
          extraHolidays: data.settings.extraHolidays,
        }).current
      : null
  const graceDays = preview
    ? daysBetween(preview.cutDate, preview.dueDate)
    : null

  function validate(): { input?: CardInput; errors: Errors } {
    const found: Errors = {}
    if (!name.trim()) found.name = 'Escribe un nombre, p. ej. "BBVA Azul"'
    if (!cutDay) found.cutDay = 'Elige el día de corte'
    if (!dueDay) found.dueDay = 'Elige el día límite de pago'
    if (!isBufferValid) found.buffer = 'Entre 0 y 10 días'
    if (Object.keys(found).length > 0) return { errors: found }
    return {
      errors: {},
      input: {
        name: name.trim(),
        cutDay,
        cutDayInNextPeriod,
        dueDay,
        paymentBufferDays,
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
      if (existing) {
        await mutate((repo) => repo.updateCard(existing.id, input))
        goBack()
      } else {
        await mutate(async (repo) => {
          const card = await repo.createCard(input)
          await repo.updateSettings({ activeCardId: card.id })
        })
        void navigate('/', { replace: true })
      }
    } catch {
      setErrors({
        form: 'No se pudo guardar. Revisa los datos e intenta de nuevo.',
      })
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    await mutate((repo) => repo.deleteCard(existing.id))
    void navigate('/ajustes', { replace: true })
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-5 px-4 pb-10"
      noValidate
    >
      <Field
        label="Nombre de la tarjeta"
        htmlFor="card-name"
        error={errors.name}
      >
        <input
          id="card-name"
          maxLength={40}
          placeholder="p. ej. BBVA Azul"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={`${ui.input} ${errors.name ? ui.inputError : ''}`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Día de corte" htmlFor="cut-day" error={errors.cutDay}>
          <DaySelect
            id="cut-day"
            value={cutDayText}
            onChange={setCutDayText}
            invalid={!!errors.cutDay}
          />
        </Field>
        <Field
          label="Día límite de pago"
          htmlFor="due-day"
          error={errors.dueDay}
        >
          <DaySelect
            id="due-day"
            value={dueDayText}
            onChange={setDueDayText}
            invalid={!!errors.dueDay}
          />
        </Field>
      </div>

      <div className="space-y-1.5">
        <p className={ui.label} id="cut-day-rule-label">
          Lo que compras el mismo día de corte entra…
        </p>
        <SegmentedControl
          label="Lo que compras el mismo día de corte entra"
          options={CUT_DAY_RULE_OPTIONS}
          value={cutDayRule}
          onChange={setCutDayRule}
          testId="cut-day-rule"
        />
        <p className={ui.muted}>
          Revisa en qué estado de cuenta te aparecen esas compras.
        </p>
      </div>

      <Field
        label="¿Cuántos días antes de la fecha límite quieres pagar?"
        htmlFor="buffer"
        error={errors.buffer}
        hint="Si ese día es inhábil, se adelanta al día hábil anterior."
      >
        <input
          id="buffer"
          inputMode="numeric"
          value={bufferText}
          onChange={(e) => setBufferText(e.target.value)}
          className={`${ui.input} ${errors.buffer ? ui.inputError : ''}`}
        />
      </Field>

      {preview && (
        <section
          className={`${ui.card} space-y-1 text-sm`}
          data-testid="card-preview"
        >
          <p className="font-semibold">Con esta configuración:</p>
          <p>
            Próximo corte:{' '}
            <span data-testid="preview-cut-date">
              {formatLongDate(preview.cutDate)}
            </span>
          </p>
          <p>
            Fecha límite:{' '}
            <span data-testid="preview-due-date">
              {formatLongDate(preview.dueDate)}
            </span>
          </p>
          <p>
            Pagarías el:{' '}
            <span data-testid="preview-suggested-date">
              {formatLongDate(preview.suggestedPaymentDate)}
            </span>
          </p>
          {cutDay > 28 && (
            <p className={ui.muted}>
              En meses más cortos el corte será el último día del mes.
            </p>
          )}
          {graceDays !== null && graceDays < MIN_EXPECTED_GRACE_DAYS && (
            <p
              className="flex gap-2 pt-2 text-amber-700 dark:text-amber-400"
              data-testid="grace-warning"
            >
              <AlertIcon className="size-5 shrink-0" />
              Entre el corte y la fecha límite habría solo {graceDays} días.
              Normalmente son al menos {MIN_EXPECTED_GRACE_DAYS}; revisa tu
              estado de cuenta.
            </p>
          )}
        </section>
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
        data-testid="save-card"
      >
        {existing
          ? 'Guardar cambios'
          : onboarding
            ? 'Comenzar'
            : 'Agregar tarjeta'}
      </button>

      {existing && (
        <ConfirmButton
          label="Eliminar tarjeta"
          confirmLabel="Sí, eliminar"
          warning="Se eliminarán también todos los movimientos de esta tarjeta."
          onConfirm={handleDelete}
          testId="delete-card"
        />
      )}
    </form>
  )
}

interface DaySelectProps {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
}

function DaySelect({ id, value, onChange, invalid }: DaySelectProps) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={`${ui.input} ${invalid ? ui.inputError : ''}`}
    >
      <option value="" disabled>
        Elige
      </option>
      {DAYS.map((d) => (
        <option key={d} value={d}>
          {d}
        </option>
      ))}
    </select>
  )
}
