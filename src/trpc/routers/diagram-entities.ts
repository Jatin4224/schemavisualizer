/**
 * SOURCE OF TRUTH KEYWORDS: diagramEntitiesRouter, diagramEntities.create,
 *   diagramEntities.delete, diagramEntities.update, diagramEntities.addField,
 *   diagramEntities.updateField, diagramEntities.deleteField,
 *   diagramEntities.reorderFields, ENTITY_QUOTA
 *
 * WHAT:  Entity-card and field-row surface for a design. Entities carry the
 *        org-wide size quota (`diagramEntities` LIMIT resource); fields are
 *        unquota'd children exposed as single-dot verbs that deliberately do
 *        NOT match the auto-wired `create`/`delete` counter verbs.
 * WHY:   The RESOURCES registry gates derive from the FIRST path segment, so
 *        entity rows MUST live at `<diagramEntities>.<verb>` to get their plan
 *        cap and counters automatically (same mechanism as `auditLogs.*`).
 *        Every write bumps the parent diagram's version so other open editors
 *        detect drift on their next autosave instead of clobbering it.
 * WHERE: Mounted as `diagramEntities` in src/trpc/routers/_app.ts; DB access
 *        via src/services/diagram.service.ts (`import *`) plus scoped inline
 *        queries following the member.ts precedent.
 */

import { TRPCError } from '@trpc/server'
import { createTRPCRouter } from '../init'
import { protectedProcedure } from '../procedures'
import { permissions } from '@/lib/better-auth/permissions'
import * as diagramService from '@/services/diagram.service'
import {
  createEntitySchema,
  updateEntitySchema,
  deleteEntitySchema,
  createFieldSchema,
  updateFieldSchema,
  deleteFieldSchema,
  reorderFieldsSchema,
} from '@/lib/types'

/* Rethrows Prisma unique-constraint violations with a user-facing message. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === 'P2002'
  )
}

export const diagramEntitiesRouter = createTRPCRouter({
  /* Limit gate + counter AUTO via the `<diagramEntities>.create` path. */
  create: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(createEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const diagram = await ctx.db.diagram.findFirst({
        where: { id: input.diagramId, organizationId: input.organizationId },
        select: { id: true },
      })
      if (!diagram) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })

      try {
        const created = await ctx.db.diagramEntity.create({
          data: {
            diagramId: diagram.id,
            name: input.name,
            note: input.note,
            color: input.color ?? null,
            positionX: input.positionX,
            positionY: input.positionY,
          },
          include: { fields: { orderBy: { order: 'asc' } } },
        })
        await diagramService.bumpDiagramVersion(ctx.db, diagram.id)
        return created
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An entity with this name already exists in this design.',
          })
        }
        throw error
      }
    }),

  /* Rename / note / color / collapse. Geometry moves ride saveCanvas instead
   * so dragging never pays an audit row or version conflict round-trip. */
  update: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(updateEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramEntity.findFirst({
        where: { id: input.entityId, diagram: { organizationId: input.organizationId } },
        select: { id: true, diagramId: true },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' })

      try {
        const updated = await ctx.db.diagramEntity.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.note !== undefined ? { note: input.note } : {}),
            ...(input.color !== undefined ? { color: input.color ?? null } : {}),
            ...(input.collapsed !== undefined ? { collapsed: input.collapsed } : {}),
          },
          include: { fields: { orderBy: { order: 'asc' } } },
        })
        await diagramService.bumpDiagramVersion(ctx.db, existing.diagramId)
        return updated
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'An entity with this name already exists in this design.',
          })
        }
        throw error
      }
    }),

  /* Factory auto-decrements the entity counter. Relations have NO database FK
   * to entities, so edges touching this card are deleted HERE first. The
   * return value must NOT contain a numeric `count` field — the factory reads
   * `result.count` to decide its decrement quantity and entities always
   * decrement by exactly 1 regardless of how many edges died. */
  delete: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(deleteEntitySchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramEntity.findFirst({
        where: { id: input.entityId, diagram: { organizationId: input.organizationId } },
        select: { id: true, diagramId: true },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' })

      const edges = await ctx.db.diagramRelation.deleteMany({
        where: { diagramId: existing.diagramId, OR: [
          { fromEntityId: existing.id },
          { toEntityId: existing.id },
        ] },
      })
      await ctx.db.diagramEntity.delete({ where: { id: existing.id } })
      await diagramService.bumpDiagramVersion(ctx.db, existing.diagramId)

      return { id: existing.id, removedRelations: edges.count }
    }),

  /* ── Fields ────────────────────────────────────────────────────────────────
   * Single-dot verbs that intentionally miss the auto-counter (`addfield` ≠
   * `create`): only entity ROWS count toward the org-wide design-size quota.
   * Each write bumps the parent diagram's concurrency version. */

  addField: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(createFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.diagramEntity.findFirst({
        where: { id: input.entityId, diagram: { organizationId: input.organizationId } },
        select: { id: true, diagramId: true },
      })
      if (!entity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' })

      /* Enforce one primary key per entity: promoting this field demotes the
       * previous PK in the SAME tx, so the invariant can't interleave. */
      if (input.isPrimary) {
        await ctx.db.diagramEntityField.updateMany({
          where: { entityId: entity.id, isPrimary: true },
          data: { isPrimary: false },
        })
      }

      const last = await ctx.db.diagramEntityField.aggregate({
        where: { entityId: entity.id },
        _max: { order: true },
      })

      try {
        const created = await ctx.db.diagramEntityField.create({
          data: {
            entityId: entity.id,
            name: input.name,
            dataType: input.dataType,
            isPrimary: input.isPrimary ?? false,
            isRequired: input.isRequired ?? true,
            isUnique: input.isUnique ?? false,
            defaultValue: input.defaultValue ?? null,
            order: (last._max.order ?? -1) + 1,
          },
        })
        await diagramService.bumpDiagramVersion(ctx.db, entity.diagramId)
        return created
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This field name is already used on the entity.',
          })
        }
        throw error
      }
    }),

  updateField: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(updateFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramEntityField.findFirst({
        where: {
          id: input.fieldId,
          entity: { diagram: { organizationId: input.organizationId } },
        },
        select: { id: true, entityId: true, entity: { select: { diagramId: true } } },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Field not found' })

      if (input.isPrimary) {
        await ctx.db.diagramEntityField.updateMany({
          where: { entityId: existing.entityId, isPrimary: true, NOT: { id: existing.id } },
          data: { isPrimary: false },
        })
      }

      try {
        const updated = await ctx.db.diagramEntityField.update({
          where: { id: existing.id },
          data: {
            ...(input.name !== undefined ? { name: input.name } : {}),
            ...(input.dataType !== undefined ? { dataType: input.dataType } : {}),
            ...(input.isPrimary !== undefined ? { isPrimary: input.isPrimary } : {}),
            ...(input.isRequired !== undefined ? { isRequired: input.isRequired } : {}),
            ...(input.isUnique !== undefined ? { isUnique: input.isUnique } : {}),
            ...(input.defaultValue !== undefined
              ? { defaultValue: input.defaultValue ?? null }
              : {}),
          },
        })
        await diagramService.bumpDiagramVersion(ctx.db, existing.entity.diagramId)
        return updated
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw new TRPCError({
            code: 'CONFLICT',
            message: 'This field name is already used on the entity.',
          })
        }
        throw error
      }
    }),

  deleteField: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(deleteFieldSchema)
    .mutation(async ({ ctx, input }) => {
      const existing = await ctx.db.diagramEntityField.findFirst({
        where: {
          id: input.fieldId,
          entity: { diagram: { organizationId: input.organizationId } },
        },
        select: { id: true, entity: { select: { diagramId: true } } },
      })
      if (!existing) throw new TRPCError({ code: 'NOT_FOUND', message: 'Field not found' })

      await ctx.db.diagramEntityField.delete({ where: { id: existing.id } })
      await diagramService.bumpDiagramVersion(ctx.db, existing.entity.diagramId)
      return { id: existing.id }
    }),

  /* Drag-to-reorder sends the FULL ordered id list; array index becomes the
   * row's `order`. Rows not belonging to this entity simply match zero times. */
  reorderFields: protectedProcedure({ requirePermission: permissions.DIAGRAMS_UPDATE })
    .input(reorderFieldsSchema)
    .mutation(async ({ ctx, input }) => {
      const entity = await ctx.db.diagramEntity.findFirst({
        where: { id: input.entityId, diagram: { organizationId: input.organizationId } },
        select: { id: true, diagramId: true },
      })
      if (!entity) throw new TRPCError({ code: 'NOT_FOUND', message: 'Entity not found' })

      await Promise.all(
        input.orderedFieldIds.map((fieldId, index) =>
          ctx.db.diagramEntityField.updateMany({
            where: { id: fieldId, entityId: entity.id },
            data: { order: index },
          })
        )
      )
      await diagramService.bumpDiagramVersion(ctx.db, entity.diagramId)

      const fields = await ctx.db.diagramEntityField.findMany({
        where: { entityId: entity.id },
        orderBy: { order: 'asc' },
      })
      return fields
    }),
})
