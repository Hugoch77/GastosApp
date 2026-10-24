import { useState, type FormEvent } from 'react'
import { useParams } from 'react-router'
import { ConfirmButton } from '../components/ConfirmButton'
import { Field } from '../components/Field'
import { NotFound } from '../components/NotFound'
import { PageHeader } from '../components/PageHeader'
import { ui } from '../components/styles'
import { OTHER_CATEGORY_ID } from '../data/defaults'
import type { Category, CategoryInput } from '../data/schema'
import { activeCategories, transactionCountByCategory } from '../data/selectors'
import { normalizeText } from '../domain/search'
import { useGoBack } from '../hooks/useGoBack'
import { useGastos } from '../state/gastosContext'

/** Emojis sugeridos; también se puede escribir cualquier otro. */
const SUGGESTED_ICONS = [
  '🍔',
  '☕',
  '🛒',
  '🚗',
  '⛽',
  '🚌',
  '💡',
  '📱',
  '💊',
  '🏋️',
  '🎬',
  '🎮',
  '👕',
  '🏠',
  '🐶',
  '👶',
  '📚',
  '✈️',
  '🏨',
  '📺',
  '🎁',
  '💼',
  '💳',
  '📦',
]

/** Ruta /categorias/nueva o /categorias/:id */
export function CategoryFormPage() {
  const { id } = useParams()
  const { data } = useGastos()
  const existing = id
    ? activeCategories(data).find((c) => c.id === id)
    : undefined

  if (id && !existing) {
    return (
      <NotFound
        message="Esta categoría no existe o fue eliminada."
        backTo="/categorias"
      />
    )
  }
  return (
    <>
      <PageHeader
        title={existing ? 'Editar categoría' : 'Nueva categoría'}
        backTo="/categorias"
      />
      <CategoryForm key={id ?? 'new'} existing={existing} />
    </>
  )
}

type Errors = Partial<Record<'name' | 'icon' | 'form', string>>

function CategoryForm({ existing }: { existing?: Category }) {
  const { data, mutate } = useGastos()
  const goBack = useGoBack('/categorias')

  const [name, setName] = useState(existing?.name ?? '')
  const [icon, setIcon] = useState(existing?.icon ?? '')
  const [errors, setErrors] = useState<Errors>({})
  const [saving, setSaving] = useState(false)

  const usedBy = existing
    ? (transactionCountByCategory(data).get(existing.id) ?? 0)
    : 0

  function validate(): { input?: CategoryInput; errors: Errors } {
    const found: Errors = {}
    const trimmed = name.trim()
    const isDuplicate = activeCategories(data).some(
      (c) =>
        c.id !== existing?.id && normalizeText(c.name) === normalizeText(name),
    )
    if (!trimmed) found.name = 'Escribe un nombre'
    else if (isDuplicate) found.name = 'Ya existe una categoría con ese nombre'
    if (!icon.trim()) found.icon = 'Elige o escribe un emoji'
    if (Object.keys(found).length > 0) return { errors: found }
    return { errors: {}, input: { name: trimmed, icon: icon.trim() } }
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
          ? repo.updateCategory(existing.id, input)
          : repo.createCategory(input),
      )
      goBack()
    } catch {
      setErrors({ form: 'No se pudo guardar. Revisa los datos.' })
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!existing) return
    goBack()
    await mutate((repo) => repo.deleteCategory(existing.id))
  }

  return (
    <form
      onSubmit={(e) => void handleSubmit(e)}
      className="space-y-5 px-4 pb-10"
      noValidate
    >
      <div className="flex items-center gap-3">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-full bg-white text-3xl ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800"
          aria-hidden="true"
        >
          {icon || '❔'}
        </span>
        <div className="flex-1">
          <Field label="Nombre" htmlFor="category-name" error={errors.name}>
            <input
              id="category-name"
              maxLength={30}
              placeholder="p. ej. Mascotas"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className={`${ui.input} ${errors.name ? ui.inputError : ''}`}
            />
          </Field>
        </div>
      </div>

      <Field
        label="Ícono"
        htmlFor="category-icon"
        error={errors.icon}
        hint="Toca uno o escribe cualquier emoji con el teclado."
      >
        <input
          id="category-icon"
          maxLength={16}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          className={`${ui.input} ${errors.icon ? ui.inputError : ''}`}
        />
      </Field>

      <div
        className="grid grid-cols-8 gap-1"
        role="group"
        aria-label="Íconos sugeridos"
      >
        {SUGGESTED_ICONS.map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => setIcon(option)}
            aria-pressed={icon === option}
            className={`flex aspect-square items-center justify-center rounded-xl text-2xl ${
              icon === option
                ? 'bg-indigo-100 ring-2 ring-indigo-500 dark:bg-indigo-950'
                : 'active:bg-slate-200 dark:active:bg-slate-800'
            }`}
            data-testid="icon-option"
          >
            {option}
          </button>
        ))}
      </div>

      {errors.form && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {errors.form}
        </p>
      )}

      <button
        type="submit"
        className={ui.buttonPrimary}
        disabled={saving}
        data-testid="save-category"
      >
        {existing ? 'Guardar cambios' : 'Agregar categoría'}
      </button>

      {existing && existing.id !== OTHER_CATEGORY_ID && (
        <ConfirmButton
          label="Eliminar categoría"
          confirmLabel="Sí, eliminar"
          warning={
            usedBy > 0
              ? `${usedBy === 1 ? 'Su movimiento pasará' : `Sus ${usedBy} movimientos pasarán`} a "Otros".`
              : 'No tiene movimientos.'
          }
          onConfirm={handleDelete}
          testId="delete-category"
        />
      )}
      {existing?.id === OTHER_CATEGORY_ID && (
        <p className={ui.muted}>
          "Otros" no se puede eliminar: recibe los movimientos de las categorías
          que borres.
        </p>
      )}
    </form>
  )
}
