/**
 * SOURCE OF TRUTH KEYWORDS: BrandBackdrop, BrandBackdropProps, surface-grid,
 *   surface-aura, brand atmosphere, hero background, auth background
 *
 * WHAT:  The app's ambient background layer — a fading hairline grid plus one
 *        or two soft coral brand auras, rendered behind page content.
 * WHY:   The "premium" look on every full-page surface (landing, auth,
 *        onboarding, setup gate) comes from the same two effects. Owning them
 *        in one decorative component stops each page re-hand-rolling absolutely
 *        positioned divs, and keeps them token-driven (see the surface-grid /
 *        surface-aura utilities in globals.css) so a rebrand needs no edits
 *        here. Purely decorative: aria-hidden + pointer-events-none, so it
 *        never intercepts clicks or reaches the accessibility tree.
 *
 *        CALLER CONTRACT: the parent must be `relative isolate` (and normally
 *        `overflow-hidden`). `isolate` is load-bearing — this layer sits at
 *        -z-10, and without a stacking context on the parent a negative
 *        z-index paints BEHIND the parent's own bg-background, making the
 *        whole backdrop invisible.
 * WHERE: src/app/page.tsx (landing hero), AuthShell, OnboardingFlow, the
 *        dashboard welcome panel, and any future full-viewport surface.
 */

import { cn } from '@/lib/utils'

export interface BrandBackdropProps {
  /** `full` adds a second, lower aura — for tall marketing pages. */
  variant?: 'default' | 'full'
  /** Hides the grid when only the aura glow is wanted. */
  grid?: boolean
  className?: string
}

export function BrandBackdrop({
  variant = 'default',
  grid = true,
  className,
}: BrandBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 -z-10 overflow-hidden', className)}
    >
      {grid ? <div className="absolute inset-0 surface-grid surface-grid-fade" /> : null}
      <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 surface-aura blur-3xl" />
      {variant === 'full' ? (
        <div className="absolute -bottom-56 left-1/4 h-[32rem] w-[32rem] surface-aura opacity-50 blur-3xl" />
      ) : null}
    </div>
  )
}
