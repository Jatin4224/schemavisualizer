'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: EntityInspectorSheet, ENTITY_INSPECTOR,
 *   EntityMetaForm, FieldRowEditor, AddFieldForm
 *
 * WHAT:  The side sheet for one entity card — meta (name/note/color) via RHF
 *        bound to updateEntitySchema, a full field manager (inline add/edit
 *        rows bound to createFieldSchema/updateFieldSchema), and a danger
 *        zone that lists exactly which relations will break before deleting.
 * WHY:   The keyboard/inspector path is the accessible equivalent of canvas
 *        manipulation, and it is where field CRUD lives so node cards stay
 *        compact.
 * WHERE: Mounted by diagram-editor.tsx; all mutations are owned by the caller
 *        through callbacks so local canvas state stays in one place.
 */

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import type { Control, FieldValues, Path } from 'react-hook-form'
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import {
  DATA_TYPES,
  DATA_TYPE_KEYS,
  getDataType,
  isDataTypeKey,
  ENTITY_COLOR_TOKENS,
  type DataTypeKey,
  type EntityColorTokenKey,
} from '@/lib/config'
import {
  createFieldSchema,
  updateEntitySchema,
  updateFieldSchema,
  type CreateFieldValues,
  type EntityFlowNode,
  type RelationFlowEdge,
  type UpdateEntityValues,
  type UpdateFieldValues,
} from '@/lib/types'

export interface EntityInspectorCallbacks {
  onSaveEntityMeta: (values: UpdateEntityValues) => Promise<void>
  onAddField: (values: Omit<CreateFieldValues, 'organizationId' | 'entityId'>) => Promise<void>
  onUpdateField: (fieldId: string, values: Partial<UpdateFieldValues>) => Promise<void>
  onDeleteField: (fieldId: string) => Promise<void>
  onDeleteEntity: () => Promise<void>
}

/**
 * SOURCE OF TRUTH KEYWORDS: EntityInspectorSheet
 *
 * WHAT:  Public sheet shell; renders nothing when no node is selected.
 */
export function EntityInspectorSheet({
  open,
  onOpenChange,
  organizationId,
  node,
  nodes,
  edges,
  callbacks,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  node: EntityFlowNode | null
  /** All cards — used to render readable relation names in the delete confirm. */
  nodes: EntityFlowNode[]
  edges: RelationFlowEdge[]
  callbacks: EntityInspectorCallbacks
}) {
  const entityNameById = React.useMemo(
    () => new Map(nodes.map((n) => [n.id, n.data.name])),
    [nodes]
  )
  const [confirmingDelete, setConfirmingDelete] = React.useState(false)
  const [deletingEntity, setDeletingEntity] = React.useState(false)

  /* Relations that reference this entity — shown verbatim in the confirm so
   * the user knows exactly what breaks (PRD acceptance criterion #2). */
  const impactedRelations =
    node?.data
      ? edges.filter(
          (edge) =>
            edge.data &&
            (edge.source === node.id || edge.target === node.id)
        )
      : []

  async function handleDeleteEntity() {
    setDeletingEntity(true)
    try {
      await callbacks.onDeleteEntity()
      setConfirmingDelete(false)
      onOpenChange(false)
    } finally {
      setDeletingEntity(false)
    }
  }

  return (
    <>
      <Sheet open={open && node !== null} onOpenChange={onOpenChange}>
        <SheetContent className="w-full overflow-y-auto p-6 sm:max-w-md">
          {node ? (
            <>
              <SheetHeader className="p-0">
                <SheetTitle className="text-xl">{node.data.name}</SheetTitle>
                <SheetDescription>Configure this entity and its fields.</SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <EntityMetaForm
                  key={`${node.id}-meta`}
                  organizationId={organizationId}
                  node={node}
                  onSave={callbacks.onSaveEntityMeta}
                />

                <Separator />

                <FieldsManager
                  key={`${node.id}-fields`}
                  organizationId={organizationId}
                  node={node}
                  callbacks={callbacks}
                />

                <Separator />

                {/* Danger zone */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-destructive">Danger zone</p>
                  <p className="text-xs text-muted-foreground">
                    Deleting removes the entity and{' '}
                    {impactedRelations.length === 1 ? 'its relation' : `${impactedRelations.length} relations`}{' '}
                    connected to it.
                  </p>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={() => setConfirmingDelete(true)}
                  >
                    <Trash2Icon className="h-4 w-4" />
                    Delete entity
                  </Button>
                </div>
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Delete confirmation listing what will break. */}
      <Dialog open={confirmingDelete} onOpenChange={setConfirmingDelete}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete “{node?.data.name}”?</DialogTitle>
            <DialogDescription>
              This entity participates in {impactedRelations.length}{' '}
              {impactedRelations.length === 1 ? 'relation' : 'relations'}, which will be removed:
            </DialogDescription>
          </DialogHeader>
          {impactedRelations.length > 0 ? (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border bg-muted/40 p-3 text-xs">
              {impactedRelations.map((edge) => (
                <li key={edge.data?.relationId ?? edge.id} className="truncate">
                  • {edge.data?.label ? `${edge.data.label}: ` : ''}
                  {entityNameById.get(edge.source) ?? edge.source} →{' '}
                  {entityNameById.get(edge.target) ?? edge.target} (
                  {edge.data?.cardinality.toLowerCase().replace(/_/g, '-')})
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmingDelete(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deletingEntity}
              onClick={() => void handleDeleteEntity()}
            >
              {deletingEntity ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
              Delete entity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: EntityMetaForm
 *
 * WHAT:  Name/note/color form for the selected entity; color choices come
 *          from the theme-token allowlist (never raw hex).
 */
function EntityMetaForm({
  organizationId,
  node,
  onSave,
}: {
  organizationId: string
  node: EntityFlowNode
  onSave: EntityInspectorCallbacks['onSaveEntityMeta']
}) {
  const [saving, setSaving] = React.useState(false)

  const form = useForm<UpdateEntityValues>({
    resolver: zodResolver(updateEntitySchema),
    defaultValues: {
      organizationId,
      entityId: node.data.entityId,
      name: node.data.name,
      note: node.data.note,
      color: node.data.color,
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          setSaving(true)
          try {
            await onSave(values)
            toast.success('Entity updated')
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save entity.')
          } finally {
            setSaving(false)
          }
        })}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="note"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Note</FormLabel>
              <FormControl>
                <Input placeholder="Optional description" maxLength={500} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="color"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Color</FormLabel>
              <Select
                onValueChange={(value) =>
                  field.onChange(value === 'default' ? null : (value as EntityColorTokenKey))
                }
                value={field.value ?? 'default'}
              >
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {(Object.keys(ENTITY_COLOR_TOKENS) as EntityColorTokenKey[]).map((key) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        <span
                          className={`h-3 w-3 rounded-full ${ENTITY_COLOR_TOKENS[key].dot}`}
                          aria-hidden
                        />
                        {ENTITY_COLOR_TOKENS[key].label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2Icon className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </Button>
      </form>
    </Form>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: FieldsManager
 *
 * WHAT:  The ordered field list with inline editors plus the add-field row.
 */
function FieldsManager({
  organizationId,
  node,
  callbacks,
}: {
  organizationId: string
  node: EntityFlowNode
  callbacks: EntityInspectorCallbacks
}) {
  const [editingFieldId, setEditingFieldId] = React.useState<string | null>(null)

  const sortedFields = [...node.data.fields].sort((a, b) => a.order - b.order)

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Fields</p>

      <div className="space-y-1">
        {sortedFields.length === 0 ? (
          <p className="text-xs text-muted-foreground">No fields yet.</p>
        ) : (
          sortedFields.map((field) =>
            editingFieldId === field.id ? (
              <FieldRowEditor
                key={field.id}
                organizationId={organizationId}
                field={field}
                callbacks={callbacks}
                onDone={() => setEditingFieldId(null)}
              />
            ) : (
              <div
                key={field.id}
                className="flex items-center justify-between gap-2 rounded-md border px-3 py-1.5"
              >
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm">{field.name}</span>
                  {field.isPrimary ? <Badge variant="secondary">PK</Badge> : null}
                  {field.isUnique ? <Badge variant="outline">U</Badge> : null}
                </span>
                <span className="flex shrink-0 items-center gap-1">
                  <span className="text-xs text-muted-foreground">
                    {getDataType(field.dataType).label}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => setEditingFieldId(field.id)}
                    aria-label={`Edit ${field.name}`}
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            )
          )
        )}
      </div>

      <AddFieldForm
        key={`${node.id}-add-field`}
        organizationId={organizationId}
        entityId={node.data.entityId}
        callbacks={callbacks}
      />
    </div>
  )
}

/* Shared flag checkboxes for both field forms — generic over the host form's
 * value type so neither schema is widened. */
function FieldFlagsControl<TValues extends FieldValues>({
  control,
  flags,
}: {
  control: Control<TValues>
  flags: ReadonlyArray<Path<TValues>>
}) {
  return (
    <div className="flex flex-wrap gap-4">
      {flags.map((flag) => (
        <FormField
          key={flag}
          control={control}
          name={flag}
          render={({ field }) => (
            <FormItem className="flex items-center gap-2 space-y-0">
              <FormControl>
                <Checkbox checked={field.value} onCheckedChange={(v) => field.onChange(v)} />
              </FormControl>
              <FormLabel className="text-xs font-normal">
                {flag === 'isPrimary' ? 'Primary key' : flag === 'isRequired' ? 'Required' : 'Unique'}
              </FormLabel>
            </FormItem>
          )}
        />
      ))}
    </div>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: FieldRowEditor
 *
 * WHAT:  Inline editor for an existing field row (name/type/flags/default).
 */
function FieldRowEditor({
  organizationId,
  field,
  callbacks,
  onDone,
}: {
  organizationId: string
  field: EntityFlowNode['data']['fields'][number]
  callbacks: EntityInspectorCallbacks
  onDone: () => void
}) {
  const [deleting, setDeleting] = React.useState(false)

  const form = useForm<UpdateFieldValues>({
    resolver: zodResolver(updateFieldSchema),
    defaultValues: {
      organizationId,
      fieldId: field.id,
      name: field.name,
      dataType: safeDataType(field.dataType),
      isPrimary: field.isPrimary,
      isRequired: field.isRequired,
      isUnique: field.isUnique,
      defaultValue: field.defaultValue,
    },
  })

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async ({ fieldId, ...values }) => {
          try {
            await callbacks.onUpdateField(fieldId, values)
            onDone()
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not save field.')
          }
        })}
        className="space-y-3 rounded-md border border-primary/40 bg-accent/30 p-3"
      >
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

        <FormField
          control={form.control}
          name="dataType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DATA_TYPE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {DATA_TYPES[key].label}
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
          name="defaultValue"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Default</FormLabel>
              <FormControl>
                <Input
                  placeholder="Optional default value"
                  maxLength={200}
                  {...field}
                  value={field.value ?? ''}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FieldFlagsControl
          control={form.control}
          flags={['isPrimary', 'isRequired', 'isUnique']}
        />

        <div className="flex items-center justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            disabled={deleting}
            onClick={async () => {
              setDeleting(true)
              try {
                await callbacks.onDeleteField(field.id)
                onDone()
              } catch (err) {
                toast.error(err instanceof Error ? err.message : 'Could not delete field.')
              } finally {
                setDeleting(false)
              }
            }}
          >
            {deleting ? <Loader2Icon className="h-4 w-4 animate-spin" /> : <Trash2Icon className="h-4 w-4" />}
            Remove
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" onClick={onDone}>
              Cancel
            </Button>
            <Button type="submit" size="sm">
              Save
            </Button>
          </div>
        </div>
      </form>
    </Form>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: AddFieldForm
 *
 * WHAT:  Compact always-visible add-field row at the bottom of the list.
 */
function AddFieldForm({
  organizationId,
  entityId,
  callbacks,
}: {
  organizationId: string
  entityId: string
  callbacks: EntityInspectorCallbacks
}) {
  const [collapsed, setCollapsed] = React.useState(true)

  const form = useForm<CreateFieldValues>({
    resolver: zodResolver(createFieldSchema),
    defaultValues: {
      organizationId,
      entityId,
      name: '',
      dataType: 'string',
      isPrimary: false,
      isRequired: true,
      isUnique: false,
      defaultValue: null,
    },
  })

  if (collapsed) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="w-full border-dashed"
        onClick={() => setCollapsed(false)}
      >
        <PlusIcon className="h-4 w-4" />
        Add field
      </Button>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(async (values) => {
          try {
            await callbacks.onAddField(values)
            form.reset({ ...values, name: '', defaultValue: null })
            setCollapsed(true)
          } catch (err) {
            toast.error(err instanceof Error ? err.message : 'Could not add field.')
          }
        })}
        className="space-y-3 rounded-md border border-dashed p-3"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. userEmail" autoFocus {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="dataType"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Type</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {DATA_TYPE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {DATA_TYPES[key].label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FieldFlagsControl
          control={form.control}
          flags={['isPrimary', 'isRequired', 'isUnique']}
        />

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm">
            <PlusIcon className="h-4 w-4" />
            Add
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => setCollapsed(true)}>
            Close
          </Button>
        </div>
      </form>
    </Form>
  )
}

/* DB-string → registry-key boundary for legacy rows (see data-types.ts). */
function safeDataType(value: string): DataTypeKey {
  return isDataTypeKey(value) ? value : 'string'
}
