'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: DiagramList, DiagramListItem
 *
 * WHAT:  Card grid of the org's designs — name, description, entity/relation
 *        counts, last-edited time and a per-card menu (open, duplicate,
 *        rename, delete). Delete confirms via AlertDialog; rename reuses a
 *        small RHF form bound to updateDiagramSchema.
 * WHY:   Mirrors the member-list action pattern (permission-gated menu items +
 *        confirm dialogs) so list surfaces stay uniform.
 * WHERE: Body of DiagramsClient on /dashboard/diagrams.
 */

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ExternalLinkIcon,
  GitBranchIcon,
  Loader2Icon,
  MoreHorizontalIcon,
  PencilIcon,
  CopyIcon,
  Table2Icon,
  Trash2Icon,
} from 'lucide-react'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { inferRouterOutputs } from '@trpc/server'

import { trpc } from '@/trpc/react-provider'
import type { AppRouter } from '@/trpc/routers/_app'
import { useActiveOrganization } from '@/hooks/use-active-organization'
import { permissions } from '@/lib/better-auth/permissions'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { updateDiagramSchema, type UpdateDiagramValues } from '@/lib/types'

export type DiagramListItem = inferRouterOutputs<AppRouter>['diagrams']['list']['rows'][number]

const EMPTY_STATE_HINT =
  'Model your entities, fields and relationships visually before writing any schema.'

export function DiagramList({ organizationId }: { organizationId: string }) {
  const utils = trpc.useUtils()
  const { hasPermission } = useActiveOrganization()

  const listQuery = trpc.diagrams.list.useQuery({ organizationId })

  /* Duplicate runs inline from the menu; rename/delete hold their target in
   * state so their dialogs can remount per row. */
  const duplicate = trpc.diagrams.duplicate.useMutation()
  const [renameTarget, setRenameTarget] = React.useState<DiagramListItem | null>(null)
  const [deleteTarget, setDeleteTarget] = React.useState<DiagramListItem | null>(null)

  const remove = trpc.diagrams.delete.useMutation()

  async function handleDuplicate(row: DiagramListItem) {
    try {
      await duplicate.mutateAsync({
        organizationId,
        diagramId: row.id,
      })
      await Promise.all([
        utils.diagrams.list.invalidate({ organizationId }),
        utils.usage.getFeatureGates.invalidate({ organizationId }),
      ])
      toast.success('Diagram duplicated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not duplicate diagram.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await remove.mutateAsync({ organizationId, diagramId: deleteTarget.id })
      await Promise.all([
        utils.diagrams.list.invalidate({ organizationId }),
        utils.usage.getFeatureGates.invalidate({ organizationId }),
      ])
      toast.success('Diagram deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not delete diagram.')
    } finally {
      setDeleteTarget(null)
    }
  }

  if (listQuery.isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <SkeletonCard />
        <SkeletonCard />
        <SkeletonCard />
      </div>
    )
  }

  const rows = listQuery.data?.rows ?? []

  if (rows.length === 0) {
    return (
      <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-lg border border-dashed p-10 text-center">
        <Table2Icon className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">No diagrams yet</p>
        <p className="max-w-sm text-xs text-muted-foreground">{EMPTY_STATE_HINT}</p>
      </div>
    )
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((row) => (
          <DiagramCard
            key={row.id}
            row={row}
            canUpdate={hasPermission(permissions.DIAGRAMS_UPDATE)}
            canDelete={hasPermission(permissions.DIAGRAMS_DELETE)}
            canCreate={hasPermission(permissions.DIAGRAMS_CREATE)}
            duplicating={duplicate.isPending && duplicate.variables?.diagramId === row.id}
            onDuplicate={() => void handleDuplicate(row)}
            onRename={() => setRenameTarget(row)}
            onDelete={() => setDeleteTarget(row)}
          />
        ))}
      </div>

      {/* Remounts per open so the form starts from the current name. */}
      {renameTarget ? (
        <RenameDiagramDialog
          key={renameTarget.id}
          organizationId={organizationId}
          row={renameTarget}
          onClose={() => setRenameTarget(null)}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the design together with its{' '}
              {deleteTarget?._count.entities ?? 0} entit
              {(deleteTarget?._count.entities ?? 0) === 1 ? 'y' : 'ies'} and{' '}
              {deleteTarget?._count.relations ?? 0} relation
              {(deleteTarget?._count.relations ?? 0) === 1 ? '' : 's'}. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={(e) => {
                e.preventDefault()
                void handleDelete()
              }}
            >
              {remove.isPending ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
              Delete diagram
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: DiagramCard
 *
 * WHAT:  One design card — title links to the editor; badges show entity and
 *        relation counts; the ⋯ menu exposes duplicate/rename/delete.
 * WHERE: Grid child of DiagramList.
 */
function DiagramCard({
  row,
  canUpdate,
  canDelete,
  canCreate,
  duplicating,
  onDuplicate,
  onRename,
  onDelete,
}: {
  row: DiagramListItem
  canUpdate: boolean
  canDelete: boolean
  canCreate: boolean
  duplicating: boolean
  onDuplicate: () => void
  onRename: () => void
  onDelete: () => void
}) {
  const hasMenuActions = canCreate || canUpdate || canDelete
  const router = useRouter()

  return (
    <Card className="group relative transition-colors hover:border-primary/50">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link href={`/dashboard/diagrams/${row.id}`} className="min-w-0">
            <CardTitle className="truncate group-hover:underline">{row.name}</CardTitle>
          </Link>
          {hasMenuActions ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button variant="ghost" size="icon" className="-mr-2 -mt-1 h-8 w-8">
                    <MoreHorizontalIcon className="h-4 w-4" />
                    <span className="sr-only">Open actions</span>
                  </Button>
                }
              />
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => router.push(`/dashboard/diagrams/${row.id}`)}>
                  <ExternalLinkIcon className="h-4 w-4" />
                  Open editor
                </DropdownMenuItem>
                {canCreate ? (
                  <DropdownMenuItem onClick={onDuplicate} disabled={duplicating}>
                    {duplicating ? (
                      <Loader2Icon className="h-4 w-4 animate-spin" />
                    ) : (
                      <CopyIcon className="h-4 w-4" />
                    )}
                    Duplicate
                  </DropdownMenuItem>
                ) : null}
                {canUpdate ? (
                  <DropdownMenuItem onClick={onRename}>
                    <PencilIcon className="h-4 w-4" />
                    Rename
                  </DropdownMenuItem>
                ) : null}
                {canDelete ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem variant="destructive" onClick={onDelete}>
                      <Trash2Icon className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {row.description ? (
          <CardDescription className="line-clamp-2">{row.description}</CardDescription>
        ) : null}

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <Badge variant="secondary" className="gap-1 font-normal">
            <Table2Icon className="h-3 w-3" />
            {row._count.entities} {row._count.entities === 1 ? 'entity' : 'entities'}
          </Badge>
          <Badge variant="secondary" className="gap-1 font-normal">
            <GitBranchIcon className="h-3 w-3" />
            {row._count.relations} {row._count.relations === 1 ? 'relation' : 'relations'}
          </Badge>
        </div>

        <p className="text-xs text-muted-foreground">
          Edited {new Date(row.updatedAt).toLocaleString()}
          {row.createdBy?.name ? ` · by ${row.createdBy.name}` : ''}
        </p>
      </CardHeader>
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card>
      <CardHeader className="space-y-3">
        <div className="h-5 w-2/3 rounded bg-muted" />
        <div className="h-3 w-full rounded bg-muted" />
        <div className="flex gap-2">
          <div className="h-5 w-20 rounded bg-muted" />
          <div className="h-5 w-24 rounded bg-muted" />
        </div>
      </CardHeader>
    </Card>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: RenameDiagramDialog
 *
 * WHAT:  Small dialog with a RHF form bound to updateDiagramSchema (name only;
 *        description editing stays on the editor's inspector for now).
 * WHERE: Mounted by DiagramList when a rename target is chosen.
 */
function RenameDiagramDialog({
  organizationId,
  row,
  onClose,
}: {
  organizationId: string
  row: DiagramListItem
  onClose: () => void
}) {
  const utils = trpc.useUtils()
  const update = trpc.diagrams.update.useMutation()

  const form = useForm<UpdateDiagramValues>({
    resolver: zodResolver(updateDiagramSchema),
    defaultValues: { organizationId, diagramId: row.id, name: row.name },
  })

  async function onSubmit(values: UpdateDiagramValues) {
    try {
      await update.mutateAsync(values)
      await utils.diagrams.list.invalidate({ organizationId })
      toast.success('Diagram renamed')
      onClose()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not rename diagram.')
    }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Rename diagram</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input autoFocus {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={update.isPending}>
                Save
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
