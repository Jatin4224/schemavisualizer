/**
 * SOURCE OF TRUTH KEYWORDS: graphFromFlow
 *
 * WHAT:  Maps the editor's live React Flow nodes and edges into the neutral
 *        CodegenGraph the generators read.
 * WHY:   The dialog must show code for what is ON SCREEN, including edits the
 *        user just made, so it reads local canvas state rather than the last
 *        server snapshot. Keeping the mapping here means the generators never
 *        import a rendering type, which is what lets them also run server-side.
 *        Edges are addressed by entity/field NAME because generated code has no
 *        concept of a row id.
 * WHERE: Called by the schema-code dialog in the diagram editor.
 */

import type {
  CodegenGraph,
  CodegenRelation,
  EntityFlowNode,
  RelationFlowEdge,
} from '@/lib/types'

export function graphFromFlow(args: {
  name: string
  nodes: readonly EntityFlowNode[]
  edges: readonly RelationFlowEdge[]
}): CodegenGraph {
  const entityNameById = new Map(args.nodes.map((node) => [node.id, node.data.name]))
  const fieldNameById = new Map<string, string>()
  for (const node of args.nodes) {
    for (const field of node.data.fields) fieldNameById.set(field.id, field.name)
  }

  const relations: CodegenRelation[] = []
  for (const edge of args.edges) {
    if (!edge.data) continue
    const fromEntity = entityNameById.get(edge.source)
    const toEntity = entityNameById.get(edge.target)
    /* An edge whose endpoint node is gone cannot be rendered as code. */
    if (!fromEntity || !toEntity) continue
    relations.push({
      fromEntity,
      toEntity,
      fromField: edge.data.fromFieldId
        ? fieldNameById.get(edge.data.fromFieldId) ?? null
        : null,
      toField: edge.data.toFieldId ? fieldNameById.get(edge.data.toFieldId) ?? null : null,
      cardinality: edge.data.cardinality,
      onDelete: edge.data.onDelete,
      label: edge.data.label,
    })
  }

  return {
    name: args.name,
    entities: args.nodes.map((node) => ({
      name: node.data.name,
      note: node.data.note,
      fields: [...node.data.fields]
        .sort((a, b) => a.order - b.order)
        .map((field) => ({
          name: field.name,
          dataType: field.dataType,
          isPrimary: field.isPrimary,
          isRequired: field.isRequired,
          isUnique: field.isUnique,
          defaultValue: field.defaultValue,
        })),
    })),
    relations,
  }
}
