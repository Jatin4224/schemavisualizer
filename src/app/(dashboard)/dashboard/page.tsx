/**
 * SOURCE OF TRUTH KEYWORDS: DashboardHomePage, DashboardWelcomePanel
 *
 * WHAT:  Dashboard landing page — the post-onboarding home inside the sidebar
 *        shell. A brand welcome panel over a card with the next steps.
 * WHY:   Thin starting point; real dashboards drop their widgets into
 *        ContentLayout. Kept intentionally minimal — this is a template base —
 *        but it uses the same brand surface treatments as the rest of the app
 *        (BrandBackdrop, gradient heading) so the first authenticated screen
 *        doesn't look unstyled next to the marketing page.
 * WHERE: Route /dashboard under the (dashboard) layout.
 */

import type { Metadata } from 'next'

import { ContentLayout } from '@/components/global/page-header'
import { BrandBackdrop } from '@/components/global/brand-backdrop'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { BRANDING } from '@/lib/config'

export const metadata: Metadata = {
  title: 'Dashboard',
}

export default function DashboardHomePage() {
  return (
    <ContentLayout title="Dashboard">
      <section className="relative isolate overflow-hidden rounded-lg border-t-2 border-t-primary border-border bg-card/50 p-8 md:p-10">
        <BrandBackdrop grid={false} />
        <p className="text-kicker text-primary">{BRANDING.landing.eyebrow}</p>
        <h2 className="font-heading mt-3 text-3xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          Welcome to <span className="text-primary">{BRANDING.appName}</span>
        </h2>
        <p className="mt-4 max-w-xl text-sm text-pretty text-muted-foreground">
          {BRANDING.appDescription}
        </p>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Next steps</CardTitle>
          <CardDescription>
            Add your product’s features here — declare them in src/lib/resources.ts and they
            appear in the sidebar automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          Use the sidebar to manage your team, organization settings, and billing.
        </CardContent>
      </Card>
    </ContentLayout>
  )
}
