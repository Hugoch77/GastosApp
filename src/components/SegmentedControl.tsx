interface Option<T extends string> {
  value: T
  label: string
}

interface Props<T extends string> {
  options: Option<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  testId?: string
}

/** Grupo de botones donde solo uno está seleccionado (como pestañas pequeñas). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  label,
  testId,
}: Props<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={label}
      data-testid={testId}
      className="flex rounded-xl bg-slate-200 p-1 dark:bg-slate-800"
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`flex-1 rounded-lg px-2 py-2 text-sm font-medium ${
              selected
                ? 'bg-white text-slate-900 shadow-sm dark:bg-slate-950 dark:text-slate-100'
                : 'text-slate-600 dark:text-slate-400'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
