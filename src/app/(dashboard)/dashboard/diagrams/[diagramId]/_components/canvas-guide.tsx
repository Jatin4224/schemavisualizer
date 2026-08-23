'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasEmptyState, CanvasLegend, CANVAS_LEGEND_ITEMS,
 *   LegendItem, diagram onboarding, canvas hint, entity legend
 *
 * WHAT:  The two orientation aids for the Schema Studio canvas — an empty-state
 *        coach mark pointing at the "+ Entity" button, and a legend decoding the
 *        icons that appear on entity cards.
 * WHY:   The canvas is a blank grid on first open and its two core gestures
 *        (add an entity, drag a handle to relate two) are invisible. Naming the
 *        gestures and the icons removes the guesswork without adding a modal.
 * WHERE: Rendered by diagram-editor.tsx inside CanvasShell's viewport.
 */

import {
  CornerLeftUpIcon,
  KeyIcon,
  Link2Icon,
  LockIcon,
  MousePointerClickIcon,
  Table2Icon,
} from 'lucide-react'

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasEmptyState
 *
 * WHAT:  Centered first-run panel with an arrow aimed at the toolbar.
 * WHY:   An empty grid gives the user nothing to act on; this names the single
 *        next step instead of leaving them to find the toolbar themselves.
 * WHERE: diagram-editor.tsx, rendered only while the graph has zero entities.
 */
export function CanvasEmptyState() {
  return (
    /* pointer-events-none so the panel never eats a pan/zoom drag on the
     * canvas underneath it. */
    <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center p-6">
      <div className="max-w-sm rounded-lg border border-dashed bg-card/80 p-6 text-center shadow-sm backdrop-blur-sm">
        <Table2Icon className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">Start with your first entity</p>
        <p className="mt-1 text-xs text-muted-foreground">
          An entity becomes a table — give it fields, then drag between two cards to
          define how they relate.
        </p>
        <p className="mt-4 flex items-center justify-center gap-1.5 text-xs font-medium text-primary">
          <CornerLeftUpIcon className="h-4 w-4" />
          Use <span className="rounded border bg-background px-1 py-0.5">+ Entity</span> above
        </p>
      </div>
    </div>
  )
}

/* The three gestures that make up the whole workflow, in the order a new user
 * meets them. Numbered because "then what?" is the actual question the old
 * single-sentence hint left unanswered. */
const CANVAS_STEPS: readonly string[] = [
  'Add an entity',
  'Give it fields',
  'Drag ● to another card to relate them',
]

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasStepsHint, CANVAS_STEPS
 *
 * WHAT:  Numbered one-line walkthrough of the editor's three core gestures.
 * WHY:   Replaces a prose hint that named only the connect gesture, leaving the
 *        order of operations implicit.
 * WHERE: diagram-editor.tsx, directly under the canvas.
 */
export function CanvasStepsHint() {
  return (
    <ol className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {CANVAS_STEPS.map((step, index) => (
        <li key={step} className="flex items-center gap-1.5">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border text-[10px] font-medium">
            {index + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  )
}

interface LegendItem {
  /** Rendered mark — an icon or a literal glyph like "?". */
  icon: React.ReactNode
  label: string
}

/* Mirrors the marks rendered by entity-node.tsx. Keep the two in step: a mark
 * shown on a card but missing here is a mark the user cannot decode. */
const CANVAS_LEGEND_ITEMS: readonly LegendItem[] = [
  { icon: <KeyIcon className="h-3 w-3 text-primary" />, label: 'Primary key' },
  { icon: <Link2Icon className="h-3 w-3" />, label: 'Foreign key' },
  { icon: <LockIcon className="h-3 w-3" />, label: 'Unique' },
  { icon: <span className="text-[10px] leading-none">?</span>, label: 'Optional' },
]

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasLegend, CANVAS_LEGEND_ITEMS
 *
 * WHAT:  Compact bottom-right key for the entity-card icons plus the two canvas
 *        gestures.
 * WHY:   The card icons are unlabeled at a glance; a persistent legend beats a
 *        tooltip the user must first suspect exists.
 * WHERE: diagram-editor.tsx, inside the canvas viewport.
 */
export function CanvasLegend() {
  return (
    <div className="pointer-events-none rounded-md border bg-card/90 px-2.5 py-2 text-xs text-muted-foreground shadow-sm backdrop-blur-sm">
      <ul className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {CANVAS_LEGEND_ITEMS.map((item) => (
          <li key={item.label} className="flex items-center gap-1">
            <span className="flex h-3 w-3 items-center justify-center">{item.icon}</span>
            {item.label}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 flex items-center gap-1 border-t pt-1.5 text-[11px]">
        <MousePointerClickIcon className="h-3 w-3 shrink-0" />
        Double-click a card to edit · double-click a line to change the relation
      </p>
    </div>
  )
}
