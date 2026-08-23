/**
 * SOURCE OF TRUTH KEYWORDS: resolveRelationFields, RelationField,
 *   RelationFieldMap, ownerSideOf, snakeCase, pluralize
 *
 * WHAT:  Turns the diagram's edge list into, for each entity, the relation
 *        fields a schema file has to declare.
 * WHY:   This is the only genuinely hard part of generating a schema. An edge is
 *        symmetric; a Prisma relation is not — one side owns the foreign key and
 *        carries `@relation(fields:…, references:…)`, the other carries a back
 *        reference that is a list or a single depending on cardinality. Getting
 *        that wrong produces a schema that will not validate, so the mapping is
 *        derived once here and both the Prisma and the SQL emitter read it.
 * WHERE: Consumed by src/lib/codegen/prisma.ts and src/lib/codegen/postgres.ts.
 */

import type { CodegenGraph, CodegenRelation } from '@/lib/types'

/** One side of one relation, from the perspective of a single entity. */
export interface RelationField {
  /** The entity this field is declared on. */
  entity: string
  /** The entity on the other end. */
  target: string
  /** True when this side holds the foreign key. */
  owns: boolean
  /** True when the back reference is a list (`Post[]`). */
  isList: boolean
  /** FK column on the owning side. Null when the edge had no field endpoint. */
  foreignKey: string | null
  /** Referenced column on the target. Null when the edge had no field endpoint. */
  references: string | null
  onDelete: CodegenRelation['onDelete']
  /** Stable name so both sides of the same edge agree. */
  relationName: string
}

export type RelationFieldMap = Map<string, RelationField[]>

/* ── Naming ────────────────────────────────────────────────────────────── */

const IRREGULAR_PLURALS: Record<string, string> = {
  person: 'people',
  child: 'children',
  man: 'men',
  woman: 'women',
  tooth: 'teeth',
  foot: 'feet',
  mouse: 'mice',
  goose: 'geese',
}

/**
 * SOURCE OF TRUTH KEYWORDS: pluralize
 *
 * WHAT:  English pluralizer covering the regular rules plus a short irregular
 *        list.
 * WHY:   Back-reference fields and SQL table names need a plural, and pulling in
 *        a pluralization dependency for a dozen rules is not worth the install.
 *        Deliberately conservative — a wrong plural is cosmetic, whereas a wrong
 *        FK column would not compile.
 * WHERE: Prisma back references and postgres table names.
 */
export function pluralize(word: string): string {
  const lower = word.toLowerCase()
  const irregular = IRREGULAR_PLURALS[lower]
  if (irregular) {
    return word[0] === word[0]?.toUpperCase()
      ? irregular.charAt(0).toUpperCase() + irregular.slice(1)
      : irregular
  }
  if (/[^aeiou]y$/i.test(word)) return word.slice(0, -1) + 'ies'
  if (/(s|ss|sh|ch|x|z)$/i.test(word)) return word + 'es'
  return word + 's'
}

/**
 * SOURCE OF TRUTH KEYWORDS: snakeCase
 *
 * WHAT:  PascalCase/camelCase -> snake_case.
 * WHERE: Postgres table and column names.
 */
export function snakeCase(value: string): string {
  return value
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/[\s-]+/g, '_')
    .toLowerCase()
}

function lowerFirst(value: string): string {
  return value.charAt(0).toLowerCase() + value.slice(1)
}

/* ── Resolution ────────────────────────────────────────────────────────── */

/**
 * SOURCE OF TRUTH KEYWORDS: ownerSideOf
 *
 * WHAT:  Decides which end of an edge holds the foreign key.
 * WHY:   MANY_TO_ONE and ONE_TO_ONE put the FK on `from`; ONE_TO_MANY is the
 *        same edge read backwards, so the FK belongs on `to`. MANY_TO_MANY has
 *        no FK column at all — Prisma models it as a list on both sides and SQL
 *        needs a join table.
 */
export function ownerSideOf(relation: CodegenRelation): 'from' | 'to' | 'none' {
  switch (relation.cardinality) {
    case 'ONE_TO_MANY':
      return 'to'
    case 'MANY_TO_ONE':
    case 'ONE_TO_ONE':
      return 'from'
    case 'MANY_TO_MANY':
      return 'none'
  }
}

/**
 * SOURCE OF TRUTH KEYWORDS: resolveRelationFields, RelationFieldMap
 *
 * WHAT:  Builds entity name -> the relation fields that entity must declare.
 * WHY:   Emitters iterate entities, but relations live in a flat list; indexing
 *        once here keeps both generators O(n) and guarantees the two sides of an
 *        edge share a relationName, which is what lets Prisma pair them when two
 *        entities are joined more than once.
 * WHERE: src/lib/codegen/prisma.ts.
 */
export function resolveRelationFields(graph: CodegenGraph): RelationFieldMap {
  const known = new Set(graph.entities.map((entity) => entity.name))
  const map: RelationFieldMap = new Map(graph.entities.map((entity) => [entity.name, []]))
  /* Disambiguates two edges between the same pair of entities. */
  const pairSeen = new Map<string, number>()

  for (const relation of graph.relations) {
    /* An edge to a deleted entity is not renderable as code. */
    if (!known.has(relation.fromEntity) || !known.has(relation.toEntity)) continue

    const pairKey = [relation.fromEntity, relation.toEntity].sort().join('_')
    const seen = (pairSeen.get(pairKey) ?? 0) + 1
    pairSeen.set(pairKey, seen)
    const relationName = seen === 1 ? pairKey : `${pairKey}_${seen}`

    const owner = ownerSideOf(relation)
    const many = relation.cardinality === 'MANY_TO_MANY'

    const fromEntry: RelationField = {
      entity: relation.fromEntity,
      target: relation.toEntity,
      owns: owner === 'from',
      /* Refined below — only MANY_TO_MANY is a list on both sides. */
      isList: many,
      foreignKey: owner === 'from' ? relation.fromField : relation.toField,
      references: owner === 'from' ? relation.toField : relation.fromField,
      onDelete: relation.onDelete,
      relationName,
    }
    const toEntry: RelationField = {
      entity: relation.toEntity,
      target: relation.fromEntity,
      owns: owner === 'to',
      isList: many,
      foreignKey: owner === 'to' ? relation.toField : relation.fromField,
      references: owner === 'to' ? relation.fromField : relation.toField,
      onDelete: relation.onDelete,
      relationName,
    }

    /* Back reference plurality: whichever side does NOT own the FK is the one
     * that can hold many rows, except in a 1-1 where both stay singular. */
    if (!many) {
      if (owner === 'from') {
        toEntry.isList = relation.cardinality !== 'ONE_TO_ONE'
        fromEntry.isList = false
      } else if (owner === 'to') {
        fromEntry.isList = relation.cardinality !== 'ONE_TO_ONE'
        toEntry.isList = false
      }
    }

    map.get(relation.fromEntity)?.push(fromEntry)
    map.get(relation.toEntity)?.push(toEntry)
  }

  return map
}

/**
 * SOURCE OF TRUTH KEYWORDS: relationFieldName
 *
 * WHAT:  The property name a relation field takes on an entity.
 * WHY:   Lists read as plurals (`orders`), singles as the lowercased entity
 *        (`user`), which is the convention every Prisma schema in the wild uses.
 */
export function relationFieldName(field: RelationField): string {
  const base = lowerFirst(field.target)
  return field.isList ? pluralize(base) : base
}
