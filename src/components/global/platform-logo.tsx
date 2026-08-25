/**
 * SOURCE OF TRUTH KEYWORDS: PlatformLogo, PlatformLogoProps
 *
 * WHAT:  The app's wordmark — a coral brand tile + APP_NAME in the display
 *        face.
 * WHY:   One reusable brand mark for the auth screens, the landing header and
 *        anywhere else the logo is needed. Swap the SVG path here to rebrand.
 *        Uses theme tokens only (bg-primary / text-primary-foreground /
 *        font-heading) so it follows the palette.
 * WHERE: src/components/global/auth/auth-shell.tsx, src/app/page.tsx.
 */

import Link from 'next/link'

import { APP_NAME } from '@/lib/config/branding'
import { cn } from '@/lib/utils'

export interface PlatformLogoProps {
  href?: string
  className?: string
  showName?: boolean
}

export function PlatformLogo({ href = '/', className, showName = true }: PlatformLogoProps) {
  const content = (
    <div className={cn('flex items-center gap-2.5', className)}>
      {/* Coral tile + ink glyph: the print-mark. Flat, squared, no glow. */}
      <div className="flex size-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="square"
          className="size-4"
          aria-hidden="true"
        >
          <path d="m8 3 4 8 5-5 5 15H2L8 3z" />
        </svg>
      </div>
      {showName ? (
        <span className="font-heading text-base font-extrabold uppercase tracking-tight">
          {APP_NAME}
        </span>
      ) : null}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="inline-flex">
        {content}
      </Link>
    )
  }
  return content
}
