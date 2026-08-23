'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CreateDiagramButton
 *
 * WHAT:  Header action that opens the create-diagram Dialog (name +
 *        description via RHF + createDiagramSchema). Hidden entirely when the
 *        user lacks diagrams:create; wrapped in <FeatureGate> so hitting the
 *        plan cap opens the upgrade modal instead of the dialog.
 * WHY:   Mirrors InviteMemberButton: the invocation key remounts the dialog
 *        body with a fresh form per open while letting the close animation
 *        finish.
 * WHERE: ContentLayout headerActions on /dashboard/diagrams.
 */

import * as React from 'react'
import { Plus } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { toast } from 'sonner'

import { trpc } from '@/trpc/react-provider'
import { useActiveOrganization, useActiveOrganizationId } from '@/hooks/use-active-organization'
import { permissions } from '@/lib/better-auth/permissions'
import { FeatureGate } from '@/components/feature-gate'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  createDiagramSchema,
  type CreateDiagramValues,
} from '@/lib/types'

export function CreateDiagramButton() {
  const [open, setOpen] = React.useState(false)
  /* Bumped per open so the form remounts fresh; stable while closing. */
  const [invocation, setInvocation] = React.useState(0)
  const { hasPermission } = useActiveOrganization()
  const organizationId = useActiveOrganizationId()
  const utils = trpc.useUtils()

  const create = trpc.diagrams.create.useMutation()

  /* Early return happens before the form mounts, so the org id is always a
   * real string where the form actually renders. */
  if (!organizationId || !hasPermission(permissions.DIAGRAMS_CREATE)) return null

  function handleOpen() {
    setInvocation((n) => n + 1)
    setOpen(true)
  }

  async function onSubmit(values: CreateDiagramValues) {
    try {
      await create.mutateAsync(values)
      await Promise.all([
        utils.diagrams.list.invalidate({ organizationId: values.organizationId }),
        utils.usage.getFeatureGates.invalidate({ organizationId: values.organizationId }),
      ])
      toast.success('Diagram created')
      setOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create diagram.')
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <FeatureGate resource="diagrams">
        <Button className="gap-2" onClick={handleOpen}>
          <Plus className="h-4 w-4" />
          New Diagram
        </Button>
      </FeatureGate>
      <DialogContent key={invocation} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New diagram</DialogTitle>
          <DialogDescription>
            Design entities and relationships before writing code.
          </DialogDescription>
        </DialogHeader>
        <CreateDiagramForm
          key={invocation}
          organizationId={organizationId}
          isPending={create.isPending}
          onSubmit={onSubmit}
          onCancel={() => setOpen(false)}
        />
      </DialogContent>
    </Dialog>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: CreateDiagramForm
 *
 * WHAT:  RHF + zodResolver(createDiagramSchema) body of the create dialog.
 * WHERE: Mounted by CreateDiagramButton inside DialogContent.
 */
function CreateDiagramForm({
  organizationId,
  isPending,
  onSubmit,
  onCancel,
}: {
  organizationId: string
  isPending: boolean
  onSubmit: (values: CreateDiagramValues) => Promise<void>
  onCancel: () => void
}) {
  const form = useForm<CreateDiagramValues>({
    resolver: zodResolver(createDiagramSchema),
    defaultValues: { organizationId, name: '', description: '' },
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Orders service" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <Textarea placeholder="What is this design for? (optional)" rows={3} {...field} />
              </FormControl>
              <FormDescription>Optional context shown on the card.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            Create diagram
          </Button>
        </DialogFooter>
      </form>
    </Form>
  )
}
