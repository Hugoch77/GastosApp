/**
 * Migraciones del esquema guardado.
 *
 * Cuando cambie la forma de los datos:
 *   1. Subir CURRENT_SCHEMA_VERSION en schema.ts y ajustar los esquemas.
 *   2. Agregar aquí `N: (data) => ...` que convierta datos de la versión N a la N + 1.
 *   3. Agregar una prueba con datos reales de la versión N.
 */
import { AppDataSchema, CURRENT_SCHEMA_VERSION, type AppData } from './schema'

/** Convierte datos de la versión `key` a la versión `key + 1`. */
export type Migration = (
  data: Record<string, unknown>,
) => Record<string, unknown>

export const MIGRATIONS: Record<number, Migration> = {
  // v2: regla para los movimientos del día de corte. Las tarjetas existentes
  // conservan el comportamiento de v1 (entran al estado que cierra ese día).
  1: (data) => ({
    ...data,
    schemaVersion: 2,
    cards: asArray(data.cards).map((card) => ({
      ...card,
      cutDayInNextPeriod: false,
    })),
  }),
}

export class SchemaVersionError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Para migraciones: los datos aún no están validados, puede no ser un arreglo. */
function asArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter(isRecord) : []
}

/** Aplica en orden las migraciones necesarias, sin validar el resultado final. */
export function upgrade(
  raw: unknown,
  migrations: Record<number, Migration>,
  currentVersion: number,
): Record<string, unknown> {
  if (!isRecord(raw)) {
    throw new SchemaVersionError('Los datos no tienen el formato esperado')
  }

  const version = raw.schemaVersion
  if (
    typeof version !== 'number' ||
    !Number.isInteger(version) ||
    version < 1
  ) {
    throw new SchemaVersionError(
      'Los datos no indican una versión de esquema válida',
    )
  }
  if (version > currentVersion) {
    throw new SchemaVersionError(
      `Los datos son de una versión más nueva de la app (v${version}); actualiza la app`,
    )
  }

  let data = raw
  for (let v = version; v < currentVersion; v++) {
    const migration = migrations[v]
    if (!migration) {
      throw new SchemaVersionError(`Falta la migración de v${v} a v${v + 1}`)
    }
    data = migration(data)
  }
  return data
}

/** Lleva datos de cualquier versión anterior a la actual y los valida. */
export function migrateToCurrent(raw: unknown): AppData {
  return AppDataSchema.parse(upgrade(raw, MIGRATIONS, CURRENT_SCHEMA_VERSION))
}
