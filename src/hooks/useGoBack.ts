import { useLocation, useNavigate } from 'react-router'

/**
 * Regresa a la pantalla anterior. Si la página se abrió directamente (sin historial
 * dentro de la app), navega a `fallback` en su lugar.
 */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate()
  const location = useLocation()

  return () => {
    if (location.key === 'default') {
      void navigate(fallback, { replace: true })
    } else {
      void navigate(-1)
    }
  }
}
