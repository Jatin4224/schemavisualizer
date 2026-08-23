'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: EditorActionsContext, useEditorActions,
 *   EDITOR_ACTIONS
 *
 * WHAT:  React context binding canvas primitives (entity cards) back to the
 *        diagram editor's actions — opening the inspector sheet, toggling a
 *        card's collapse state.
 * WHY:   Custom nodes render deep inside React Flow where prop-drilling from
 *        the orchestrator is impractical; context keeps node components dumb
 *        while actions stay owned by the editor.
 * WHERE: Provided by diagram-editor.tsx around <CanvasShell>; consumed by
 *        entity-node.tsx.
 */

import * as React from 'react'

/**
 * Inferred contract (no hand-written interface here — types live in
 * src/lib/types): the default value only exists so useContext returns
 * `Contract | null` for safe consumption above the provider.
 */
export const EditorActionsContext = React.createContext(
  /** Discriminant null = rendered outside the editor (should never happen). */
  null as null | {
    openInspector: (entityId: string) => void
    toggleCollapse: (entityId: string) => void
    /** Field ids on this entity referenced by any relation edge (FK badges). */
    fkFieldsFor: (entityId: string) => readonly string[]
  }
)

/**
 * SOURCE OF TRUTH KEYWORDS: useEditorActions
 *
 * WHAT:  Typed accessor for EditorActionsContext that throws a clear error
 *          when used outside the provider instead of failing silently.
 * WHERE: entity-node.tsx action handlers.
 */
export function useEditorActions() {
  const ctx = React.useContext(EditorActionsContext)
  if (!ctx) {
    throw new Error('useEditorActions must be used within the diagram editor provider')
  }
  return ctx
}
