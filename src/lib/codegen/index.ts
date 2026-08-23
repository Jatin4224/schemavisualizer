/**
 * SOURCE OF TRUTH KEYWORDS: generateFiles, CODEGEN_TARGETS, CODEGEN_TARGET_KEYS,
 *   generatePrismaSchema, generatePostgresDdl, generateJsonDesign,
 *   graphFromFlow, resolveRelationFields
 *
 * WHAT:  Barrel for the code generators. Import from '@/lib/codegen'.
 * WHY:   Everything here is pure and dependency-free so the same modules run in
 *        the browser (live code dialog) and on the server (gated export).
 * WHERE: Consumed by the schema-code dialog; reserved for the schemaExport router.
 */

export {
  CODEGEN_TARGETS,
  CODEGEN_TARGET_KEYS,
  generateFiles,
  generateJsonDesign,
  type CodegenTargetDefinition,
} from './targets'
export { generatePrismaSchema } from './prisma'
export { generatePostgresDdl } from './postgres'
export { graphFromFlow } from './adapters'
export {
  resolveRelationFields,
  relationFieldName,
  ownerSideOf,
  pluralize,
  snakeCase,
  type RelationField,
  type RelationFieldMap,
} from './relations'
