/**
 * SOURCE OF TRUTH KEYWORDS: RootPage, LandingHero, LandingHighlights,
 *   GetStartedCta, PublicLanding, BrandBackdrop
 *
 * WHAT:  The public landing page — brand bar, gradient hero with the primary
 *        CTA, and the value-prop grid.
 * WHY:   The root route is the first thing anonymous visitors see; it stays a
 *        static server component so there is no auth probe or client redirect
 *        here. All copy comes from BRANDING.landing
 *        (src/lib/config/branding.ts) and the CTA targets from AUTH_ROUTES —
 *        no hardcoded strings or paths. Atmosphere comes from BrandBackdrop so
 *        it matches the auth screens exactly.
 * WHERE: CTA target: AUTH_ROUTES.signIn handled by AuthRedirectObserver
 *        (src/trpc/react-provider.tsx); brand copy: BRANDING.
 */

import Link from 'next/link'
import { ArrowRightIcon } from 'lucide-react'

import { buttonVariants } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { BrandBackdrop } from '@/components/global/brand-backdrop'
import { PlatformLogo } from '@/components/global/platform-logo'
import { AUTH_ROUTES, BRANDING, REGISTRATION_OPEN } from '@/lib/config'

const { landing } = BRANDING

/* Invitation-only deployments have no public sign-up (proxy.ts bounces it), so
 * the primary CTA falls back to sign-in instead of a dead-end route. */
const PRIMARY_CTA_HREF = REGISTRATION_OPEN ? AUTH_ROUTES.signUp : AUTH_ROUTES.signIn

export default function RootPage() {
  return (
    <div className="relative isolate flex min-h-svh flex-col overflow-hidden bg-background">
      <BrandBackdrop variant="full" />

      <header className="flex items-center justify-between border-b border-border px-6 py-4 md:px-10">
        <PlatformLogo href="/" />
        <Link
          href={AUTH_ROUTES.signIn}
          className={buttonVariants({ variant: 'ghost', size: 'sm' })}
        >
          {landing.secondaryCtaLabel}
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 py-16 md:px-10 md:py-24">
        <section className="flex w-full max-w-3xl flex-col items-center gap-6 text-center">
          <Badge variant="outline" className="gap-1.5 border-primary/40 bg-primary/5 text-primary">
            <span className="size-1.5 rounded-[1px] bg-primary" />
            {landing.eyebrow}
          </Badge>

          {/* Editorial display headline: heavy Archivo caps, solid coral accent
              word instead of a gradient — print-poster energy. */}
          <h1 className="font-heading text-5xl font-black uppercase leading-[0.95] tracking-tight text-balance sm:text-7xl">
            {landing.headlineLead}{' '}
            <span className="text-primary">{landing.headlineAccent}</span>
          </h1>

          <p className="max-w-xl text-lg text-pretty text-muted-foreground">
            {BRANDING.appDescription}
          </p>

          <div className="mt-2 flex flex-col items-center gap-3 sm:flex-row">
            <Link
              href={PRIMARY_CTA_HREF}
              className={buttonVariants({ size: 'lg' })}
            >
              {landing.primaryCtaLabel}
              <ArrowRightIcon data-icon="inline-end" />
            </Link>
            <Link
              href={AUTH_ROUTES.signIn}
              className={buttonVariants({ variant: 'outline', size: 'lg' })}
            >
              {landing.secondaryCtaLabel}
            </Link>
          </div>

          <p className="text-kicker text-muted-foreground">{landing.footerNote}</p>
        </section>

        <section className="mt-20 grid w-full max-w-5xl gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-2 lg:grid-cols-3">
          {landing.highlights.map((highlight, index) => (
            <div key={highlight.title} className="flex flex-col gap-8 bg-card p-6 transition-colors hover:bg-muted/40">
              <span className="font-mono text-xs font-semibold tracking-[0.18em] text-primary">
                {String(index + 1).padStart(2, '0')}
              </span>
              <div>
                <h2 className="font-heading text-base font-bold uppercase tracking-tight text-foreground">
                  {highlight.title}
                </h2>
                <p className="mt-1.5 text-sm text-pretty text-muted-foreground">{highlight.body}</p>
              </div>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t border-border px-6 py-6 text-center text-xs text-muted-foreground md:px-10">
        © {new Date().getFullYear()} {BRANDING.appName}
      </footer>
    </div>
  )
}
