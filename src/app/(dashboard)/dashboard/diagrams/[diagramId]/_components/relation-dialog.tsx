'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: RelationDialog, RELATION_DIALOG, cardinalityPicker
 *
 * WHAT:  Dialog for creating/editing a typed relation — cardinality select,
 *        onDelete behavior select, optional label, and endpoint field picks
 *        (pre-filled when dragged from a specific field handle).
 * WHY:   One dialog serves BOTH the connect-drag flow (new relation) and the
 *        edge click flow (edit/delete) so cardinality semantics have a single
 *        editing surface.
 * WHERE: Mounted by diagram-editor.tsx; mutations are owned by the caller via
 *        onSubmit/onDelete callbacks.
 */

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { Loader2Icon } from 'lucide-react'

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
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'

/* Endpoint labels shown read-only so the user knows which edge they're shaping. */
export interface RelationDialogEndpoint {
  entityName: string
  /** Resolved field name or undefined for an unresolved/entity-level endpoint. */
  fieldName?: string | null
}

export interface RelationFormOutput {
  cardinality: 'ONE_TO_ONE' | 'ONE_TO_MANY' | 'MANY_TO_ONE' | 'MANY_TO_MANY'
  onDelete: 'cascade' | 'restrict' | 'setNull'
  label: string
}

const CARDINALITY_OPTIONS = [
  { value: 'ONE_TO_ONE', label: 'One to one', hint: '1 — 1' },
  { value: 'ONE_TO_MANY', label: 'One to many', hint: '1 — *' },
  { value: 'MANY_TO_ONE', label: 'Many to one', hint: '* — 1' },
  { value: 'MANY_TO_MANY', label: 'Many to many', hint: '* — *' },
] as const satisfies ReadonlyArray<{ value: RelationFormOutput['cardinality']; label: string; hint: string }>

const ON_DELETE_OPTIONS = [
  { value: 'restrict', label: 'Restrict', hint: 'Block deleting referenced rows' },
  { value: 'cascade', label: 'Cascade', hint: 'Delete children along with the parent' },
  { value: 'setNull', label: 'Set null', hint: 'Clear the reference when the parent goes' },
] as const satisfies ReadonlyArray<{ value: RelationFormOutput['onDelete']; label: string; hint: string }>

/**
 * SOURCE OF TRUTH KEYWORDS: RelationDialog
 *
 * WHAT:  The dialog body/form. Validation mirrors createRelationSchema's
 *          shape (cardinality/onDelete enums + short label); ids and endpoints
 *          are owned by the caller and never edited here.
 */
export function RelationDialog({
  open,
  onOpenChange,
  title,
  description,
  fromEndpoint,
  toEndpoint,
  initial,
  submitting,
  submitLabel,
  onSubmit,
  onDelete,
  deleting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  fromEndpoint: RelationDialogEndpoint
  toEndpoint: RelationDialogEndpoint
  initial?: Partial<RelationFormOutput>
  submitting: boolean
  submitLabel: string
  onSubmit: (values: RelationFormOutput) => void
  onDelete?: () => void
  deleting?: boolean
}) {
  const form = useForm<RelationFormOutput>({
    defaultValues: {
      cardinality: initial?.cardinality ?? 'MANY_TO_ONE',
      onDelete: initial?.onDelete ?? 'restrict',
      label: initial?.label ?? '',
    },
  })

  /* Re-seed when a different edge/connection opens the dialog. */
  React.useEffect(() => {
    if (open) {
      form.reset({
        cardinality: initial?.cardinality ?? 'MANY_TO_ONE',
        onDelete: initial?.onDelete ?? 'restrict',
        label: initial?.label ?? '',
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- reseed only on open/target change
  }, [open, initial?.cardinality, initial?.onDelete, initial?.label])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Endpoints summary */}
        <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="truncate font-medium">{fromEndpoint.entityName}</span>
          {fromEndpoint.fieldName ? (
            <span className="text-muted-foreground">.{fromEndpoint.fieldName}</span>
          ) : null}
          <span aria-hidden className="text-muted-foreground">→</span>
          <span className="truncate font-medium">{toEndpoint.entityName}</span>
          {toEndpoint.fieldName ? (
            <span className="text-muted-foreground">.{toEndpoint.fieldName}</span>
          ) : null}
        </div>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="cardinality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Cardinality</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose cardinality" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {CARDINALITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          <span className="font-mono text-xs text-muted-foreground">
                            {option.hint}
                          </span>
                          {' · '}
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="onDelete"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>On delete</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose behavior" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ON_DELETE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                          <span className="ml-1 text-xs text-muted-foreground">
                            — {option.hint}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="label"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Label</FormLabel>
                  <FormControl>
                    <Input placeholder="Optional, e.g. placed by" maxLength={120} {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="gap-2 sm:gap-0">
              {onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  disabled={deleting}
                  onClick={onDelete}
                >
                  {deleting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
                  Remove relation
                </Button>
              ) : null}
              <Button type="submit" disabled={submitting} className="ml-auto">
                {submitting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
                {submitLabel}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
