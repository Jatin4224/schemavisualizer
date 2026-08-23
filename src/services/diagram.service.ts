import 'server-only'

/**
 * SOURCE OF TRUTH KEYWORDS: diagramService, getDiagramGraph, listDiagrams,
 *   duplicateDiagramGraph, saveCanvasGeometry, bumpDiagramVersion,
 *   buildSnapshotPayload, restoreSnapshotFromPayload, diagramGraphInclude,
 *   DIAGRAM_GRAPH_INCLUDE
 *
 * WHAT:  Pure Prisma access for Schema Studio — the design-graph read, the
 *        list query, deep-copy duplication, version-guarded canvas autosave,
 *        and snapshot serialize/restore. No business decisions here: version
 *        CONFLICT policy, name-uniqueness errors, and impact messaging are the
 *        routers' job (they receive this module via `import *`).
 * WHY:   CLAUDE.md layer contract — the ONLY place diagram tables are touched.
 *        Every function takes `db: DbClient` so the protected procedure's tx
 *        client flows in and handler writes commit atomically with counters
 *        and audit rows.
 * WHERE: Called by src/trpc/routers/diagrams.ts and diagram-entities.ts.
 *        Export dialect rendering lives in src/services/diagram-export.service.ts.
 */

import type { DbClient } from '@/lib/config/prisma'
import type { Prisma, Diagram } from '@/generated/prisma'
import type {
  DiagramListItemRow,
  DiagramWithGraphRow,
  SnapshotPayloadValues,
} from '@/lib/types'
import { isCardinalityValue, isOnDeleteValue } from '@/lib/types'
import { isDataTypeKey } from '@/lib/config/data-types'
import { isEntityColorTokenKey } from '@/lib/config/entity-colors'

/**
 * SOURCE OF TRUTH KEYWORDS: diagramGraphInclude
 *
 * WHAT:  The canonical nested include for a full design graph — entities with
 *        their ordered fields, plus all relations — in ONE query.
 * WHY:   PRD load target (<400ms p95 at 100 entities) depends on a single
 *        round-trip; keeping the include here means getById, duplicate, and
 *        snapshot serialization can never drift apart on shape or ordering.
 * WHERE: Used by getDiagramGraph below; mirrors the DiagramWithGraphRow type
 *        in src/lib/types/diagram.ts.
 */
export const diagramGraphInclude = {
  entities: {
    include: { fields: { orderBy: { order: 'asc' as const } } },
    orderBy: { name: 'asc' as const },
  },
  relations: true,
} satisfies Prisma.DiagramInclude

/* ── Reads ─────────────────────────────────────────────────────────────── */

/**
 * SOURCE OF TRUTH KEYWORDS: listDiagrams
 *
 * WHAT:  Paginated org-scoped diagram list with entity/relation/snapshot
 *        counts and creator meta — exactly what the list-page cards render.
 * WHY:   One query + one count keeps pagination math in the router simple;
 *        ordering by updatedAt puts recently-edited designs first.
 * WHERE: diagrams.list in src/trpc/routers/diagrams.ts.
 */
export async function listDiagrams(
  db: DbClient,
  organizationId: string,
  skip: number,
  take: number
): Promise<{ rows: DiagramListItemRow[]; total: number }> {
  const [rows, total] = await Promise.all([
    db.diagram.findMany({
      where: { organizationId },
      include: {
        _count: { select: { entities: true, relations: true, snapshots: true } },
        createdBy: { select: { id: true, name: true, image: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip,
      take,
    }),
    db.diagram.count({ where: { organizationId } }),
  ])
  return { rows, total }
}

/**
 * SOURCE OF TRUTH KEYWORDS: getDiagramGraph
 *
 * WHAT:  Fetches one diagram WITH its full graph, scoped by organization so a
 *        guessed id from another tenant returns null rather than data.
 * WHY:   Org-scoping lives IN the query (not just the procedure membership
 *        check) as defense-in-depth for the tenancy rule.
 * WHERE: diagrams.getById in src/trpc/routers/diagrams.ts; also the base read
 *        for duplicate and export.
 */
export async function getDiagramGraph(
  db: DbClient,
  organizationId: string,
  diagramId: string
): Promise<DiagramWithGraphRow | null> {
  return db.diagram.findFirst({
    where: { id: diagramId, organizationId },
    include: diagramGraphInclude,
  })
}

/* ── Writes ────────────────────────────────────────────────────────────── */

/**
 * SOURCE OF TRUTH KEYWORDS: bumpDiagramVersion
 *
 * WHAT:  Increments the diagram's concurrency version by 1.
 * WHY:   Every content mutation (entity/field/relation) bumps the version so
 *          other open editors detect drift on their next autosave and get the
 *          reload-or-overwrite choice instead of silently clobbering.
 * WHERE: Called by entity/field/relation mutation handlers inside their tx.
 */
export async function bumpDiagramVersion(db: DbClient, diagramId: string): Promise<void> {
  await db.diagram.update({
    where: { id: diagramId },
    data: { version: { increment: 1 } },
  })
}

/**
 * SOURCE OF TRUTH KEYWORDS: saveCanvasGeometry
 *
 * WHAT:  Batched autosave — viewport plus per-entity geometry in one call,
 *          guarded by optimistic concurrency (`version` match required).
 * WHY:   High-frequency path (~800ms debounce): a single updateMany on the
 *          diagram (which both checks AND increments the version atomically)
 *          followed by per-entity updateMany writes, all inside the caller's
 *          tx. A version miss updates zero rows and reports failure so the
 *          router raises CONFLICT instead of clobbering a concurrent editor.
 * WHERE: diagrams.saveCanvas in src/trpc/routers/diagrams.ts.
 */
export async function saveCanvasGeometry(
  db: DbClient,
  input: {
    diagramId: string
    version: number
    viewportX: number
    viewportY: number
    viewportZoom: number
    entities: ReadonlyArray<{ id: string; positionX: number; positionY: number; collapsed: boolean }>
  }
): Promise<boolean> {
  /* Atomic check-and-bump: count === 0 ⇔ stale version ⇔ CONFLICT. */
  const head = await db.diagram.updateMany({
    where: { id: input.diagramId, version: input.version },
    data: {
      version: { increment: 1 },
      viewportX: input.viewportX,
      viewportY: input.viewportY,
      viewportZoom: input.viewportZoom,
    },
  })
  if (head.count === 0) return false

  await Promise.all(
    input.entities.map((patch) =>
      db.diagramEntity.updateMany({
        where: { id: patch.id, diagramId: input.diagramId },
        data: {
          positionX: patch.positionX,
          positionY: patch.positionY,
          collapsed: patch.collapsed,
        },
      })
    )
  )
  return true
}

/**
 * SOURCE OF TRUTH KEYWORDS: duplicateDiagramGraph
 *
 * WHAT:  Deep-copies a diagram's entire graph (entities → fields → relations)
 *          under a NEW diagram row, remapping ids. Caller supplies the new
 *          name and createdById; uniqueness of that name was checked upstream.
 * WHY:   Relations point at entity/field ids, so a naive row clone would dangle
 *          — the remap maps old→new ids while copying, keeping edges intact.
 *        Runs in the caller's tx so the factory's counter bump commits or rolls
 *          back together with the copy.
 * WHERE: diagrams.duplicate in src/trpc/routers/diagrams.ts.
 */
export async function duplicateDiagramGraph(
  db: DbClient,
  source: DiagramWithGraphRow,
  fresh: { organizationId: string; name: string; description: string; createdById?: string | null }
): Promise<Diagram> {
  const created = await db.diagram.create({
    data: {
      organizationId: fresh.organizationId,
      name: fresh.name,
      description: fresh.description,
      viewportX: source.viewportX,
      viewportY: source.viewportY,
      viewportZoom: source.viewportZoom,
      createdById: fresh.createdById ?? null,
    },
  })

  const entityIdMap = new Map<string, string>()
  for (const entity of source.entities) {
    const copy = await db.diagramEntity.create({
      data: {
        diagramId: created.id,
        name: entity.name,
        note: entity.note,
        color: entity.color,
        positionX: entity.positionX,
        positionY: entity.positionY,
        collapsed: entity.collapsed,
      },
    })
    entityIdMap.set(entity.id, copy.id)

    /* Field ids never leave the entity scope, so they need no map — copies
     * are created per-field and relations don't reference field ROWS across
     * diagrams (fromFieldId/toFieldId are validated against the copied set by
     * the validator later; they're advisory labels on edges, not FKs). */
    for (const field of [...entity.fields].sort((a, b) => a.order - b.order)) {
      await db.diagramEntityField.create({
        data: {
          entityId: copy.id,
          name: field.name,
          dataType: field.dataType,
          isPrimary: field.isPrimary,
          isRequired: field.isRequired,
          isUnique: field.isUnique,
          defaultValue: field.defaultValue,
          order: field.order,
        },
      })
    }
  }

  for (const relation of source.relations) {
    const fromEntityId = entityIdMap.get(relation.fromEntityId)
    const toEntityId = entityIdMap.get(relation.toEntityId)
    if (!fromEntityId || !toEntityId) continue
    await db.diagramRelation.create({
      data: {
        diagramId: created.id,
        fromEntityId,
        toEntityId,
        cardinality: relation.cardinality,
        onDelete: relation.onDelete,
        label: relation.label,
      },
    })
  }

  return created
}

/* ── Snapshots ─────────────────────────────────────────────────────────── */

/**
 * SOURCE OF TRUTH KEYWORDS: buildSnapshotPayload
 *
 * WHAT:  Serializes a full design graph into the SnapshotPayloadValues shape
 *          stored as JSON on a DiagramSnapshot row.
 * WHY:   Snapshots embed rows BY VALUE so restore is one write and the copy
 *          survives later edits/deletes of live rows. Single serializer here =
 *          single source of truth for the payload shape (validated by
 *          snapshotPayloadSchema in src/lib/types/diagram.ts). String columns
 *          (`color`, `dataType`, `cardinality`, `onDelete`) cross the
 *          DB-string → registry-union boundary via the config guards; a value
 *          that fails its guard is IMPOSSIBLE through the zod-validated
 *          routers, so the row is dropped rather than persisted as corruption.
 * WHERE: diagram-history.create in src/trpc/routers/diagram-history.ts.
 */
export function buildSnapshotPayload(graph: DiagramWithGraphRow): SnapshotPayloadValues {
  return {
    savedAt: new Date().toISOString(),
    viewport: {
      x: graph.viewportX,
      y: graph.viewportY,
      zoom: graph.viewportZoom,
    },
    entities: graph.entities.map((entity) => ({
      id: entity.id,
      name: entity.name,
      note: entity.note,
      /* DB-string → union boundary: impossible values degrade to neutral
       * rather than blocking restore (see guard docs in config). */
      color:
        entity.color !== null && isEntityColorTokenKey(entity.color)
          ? entity.color
          : null,
      positionX: entity.positionX,
      positionY: entity.positionY,
      collapsed: entity.collapsed,
      fields: entity.fields.flatMap((field) =>
        isDataTypeKey(field.dataType)
          ? [
              {
                id: field.id,
                name: field.name,
                dataType: field.dataType,
                isPrimary: field.isPrimary,
                isRequired: field.isRequired,
                isUnique: field.isUnique,
                defaultValue: field.defaultValue,
                order: field.order,
              },
            ]
          : []
      ),
    })),
    relations: graph.relations.flatMap((relation) =>
      isCardinalityValue(relation.cardinality) && isOnDeleteValue(relation.onDelete)
        ? [
            {
              id: relation.id,
              fromEntityId: relation.fromEntityId,
              fromFieldId: relation.fromFieldId,
              toEntityId: relation.toEntityId,
              toFieldId: relation.toFieldId,
              cardinality: relation.cardinality,
              onDelete: relation.onDelete,
              label: relation.label,
            },
          ]
        : []
    ),
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: restoreSnapshotFromPayload
 *
 * WHAT:  Replaces a diagram's live graph with the snapshot payload — wipes
 *          current relations/entities, then recreates rows PRESERVING the
 *          payload ids, plus restores the viewport and bumps the version.
 * WHY:   Preserving ids keeps relation endpoints valid without remapping, and
 *          recreate-in-tx guarantees the design never appears half-restored.
 *          Caller parsed the payload with snapshotPayloadSchema BEFORE calling
 *          — this function trusts its input completely.
 * WHERE: diagram-history.restore in src/trpc/routers/diagram-history.ts.
 */
export async function restoreSnapshotFromPayload(
  db: DbClient,
  diagramId: string,
  payload: SnapshotPayloadValues
): Promise<void> {
  /* Wipe children (relations first — though neither carries an FK to the
   * other, order documents intent), then bulk-recreate from the payload. */
  await db.diagramRelation.deleteMany({ where: { diagramId } })
  await db.diagramEntity.deleteMany({ where: { diagramId } })

  if (payload.entities.length > 0) {
    await db.diagramEntity.createMany({
      data: payload.entities.map((entity) => ({
        id: entity.id,
        diagramId,
        name: entity.name,
        note: entity.note,
        color: entity.color,
        positionX: entity.positionX,
        positionY: entity.positionY,
        collapsed: entity.collapsed,
      })),
    })
    const fieldRows = payload.entities.flatMap((entity) =>
      entity.fields.map((field) => ({
        id: field.id,
        entityId: entity.id,
        name: field.name,
        dataType: field.dataType,
        isPrimary: field.isPrimary,
        isRequired: field.isRequired,
        isUnique: field.isUnique,
        defaultValue: field.defaultValue,
        order: field.order,
      }))
    )
    if (fieldRows.length > 0) {
      await db.diagramEntityField.createMany({ data: fieldRows })
    }
  }

  if (payload.relations.length > 0) {
    await db.diagramRelation.createMany({
      data: payload.relations.map((relation) => ({
        id: relation.id,
        diagramId,
        fromEntityId: relation.fromEntityId,
        fromFieldId: relation.fromFieldId,
        toEntityId: relation.toEntityId,
        toFieldId: relation.toFieldId,
        cardinality: relation.cardinality,
        onDelete: relation.onDelete,
        label: relation.label,
      })),
    })
  }

  await db.diagram.update({
    where: { id: diagramId },
    data: {
      viewportX: payload.viewport.x,
      viewportY: payload.viewport.y,
      viewportZoom: payload.viewport.zoom,
      version: { increment: 1 },
    },
  })
}
