'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: PortalOverview
 *
 * WHAT:  Platform headline stat cards (organizations, users, active
 *        subscriptions) for the portal home.
 * WHERE: Rendered by the /portal page. Reads trpc.portal.getOverview.
 */

import { trpc } from '@/trpc/react-provider'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'

export function PortalOverview() {
  const { data, isLoading } = trpc.portal.getOverview.useQuery()

  const stats = [
    { label: 'Organizations', value: data?.totalOrganizations },
    { label: 'Users', value: data?.totalUsers },
    { label: 'Active subscriptions', value: data?.activeSubscriptions },
  ]

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      {stats.map((stat) => (
        <Card key={stat.label}>
          <CardHeader>
            <CardTitle className="text-kicker font-medium text-muted-foreground">
              {stat.label}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-10 w-20" />
            ) : (
              <p className="font-heading text-5xl font-black tabular-nums leading-none tracking-tight">
                {stat.value ?? 0}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
