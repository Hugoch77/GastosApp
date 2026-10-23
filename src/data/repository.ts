/**
 * Contrato de acceso a datos. La UI solo conoce esta interfaz.
 *
 * Todos los métodos son asíncronos aunque LocalStorage sea síncrono: así una futura
 * implementación contra una API (FastAPI) encaja sin cambiar la UI.
 */
import type { ParseBackupResult } from './backup'
import type {
  AppData,
  Card,
  CardInput,
  Settings,
  Transaction,
  TransactionInput,
} from './schema'

export interface GastosRepository {
  /** Todos los datos, incluidos los registros borrados lógicamente. */
  getData(): Promise<AppData>

  createCard(input: CardInput): Promise<Card>
  updateCard(id: string, input: CardInput): Promise<Card>
  /** Borrado lógico de la tarjeta y de sus movimientos. */
  deleteCard(id: string): Promise<void>

  createTransaction(input: TransactionInput): Promise<Transaction>
  updateTransaction(id: string, input: TransactionInput): Promise<Transaction>
  deleteTransaction(id: string): Promise<void>

  updateSettings(patch: Partial<Settings>): Promise<Settings>

  /** JSON listo para descargar como respaldo. */
  exportBackup(): Promise<string>
  /** Reemplaza todos los datos. Si el respaldo es inválido no modifica nada. */
  importBackup(json: string): Promise<ParseBackupResult>
}

export class NotFoundError extends Error {}
