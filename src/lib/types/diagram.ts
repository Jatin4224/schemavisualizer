/**
 * SOURCE OF TRUTH KEYWORDS: diagramNameSchema, createDiagramSchema,
 *   updateDiagramSchema, duplicateDiagramSchema, listDiagramsSchema,
 *   getDiagramSchema, deleteDiagramSchema, saveCanvasSchema, canvasEntityPatch,
 *   entityNameSchema, createEntitySchema, updateEntitySchema,
 *   deleteEntitySchema, fieldNameSchema, createFieldSchema, updateFieldSchema,
 *   deleteFieldSchema, reorderFieldsSchema, cardinalitySchema, onDeleteSchema,
 *   createRelationSchema, updateRelationSchema, deleteRelationSchema,
 *   exportDialectSchema, generateExportSchema, snapshotLabelSchema,
 *   snapshotPayloadSchema, createSnapshotSchema, restoreSnapshotSchema,
 *   DiagramRow, DiagramWithGraphRow, DiagramListItemRow,
 *   CreateDiagramValues, SaveCanvasValues, CreateEntityValues,
 *   CreateFieldValues, RelationValues, GenerateExportValues
 *
 * WHAT:  Zod schemas + inferred types for every Schema Studio input surface
 *        (diagram CRUD, canvas autosave, entities, fields, relations, export,
 *        snapshots) plus the Prisma row-payload types the services return.
 * WHY:   One contract per input (CLAUDE.md). `cardinality` / `onDelete` /
 *        `dataType` / entity `color` validate against their config registries
 *        here — the DB stores plain strings by design (no enums), so THIS file
 *        is what makes an invalid value unpersistable. `version` on mutating
 *        schemas is the optimistic-concurrency guard the router checks.
 * WHERE: Imported by src/trpc/routers/{diagrams,diagram-entities,schema-export,
 *        diagram-history}.ts, src/services/diagram*.service.ts, and the
 *        diagrams UI. Re-exported via src/lib/types.
 */

import { z } from 'zod'
import type { Prisma } from '@/generated/prisma'
import { DATA_TYPE_KEYS } from '@/lib/config/data-types'
import {
  ENTITY_COLOR_TOKEN_KEYS,
  type EntityColorTokenKey,
} from '@/lib/config/entity-colors'

/* ── Shared atoms ─────────────────────────────────────────────────────── */

const organizationIdSchema = z.string().min(1, 'Organization ID is required.')

export const diagramNameSchema = z
  .string()
  .trim()
  .min(2, 'Diagram name must be at least 2 characters.')
  .max(80, 'Diagram name is too long.')

export const entityNameSchema = z
  .string()
  .trim()
  .min(1, 'Entity name is required.')
  .max(60, 'Entity name is too long.')
  .regex(
    /^[A-Za-z][A-Za-z0-9_]*$/,
    'Use letters, numbers and underscores; must start with a letter.'
  )

export const fieldNameSchema = z
  .string()
  .trim()
  .min(1, 'Field name is required.')
  .max(60, 'Field name is too long.')
  .regex(
    /^[a-z][a-zA-Z0-9_]*$/,
    'Use camelCase: start with a lowercase letter, then letters, numbers or underscores.'
  )

/** ONE_TO_ONE | ONE_TO_MANY | MANY_TO_ONE | MANY_TO_MANY */
export const cardinalitySchema = z.enum([
  'ONE_TO_ONE',
  'ONE_TO_MANY',
  'MANY_TO_ONE',
  'MANY_TO_MANY',
])

/** cascade | restrict | setNull */
export const onDeleteSchema = z.enum(['cascade', 'restrict', 'setNull'])

/** prisma | postgresql | json */
export const exportDialectSchema = z.enum(['prisma', 'postgresql', 'json'])

/** Field type key from DATA_TYPES (src/lib/config/data-types.ts). */
export const dataTypeSchema = z.enum(DATA_TYPE_KEYS)

/** Entity accent color — a theme-token KEY, never a hex. */
export const entityColorKeySchema = z.enum(ENTITY_COLOR_TOKEN_KEYS)

/* ── Diagram CRUD ─────────────────────────────────────────────────────── */

export const createDiagramSchema = z.object({
  organizationId: organizationIdSchema,
  name: diagramNameSchema,
  /* No .default(): an optional-with-default input type breaks the RHF resolver
   * generic; the form supplies its own defaultValues instead. */
  description: z.string().trim().max(280, 'Description is too long.'),
})

export const updateDiagramSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  name: diagramNameSchema.optional(),
  description: z.string().trim().max(280).optional(),
})

export const duplicateDiagramSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  /** Defaults to "Copy of <original>" in the router when omitted. */
  name: diagramNameSchema.optional(),
})

export const listDiagramsSchema = z.object({
  organizationId: organizationIdSchema,
  page: z.number().int().positive().optional(),
  pageSize: z.number().int().positive().optional(),
})

export const getDiagramSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
})

export const deleteDiagramSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
})

/* ── Canvas autosave (high-frequency, audit-free) ─────────────────────── */

/** Per-entity geometry patch inside a saveCanvas batch. */
export const canvasEntityPatch = z.object({
  id: z.string().min(1),
  positionX: z.number(),
  positionY: z.number(),
  collapsed: z.boolean(),
})

export const saveCanvasSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  /** Client's known row version — stale values get CONFLICT. */
  version: z.number().int().positive(),
  viewportX: z.number(),
  viewportY: z.number(),
  viewportZoom: z.number().min(0.1).max(4),
  entities: z.array(canvasEntityPatch).max(500),
})

/* ── Entities ─────────────────────────────────────────────────────────── */

export const createEntitySchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  name: entityNameSchema,
  note: z.string().trim().max(500).default(''),
  color: entityColorKeySchema.nullish(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
})

export const updateEntitySchema = z.object({
  organizationId: organizationIdSchema,
  entityId: z.string().min(1),
  name: entityNameSchema.optional(),
  note: z.string().trim().max(500).optional(),
  color: entityColorKeySchema.nullish(),
  collapsed: z.boolean().optional(),
})

export const deleteEntitySchema = z.object({
  organizationId: organizationIdSchema,
  entityId: z.string().min(1),
})

/* ── Fields ───────────────────────────────────────────────────────────── */

const fieldFlags = {
  isPrimary: z.boolean().optional(),
  isRequired: z.boolean().optional(),
  isUnique: z.boolean().optional(),
  defaultValue: z.string().max(200).nullish(),
}

export const createFieldSchema = z.object({
  organizationId: organizationIdSchema,
  entityId: z.string().min(1),
  name: fieldNameSchema,
  dataType: dataTypeSchema,
  ...fieldFlags,
})

export const updateFieldSchema = z.object({
  organizationId: organizationIdSchema,
  fieldId: z.string().min(1),
  name: fieldNameSchema.optional(),
  dataType: dataTypeSchema.optional(),
  ...fieldFlags,
})

export const deleteFieldSchema = z.object({
  organizationId: organizationIdSchema,
  fieldId: z.string().min(1),
})

export const reorderFieldsSchema = z.object({
  organizationId: organizationIdSchema,
  entityId: z.string().min(1),
  /** Full ordered list of field ids — positions derived from array index. */
  orderedFieldIds: z.array(z.string().min(1)).min(1),
})

/* ── Relations ────────────────────────────────────────────────────────── */

export const createRelationSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  fromEntityId: z.string().min(1),
  /** Optional so an edge can be drawn entity-to-entity before an FK exists. */
  fromFieldId: z.string().min(1).nullish(),
  toEntityId: z.string().min(1),
  toFieldId: z.string().min(1).nullish(),
  cardinality: cardinalitySchema,
  onDelete: onDeleteSchema.default('restrict'),
  label: z.string().trim().max(120).default(''),
})

export const updateRelationSchema = z.object({
  organizationId: organizationIdSchema,
  relationId: z.string().min(1),
  cardinality: cardinalitySchema.optional(),
  onDelete: onDeleteSchema.optional(),
  label: z.string().trim().max(120).optional(),
  fromFieldId: z.string().min(1).nullish(),
  toFieldId: z.string().min(1).nullish(),
})

export const deleteRelationSchema = z.object({
  organizationId: organizationIdSchema,
  relationId: z.string().min(1),
})

/* ── Export ───────────────────────────────────────────────────────────── */

export const generateExportSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  dialect: exportDialectSchema,
})

export type GenerateExportValues = z.infer<typeof generateExportSchema>

/* ── Snapshots ────────────────────────────────────────────────────────── */

export const snapshotLabelSchema = z
  .string()
  .trim()
  .min(2, 'Label must be at least 2 characters.')
  .max(60, 'Label is too long.')

/**
 * Shape of the serialized design stored in DiagramSnapshot.payload. Field and
 * relation rows are embedded by VALUE (not FK) so a restore is one write and
 * survives edits/deletes of live rows after the snapshot was taken.
 */
export const snapshotPayloadSchema = z.object({
  savedAt: z.string(),
  viewport: z.object({ x: z.number(), y: z.number(), zoom: z.number() }),
  entities: z.array(
    z.object({
      id: z.string(),
      name: entityNameSchema,
      note: z.string(),
      color: entityColorKeySchema.nullable(),
      positionX: z.number(),
      positionY: z.number(),
      collapsed: z.boolean(),
      fields: z.array(
        z.object({
          id: z.string(),
          name: fieldNameSchema,
          dataType: dataTypeSchema,
          isPrimary: z.boolean(),
          isRequired: z.boolean(),
          isUnique: z.boolean(),
          defaultValue: z.string().nullable(),
          order: z.number().int(),
        })
      ),
    })
  ),
  relations: z.array(
    z.object({
      id: z.string(),
      fromEntityId: z.string(),
      fromFieldId: z.string().nullable(),
      toEntityId: z.string(),
      toFieldId: z.string().nullable(),
      cardinality: cardinalitySchema,
      onDelete: onDeleteSchema,
      label: z.string(),
    })
  ),
})

export type SnapshotPayloadValues = z.infer<typeof snapshotPayloadSchema>

export const createSnapshotSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  label: snapshotLabelSchema,
})

export const restoreSnapshotSchema = z.object({
  organizationId: organizationIdSchema,
  snapshotId: z.string().min(1),
})

export const listSnapshotsSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
})

/* ── Inferred input types ─────────────────────────────────────────────── */

export type CreateDiagramValues = z.infer<typeof createDiagramSchema>
export type UpdateDiagramValues = z.infer<typeof updateDiagramSchema>
export type DuplicateDiagramValues = z.infer<typeof duplicateDiagramSchema>
export type ListDiagramsValues = z.infer<typeof listDiagramsSchema>
export type GetDiagramValues = z.infer<typeof getDiagramSchema>
export type DeleteDiagramValues = z.infer<typeof deleteDiagramSchema>
export type SaveCanvasValues = z.infer<typeof saveCanvasSchema>
export type CanvasEntityPatch = z.infer<typeof canvasEntityPatch>
export type CreateEntityValues = z.infer<typeof createEntitySchema>
export type UpdateEntityValues = z.infer<typeof updateEntitySchema>
export type DeleteEntityValues = z.infer<typeof deleteEntitySchema>
export type CreateFieldValues = z.infer<typeof createFieldSchema>
export type UpdateFieldValues = z.infer<typeof updateFieldSchema>
export type DeleteFieldValues = z.infer<typeof deleteFieldSchema>
export type ReorderFieldsValues = z.infer<typeof reorderFieldsSchema>
export type CreateRelationValues = z.infer<typeof createRelationSchema>
export type UpdateRelationValues = z.infer<typeof updateRelationSchema>
export type DeleteRelationValues = z.infer<typeof deleteRelationSchema>
export type CreateSnapshotValues = z.infer<typeof createSnapshotSchema>
export type RestoreSnapshotValues = z.infer<typeof restoreSnapshotSchema>

export type CardinalityValue = z.infer<typeof cardinalitySchema>
export type OnDeleteValue = z.infer<typeof onDeleteSchema>
export type ExportDialect = z.infer<typeof exportDialectSchema>

/**
 * Cast-free guards for the DB-string → union boundary on DiagramRelation's
 * `cardinality` / `onDelete` columns (no enums by design — validation lives
 * here). Used by buildSnapshotPayload when serializing rows into the strict
 * SnapshotPayloadValues shape.
 */
export function isCardinalityValue(value: string): value is CardinalityValue {
  return cardinalitySchema.safeParse(value).success
}
export function isOnDeleteValue(value: string): value is OnDeleteValue {
  return onDeleteSchema.safeParse(value).success
}

/* ── Row payload types (from the generated Prisma client) ─────────────── */

/** Bare Diagram row. */
export type DiagramRow = Prisma.DiagramGetPayload<object>

/**
 * Full design graph in one shape — the payload of diagrams.getById and the
 * restore target for snapshots.
 */
export type DiagramWithGraphRow = Prisma.DiagramGetPayload<{
  include: { entities: { include: { fields: true } }; relations: true }
}>

/** List-page row with counts + creator for the card meta line. */
export type DiagramListItemRow = Prisma.DiagramGetPayload<{
  include: {
    _count: { select: { entities: true; relations: true; snapshots: true } }
    createdBy: { select: { id: true; name: true; image: true } }
  }
}>

/* ── Canvas contracts (React Flow) ────────────────────────────────────── */

import type { Node, Edge } from '@xyflow/react'

/** One field row as embedded in an entity node's data. */
export type GraphFieldValues = {
  id: string
  name: string
  /** DATA_TYPES key (display/export coerce via the registry). */
  dataType: string
  isPrimary: boolean
  isRequired: boolean
  isUnique: boolean
  defaultValue: string | null
  order: number
}

/**
 * SOURCE OF TRUTH KEYWORDS: EntityNodeData, ENTITY_NODE_TYPE,
 *   RelationEdgeData, RELATION_EDGE_TYPE
 *
 * WHAT:  The `data` payloads carried by canvas nodes/edges plus their
 *        React Flow generic aliases. The editor, entity cards, and the
 *        inspector sheet all read/write through these so the canvas shape
 *        has exactly one contract.
 */
export type EntityNodeData = {
  entityId: string
  name: string
  note: string
  color: EntityColorTokenKey | null
  collapsed: boolean
  fields: GraphFieldValues[]
}

export type RelationEdgeData = {
  relationId: string
  cardinality: CardinalityValue
  onDelete: OnDeleteValue
  label: string
  /** Resolved FK endpoints (null while entity-level/unresolved). */
  fromFieldId: string | null
  toFieldId: string | null
}

export type EntityFlowNode = Node<EntityNodeData, 'entity'>
/** No literal second generic — edges render via the built-in smoothstep type. */
export type RelationFlowEdge = Edge<RelationEdgeData>
