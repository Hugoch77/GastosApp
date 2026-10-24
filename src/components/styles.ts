/**
 * Clases de Tailwind compartidas. Mantenerlas aquí evita repetir cadenas largas y
 * asegura que botones, campos y tarjetas se vean igual en toda la app.
 */
export const ui = {
  card: 'rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800',
  /** Tarjeta sin padding con renglones separados por líneas. */
  list: 'divide-y divide-slate-200 overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-slate-200 dark:divide-slate-800 dark:bg-slate-900 dark:ring-slate-800',
  // text-base (16px) evita que iOS haga zoom al enfocar el campo.
  input:
    'w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-base outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/30 dark:border-slate-700 dark:bg-slate-900',
  inputError: 'border-red-500 focus:border-red-500 focus:ring-red-500/30',
  label: 'text-sm font-medium text-slate-700 dark:text-slate-300',
  muted: 'text-sm text-slate-500 dark:text-slate-400',
  sectionTitle:
    'px-1 text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400',
  buttonPrimary:
    'block w-full rounded-xl bg-brand-700 px-4 py-3 text-center font-semibold text-white active:bg-brand-800 disabled:opacity-50',
  buttonSecondary:
    'block w-full rounded-xl bg-slate-200 px-4 py-3 text-center font-semibold text-slate-900 active:bg-slate-300 dark:bg-slate-800 dark:text-slate-100 dark:active:bg-slate-700',
  buttonDanger:
    'block w-full rounded-xl px-4 py-3 text-center font-semibold text-red-600 ring-1 ring-red-300 active:bg-red-50 dark:text-red-400 dark:ring-red-900 dark:active:bg-red-950',
} as const
