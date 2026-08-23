/**
 * SOURCE OF TRUTH KEYWORDS: diagramsRouter, diagrams.list, diagrams.getById,
 *   diagrams.create, diagrams.update, diagrams.delete, diagrams.duplicate,
 *   diagrams.saveCanvas, diagrams.addRelation, diagrams.updateRelation,
 *   diagrams.deleteRelation, DIAGRAM_CONFLICT
 *
 * WHAT:  Diagram-level surface — CRUD, deep-copy duplicate, batched canvas
 *        autosave with optimistic concurrency, and typed relation edges.
 * WHY:   Built on protectedProcedure so auth/org-scoping/audit/tx/gates are
 *        automatic. Path names drive behavior: `diagrams.create` auto-checks
 *        the plan limit and bumps the counter; `diagrams.delete` auto-
 *        decrements; `saveCanvas` opts out of audit (`audit: false`) and is
 *        rate-limited via RESOURCES. `duplicate` creates a diagram WITHOUT
 *        matching the auto-wired `create` verb, so it performs the SAME gate
 *        and counter bump explicitly — skipping it would let duplicates
 *        bypass the org's plan cap.
 * WHERE: Mounted as `diagrams` in src/trpc/routers/_app.ts; DB access via
 *        src/services/diagram.service.ts (`import *`).
 */

import { TRPCError } from '@trpc/server'
import { createTRPCRouter, createStructuredError } from '../init'
import { protectedProcedure } from '../procedures'
import { permissions } from '@/lib/better-auth/permissions'
import { ERROR_CODES } from '@/lib/errors'
import { checkFeatureGate } from '@/lib/feature-gate'
import { incrementUsage } from '@/services/usage.service'
import * as diagramService from '@/services/diagram.service'
import {
  createDiagramSchema,
  updateDiagramSchema,
  duplicateDiagramSchema,
  listDiagramsSchema,
  getDiagramSchema,
  deleteDiagramSchema,
  saveCanvasSchema,
  createRelationSchema,
  updateRelationSchema,
  deleteRelationSchema,
} from '@/lib/types'

/* Rethrows Prisma unique-constraint violations as a user-facing message. */
function throwIfUniqueViolation(error: unknown, message: string): void {
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  ) {
    throw new TRPCError({ code: 'CONFLICT', message })
  }
}

export const diagramsRouter = createTRPCRouter({
  /* Paginated list for /dashboard/diagrams cards. */
  list: protectedProcedure({
    requirePermission: permissions.DIAGRAMS_READ,
    paginate: true,
  })
    .input(listDiagramsSchema)
    .query(async ({ ctx, input }) => {
      const { rows, total } = await diagramService.listDiagrams(
        ctx.db,
        input.organizationId,
        ctx.pagination.skip,
        ctx.pagination.take
      )
      return { rows, total }
    }),

  /* Full design graph in one query — hydrates the canvas editor. */
  getById: protectedProcedure({ requirePermission: permissions.DIAGRAMS_READ })
    .input(getDiagramSchema)
    .query(async ({ ctx, input }) => {
      const graph = await diagramService.getDiagramGraph(
        ctx.db,
        input.organizationId,
        input.diagramId
      )
      if (!graph) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })
      return graph
    }),

  /* Limit gate + counter bump + audit are AUTO via the `diagrams.create` path.
   * Names are unique per org (schema-level) — pre-checked for a clean error. */
  create: protectedProcedure({ requirePermission: permissions.DIAGRAMS_CREATE })
    .input(createDiagramSchema)
    .mutation(async ({ ctx, input }) => {
      const clash = await ctx.db.diagram.findFirst({
        where: { organizationId: input.organizationId, name: input.name },
        select: { id: true },
      })
      if (clash) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have a diagram with this name.',
        })
      }
      try {
        return await ctx.db.diagram.create({
          data: {
            organizationId: input.organizationId,
            name: input.name,
            description: input.description,
            createdById: ctx.user.id,
          },
        })
      } catch (error) {
        throwIfUniqueViolation(error, 'You already have a diagram with this name.')
        throw error
      }
    }),

  /* Rename / edit description. */
  update: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(updateDiagramSchema)
    .mutation(async ({ ctx, input }) => {
      const diagram = await ctx.db.diagram.findFirst({
        where: { id: input.diagramId, organizationId: input.organizationId },
        select: { id: true },
      })
      if (!diagram) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })

      try {
        return await ctx.db.diagram.update({
          where: { id: diagram.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.description !== undefined ? { description: input.description } : {}),
          },
        })
      } catch (error) {
        throwIfUniqueViolation(error, 'You already have a diagram with this name.')
        throw error
      }
    }),

  /* Factory auto-decrements the diagrams counter (result has no numeric
   * `count` field → exactly 1). Children cascade at the DB level. */
  delete: protectedProcedure({ requirePermission: permissions.DIAGRAMS_DELETE })
    .input(deleteDiagramSchema)
    .mutation(async ({ ctx, input }) => {
      const deleted = await ctx.db.diagram.deleteMany({
        where: { id: input.diagramId, organizationId: input.organizationId },
      })
      if (deleted.count === 0) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })
      }
      return { id: input.diagramId }
    }),

  /* Deep-copies entities, fields, relations and positions. Because the path
   * verb is NOT `create`, the factory's limit gate and counter never fire —
   * both are performed HERE so duplication can't exceed the plan cap. */
  duplicate: protectedProcedure({ requirePermission: permissions.DIAGRAMS_CREATE })
    .input(duplicateDiagramSchema)
    .mutation(async ({ ctx, input }) => {
      const source = await diagramService.getDiagramGraph(
        ctx.db,
        input.organizationId,
        input.diagramId
      )
      if (!source) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })

      const gate = await checkFeatureGate(input.organizationId, 'diagrams', 1)
      if (!gate.allowed) {
        throw createStructuredError('FORBIDDEN', gate.reason || 'Plan limit reached', {
          errorCode: ERROR_CODES.USAGE_LIMIT_REACHED,
          resource: 'diagrams' as const,
          limit: gate.limit ?? 0,
          current: gate.currentUsage ?? 0,
          upgradeRequired: true,
          message: gate.reason || 'You have reached your plan limit for this feature',
        })
      }

      /* Pick a unique "… copy" name inside the same tx that writes the copy,
       * so a concurrent create can't slip a clash past the check. */
      const baseName = input.name ?? `${source.name} copy`
      let candidateName = baseName
      for (let attempt = 0; attempt < 20; attempt++) {
        const taken = await ctx.db.diagram.findFirst({
          where: { organizationId: input.organizationId, name: candidateName },
          select: { id: true },
        })
        if (!taken) break
        candidateName = `${baseName} (${attempt + 2})`
      }

      const created = await diagramService.duplicateDiagramGraph(ctx.db, source, {
        organizationId: input.organizationId,
        name: candidateName,
        description: source.description,
        createdById: ctx.user.id,
      })
      /* Mirror the factory's `.create` counter math for the manual gate. */
      await incrementUsage(input.organizationId, 'diagrams', 1, ctx.db)

      return created
    }),

  /* High-frequency autosave (positions + viewport). No audit by design;
   * rate-limited via RESOURCES. Stale version ⇒ CONFLICT carrying the fresh
   * version so the client can offer reload-or-overwrite. */
  saveCanvas: protectedProcedure({
    requirePermission: permissions.DIAGRAMS_UPDATE,
    audit: false,
    txTimeout: 15_000,
  })
    .input(saveCanvasSchema)
    .mutation(async ({ ctx, input }) => {
      const saved = await diagramService.saveCanvasGeometry(ctx.db, {
        diagramId: input.diagramId,
        version: input.version,
        viewportX: input.viewportX,
        viewportY: input.viewportY,
        viewportZoom: input.viewportZoom,
        entities: input.entities,
      })
      if (!saved) {
        const current = await ctx.db.diagram.findFirst({
          where: { id: input.diagramId, organizationId: input.organizationId },
          select: { version: true },
        })
        if (!current) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This design was changed by someone else.',
          cause: { currentVersion: current.version },
        })
      }
      return { saved: true, version: input.version + 1 }
    }),

  /* ── Relations ────────────────────────────────────────────────────────────
   * Edges live under `diagrams` because they belong to the DESIGN, not to any
   * single entity card. Verbs deliberately avoid `create`/`delete` so the
   * factory's diagram counter is untouched — only entity rows count toward
   * quotas. Every write bumps the diagram version for concurrency drift. */

  addRelation: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(createRelationSchema)
    .mutation(async ({ ctx, input }) => {
      const diagram = await ctx.db.diagram.findFirst({
        where: { id: input.diagramId, organizationId: input.organizationId },
        select: { id: true },
      })
      if (!diagram) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })

      const endpoints = [
        { entityId: input.fromEntityId, fieldId: input.fromFieldId ?? null },
        { entityId: input.toEntityId, fieldId: input.toFieldId ?? null },
      ] as const

      /* Both entities must exist INSIDE this diagram, and any referenced
       * fields must belong to their entity — otherwise edges could point at
       * another tenant's rows. */
      for (const endpoint of endpoints) {
        const entity = await ctx.db.diagramEntity.findFirst({
          where: { id: endpoint.entityId, diagramId: diagram.id },
          select: { id: true },
        })
        if (!entity) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Both ends of a relation must be entities in this design.',
          })
        }
        if (endpoint.fieldId) {
          const field = await ctx.db.diagramEntityField.findFirst({
            where: { id: endpoint.fieldId, entityId: entity.id },
            select: { id: true },
          })
          if (!field) {
            throw new TRPCError({
              code: 'BAD_REQUEST',
              message: 'The referenced field does not belong to the connected entity.',
            })
          }
        }
      }

      const created = await ctx.db.diagramRelation.create({
        data: {
          diagramId: diagram.id,
          fromEntityId: input.fromEntityId,
          fromFieldId: input.fromFieldId ?? null,
          toEntityId: input.toEntityId,
          toFieldId: input.toFieldId ?? null,
          cardinality: input.cardinality,
          onDelete: input.onDelete,
          label: input.label,
        },
      })
      await diagramService.bumpDiagramVersion(ctx.db, diagram.id)
      return created
    }),

  updateRelation: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(updateRelationSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramRelation.findFirst({
        where: { id: input.relationId, diagram: { organizationId: input.organizationId } },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Relation not found' })

      /* Field re-points must stay within their respective entities. */
      if (input.fromFieldId) {
        const field = await ctx.db.diagramEntityField.findFirst({
          where: { id: input.fromFieldId, entityId: existing.fromEntityId },
          select: { id: true },
        })
        if (!field) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The source field does not belong to the relation’s source entity.',
          })
        }
      }
      if (input.toFieldId) {
        const field = await ctx.db.diagramEntityField.findFirst({
          where: { id: input.toFieldId, entityId: existing.toEntityId },
          select: { id: true },
        })
        if (!field) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'The target field does not belong to the relation’s target entity.',
          })
        }
      }

      const updated = await ctx.db.diagramRelation.update({
        where: { id: existing.id },
        data: {
          ...(input.cardinality !== undefined ? { cardinality: input.cardinality } : {}),
          ...(input.onDelete !== undefined ? { onDelete: input.onDelete } : {}),
          ...(input.label !== undefined ? { label: input.label } : {}),
          ...(input.fromFieldId !== undefined ? { fromFieldId: input.fromFieldId } : {}),
          ...(input.toFieldId !== undefined ? { toFieldId: input.toFieldId } : {}),
        },
      })
      await diagramService.bumpDiagramVersion(ctx.db, existing.diagramId)
      return updated
    }),

  deleteRelation: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(deleteRelationSchema)
    .mutation(async ({ ctx, input }) => {
      /* Read scoped first so the version bump knows its diagram; the delete
       * then targets the verified id. */
      const existing = await ctx.db.diagramRelation.findFirst({
        where: { id: input.relationId, diagram: { organizationId: input.organizationId } },
        select: { id: true, diagramId: true },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Relation not found' })

      await ctx.db.diagramRelation.delete({ where: { id: existing.id } })
      await diagramService.bumpDiagramVersion(ctx.db, existing.diagramId)
      return { id: existing.id }
    }),
})
