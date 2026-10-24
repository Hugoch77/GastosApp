import { BackupImport } from '../components/BackupImport'
import { ui } from '../components/styles'
import { SyncSettings } from '../components/SyncSettings'
import { CardForm } from './CardFormPage'

/** Se muestra mientras no hay ninguna tarjeta registrada. */
export function OnboardingPage() {
  return (
    <main className="mx-auto max-w-md space-y-6 pt-[env(safe-area-inset-top)]">
      <header className="space-y-2 px-4 pt-8">
        <h1 className="text-2xl font-bold" data-testid="page-title">
          Configura tu tarjeta
        </h1>
        <p className={ui.muted}>
          Con el día de corte y el día límite de pago calcularemos cuándo y
          cuánto pagar para no generar intereses. Los encuentras en tu estado de
          cuenta.
        </p>
      </header>

      <CardForm onboarding />

      <section className="space-y-3 px-4">
        <h2 className={ui.sectionTitle}>¿Ya la usas en otro dispositivo?</h2>
        <SyncSettings />
      </section>

      <section className="space-y-3 px-4 pb-10">
        <h2 className={ui.sectionTitle}>¿Ya tienes un respaldo?</h2>
        <BackupImport confirmReplace={false} goHomeAfterImport />
      </section>
    </main>
  )
}
