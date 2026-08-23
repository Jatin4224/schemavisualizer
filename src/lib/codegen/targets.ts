/**
 * SOURCE OF TRUTH KEYWORDS: CODEGEN_TARGETS, CODEGEN_TARGET_KEYS,
 *   CodegenTargetDefinition, generateFiles, generateJsonDesign
 *
 * WHAT:  The registry of code-generation targets — label, description, and the
 *        pure function that turns a design into files.
 * WHY:   Same registry idiom as DATA_TYPES and PLANS: an `as const` table whose
 *        keys ARE the persisted/selected values. Adding a stack (Drizzle, REST
 *        handlers, SQLAlchemy) is ONE key plus one module — no router, service
 *        or component changes. That is the "switching tech stacks should be
 *        simple" mandate made concrete.
 *        Every generator is pure and dependency-free so the same code runs in
 *        the browser for the live code dialog and on the server for a gated
 *        export, with no chance of the two drifting.
 * WHERE: Consumed by the schema-code dialog and (later) the schemaExport router.
 */

import type { CodegenGraph, CodegenTargetKey, GeneratedFile } from '@/lib/types'
import { generatePrismaSchema } from './prisma'
import { generatePostgresDdl } from './postgres'

export interface CodegenTargetDefinition {
  label: string
  description: string
  generate: (graph: CodegenGraph) => GeneratedFile
}

/**
 * SOURCE OF TRUTH KEYWORDS: generateJsonDesign
 *
 * WHAT:  The portable design file — also the intended import format.
 * WHY:   Emitted from the same neutral CodegenGraph as the other targets, so a
 *        round trip through JSON cannot lose anything the other emitters can see.
 */
export function generateJsonDesign(graph: CodegenGraph): GeneratedFile {
  return {
    path: 'design.json',
    language: 'json',
    contents: JSON.stringify(graph, null, 2),
  }
}

export const CODEGEN_TARGETS = {
  prisma: {
    label: 'Prisma',
    description: 'A prisma/schema.prisma with models and relation fields',
    generate: generatePrismaSchema,
  },
  postgres: {
    label: 'SQL',
    description: 'PostgreSQL CREATE TABLE statements with foreign keys',
    generate: generatePostgresDdl,
  },
  json: {
    label: 'JSON',
    description: 'Portable design file, also the import format',
    generate: generateJsonDesign,
  },
} as const satisfies Record<CodegenTargetKey, CodegenTargetDefinition>

/** Ordered keys — drives the dialog's tab order. */
export const CODEGEN_TARGET_KEYS = Object.keys(CODEGEN_TARGETS) as readonly CodegenTargetKey[]

/**
 * SOURCE OF TRUTH KEYWORDS: generateFiles
 *
 * WHAT:  Runs a set of targets over one design.
 * WHERE: The code dialog renders one target at a time; a future export bundles
 *        all of them.
 */
export function generateFiles(
  graph: CodegenGraph,
  targets: readonly CodegenTargetKey[] = CODEGEN_TARGET_KEYS
): GeneratedFile[] {
  return targets.map((target) => CODEGEN_TARGETS[target].generate(graph))
}
