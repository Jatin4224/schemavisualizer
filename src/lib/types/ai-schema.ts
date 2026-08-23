/**
 * SOURCE OF TRUTH KEYWORDS: aiDesignSchema, aiDesignEntitySchema,
 *   aiDesignFieldSchema, aiDesignRelationSchema, generateAiSchemaSchema,
 *   aiSchemaPromptSchema, aiSchemaModeSchema, AiDesignValues,
 *   AiDesignEntityValues, AiDesignRelationValues, GenerateAiSchemaValues,
 *   AiSchemaMode, AI_DESIGN_MAX_ENTITIES, AI_DESIGN_MAX_FIELDS
 *
 * WHAT:  The contract for the AI schema chatbot — the shape Gemini must return
 *        (aiDesignSchema) and the tRPC input for aiSchema.create.
 * WHY:   Two schemas, deliberately: the MODEL-FACING shape is loose (plain
 *        strings, every field required, no regex/defaults) because it is
 *        converted to JSON Schema and handed to Gemini, and structured-output
 *        models comply far better with a flat required shape than with
 *        optionals and patterns. Names are then sanitized and re-validated
 *        server-side against the strict entityNameSchema / fieldNameSchema, so
 *        a hallucinated `user-name!` can never reach the database.
 *        Relations reference endpoints BY NAME because the model cannot know
 *        row ids; the service resolves names to ids after the inserts.
 * WHERE: Consumed by src/services/ai-schema.service.ts and
 *        src/trpc/routers/ai-schema.ts. Re-exported via src/lib/types.
 */

import { z } from 'zod'

import { DATA_TYPE_KEYS } from '@/lib/config/data-types'
import { cardinalitySchema, onDeleteSchema } from './diagram'

const organizationIdSchema = z.string().min(1, 'Organization ID is required.')

/** Hard caps so one prompt can't blow the entity quota or the tx timeout. */
export const AI_DESIGN_MAX_ENTITIES = 25
export const AI_DESIGN_MAX_FIELDS = 30

/* ── Model-facing design shape ────────────────────────────────────────── */

export const aiDesignFieldSchema = z.object({
  name: z.string().describe('camelCase column name, e.g. "createdAt" or "userId"'),
  dataType: z.enum(DATA_TYPE_KEYS).describe('One of the allowed field data types'),
  isPrimary: z.boolean().describe('True for exactly one field per entity'),
  isRequired: z.boolean().describe('False means the column is nullable'),
  isUnique: z.boolean().describe('True to add a unique constraint'),
})

export const aiDesignEntitySchema = z.object({
  name: z
    .string()
    .describe('PascalCase singular entity name, e.g. "Course" or "Enrollment"'),
  note: z.string().describe('One short sentence describing what this entity holds'),
  fields: z.array(aiDesignFieldSchema).describe('Columns, primary key first'),
})

export const aiDesignRelationSchema = z.object({
  fromEntity: z.string().describe('Entity name that holds the foreign key'),
  fromField: z.string().describe('Foreign-key field name on fromEntity'),
  toEntity: z.string().describe('Entity name being referenced'),
  toField: z.string().describe('Referenced field on toEntity, usually its primary key'),
  cardinality: cardinalitySchema,
  onDelete: onDeleteSchema,
  label: z.string().describe('Short human label, e.g. "enrolled in"'),
})

/**
 * SOURCE OF TRUTH KEYWORDS: aiDesignSchema, AiDesignValues
 *
 * WHAT:  The full design Gemini returns for one prompt.
 * WHY:   `summary` is what the chat bubble renders, so the model is asked for
 *        it in the same call rather than a second round trip.
 * WHERE: Passed as the `schema` argument to generateObject().
 */
export const aiDesignSchema = z.object({
  summary: z
    .string()
    .describe('Two or three sentences explaining the design decisions, for the chat reply'),
  entities: z.array(aiDesignEntitySchema),
  relations: z.array(aiDesignRelationSchema),
})

/* ── Router input ─────────────────────────────────────────────────────── */

/** extend = keep what is on the canvas; replace = wipe it first. */
export const aiSchemaModeSchema = z.enum(['extend', 'replace'])

export const aiSchemaPromptSchema = z
  .string()
  .trim()
  .min(3, 'Describe what you want in a few more words.')
  .max(2000, 'That prompt is too long.')

/**
 * SOURCE OF TRUTH KEYWORDS: aiSchemaFormSchema, AiSchemaFormValues
 *
 * WHAT:  The chat composer form — just the prompt field.
 * WHY:   Deliberately NOT generateAiSchemaSchema: that one carries `mode`
 *        with a .default(), which makes its zod input and output types
 *        differ, and under exactOptionalPropertyTypes zodResolver then fails
 *        to line up with useForm. Every field here is required, so input and
 *        output match and the resolver types cleanly.
 * WHERE: src/app/(dashboard)/dashboard/diagrams/[diagramId]/_components/ai-chat-panel.tsx
 */
export const aiSchemaFormSchema = z.object({
  prompt: aiSchemaPromptSchema,
})

export const generateAiSchemaSchema = z.object({
  organizationId: organizationIdSchema,
  diagramId: z.string().min(1),
  prompt: aiSchemaPromptSchema,
  mode: aiSchemaModeSchema.default('extend'),
})

export type AiDesignFieldValues = z.infer<typeof aiDesignFieldSchema>
export type AiDesignEntityValues = z.infer<typeof aiDesignEntitySchema>
export type AiDesignRelationValues = z.infer<typeof aiDesignRelationSchema>
export type AiDesignValues = z.infer<typeof aiDesignSchema>
export type GenerateAiSchemaValues = z.infer<typeof generateAiSchemaSchema>
export type AiSchemaMode = z.infer<typeof aiSchemaModeSchema>
export type AiSchemaFormValues = z.infer<typeof aiSchemaFormSchema>
