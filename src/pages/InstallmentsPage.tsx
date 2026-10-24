import { Link } from 'react-router'
import { Money } from '../components/Money'
import { PageHeader } from '../components/PageHeader'
import { ui } from '../components/styles'
import type { Transaction } from '../data/schema'
import { transactionsForCard } from '../data/selectors'
import { dueDateForCut, getBillingCycle } from '../domain/billing'
import {
  activeInstallmentPlans,
  installmentProjection,
  type InstallmentPlan,
} from '../domain/installmentPlans'
import { pendingInstallmentsCents } from '../domain/summary'
import { useSelectedCard } from '../hooks/useSelectedCard'
import { useToday } from '../hooks/useToday'
import { formatMonthYear } from '../lib/format'
import { useGastos } from '../state/gastosContext'

/** Cuántos estados de cuenta se muestran en la proyección. */
const PROJECTION_STATEMENTS = 6

/** Ruta /msi: compras a meses vigentes y cuánto se pagará de MSI en los próximos meses. */
export function InstallmentsPage() {
  const today = useToday()
  const { data } = useGastos()
  const { card, config } = useSelectedCard()

  const transactions = transactionsForCard(data, card.id)
  const currentCut = getBillingCycle(today, config).current.cutDate
  const plans = activeInstallmentPlans(transactions, currentCut, config)
  const projection = installmentProjection(
    transactions,
    currentCut,
    PROJECTION_STATEMENTS,
    config,
  )
  const remainingCents = plans.reduce((sum, p) => sum + p.remainingCents, 0)
  // Mismo cálculo que "MSI por facturar" en el panel: así ambos números coinciden.
  const afterCurrentCutCents = pendingInstallmentsCents(
    transactions,
    currentCut,
    config,
  )
  const maxMonthCents = Math.max(...projection.map((p) => p.amountCents))
  const categories = new Map(data.categories.map((c) => [c.id, c]))

  return (
    <>
      <PageHeader title="Meses sin intereses" backTo="/" />
      <main className="space-y-6 px-4 pb-10">
        {plans.length === 0 ? (
          <p
            className={`${ui.card} text-center ${ui.muted}`}
            data-testid="msi-empty"
          >
            No tienes compras a meses vigentes en esta tarjeta.
          </p>
        ) : (
          <>
            <section className={`${ui.card} space-y-3`}>
              <div>
                <p className={ui.muted}>Te falta pagar en MSI</p>
                <Money
                  cents={remainingCents}
                  className="block text-3xl font-bold"
                  testId="msi-remaining-total"
                />
              </div>
              <div className="grid grid-cols-2 gap-3 border-t border-slate-200 pt-3 text-sm dark:border-slate-800">
                <p>
                  <span className={`${ui.muted} block`}>Este periodo</span>
                  <Money
                    cents={projection[0].amountCents}
                    className="font-semibold"
                    testId="msi-current-period"
                  />
                </p>
                <p>
                  <span className={`${ui.muted} block`}>
                    Después del próximo corte
                  </span>
                  <Money
                    cents={afterCurrentCutCents}
                    className="font-semibold"
                    testId="msi-after-current-cut"
                  />
                </p>
              </div>
            </section>

            <section className="space-y-3">
              <div className="px-1">
                <h2 className={ui.sectionTitle}>Próximos pagos de MSI</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Mensualidades por estado de cuenta, según el mes en que se
                  pagan.
                </p>
              </div>
              <ul className={`${ui.card} space-y-3`}>
                {projection.map((month) => (
                  <li
                    key={month.cutDate}
                    className="grid grid-cols-[4.5rem_1fr_auto] items-center gap-3 text-sm"
                    data-testid="msi-projection-row"
                  >
                    <span className={ui.muted}>
                      {formatMonthYear(month.dueDate)}
                    </span>
                    <Bar value={month.amountCents} max={maxMonthCents} />
                    <Money
                      cents={month.amountCents}
                      className="text-right font-medium"
                    />
                  </li>
                ))}
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className={ui.sectionTitle}>
                Compras vigentes (
                <span data-testid="msi-active-count">{plans.length}</span>)
              </h2>
              <ul className={ui.list}>
                {plans.map((plan) => (
                  <PlanRow
                    key={plan.transaction.id}
                    plan={plan}
                    icon={
                      categories.get(plan.transaction.categoryId ?? '')?.icon
                    }
                    endsOn={dueDateForCut(plan.lastCutDate, config.dueDay)}
                  />
                ))}
              </ul>
            </section>
          </>
        )}
      </main>
    </>
  )
}

/** Barra horizontal proporcional a `value` (máximo 24px de grosor, punta redondeada). */
function Bar({ value, max }: { value: number; max: number }) {
  const percent = max > 0 ? (value / max) * 100 : 0
  return (
    <span className="block h-3" aria-hidden="true">
      {value > 0 && (
        <span
          className="block h-full min-w-1 rounded-r bg-brand-600"
          style={{ width: `${percent}%` }}
        />
      )}
    </span>
  )
}

function PlanRow({
  plan,
  icon,
  endsOn,
}: {
  plan: InstallmentPlan<Transaction>
  icon: string | undefined
  endsOn: string
}) {
  const { transaction: t, months, billedCount } = plan
  return (
    <li>
      <Link
        to={`/movimientos/${t.id}`}
        className="flex items-center gap-3 px-4 py-3 active:bg-slate-100 dark:active:bg-slate-800"
        data-testid="msi-plan"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-100 text-lg dark:bg-slate-800">
          {icon ?? '📦'}
        </span>
        <span className="min-w-0 flex-1 space-y-1">
          <span className="flex items-baseline justify-between gap-2">
            <span
              className="truncate font-medium"
              data-testid="msi-plan-description"
            >
              {t.description}
            </span>
            <Money
              cents={plan.remainingCents}
              className="shrink-0 font-semibold"
              testId="msi-plan-remaining"
            />
          </span>
          <span
            className="block h-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800"
            role="progressbar"
            aria-label={`${billedCount} de ${months} mensualidades facturadas`}
            aria-valuemin={0}
            aria-valuemax={months}
            aria-valuenow={billedCount}
          >
            <span
              className="block h-full rounded-full bg-brand-600"
              style={{ width: `${(billedCount / months) * 100}%` }}
            />
          </span>
          <span
            className="flex justify-between gap-2 text-xs text-slate-500 dark:text-slate-400"
            data-testid="msi-plan-detail"
          >
            <span>
              <Money cents={plan.nextAmountCents} /> al mes · {billedCount}/
              {months}
            </span>
            <span>Termina {formatMonthYear(endsOn)}</span>
          </span>
        </span>
      </Link>
    </li>
  )
}
