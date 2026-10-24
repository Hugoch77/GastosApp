import { useState } from 'react'
import { Link } from 'react-router'
import { BackupImport } from '../components/BackupImport'
import { PageHeader } from '../components/PageHeader'
import { ui } from '../components/styles'
import { activeCards, activeCategories } from '../data/selectors'
import { isValidIsoDate } from '../domain/dates'
import { useBackupStatus, useExportBackup } from '../hooks/useBackup'
import { formatDateWithYear } from '../lib/format'
import { useGastos } from '../state/gastosContext'

export function SettingsPage() {
  return (
    <>
      <PageHeader title="Ajustes" />
      <main className="space-y-8 px-4">
        <CardsSection />
        <CategoriesSection />
        <BackupSection />
        <HolidaysSection />
      </main>
    </>
  )
}

function CardsSection() {
  const { data } = useGastos()

  return (
    <section className="space-y-3">
      <h2 className={ui.sectionTitle}>Tarjetas</h2>
      <ul className={ui.list}>
        {activeCards(data).map((card) => (
          <li key={card.id}>
            <Link
              to={`/tarjetas/${card.id}`}
              className="flex items-center justify-between gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
              data-testid="card-row"
            >
              <span>
                <span className="block font-medium">{card.name}</span>
                <span className={ui.muted}>
                  Corte día {card.cutDay} · Pago día {card.dueDay}
                </span>
              </span>
              {card.id === data.settings.activeCardId && (
                <span className="rounded-full bg-brand-100 px-2.5 py-0.5 text-xs font-semibold text-brand-800 dark:bg-brand-900/50 dark:text-brand-300">
                  Seleccionada
                </span>
              )}
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/tarjetas/nueva"
        className={ui.buttonSecondary}
        data-testid="add-card"
      >
        Agregar tarjeta
      </Link>
    </section>
  )
}

function CategoriesSection() {
  const { data } = useGastos()
  const categories = activeCategories(data)

  return (
    <section className="space-y-3">
      <h2 className={ui.sectionTitle}>Categorías</h2>
      <Link
        to="/categorias"
        className={`${ui.card} flex items-center justify-between gap-3 active:bg-slate-100 dark:active:bg-slate-800`}
        data-testid="manage-categories"
      >
        <span>
          <span className="block font-medium">Administrar categorías</span>
          <span className={ui.muted}>
            {categories
              .slice(0, 6)
              .map((c) => c.icon)
              .join(' ')}{' '}
            · {categories.length} categorías
          </span>
        </span>
        <span aria-hidden="true" className={ui.muted}>
          ›
        </span>
      </Link>
    </section>
  )
}

function BackupSection() {
  const exportBackup = useExportBackup()
  const { lastBackupDate } = useBackupStatus()

  return (
    <section className="space-y-3">
      <h2 className={ui.sectionTitle}>Respaldo</h2>
      <p className={ui.muted}>
        Tus datos solo se guardan en este dispositivo. Descarga un respaldo de
        vez en cuando o úsalo para pasar tus datos a otro dispositivo.
      </p>
      <p className={ui.muted} data-testid="last-backup">
        {lastBackupDate
          ? `Último respaldo: ${formatDateWithYear(lastBackupDate)}`
          : 'Aún no has descargado un respaldo.'}
      </p>
      <button
        type="button"
        className={ui.buttonPrimary}
        onClick={() => void exportBackup()}
        data-testid="export-backup"
      >
        Descargar respaldo
      </button>
      <BackupImport />
    </section>
  )
}

function HolidaysSection() {
  const { data, mutate } = useGastos()
  const [newDate, setNewDate] = useState('')
  const holidays = data.settings.extraHolidays

  async function saveHolidays(next: string[]) {
    await mutate((repo) =>
      repo.updateSettings({ extraHolidays: [...new Set(next)].sort() }),
    )
  }

  return (
    <section className="space-y-3">
      <h2 className={ui.sectionTitle}>Días inhábiles adicionales</h2>
      <p className={ui.muted}>
        Los festivos bancarios oficiales ya se calculan solos. Agrega aquí días
        extraordinarios (p. ej. el 1 de octubre en año de cambio de gobierno).
      </p>

      {holidays.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {holidays.map((day) => (
            <li
              key={day}
              className="flex items-center gap-1 rounded-full bg-slate-200 py-1 pr-1 pl-3 text-sm dark:bg-slate-800"
            >
              {formatDateWithYear(day)}
              <button
                type="button"
                onClick={() =>
                  void saveHolidays(holidays.filter((d) => d !== day))
                }
                className="rounded-full px-2 active:bg-slate-300 dark:active:bg-slate-700"
                aria-label={`Quitar ${formatDateWithYear(day)}`}
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="flex gap-2">
        <input
          type="date"
          aria-label="Día inhábil"
          value={newDate}
          onChange={(e) => setNewDate(e.target.value)}
          className={ui.input}
        />
        <button
          type="button"
          disabled={!isValidIsoDate(newDate)}
          onClick={() => {
            void saveHolidays([...holidays, newDate])
            setNewDate('')
          }}
          className="shrink-0 rounded-xl bg-slate-200 px-4 font-semibold disabled:opacity-50 dark:bg-slate-800"
        >
          Agregar
        </button>
      </div>
    </section>
  )
}
