/**
 * SOURCE OF TRUTH KEYWORDS: CodegenGraph, CodegenEntity, CodegenField,
 *   CodegenRelation, GeneratedFile, CodegenLanguage, CodegenTargetKey
 *
 * WHAT:  The neutral design shape the code generators read, and the file shape
 *        they emit.
 * WHY:   Deliberately NOT DiagramWithGraphRow and NOT the React Flow node types.
 *        A Prisma row carries ids, timestamps and viewport columns the emitters
 *        must never see, and the flow types are a rendering concern. One flat
 *        shape in the middle means the same generator runs client-side for the
 *        live code dialog AND server-side for a gated export, with no branching
 *        and no chance of the two drifting.
 *        Endpoints are addressed BY NAME because that is what generated code
 *        actually contains — ids are meaningless in a schema file.
 * WHERE: Produced by src/lib/codegen/adapters.ts consumers; consumed by every
 *        generator in src/lib/codegen/. Re-exported via src/lib/types.
 */

import type { CardinalityValue, OnDeleteValue } from './diagram'

export interface CodegenField {
  name: string
  /** A DATA_TYPES key (src/lib/config/data-types.ts). */
  dataType: string
  isPrimary: boolean
  isRequired: boolean
  isUnique: boolean
  defaultValue: string | null
}

export interface CodegenEntity {
  name: string
  note: string
  fields: CodegenField[]
}

export interface CodegenRelation {
  fromEntity: string
  /** Null when the edge was drawn entity-to-entity before an FK existed. */
  fromField: string | null
  toEntity: string
  toField: string | null
  cardinality: CardinalityValue
  onDelete: OnDeleteValue
  label: string
}

export interface CodegenGraph {
  name: string
  entities: CodegenEntity[]
  relations: CodegenRelation[]
}

/** Drives the syntax label and the file extension, not highlighting. */
export type CodegenLanguage = 'prisma' | 'sql' | 'json'

export interface GeneratedFile {
  /** Repo-relative path the file would occupy, e.g. `prisma/schema.prisma`. */
  path: string
  language: CodegenLanguage
  contents: string
}

/** Registry keys in src/lib/codegen/targets.ts. */
export type CodegenTargetKey = 'prisma' | 'postgres' | 'json'
