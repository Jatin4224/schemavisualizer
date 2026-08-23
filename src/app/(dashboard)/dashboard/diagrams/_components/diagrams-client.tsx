'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: DiagramsClient
 *
 * WHAT:  Diagrams page client shell — resolves the active org + permission and
 *        renders DiagramList inside ContentLayout with the Create button as
 *        the header action. Gated on diagrams:read.
 * WHY:   Mirrors TeamClient so every dashboard page shares one chrome pattern.
 * WHERE: Rendered by the diagrams page.
 */

import { useActiveOrganization } from '@/hooks/use-active-organization'
import { permissions } from '@/lib/better-auth/permissions'
import { ContentLayout } from '@/components/global/page-header'
import { Skeleton } from '@/components/ui/skeleton'
import { DiagramList } from './diagram-list'
import { CreateDiagramButton } from './create-diagram-button'

export function DiagramsClient() {
  const { activeOrganization, isLoading, hasPermission } = useActiveOrganization()
  const organizationId = activeOrganization?.id
  const hasAccess = hasPermission(permissions.DIAGRAMS_READ)

  if (isLoading && !activeOrganization) {
    return (
      <ContentLayout title="Diagrams" actions={<CreateDiagramButton />}>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </div>
      </ContentLayout>
    )
  }

  if (!organizationId || !hasAccess) {
    return (
      <ContentLayout title="Diagrams">
        <div className="flex h-full items-center justify-center p-6">
          <div className="max-w-md space-y-2 text-center">
            <p className="text-sm font-medium text-destructive">
              {!hasAccess
                ? 'You don\u2019t have permission to view diagrams'
                : 'No active organization found.'}
            </p>
            {!hasAccess && (
              <p className="text-xs text-muted-foreground">
                Contact your organization owner to grant you the{' '}
                <code className="rounded bg-muted px-1 py-0.5 text-xs">diagrams:read</code>{' '}
                permission.
              </p>
            )}
          </div>
        </div>
      </ContentLayout>
    )
  }

  return (
    <ContentLayout title="Diagrams" actions={<CreateDiagramButton />}>
      <DiagramList organizationId={organizationId} />
    </ContentLayout>
  )
}
