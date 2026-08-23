'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: EntityNode, ENTITY_NODE_TYPE, entityNodeTypes
 *
 * WHAT:  The entity card custom node — color-coded header (name + collapse
 *        toggle), the ordered field list with PK/FK/unique/required badges,
 *        and a footer that opens the inspector for field management. Left
 *        target / right source handles make relations draggable.
 * WHY:   Pure presentation: reads EntityNodeData and the editor action context;
 *        every mutation is delegated upward so state stays in one place.
 * WHERE: Registered as `entity` nodeType by diagram-editor.tsx.
 */

import { memo } from 'react'
import { Handle, Position, type NodeProps } from '@xyflow/react'
import {
  ArrowRightIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  KeyIcon,
  Link2Icon,
  LockIcon,
  PlusIcon,
  Settings2Icon,
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getEntityColorToken } from '@/lib/config/entity-colors'
import { getDataType } from '@/lib/config/data-types'
import type { EntityFlowNode } from '@/lib/types'
import { useEditorActions } from './editor-context'

/* Double-click on the card body also opens the inspector; single click is
 * reserved for selection/multi-select semantics of the canvas. */
function EntityNodeComponent({ id, data, selected }: NodeProps<EntityFlowNode>) {
  const { openInspector, toggleCollapse, fkFieldsFor } = useEditorActions()
  const token = getEntityColorToken(data.color)
  const fkFieldIds = fkFieldsFor(id)

  return (
    <div
      className={[
        'group relative w-64 rounded-lg border bg-card text-card-foreground shadow-sm transition-shadow',
        token.strip !== 'border-border' ? `${token.strip} border-l-4` : 'border',
        selected ? 'ring-2 ring-ring' : '',
      ].join(' ')}
    >
      {/* Relation endpoints. Sized well above the 8px default and ring-outlined
       * so they read as grab targets — the connect gesture is undiscoverable
       * when the handles look like decorative dots. */}
      <Handle
        type="target"
        position={Position.Left}
        title={`Drop a connection here to point at ${data.name}`}
        className="h-3! w-3! border-2! border-background! bg-muted-foreground! transition-transform hover:scale-125!"
      />
      <Handle
        type="source"
        position={Position.Right}
        title={`Drag from here to link ${data.name} to another entity`}
        className="h-3! w-3! border-2! border-background! bg-primary! ring-primary/30 transition-transform group-hover:scale-125! group-hover:ring-4"
      />

      {/* Hover coach mark — names the gesture at the exact spot it starts. */}
      <span className="pointer-events-none absolute top-1/2 -right-1.5 z-10 hidden -translate-y-1/2 translate-x-full items-center gap-1 whitespace-nowrap rounded-md border bg-popover px-1.5 py-0.5 text-[10px] font-medium text-popover-foreground shadow-sm group-hover:flex">
        Drag to link
        <ArrowRightIcon className="h-3 w-3" />
      </span>

      {/* Header */}
      <div className="flex items-center justify-between gap-1 px-3 py-2">
        <button
          type="button"
          className="min-w-0 flex-1 cursor-grab truncate text-left text-sm font-medium active:cursor-grabbing"
          onDoubleClick={() => openInspector(id)}
          title={data.note ? `${data.note}\n\nDrag to move · double-click to edit` : 'Drag to move · double-click to edit'}
        >
          {data.name}
        </button>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => openInspector(id)}
            aria-label={`Configure ${data.name}`}
          >
            <Settings2Icon className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={() => toggleCollapse(id)}
            aria-label={data.collapsed ? `Expand ${data.name}` : `Collapse ${data.name}`}
          >
            {data.collapsed ? (
              <ChevronRightIcon className="h-3.5 w-3.5" />
            ) : (
              <ChevronDownIcon className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      {/* Fields */}
      {data.collapsed ? (
        <p className="border-t px-3 py-1.5 text-xs text-muted-foreground">
          {data.fields.length} {data.fields.length === 1 ? 'field' : 'fields'}
        </p>
      ) : (
        <ul className="max-h-56 space-y-0.5 overflow-y-auto border-t px-3 py-1.5">
          {data.fields.length === 0 ? (
            <li className="py-1 text-xs text-muted-foreground">No fields yet</li>
          ) : (
            data.fields.map((field) => (
              <li key={field.id} className="flex items-center justify-between gap-2 py-0.5">
                <span className="flex min-w-0 items-center gap-1">
                  {/* Icons carry the whole meaning of a row, so each is named on
                   * hover too — not just to screen readers. The title lives on a
                   * wrapper because lucide icons take no `title` prop. */}
                  {field.isPrimary ? (
                    <span
                      className="flex shrink-0 items-center"
                      title="Primary key — uniquely identifies each row"
                    >
                      <KeyIcon className="h-3 w-3 text-primary" aria-label="Primary key" />
                    </span>
                  ) : fkFieldIds.includes(field.id) ? (
                    <span
                      className="flex shrink-0 items-center"
                      title="Foreign key — points at another entity"
                    >
                      <Link2Icon className="h-3 w-3 text-muted-foreground" aria-label="Foreign key" />
                    </span>
                  ) : null}
                  <span className="truncate text-xs">{field.name}</span>
                  {!field.isRequired ? (
                    <span
                      className="text-[10px] text-muted-foreground"
                      title="Optional — this field can be empty"
                      aria-label="Optional field"
                    >
                      ?
                    </span>
                  ) : null}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  {field.isUnique ? (
                    <span
                      className="flex items-center"
                      title="Unique — no two rows may share this value"
                    >
                      <LockIcon className="h-3 w-3 text-muted-foreground" aria-label="Unique" />
                    </span>
                  ) : null}
                  <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                    {getDataType(field.dataType).label}
                  </span>
                </span>
              </li>
            ))
          )}
        </ul>
      )}

      {/* Footer — the primary way into the inspector, so it states the outcome
       * ("Add / edit fields") rather than the noun it operates on. */}
      <button
        type="button"
        className="flex w-full items-center gap-1 rounded-b-lg border-t bg-muted/40 px-3 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        onClick={() => openInspector(id)}
        title={`Add or edit the fields of ${data.name}`}
      >
        <PlusIcon className="h-3 w-3" />
        Add / edit fields
      </button>
    </div>
  )
}

export const EntityNode = memo(EntityNodeComponent)

/** nodeTypes mapping consumed by CanvasShell. Stable identity avoids RF re-mounts. */
export const entityNodeTypes = { entity: EntityNode }
