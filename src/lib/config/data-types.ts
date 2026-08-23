/**
 * SOURCE OF TRUTH KEYWORDS: DATA_TYPES, DataTypeKey, DataTypeDefinition,
 *   DATA_TYPE_ENTRIES, getDataType, DATA_TYPE_KEYS
 *
 * WHAT:  Registry of every field data type a diagram entity field may hold —
 *        display label plus its mapping into each export dialect (Prisma,
 *        PostgreSQL). The object keys ARE the persisted `dataType` values on
 *        DiagramEntityField rows.
 * WHY:   Adding a dialect (e.g. MySQL DDL) or a new type (e.g. `bytes`) means
 *        adding one key/row here — no router, service, or component changes.
 *        Validation lives in src/lib/types/diagram.ts via
 *        `z.enum(DATA_TYPE_KEYS)`, so an unknown type can never persist.
 * WHERE: Referenced by src/lib/types/diagram.ts (validation), the field editor
 *        UI (label dropdown), and src/services/diagram-export.service.ts
 *        (dialect mapping at export time).
 */

export interface DataTypeDefinition {
  /** Human label shown in the field-type picker. */
  label: string
  /** Type emitted by the Prisma dialect adapter. */
  prisma: string
  /** Column type emitted by the PostgreSQL DDL adapter. */
  postgres: string
}

export const DATA_TYPES = {
  string: { label: 'String', prisma: 'String', postgres: 'TEXT' },
  int: { label: 'Integer', prisma: 'Int', postgres: 'INTEGER' },
  bigint: { label: 'BigInt', prisma: 'BigInt', postgres: 'BIGINT' },
  float: { label: 'Float', prisma: 'Float', postgres: 'DOUBLE PRECISION' },
  decimal: { label: 'Decimal', prisma: 'Decimal', postgres: 'NUMERIC' },
  boolean: { label: 'Boolean', prisma: 'Boolean', postgres: 'BOOLEAN' },
  datetime: { label: 'DateTime', prisma: 'DateTime', postgres: 'TIMESTAMP(3)' },
  json: { label: 'JSON', prisma: 'Json', postgres: 'JSONB' },
  uuid: { label: 'UUID', prisma: 'String', postgres: 'UUID' },
} as const satisfies Record<string, DataTypeDefinition>

export type DataTypeKey = keyof typeof DATA_TYPES

/** Ordered keys — drives the field-type picker and the zod enum. */
export const DATA_TYPE_KEYS = Object.keys(DATA_TYPES) as readonly DataTypeKey[]

/**
 * SOURCE OF TRUTH KEYWORDS: getDataType
 *
 * WHAT:  Safe lookup of a DataTypeDefinition by its persisted key, with a
 *        fallback to `string` so a legacy/unknown row never crashes a render
 *        or an export.
 * WHERE: Called by the export adapters and the entity-node field rows.
 */
export function getDataType(key: string): DataTypeDefinition {
  return (DATA_TYPES as Record<string, DataTypeDefinition>)[key] ?? DATA_TYPES.string
}

/**
 * SOURCE OF TRUTH KEYWORDS: isDataTypeKey
 *
 * WHAT:  Cast-free type guard narrowing a persisted `dataType` string to a
 *        DataTypeKey.
 * WHY:   DiagramEntityField.dataType is a plain String column storing a
 *        registry KEY; this is the sanctioned DB-string → union boundary
 *        (no enums by design), keeping `as`/`any` out of consumers.
 * WHERE: buildSnapshotPayload in src/services/diagram.service.ts; export adapters.
 */
export function isDataTypeKey(value: string): value is DataTypeKey {
  return Object.prototype.hasOwnProperty.call(DATA_TYPES, value)
}
