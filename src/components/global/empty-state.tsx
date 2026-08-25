/**
 * SOURCE OF TRUTH KEYWORDS: EmptyState, EmptyStateProps, empty state,
 *   no results, zero state, placeholder card, dashed panel
 *
 * WHAT:  The app-wide "nothing here yet" panel — dashed brand-tinted frame,
 *        haloed icon, title, hint copy and an optional action slot.
 * WHY:   Every list surface (diagrams, payment methods, members, audit logs)
 *        had its own dashed <div> with slightly different padding, icon size
 *        and copy weight. One component makes them identical, keeps them
 *        token-driven, and means a future redesign of empty states is a
 *        one-file change. The action is a SLOT, not a prop pair — callers keep
 *        owning their button, permissions and handlers.
 * WHERE: DiagramList, BillingTab payment methods, and any future list that can
 *        render zero rows.
 */

import * as React from 'react'
import type { LucideIcon } from 'lucide-react'

import { cn } from '@/lib/utils'

export interface EmptyStateProps {
  /** Lucide icon rendered inside the brand halo. */
  icon?: LucideIcon
  title: string
  description?: string
  /** Buttons / links shown under the copy — the caller owns permissions. */
  action?: React.ReactNode
  /** `sm` for empty states nested inside a card or settings section. */
  size?: 'default' | 'sm'
  className?: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  size = 'default',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-card/30 text-center',
        size === 'sm' ? 'gap-2 p-6' : 'min-h-64 gap-3 p-10',
        className
      )}
    >
      {Icon ? (
        <span className="mb-1 flex size-11 items-center justify-center rounded-md bg-primary/10 text-primary ring-1 ring-primary/25">
          <Icon className="size-5" />
        </span>
      ) : null}
      <p className="font-heading text-base font-bold tracking-tight text-foreground">{title}</p>
      {description ? (
        <p className="max-w-sm text-xs text-pretty text-muted-foreground">{description}</p>
      ) : null}
      {action ? <div className="mt-3 flex items-center gap-2">{action}</div> : null}
    </div>
  )
}
