/**
 * Dictado con el reconocimiento de voz del navegador (Web Speech API).
 *
 * En Chrome para Android el audio lo procesa el servicio de Google: es gratis pero
 * necesita internet. Si el navegador no lo soporta, `supported` es false y la UI
 * oculta el botón.
 */
import { useCallback, useEffect, useRef, useState } from 'react'

// TypeScript no incluye los tipos de esta API; basta con lo que usamos.
interface RecognitionResultEvent {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}
interface RecognitionErrorEvent {
  error: string
}
interface Recognition {
  lang: string
  interimResults: boolean
  maxAlternatives: number
  onresult: ((event: RecognitionResultEvent) => void) | null
  onerror: ((event: RecognitionErrorEvent) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
type RecognitionConstructor = new () => Recognition

function getRecognitionConstructor(): RecognitionConstructor | undefined {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor
    webkitSpeechRecognition?: RecognitionConstructor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Permite el uso del micrófono para dictar.',
  'service-not-allowed': 'Permite el uso del micrófono para dictar.',
  'no-speech': 'No escuché nada. Toca el micrófono e intenta de nuevo.',
  network: 'Se necesita internet para reconocer la voz.',
  'audio-capture': 'No se encontró un micrófono.',
}

export interface SpeechRecognitionControls {
  supported: boolean
  listening: boolean
  error: string | null
  start: () => void
  stop: () => void
}

/** `onResult` recibe la frase reconocida (una sola, ya terminada). */
export function useSpeechRecognition(
  onResult: (transcript: string) => void,
): SpeechRecognitionControls {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const recognitionRef = useRef<Recognition | null>(null)
  // Ref para usar siempre la versión más reciente del callback sin reiniciar el dictado.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  // Al salir de la pantalla se cancela el dictado en curso.
  useEffect(() => () => recognitionRef.current?.abort(), [])

  const RecognitionImpl = getRecognitionConstructor()

  // useCallback: `start` no cambia entre renders, así se puede llamar desde un efecto.
  const start = useCallback(() => {
    if (!RecognitionImpl) return
    recognitionRef.current?.abort()

    const recognition = new RecognitionImpl()
    recognition.lang = 'es-MX'
    recognition.interimResults = false
    recognition.maxAlternatives = 1
    recognition.onresult = (event) => {
      const transcript = event.results[0]?.[0]?.transcript.trim()
      if (transcript) onResultRef.current(transcript)
    }
    recognition.onerror = (event) => {
      // 'aborted' ocurre al cancelar a propósito; no es un error para el usuario.
      if (event.error !== 'aborted') {
        setError(ERROR_MESSAGES[event.error] ?? 'No se pudo usar el micrófono.')
      }
    }
    recognition.onend = () => setListening(false)

    recognitionRef.current = recognition
    setError(null)
    setListening(true)
    try {
      recognition.start()
    } catch {
      setListening(false)
      setError(
        'No se pudo iniciar el micrófono. Tócalo para intentar de nuevo.',
      )
    }
  }, [RecognitionImpl])

  const stop = useCallback(() => recognitionRef.current?.stop(), [])

  return {
    supported: RecognitionImpl !== undefined,
    listening,
    error,
    start,
    stop,
  }
}
