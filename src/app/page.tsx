/**
 * SOURCE OF TRUTH KEYWORDS: RootPage, LandingSection, LandingHero,
 *   GetStartedCta, PublicLanding
 *
 * WHAT:  Minimal public landing page — one section with the app heading,
 *        description copy, and a Get Started CTA that links to sign-in.
 * WHY:   The root route is the first thing anonymous visitors see; it stays a
 *        static server component so there is no auth probe or client redirect
 *        here. All copy comes from BRANDING (src/lib/config/branding.ts) and
 *        the CTA target from AUTH_ROUTES (src/lib/config/auth-routes.ts) — no
 *        hardcoded strings or paths.
 * WHERE: CTA target: AUTH_ROUTES.signIn handled by AuthRedirectObserver
 *        (src/trpc/react-provider.tsx); brand copy: BRANDING.
 */

import Link from 'next/link'

import { buttonVariants } from '@/components/ui/button'
import { AUTH_ROUTES, BRANDING } from '@/lib/config'

export default function RootPage() {
  return (
    <main className="flex min-h-svh items-center justify-center bg-background px-4">
      <section className="flex max-w-xl flex-col items-center gap-6 text-center">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          {BRANDING.appName}
        </h1>
        <p className="text-lg text-muted-foreground">{BRANDING.appDescription}</p>
        <Link href={AUTH_ROUTES.signIn} className={buttonVariants({ size: 'lg' })}>
          Get Started
        </Link>
      </section>
    </main>
  )
}
