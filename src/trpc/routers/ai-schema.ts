/**
 * SOURCE OF TRUTH KEYWORDS: aiSchemaRouter, aiSchema.create, AI_ENTITY_QUOTA
 *
 * WHAT:  The AI schema chatbot endpoint — takes a natural-language prompt and
 *        writes the resulting entities, fields and relations into a diagram.
 * WHY:   The verb is `create` on purpose: that single naming choice makes the
 *        factory apply the `aiSchema` plan cap BEFORE the model is called, bump
 *        the generation counter after, write the audit row, and enforce the
 *        10/min rate limit — none of it declared here (AUTO_DERIVED_FROM_RESOURCES).
 *        What the factory cannot know is that one generation also creates many
 *        ENTITY rows, so the `diagramEntities` quota is checked and moved
 *        explicitly below — the sanctioned pattern for a path that consumes a
 *        second resource. txTimeout is raised because a generation is a model
 *        round trip plus a batch of inserts inside one transaction.
 * WHERE: Mounted as `aiSchema` in src/trpc/routers/_app.ts. Model call and
 *        persistence live in src/services/ai-schema.service.ts.
 */

import { TRPCError } from '@trpc/server'

import { createTRPCRouter, createStructuredError } from '../init'
import { protectedProcedure } from '../procedures'
import { permissions } from '@/lib/better-auth/permissions'
import { ERROR_CODES } from '@/lib/errors'
import { checkFeatureGate } from '@/lib/feature-gate'
import { decrementUsage, incrementUsage } from '@/services/usage.service'
import * as diagramService from '@/services/diagram.service'
import * as aiSchemaService from '@/services/ai-schema.service'
import { generateAiSchemaSchema } from '@/lib/types'

export const aiSchemaRouter = createTRPCRouter({
  create: protectedProcedure({
    /* Writing entities into someone's design is a design edit, so it rides the
     * existing diagram permission rather than inventing an AI-specific verb. */
    requirePermission: permissions.DIAGRAMS_UPDATE,
    /* A large design can take ~40s to generate, and the factory holds the tx
     * open across the whole handler — so the model call sits INSIDE it. Sized
     * for the worst case plus the insert batch. Tradeoff noted: at real
     * concurrency this should become propose-then-apply so the tx stays short. */
    txTimeout: 90_000,
  })
    .input(generateAiSchemaSchema)
    .mutation(async ({ ctx, input }) => {
      const graph = await diagramService.getDiagramGraph(
        ctx.db,
        input.organizationId,
        input.diagramId
      )
      if (!graph) throw new TRPCError({ code: 'NOT_FOUND', message: 'Diagram not found' })

      let generated: Awaited<ReturnType<typeof aiSchemaService.generateAiDesign>>
      try {
        generated = await aiSchemaService.generateAiDesign({
          prompt: input.prompt,
          mode: input.mode,
          graph,
        })
      } catch (error) {
        /* Upstream failures (quota, safety block, malformed object after
         * retries) must not surface as a 500 with an SDK stack trace. */
        console.error('[aiSchema.create] generation failed:', error)
        throw new TRPCError({
          code: 'BAD_GATEWAY',
          message:
            'The AI could not produce a valid schema for that request. Try rephrasing it.',
        })
      }

      if (!generated) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'AI schema generation is not configured. Set GOOGLE_GENERATIVE_AI_API_KEY.',
        })
      }

      const { design, droppedEntities, droppedRelations } = generated
      if (design.entities.length === 0) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message:
            'The AI did not return any new entities for that request. Try describing the domain in more detail.',
        })
      }

      /* Entity-quota accounting. `replace` wipes the current graph first, so the
       * org only pays for the NET increase; `extend` pays for every new row. The
       * gate is checked on the positive delta only — a design that shrinks the
       * canvas can never be blocked by the cap. */
      const existingEntityCount = graph.entities.length
      const netEntityDelta =
        input.mode === 'replace'
          ? design.entities.length - existingEntityCount
          : design.entities.length

      if (netEntityDelta > 0) {
        const gate = await checkFeatureGate(
          input.organizationId,
          'diagramEntities',
          netEntityDelta
        )
        if (!gate.allowed) {
          throw createStructuredError('FORBIDDEN', gate.reason || 'Plan limit reached', {
            errorCode: ERROR_CODES.USAGE_LIMIT_REACHED,
            resource: 'diagramEntities' as const,
            limit: gate.limit ?? 0,
            current: gate.currentUsage ?? 0,
            upgradeRequired: true,
            message:
              gate.reason ||
              'This design would exceed the entity limit for your plan.',
          })
        }
      }

      const applied = await aiSchemaService.applyAiDesign(ctx.db, {
        diagramId: graph.id,
        design,
        mode: input.mode,
        existingEntityCount,
      })

      /* Counter math mirrors what the factory would do for a `.create` on
       * diagramEntities. Inside the same tx, so it rolls back with the inserts. */
      if (netEntityDelta > 0) {
        await incrementUsage(input.organizationId, 'diagramEntities', netEntityDelta, ctx.db)
      } else if (netEntityDelta < 0) {
        await decrementUsage(input.organizationId, 'diagramEntities', -netEntityDelta, ctx.db)
      }

      /* Other open editors detect drift on their next autosave. */
      await diagramService.bumpDiagramVersion(ctx.db, graph.id)

      return {
        summary: design.summary,
        entitiesCreated: applied.entitiesCreated,
        fieldsCreated: applied.fieldsCreated,
        relationsCreated: applied.relationsCreated,
        droppedEntities,
        droppedRelations,
      }
    }),
})
