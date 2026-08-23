'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: DiagramEditorView
 *
 * WHAT:  Client shell for the editor route — resolves the active org +
 *        diagrams:read permission and renders DiagramEditor inside
 *        ContentLayout with a back link as the header action.
 * WHY:   Mirrors TeamClient's chrome so the editor feels native to the
 *        dashboard while keeping the canvas itself route-agnostic.
 * WHERE: Rendered by [diagramId]/page.tsx.
 */

import Link from 'next/link'
import { ArrowLeftIcon } from 'lucide-react'

import { useActiveOrganization } from '@/hooks/use-active-organization'
import { permissions } from '@/lib/better-auth/permissions'
import { ContentLayout } from '@/components/global/page-header'
import { buttonVariants } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { DiagramEditor } from './diagram-editor'

export function DiagramEditorView({ diagramId }: { diagramId: string }) {
  const { activeOrganization, isLoading, hasPermission } = useActiveOrganization()
  const organizationId = activeOrganization?.id

  if (isLoading && !activeOrganization) {
    return (
      <ContentLayout title="Diagram">
        <Skeleton className="h-[calc(100vh-10rem)] w-full rounded-lg" />
      </ContentLayout>
    )
  }

  if (!organizationId || !hasPermission(permissions.DIAGRAMS_READ)) {
    return (
      <ContentLayout title="Diagram">
        <div className="flex h-full items-center justify-center p-6">
          <p className="text-sm text-muted-foreground">
            You don&apos;t have access to this diagram.
          </p>
        </div>
      </ContentLayout>
    )
  }

  return (
    <ContentLayout
      title="Diagram"
      actions={
        <Link href="/dashboard/diagrams" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
          <ArrowLeftIcon className="h-4 w-4" />
          All diagrams
        </Link>
      }
    >
      <DiagramEditor organizationId={organizationId} diagramId={diagramId} />
    </ContentLayout>
  )
}
