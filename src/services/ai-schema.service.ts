import 'server-only'

/**
 * SOURCE OF TRUTH KEYWORDS: generateAiDesign, sanitizeAiDesign, applyAiDesign,
 *   AiApplyResult, buildExistingSchemaContext, AI_SCHEMA_SYSTEM_PROMPT
 *
 * WHAT:  The AI schema chatbot's engine — prompts Gemini for a design, scrubs
 *        the reply into something the database will accept, and writes it into
 *        a diagram.
 * WHY:   Model output is UNTRUSTED input. Gemini is asked for a deliberately
 *        loose shape (see src/lib/types/ai-schema.ts) and everything strict is
 *        enforced here: names are coerced to the entityName/fieldName regexes,
 *        entities and fields are capped and de-duplicated, exactly one primary
 *        key is guaranteed per entity, and relations whose endpoints do not
 *        resolve are dropped rather than written as dangling edges. This
 *        mirrors parseRolePermissions() in role.service.ts — parse defensively,
 *        never trust the returned blob.
 * WHERE: Called by src/trpc/routers/ai-schema.ts. Gemini access via
 *        src/lib/config/google-ai.ts; DB writes go through the passed DbClient
 *        so they join the procedure factory's transaction.
 */

import { generateObject } from 'ai'

import type { DbClient } from '@/lib/config/prisma'
import { getGoogleAiModels, isGoogleAiConfigured } from '@/lib/config/google-ai'
import { DATA_TYPE_KEYS } from '@/lib/config/data-types'
import {
  aiDesignSchema,
  AI_DESIGN_MAX_ENTITIES,
  AI_DESIGN_MAX_FIELDS,
  type AiDesignValues,
  type AiSchemaMode,
  type DiagramWithGraphRow,
} from '@/lib/types'

/* Canvas grid used when placing generated cards. Entity nodes are ~280px wide;
 * these gaps keep edges readable without an auto-layout pass. */
const GRID_COLUMNS = 4
const GRID_STEP_X = 360
const GRID_STEP_Y = 320

/**
 * SOURCE OF TRUTH KEYWORDS: AI_SCHEMA_SYSTEM_PROMPT
 *
 * WHAT:  The instruction block that constrains Gemini to this app's data model.
 * WHY:   Every rule here has a matching hard check in sanitizeAiDesign — the
 *        prompt raises output quality, the sanitizer guarantees correctness.
 *        Listing the allowed data types inline (rather than relying only on the
 *        JSON-schema enum) measurably reduces invalid-type retries.
 */
const AI_SCHEMA_SYSTEM_PROMPT = [
  'You are a senior database architect. You turn a product description into a normalized relational schema.',
  '',
  'Rules you MUST follow:',
  '- Entity names: PascalCase, singular, letters/numbers/underscore only. e.g. "Course", "Enrollment", "LessonProgress".',
  '- Field names: camelCase, letters/numbers/underscore only, starting lowercase. e.g. "id", "createdAt", "courseId".',
  '- Every entity has EXACTLY ONE primary key field, named "id", with isPrimary true.',
  '- Foreign keys are named after the target entity plus "Id" (e.g. "courseId" referencing Course.id) and MUST also exist as a field on the entity that holds them.',
  '- Allowed dataType values ONLY: ' + DATA_TYPE_KEYS.join(', ') + '.',
  '- Use "uuid" for ids, "datetime" for timestamps, "decimal" for money, "string" for text, "json" for unstructured blobs.',
  '- Add createdAt and updatedAt datetime fields to entities that represent records users create.',
  '- Every relation must reference entities and fields you actually defined.',
  '- Prefer MANY_TO_ONE, pointing from the entity that holds the foreign key to the entity it references.',
  '- Model many-to-many with an explicit join entity (e.g. Enrollment between Student and Course) instead of MANY_TO_MANY.',
  '- Keep the design focused: at most ' + AI_DESIGN_MAX_ENTITIES + ' entities, and at most ' + AI_DESIGN_MAX_FIELDS + ' fields per entity.',
  '- Do NOT include auth or tenancy scaffolding (users, organizations, sessions) unless the request is specifically about that.',
].join('\n')

/**
 * SOURCE OF TRUTH KEYWORDS: buildExistingSchemaContext
 *
 * WHAT:  Renders the diagram's current entities and fields as compact text for
 *        the prompt.
 * WHY:   "extend" mode has to know what already exists or the model re-invents
 *        tables that are on the canvas, and the (diagramId, name) unique index
 *        then rejects them. Sent as text rather than JSON to keep tokens down.
 * WHERE: generateAiDesign, extend mode only.
 */
export function buildExistingSchemaContext(graph: DiagramWithGraphRow): string {
  if (graph.entities.length === 0) return 'The canvas is currently empty.'
  const lines = graph.entities.map((entity) => {
    const fields = entity.fields
      .map((field) => field.name + ':' + field.dataType + (field.isPrimary ? ' (pk)' : ''))
      .join(', ')
    return '- ' + entity.name + '(' + fields + ')'
  })
  return 'Entities already on the canvas:\n' + lines.join('\n')
}

/* ── Name coercion ─────────────────────────────────────────────────────── */

/* Strips anything the entityName/fieldName regexes reject, then fixes the
 * leading character. Returns '' when nothing usable survives; callers drop that
 * record rather than inventing a placeholder name. */
function toSafeIdentifier(raw: string, style: 'pascal' | 'camel'): string {
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[^A-Za-z0-9_ ]/g, ' ')
    .trim()
  if (!cleaned) return ''
  const words = cleaned.split(/[\s_]+/).filter(Boolean)
  if (words.length === 0) return ''
  const parts = words.map((word, index) => {
    const lower = word.toLowerCase()
    if (index === 0 && style === 'camel') return lower
    return lower.charAt(0).toUpperCase() + lower.slice(1)
  })
  const joined = parts.join('').slice(0, 60)
  /* A name starting with a digit satisfies neither regex. */
  return /^[A-Za-z]/.test(joined) ? joined : ''
}

/**
 * SOURCE OF TRUTH KEYWORDS: sanitizeAiDesign
 *
 * WHAT:  Turns a raw model reply into a design guaranteed to satisfy every
 *        schema constraint, and reports what it had to discard.
 * WHY:   Runs BEFORE any write, so a hallucinated name, a duplicate column, a
 *        second primary key or an edge to a non-existent table becomes a
 *        dropped record instead of a transaction that fails halfway through the
 *        batch. `taken` carries names already on the canvas so extend mode
 *        cannot collide with the (diagramId, name) unique index.
 * WHERE: generateAiDesign.
 */
export function sanitizeAiDesign(
  design: AiDesignValues,
  taken: ReadonlySet<string> = new Set()
): { design: AiDesignValues; droppedEntities: number; droppedRelations: number } {
  const usedEntityNames = new Set<string>(taken)
  const entities: AiDesignValues['entities'] = []
  let droppedEntities = 0

  for (const entity of design.entities) {
    if (entities.length >= AI_DESIGN_MAX_ENTITIES) {
      droppedEntities++
      continue
    }
    const name = toSafeIdentifier(entity.name, 'pascal')
    if (!name || usedEntityNames.has(name)) {
      droppedEntities++
      continue
    }

    const usedFieldNames = new Set<string>()
    const fields: AiDesignValues['entities'][number]['fields'] = []
    for (const field of entity.fields) {
      if (fields.length >= AI_DESIGN_MAX_FIELDS) break
      const fieldName = toSafeIdentifier(field.name, 'camel')
      if (!fieldName || usedFieldNames.has(fieldName)) continue
      usedFieldNames.add(fieldName)
      fields.push({
        name: fieldName,
        dataType: field.dataType,
        isPrimary: field.isPrimary,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
      })
    }

    /* An entity with no columns is useless on the canvas. */
    if (fields.length === 0) {
      droppedEntities++
      continue
    }

    /* Exactly one primary key: keep the first the model marked, else promote a
     * field literally called `id`, else the first field. The database has no
     * such constraint, but diagramEntities.addField/updateField enforce it and
     * the export adapters assume it. */
    const firstMarked = fields.findIndex((field) => field.isPrimary)
    const byIdName = fields.findIndex((field) => field.name === 'id')
    const primaryIndex = firstMarked >= 0 ? firstMarked : byIdName >= 0 ? byIdName : 0
    const resolvedFields = fields.map((field, index) => ({
      ...field,
      isPrimary: index === primaryIndex,
      isRequired: index === primaryIndex ? true : field.isRequired,
    }))

    usedEntityNames.add(name)
    entities.push({ name, note: entity.note.slice(0, 500), fields: resolvedFields })
  }

  /* Relations may only join entities that survived, through fields those
   * entities actually have. */
  const fieldsByEntity = new Map(
    entities.map((entity) => [entity.name, new Set(entity.fields.map((f) => f.name))])
  )
  const relations: AiDesignValues['relations'] = []
  const seenRelations = new Set<string>()
  let droppedRelations = 0

  for (const relation of design.relations) {
    const fromEntity = toSafeIdentifier(relation.fromEntity, 'pascal')
    const toEntity = toSafeIdentifier(relation.toEntity, 'pascal')
    const fromField = toSafeIdentifier(relation.fromField, 'camel')
    const toField = toSafeIdentifier(relation.toField, 'camel')
    const fromFields = fieldsByEntity.get(fromEntity)
    const toFields = fieldsByEntity.get(toEntity)

    if (!fromFields || !toFields || !fromFields.has(fromField) || !toFields.has(toField)) {
      droppedRelations++
      continue
    }
    const key = fromEntity + '.' + fromField + '->' + toEntity + '.' + toField
    if (seenRelations.has(key)) {
      droppedRelations++
      continue
    }
    seenRelations.add(key)
    relations.push({
      fromEntity,
      fromField,
      toEntity,
      toField,
      cardinality: relation.cardinality,
      onDelete: relation.onDelete,
      label: relation.label.slice(0, 120),
    })
  }

  return {
    design: { summary: design.summary, entities, relations },
    droppedEntities,
    droppedRelations,
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateAiDesign
 *
 * WHAT:  Prompts Gemini for a design and returns the sanitized result.
 * WHY:   Returns null when the API key is absent so the router answers with a
 *        clean PRECONDITION_FAILED instead of an SDK stack trace — the same
 *        fail-soft posture email.service.ts takes on a missing Resend key.
 * WHERE: Called by aiSchema.create in src/trpc/routers/ai-schema.ts.
 */
export async function generateAiDesign(args: {
  prompt: string
  mode: AiSchemaMode
  graph: DiagramWithGraphRow
}): Promise<{
  design: AiDesignValues
  droppedEntities: number
  droppedRelations: number
} | null> {
  if (!isGoogleAiConfigured()) return null
  const models = getGoogleAiModels('schemaDesign')
  if (models.length === 0) return null

  const isExtend = args.mode === 'extend'
  const context = isExtend
    ? buildExistingSchemaContext(args.graph) +
      '\n\nAdd to this design. Do NOT redefine entities that already exist; return only NEW entities, plus relations connecting them (relations may reference existing entities by name).'
    : 'Design this schema from scratch. The canvas will be cleared first.'

  /* Walk the fallback chain: a flash model under load answers 503 often enough
   * that one overloaded model would otherwise fail a real user request. The
   * last model's error propagates so the router can report a genuine failure. */
  let lastError: unknown
  let object: AiDesignValues | null = null
  for (const [index, model] of models.entries()) {
    try {
      const result = await generateObject({
        model,
        schema: aiDesignSchema,
        system: AI_SCHEMA_SYSTEM_PROMPT,
        prompt: context + '\n\nRequest: ' + args.prompt,
      })
      object = result.object
      break
    } catch (error) {
      lastError = error
      if (index === models.length - 1) throw error
      console.warn('[ai-schema] model failed, falling back to the next one:', error)
    }
  }
  if (!object) throw lastError

  /* In extend mode, existing names are reserved so the batch cannot trip the
   * (diagramId, name) unique index. */
  const taken = isExtend
    ? new Set(args.graph.entities.map((entity) => entity.name))
    : new Set<string>()

  return sanitizeAiDesign(object, taken)
}

/* ── Persistence ───────────────────────────────────────────────────────── */

export interface AiApplyResult {
  entitiesCreated: number
  fieldsCreated: number
  relationsCreated: number
}

/**
 * SOURCE OF TRUTH KEYWORDS: applyAiDesign, AiApplyResult
 *
 * WHAT:  Writes a sanitized design into a diagram and reports what it created.
 * WHY:   Entities are inserted first so their ids exist before fields and
 *        relations resolve against them — the model addresses endpoints BY NAME
 *        and this is the only place those names become ids. `replace` clears the
 *        existing graph in the SAME transaction, so a failed write never leaves
 *        a half-emptied canvas. New cards are laid out on a grid offset below
 *        whatever is already there.
 * WHERE: Called by aiSchema.create with ctx.db (the factory's tx client).
 */
export async function applyAiDesign(
  db: DbClient,
  args: {
    diagramId: string
    design: AiDesignValues
    mode: AiSchemaMode
    existingEntityCount: number
  }
): Promise<AiApplyResult> {
  if (args.mode === 'replace') {
    /* Relations first — they carry no FK to entities, so nothing cascades. */
    await db.diagramRelation.deleteMany({ where: { diagramId: args.diagramId } })
    await db.diagramEntity.deleteMany({ where: { diagramId: args.diagramId } })
  }

  /* Stack new rows beneath existing ones so an extend never lands on top of the
   * current design. */
  const rowOffset =
    args.mode === 'replace' ? 0 : Math.ceil(args.existingEntityCount / GRID_COLUMNS)

  const entityIdByName = new Map<string, string>()
  const fieldIdByKey = new Map<string, string>()
  let fieldsCreated = 0

  for (const [index, entity] of args.design.entities.entries()) {
    const created = await db.diagramEntity.create({
      data: {
        diagramId: args.diagramId,
        name: entity.name,
        note: entity.note,
        positionX: (index % GRID_COLUMNS) * GRID_STEP_X,
        positionY: (Math.floor(index / GRID_COLUMNS) + rowOffset) * GRID_STEP_Y,
      },
      select: { id: true },
    })
    entityIdByName.set(entity.name, created.id)

    for (const [order, field] of entity.fields.entries()) {
      const createdField = await db.diagramEntityField.create({
        data: {
          entityId: created.id,
          name: field.name,
          dataType: field.dataType,
          isPrimary: field.isPrimary,
          isRequired: field.isRequired,
          isUnique: field.isUnique,
          order,
        },
        select: { id: true },
      })
      fieldIdByKey.set(entity.name + '.' + field.name, createdField.id)
      fieldsCreated++
    }
  }

  /* Extend mode may point at entities that were already on the canvas, so a
   * name missing from this batch falls back to a lookup against stored rows. */
  let relationsCreated = 0
  for (const relation of args.design.relations) {
    const fromEntityId =
      entityIdByName.get(relation.fromEntity) ??
      (await findExistingEntityId(db, args.diagramId, relation.fromEntity))
    const toEntityId =
      entityIdByName.get(relation.toEntity) ??
      (await findExistingEntityId(db, args.diagramId, relation.toEntity))
    if (!fromEntityId || !toEntityId) continue

    const fromFieldId =
      fieldIdByKey.get(relation.fromEntity + '.' + relation.fromField) ??
      (await findExistingFieldId(db, fromEntityId, relation.fromField))
    const toFieldId =
      fieldIdByKey.get(relation.toEntity + '.' + relation.toField) ??
      (await findExistingFieldId(db, toEntityId, relation.toField))

    await db.diagramRelation.create({
      data: {
        diagramId: args.diagramId,
        fromEntityId,
        fromFieldId,
        toEntityId,
        toFieldId,
        cardinality: relation.cardinality,
        onDelete: relation.onDelete,
        label: relation.label,
      },
    })
    relationsCreated++
  }

  return {
    entitiesCreated: args.design.entities.length,
    fieldsCreated,
    relationsCreated,
  }
}

async function findExistingEntityId(
  db: DbClient,
  diagramId: string,
  name: string
): Promise<string | null> {
  const row = await db.diagramEntity.findFirst({
    where: { diagramId, name },
    select: { id: true },
  })
  return row?.id ?? null
}

async function findExistingFieldId(
  db: DbClient,
  entityId: string,
  name: string
): Promise<string | null> {
  const row = await db.diagramEntityField.findFirst({
    where: { entityId, name },
    select: { id: true },
  })
  return row?.id ?? null
}
