import { Link } from 'react-router'
import { PageHeader } from './PageHeader'
import { ui } from './styles'

export function NotFound({
  message,
  backTo,
}: {
  message: string
  backTo: string
}) {
  return (
    <>
      <PageHeader title="No encontrado" backTo={backTo} />
      <main className="space-y-4 px-4">
        <p className={ui.muted}>{message}</p>
        <Link to={backTo} className={ui.buttonSecondary}>
          Regresar
        </Link>
      </main>
    </>
  )
}
