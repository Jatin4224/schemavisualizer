/**
 * SOURCE OF TRUTH KEYWORDS: AuthShell, AuthShellProps, AuthShellVariant
 *
 * WHAT:  Centered full-viewport wrapper used by every (auth) route — the brand
 *        backdrop, the logo + BRANDING.appName, then an arbitrary child slot,
 *        optionally framed in an elevated panel.
 * WHY:   Pulled out of the page files so future auth pages (forgot, reset,
 *        verify, 2fa) inherit the same chrome without duplicating layout
 *        markup, and so a branding redesign is a one-file change. The panel is
 *        a VARIANT rather than always-on because some routes (accept-invitation)
 *        bring their own Card and would otherwise nest two surfaces.
 * WHERE: Used by the (auth) route group pages under src/app/(auth)/.
 */

import * as React from 'react'

import { BrandBackdrop } from '@/components/global/brand-backdrop'
import { PlatformLogo } from '@/components/global/platform-logo'

export type AuthShellVariant = 'panel' | 'bare'

export interface AuthShellProps {
  children: React.ReactNode
  /** `bare` when the child already renders its own Card/surface. */
  variant?: AuthShellVariant
}

export function AuthShell({ children, variant = 'panel' }: AuthShellProps) {
  return (
    <div className="relative isolate flex min-h-svh flex-col items-center justify-center gap-6 overflow-hidden bg-background p-6 md:p-10">
      <BrandBackdrop />
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="self-center">
          <PlatformLogo href="/" />
        </div>
        {variant === 'panel' ? (
          <div className="rounded-lg border-t-2 border-t-primary border-border bg-card p-6 shadow-2xl sm:p-8">
            {children}
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  )
}
