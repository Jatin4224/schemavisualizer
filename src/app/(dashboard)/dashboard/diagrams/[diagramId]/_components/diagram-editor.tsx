'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: DiagramEditor, DIAGRAM_EDITOR, saveState,
 *   flushSave, scheduleSave, pendingConnection, editingRelationId,
 *   openInspector, toggleCollapse, fkFieldsFor, handleAddEntity,
 *   ConflictDialog
 *
 * WHAT:  The canvas orchestrator — loads the design graph once, owns local
 *        node/edge state, debounced geometry+viewport autosave guarded by
 *        optimistic concurrency (CONFLICT → reload-or-overwrite), and all
 *        entity/field/relation mutations patched locally from returned rows.
 * WHY:   One state owner keeps the picture (canvas) and the text (inspector)
 *        in sync from a single source. Mutations patch local state so there
 *        is no refetch racing the next autosave; only the list-page counters
 *        get invalidated.
 * WHERE: Rendered by [diagramId]/page.tsx under the dashboard chrome.
 */

import * as React from 'react'
import {
  applyEdgeChanges,
  applyNodeChanges,
  useReactFlow,
  type Connection,
  type EdgeChange,
  type EdgeMouseHandler,
  type NodeChange,
  type OnMoveEnd,
  type Viewport,
} from '@xyflow/react'
import {
  AlertCircleIcon,
  CheckCircle2Icon,
  CloudOffIcon,
  FileCode2Icon,
  Loader2Icon,
  PlusIcon,
  SparklesIcon,
} from 'lucide-react'
import { toast } from 'sonner'

import { trpc } from '@/trpc/react-provider'
import { FeatureGate } from '@/components/feature-gate'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { CanvasProvider, CanvasShell } from '@/components/global/canvas'
import { isEntityColorTokenKey } from '@/lib/config/entity-colors'
import {
  isCardinalityValue,
  isOnDeleteValue,
  type CardinalityValue,
  type EntityFlowNode,
  type GraphFieldValues,
  type OnDeleteValue,
  type RelationFlowEdge,
  type UpdateEntityValues,
  type UpdateFieldValues,
} from '@/lib/types'
import { EditorActionsContext } from './editor-context'
import { entityNodeTypes } from './entity-node'
import {
  EntityInspectorSheet,
  type EntityInspectorCallbacks,
} from './entity-inspector-sheet'
import { RelationDialog, type RelationFormOutput } from './relation-dialog'
import { AiSchemaDialog } from './ai-schema-dialog'
import { SchemaCodeDialog } from './schema-code-dialog'
import { CanvasEmptyState, CanvasLegend, CanvasStepsHint } from './canvas-guide'

type SaveState = 'saved' | 'dirty' | 'saving' | 'error'

const AUTOSAVE_DEBOUNCE_MS = 800

/** Orthogonal routing reads best for schema edges. */
const DEFAULT_EDGE_OPTIONS = { type: 'smoothstep' } as const

/* Pure payload builder shared by autosave and conflict-overwrite so both
 * paths can never drift on shape. */
function buildCanvasSaveInput(
  organizationId: string,
  diagramId: string,
  version: number,
  viewport: Viewport,
  nodes: readonly EntityFlowNode[]
) {
  return {
    organizationId,
    diagramId,
    version,
    viewportX: viewport.x,
    viewportY: viewport.y,
    viewportZoom: viewport.zoom,
    entities: nodes.map((node) => ({
      id: node.id,
      positionX: node.position.x,
      positionY: node.position.y,
      collapsed: node.data.collapsed,
    })),
  }
}

export function DiagramEditor({
  organizationId,
  diagramId,
}: {
  organizationId: string
  diagramId: string
}) {
  /* The canvas store must sit ABOVE DiagramEditorInner because that component
   * calls useReactFlow (screenToFlowPosition) — rendering CanvasShell alone
   * would make the provider its child, which is what xyflow error 001 reports.
   * Keying the provider remounts local state AND the canvas store together, so
   * no camera or selection leaks across diagrams. */
  return (
    <CanvasProvider key={diagramId}>
      <DiagramEditorInner organizationId={organizationId} diagramId={diagramId} />
    </CanvasProvider>
  )
}

function DiagramEditorInner({
  organizationId,
  diagramId,
}: {
  organizationId: string
  diagramId: string
}) {
  const utils = trpc.useUtils()
  const { screenToFlowPosition } = useReactFlow()

  /* ── Server snapshot ─────────────────────────────────────────────────── */
  const graphQuery = trpc.diagrams.getById.useQuery({ organizationId, diagramId })
  const graph = graphQuery.data

  /* ── Local canvas state ──────────────────────────────────────────────── */
  const [nodes, setNodes] = React.useState<EntityFlowNode[]>([])
  const [edges, setEdges] = React.useState<RelationFlowEdge[]>([])
  const [saveState, setSaveState] = React.useState<SaveState>('saved')
  const [snapToGrid, setSnapToGrid] = React.useState(false)
  const [aiOpen, setAiOpen] = React.useState(false)
  const [codeOpen, setCodeOpen] = React.useState(false)

  /* Inspector + dialogs */
  const [inspectorEntityId, setInspectorEntityId] = React.useState<string | null>(null)
  const [pendingConnection, setPendingConnection] = React.useState<Connection | null>(null)
  const [editingRelationId, setEditingRelationId] = React.useState<string | null>(null)
  const [relationSubmitting, setRelationSubmitting] = React.useState(false)
  const [relationDeleting, setRelationDeleting] = React.useState(false)

  const [version, setVersion] = React.useState(1)
  const [conflictOpen, setConflictOpen] = React.useState(false)
  const conflictVersionRef = React.useRef<number | null>(null)

  /* Live camera state (updated by move-end) + mirror for async saves. */
  const [viewport, setViewport] = React.useState<Viewport>({ x: 0, y: 0, zoom: 1 })
  const viewportRef = React.useRef<Viewport>({ x: 0, y: 0, zoom: 1 })
  const nodesRef = React.useRef<EntityFlowNode[]>([])

  /* Keep mirrors in sync after commit so event handlers read fresh graphs
   * without touching refs during render. */
  React.useEffect(() => {
    nodesRef.current = nodes
  }, [nodes])
  React.useEffect(() => {
    viewportRef.current = viewport
  }, [viewport])

  /* Camera restore point for CanvasShell's first mount. */
  const [initialViewport, setInitialViewport] = React.useState<Viewport>({
    x: 0,
    y: 0,
    zoom: 1,
  })
  /* Which server snapshot local state was hydrated from — render-phase
   * adjustment (the sanctioned alternative to hydrate-in-effect). */
  const [hydratedGraph, setHydratedGraph] = React.useState<typeof graph>(undefined)

  /* ── Hydration ───────────────────────────────────────────────────────── */

  if (graph && hydratedGraph !== graph) {
    setHydratedGraph(graph)
    setVersion(graph.version)
    const restoredViewport = {
      x: graph.viewportX,
      y: graph.viewportY,
      zoom: graph.viewportZoom,
    }
    setViewport(restoredViewport)
    setInitialViewport(restoredViewport)
    setNodes(
      graph.entities.map((entity) => ({
        id: entity.id,
        type: 'entity' as const,
        position: { x: entity.positionX, y: entity.positionY },
        data: {
          entityId: entity.id,
          name: entity.name,
          note: entity.note,
          color: parseColorToken(entity.color),
          collapsed: entity.collapsed,
          fields: [...entity.fields]
            .sort((a, b) => a.order - b.order)
            .map((f) => ({
              id: f.id,
              name: f.name,
              dataType: f.dataType,
              isPrimary: f.isPrimary,
              isRequired: f.isRequired,
              isUnique: f.isUnique,
              defaultValue: f.defaultValue,
              order: f.order,
            })),
        },
      }))
    )
    setEdges(
      graph.relations.map((relation) => ({
        id: relation.id,
        source: relation.fromEntityId,
        target: relation.toEntityId,
        ...DEFAULT_EDGE_OPTIONS,
        label: relation.label || undefined,
        data: {
          relationId: relation.id,
          cardinality: parseCardinality(relation.cardinality),
          onDelete: parseOnDelete(relation.onDelete),
          label: relation.label,
          fromFieldId: relation.fromFieldId,
          toFieldId: relation.toFieldId,
        },
      }))
    )
  }

  /* ── Autosave (debounced, version-guarded) ───────────────────────────── */

  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  const flushSave = React.useCallback(async () => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    setSaveState('saving')
    try {
      const result = await utils.client.diagrams.saveCanvas.mutate(
        buildCanvasSaveInput(organizationId, diagramId, version, viewportRef.current, nodesRef.current)
      )
      setVersion(result.version)
      setSaveState('saved')
    } catch (error) {
      const shaped = error as {
        data?: { code?: string; cause?: { currentVersion?: number } }
      }
      const stale =
        shaped.data?.code === 'CONFLICT' &&
        typeof shaped.data.cause?.currentVersion === 'number'
      if (stale && shaped.data?.cause) {
        conflictVersionRef.current = shaped.data.cause.currentVersion ?? null
        setConflictOpen(true)
      }
      setSaveState('error')
    }
  }, [utils.client, organizationId, diagramId, version])

  const scheduleSave = React.useCallback(() => {
    setSaveState('dirty')
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => void flushSave(), AUTOSAVE_DEBOUNCE_MS)
  }, [flushSave])

  /* Never lose trailing edits on unmount. */
  React.useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [])

  const handleMoveEnd = React.useCallback<OnMoveEnd>(
    (_event, nextViewport) => {
      setViewport(nextViewport)
      scheduleSave()
    },
    [scheduleSave]
  )

  const handleNodeDragStop = React.useCallback(() => {
    scheduleSave()
  }, [scheduleSave])

  /* ── Context actions (stable identities → node memo stays effective) ── */

  const toggleCollapse = React.useCallback(
    (entityId: string) => {
      setNodes((current) =>
        current.map((node) =>
          node.id === entityId
            ? { ...node, data: { ...node.data, collapsed: !node.data.collapsed } }
            : node
        )
      )
      scheduleSave()
    },
    [scheduleSave]
  )

  const openInspector = React.useCallback((entityId: string) => {
    setInspectorEntityId(entityId)
  }, [])

  /* FK badge lookup derived from current edges — no refs touched in render. */
  const fkFieldIdsByEntity = React.useMemo(() => {
    const map = new Map<string, string[]>()
    for (const edge of edges) {
      if (!edge.data) continue
      if (edge.data.fromFieldId) {
        const list = map.get(edge.source) ?? []
        list.push(edge.data.fromFieldId)
        map.set(edge.source, list)
      }
      if (edge.data.toFieldId) {
        const list = map.get(edge.target) ?? []
        list.push(edge.data.toFieldId)
        map.set(edge.target, list)
      }
    }
    return map
  }, [edges])

  const fkFieldsFor = React.useCallback(
    (entityId: string): readonly string[] => fkFieldIdsByEntity.get(entityId) ?? [],
    [fkFieldIdsByEntity]
  )

  const contextValue = React.useMemo(
    () => ({ openInspector, toggleCollapse, fkFieldsFor }),
    [openInspector, toggleCollapse, fkFieldsFor]
  )

  /* ── Mutations ───────────────────────────────────────────────────────── */

  const createEntity = trpc.diagramEntities.create.useMutation()
  const addFieldMutation = trpc.diagramEntities.addField.useMutation()
  const updateEntity = trpc.diagramEntities.update.useMutation()
  const updateField = trpc.diagramEntities.updateField.useMutation()
  const deleteField = trpc.diagramEntities.deleteField.useMutation()
  const deleteEntity = trpc.diagramEntities.delete.useMutation()

  const addRelation = trpc.diagrams.addRelation.useMutation()
  const updateRelation = trpc.diagrams.updateRelation.useMutation()
  const deleteRelation = trpc.diagrams.deleteRelation.useMutation()

  function patchNodeData(entityId: string, data: Partial<EntityFlowNode['data']>) {
    setNodes((current) =>
      current.map((node) =>
        node.id === entityId ? { ...node, data: { ...node.data, ...data } } : node
      )
    )
  }

  function upsertField(entityId: string, field: GraphFieldValues) {
    setNodes((current) =>
      current.map((node) => {
        if (node.id !== entityId) return node
        const others = node.data.fields.filter((f) => f.id !== field.id)
        const demoted = field.isPrimary
          ? others.map((f) => ({ ...f, isPrimary: false }))
          : others
        return {
          ...node,
          data: { ...node.data, fields: [...demoted, field].sort((a, b) => a.order - b.order) },
        }
      })
    )
  }

  async function handleAddEntity() {
    try {
      const center = screenToFlowPosition({
        x: window.innerWidth / 2,
        y: window.innerHeight / 3,
      })
      const existing = new Set(nodesRef.current.map((n) => n.data.name))
      let name = 'NewEntity'
      for (let i = 2; existing.has(name); i++) name = `NewEntity${i}`

      const createdEntity = await createEntity.mutateAsync({
        organizationId,
        diagramId,
        name,
        note: '',
        color: null,
        positionX: center.x - 128,
        positionY: center.y - 60,
      })

      /* Every table starts somewhere: seed an `id` primary key automatically. */
      const createdField = await addFieldMutation.mutateAsync({
        organizationId,
        entityId: createdEntity.id,
        name: 'id',
        dataType: 'uuid',
        isPrimary: true,
        isRequired: true,
        isUnique: false,
        defaultValue: null,
      })

      setNodes((current) => [
        ...current,
        {
          id: createdEntity.id,
          type: 'entity' as const,
          position: { x: createdEntity.positionX, y: createdEntity.positionY },
          data: {
            entityId: createdEntity.id,
            name: createdEntity.name,
            note: createdEntity.note,
            color: parseColorToken(createdEntity.color),
            collapsed: false,
            fields: [
              {
                id: createdField.id,
                name: createdField.name,
                dataType: createdField.dataType,
                isPrimary: createdField.isPrimary,
                isRequired: createdField.isRequired,
                isUnique: createdField.isUnique,
                defaultValue: createdField.defaultValue,
                order: createdField.order,
              },
            ],
          },
        },
      ])
      toast.success(`Entity “${createdEntity.name}” added`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add entity.')
    }
  }

  const inspectorCallbacks: EntityInspectorCallbacks = {
    onSaveEntityMeta: async (values: UpdateEntityValues) => {
      const updated = await updateEntity.mutateAsync(values)
      patchNodeData(values.entityId, {
        name: updated.name,
        note: updated.note,
        color: parseColorToken(updated.color),
      })
    },
    onAddField: async (values) => {
      if (!inspectorEntityId) throw new Error('No entity selected')
      const created = await addFieldMutation.mutateAsync({
        ...values,
        organizationId,
        entityId: inspectorEntityId,
      })
      upsertField(inspectorEntityId, {
        id: created.id,
        name: created.name,
        dataType: created.dataType,
        isPrimary: created.isPrimary,
        isRequired: created.isRequired,
        isUnique: created.isUnique,
        defaultValue: created.defaultValue,
        order: created.order,
      })
    },
    onUpdateField: async (fieldId: string, values: Partial<UpdateFieldValues>) => {
      const updated = await updateField.mutateAsync({ fieldId, ...values, organizationId })
      setNodes((current) =>
        current.map((node) =>
          node.id === inspectorEntityId
            ? {
                ...node,
                data: {
                  ...node.data,
                  fields: node.data.fields.map((f) =>
                    f.id === fieldId
                      ? {
                          ...f,
                          name: updated.name ?? f.name,
                          dataType: updated.dataType ?? f.dataType,
                          isPrimary:
                            values.isPrimary !== undefined ? values.isPrimary : f.isPrimary,
                          isRequired:
                            values.isRequired !== undefined ? values.isRequired : f.isRequired,
                          isUnique:
                            values.isUnique !== undefined ? values.isUnique : f.isUnique,
                          defaultValue:
                            values.defaultValue !== undefined
                              ? values.defaultValue
                              : f.defaultValue,
                        }
                      : values.isPrimary
                        ? { ...f, isPrimary: false }
                        : f
                  ),
                },
              }
            : node
        )
      )
    },
    onDeleteField: async (fieldId: string) => {
      await deleteField.mutateAsync({ organizationId, fieldId })
      setNodes((current) =>
        current.map((node) =>
          node.id === inspectorEntityId
            ? {
                ...node,
                data: {
                  ...node.data,
                  fields: node.data.fields.filter((f) => f.id !== fieldId),
                },
              }
            : node
        )
      )
    },
    onDeleteEntity: async () => {
      if (!inspectorEntityId) return
      const result = await deleteEntity.mutateAsync({
        organizationId,
        entityId: inspectorEntityId,
      })
      setNodes((current) => current.filter((node) => node.id !== inspectorEntityId))
      setEdges((current) =>
        current.filter(
          (edge) => edge.source !== inspectorEntityId && edge.target !== inspectorEntityId
        )
      )
      setInspectorEntityId(null)
      await Promise.allSettled([
        utils.diagrams.list.invalidate({ organizationId }),
        utils.usage.getFeatureGates.invalidate({ organizationId }),
      ])
      toast.success(
        result.removedRelations > 0
          ? `Entity deleted (${result.removedRelations} relations removed)`
          : 'Entity deleted'
      )
    },
  }

  /* ── Relations ───────────────────────────────────────────────────────── */

  const handleConnect = React.useCallback((connection: Connection) => {
    if (!connection.source || !connection.target) return
    if (connection.source === connection.target) {
      toast.error('Self-relations land in a later iteration.')
      return
    }
    setPendingConnection(connection)
  }, [])

  async function handleRelationSubmit(values: RelationFormOutput) {
    setRelationSubmitting(true)
    try {
      if (editingRelationId) {
        const updated = await updateRelation.mutateAsync({
          organizationId,
          relationId: editingRelationId,
          ...values,
        })
        setEdges((current) =>
          current.map((edge) =>
            edge.data?.relationId === editingRelationId
              ? {
                  ...edge,
                  label: updated.label || undefined,
                  data: {
                    relationId: updated.id,
                    cardinality: parseCardinality(updated.cardinality),
                    onDelete: parseOnDelete(updated.onDelete),
                    label: updated.label,
                    fromFieldId: updated.fromFieldId,
                    toFieldId: updated.toFieldId,
                  },
                }
              : edge
          )
        )
        toast.success('Relation updated')
        setEditingRelationId(null)
      } else if (pendingConnection) {
        const created = await addRelation.mutateAsync({
          organizationId,
          diagramId,
          fromEntityId: pendingConnection.source,
          toEntityId: pendingConnection.target,
          cardinality: values.cardinality,
          onDelete: values.onDelete,
          label: values.label,
        })
        setEdges((current) => [
          ...current,
          {
            id: created.id,
            source: created.fromEntityId,
            target: created.toEntityId,
            ...DEFAULT_EDGE_OPTIONS,
            label: created.label || undefined,
            data: {
              relationId: created.id,
              cardinality: parseCardinality(created.cardinality),
              onDelete: parseOnDelete(created.onDelete),
              label: created.label,
              fromFieldId: created.fromFieldId ?? null,
              toFieldId: created.toFieldId ?? null,
            },
          },
        ])
        toast.success('Relation created')
        setPendingConnection(null)
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save relation.')
    } finally {
      setRelationSubmitting(false)
    }
  }

  async function handleRelationDelete() {
    if (!editingRelationId) return
    setRelationDeleting(true)
    try {
      await deleteRelation.mutateAsync({ organizationId, relationId: editingRelationId })
      setEdges((current) => current.filter((edge) => edge.id !== editingRelationId))
      setEditingRelationId(null)
      toast.success('Relation removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove relation.')
    } finally {
      setRelationDeleting(false)
    }
  }

  const handleEdgeDoubleClick = React.useCallback<EdgeMouseHandler<RelationFlowEdge>>(
    (_event, edge) => {
      if (edge.data) setEditingRelationId(edge.data.relationId)
    },
    []
  )

  /* ── Derived dialog payloads ─────────────────────────────────────────── */

  const nodeNameById = React.useMemo(
    () => new Map(nodes.map((n) => [n.id, n.data.name])),
    [nodes]
  )
  const fieldNameById = React.useMemo(() => {
    const map = new Map<string, string>()
    for (const node of nodes) {
      for (const field of node.data.fields) map.set(field.id, field.name)
    }
    return map
  }, [nodes])

  const editingEdge =
    editingRelationId !== null
      ? edges.find((edge) => edge.data?.relationId === editingRelationId) ?? null
      : null
  const inspectorNode =
    inspectorEntityId !== null
      ? nodes.find((node) => node.id === inspectorEntityId) ?? null
      : null

  /* ── Loading / missing states ────────────────────────────────────────── */

  if (graphQuery.isLoading && !graph) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center rounded-lg border bg-card">
        <Loader2Icon className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (graphQuery.isError || (!graphQuery.isLoading && !graph)) {
    return (
      <div className="flex h-[calc(100vh-8rem)] flex-col items-center justify-center gap-2 rounded-lg border bg-card">
        <p className="text-sm font-medium text-destructive">This diagram could not be loaded.</p>
        <p className="text-xs text-muted-foreground">It may have been deleted.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="h-[calc(100vh-10rem)] overflow-hidden rounded-lg border bg-background">
        <EditorActionsContext.Provider value={contextValue}>
          <CanvasShell
            nodes={nodes}
            edges={edges}
            onNodesChange={(changes: NodeChange<EntityFlowNode>[]) =>
              setNodes((current) => applyNodeChanges(changes, current))
            }
            onEdgesChange={(changes: EdgeChange<RelationFlowEdge>[]) =>
              setEdges((current) => applyEdgeChanges(changes, current))
            }
            onConnect={handleConnect}
            onMoveEnd={handleMoveEnd}
            onNodeDragStop={handleNodeDragStop}
            onEdgeDoubleClick={handleEdgeDoubleClick}
            nodeTypes={entityNodeTypes}
            defaultViewport={initialViewport}
            snapToGrid={snapToGrid}
            fitView={false}
            loading={graphQuery.isLoading && nodes.length === 0}
            legend={nodes.length > 0 ? <CanvasLegend /> : undefined}
            overlay={nodes.length === 0 ? <CanvasEmptyState /> : undefined}
            toolbar={
              <div className="flex items-center gap-3 rounded-md border bg-card p-2 shadow-sm">
                <FeatureGate resource="diagramEntities">
                  <Button size="sm" className="gap-1.5" onClick={() => void handleAddEntity()}>
                    <PlusIcon className="h-4 w-4" />
                    Entity
                  </Button>
                </FeatureGate>
                {/* Ask AI is gated on the aiSchema quota; viewing code is
                  * free because generation is entirely client-side. */}
                <FeatureGate resource="aiSchema">
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5"
                    onClick={() => setAiOpen(true)}
                  >
                    <SparklesIcon className="h-4 w-4" />
                    Ask AI
                  </Button>
                </FeatureGate>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => setCodeOpen(true)}
                >
                  <FileCode2Icon className="h-4 w-4" />
                  Code
                </Button>
                <label className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground">
                  <Switch
                    checked={snapToGrid}
                    onCheckedChange={setSnapToGrid}
                    aria-label="Snap to grid"
                  />
                  Snap
                </label>
                {/* Save status. Each state pairs an icon with its wording so it
                 * is readable at a glance, and the failure state is a real
                 * button — bare red text does not read as something to click. */}
                <span className="flex items-center gap-1.5 border-l pl-3 text-xs text-muted-foreground">
                  {saveState === 'saving' ? (
                    <>
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                      Saving…
                    </>
                  ) : saveState === 'dirty' ? (
                    <>
                      <CloudOffIcon className="h-3 w-3" />
                      Unsaved changes
                    </>
                  ) : saveState === 'error' ? (
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 gap-1 px-2 text-xs"
                      onClick={() => void flushSave()}
                      title="Saving failed — click to try again"
                    >
                      <AlertCircleIcon className="h-3 w-3" />
                      Save failed — retry
                    </Button>
                  ) : (
                    <>
                      <CheckCircle2Icon className="h-3 w-3 text-primary" />
                      All changes saved
                    </>
                  )}
                </span>
              </div>
            }
          />

          {/* Inspector sheet */}
          <EntityInspectorSheet
            open={inspectorNode !== null}
            onOpenChange={(open) => !open && setInspectorEntityId(null)}
            organizationId={organizationId}
            node={inspectorNode}
            nodes={nodes}
            edges={edges}
            callbacks={inspectorCallbacks}
          />

          {/* New-relation dialog (connect drag) */}
          {pendingConnection ? (
            <RelationDialog
              open
              onOpenChange={(open) => !open && setPendingConnection(null)}
              title="New relation"
              description="Choose how these entities relate."
              fromEndpoint={{
                entityName: nodeNameById.get(pendingConnection.source) ?? 'Source',
                fieldName: pendingConnection.sourceHandle
                  ? fieldNameById.get(pendingConnection.sourceHandle) ?? null
                  : null,
              }}
              toEndpoint={{
                entityName: nodeNameById.get(pendingConnection.target) ?? 'Target',
                fieldName: pendingConnection.targetHandle
                  ? fieldNameById.get(pendingConnection.targetHandle) ?? null
                  : null,
              }}
              submitting={relationSubmitting}
              submitLabel="Create relation"
              onSubmit={handleRelationSubmit}
            />
          ) : null}

          {/* Edit/delete dialog (edge double-click) */}
          {editingEdge?.data ? (
            <RelationDialog
              open
              onOpenChange={(open) => !open && setEditingRelationId(null)}
              title="Edit relation"
              description="Adjust this relationship or remove it."
              fromEndpoint={{ entityName: nodeNameById.get(editingEdge.source) ?? 'Source' }}
              toEndpoint={{ entityName: nodeNameById.get(editingEdge.target) ?? 'Target' }}
              initial={{
                cardinality: editingEdge.data.cardinality,
                onDelete: editingEdge.data.onDelete,
                label: editingEdge.data.label,
              }}
              submitting={relationSubmitting}
              submitLabel="Save relation"
              onSubmit={handleRelationSubmit}
              onDelete={() => void handleRelationDelete()}
              deleting={relationDeleting}
            />
          ) : null}

          {/* Version-conflict resolution */}
          <ConflictDialog
            open={conflictOpen}
            onOpenChange={setConflictOpen}
            onReload={async () => {
              setConflictOpen(false)
              await utils.diagrams.getById.invalidate({ organizationId, diagramId })
            }}
            onOverwrite={async () => {
              const serverVersion = conflictVersionRef.current
              if (typeof serverVersion === 'number') {
                try {
                  /* Clobber with OUR current graph at the server's version. */
                  const result = await utils.client.diagrams.saveCanvas.mutate(
                    buildCanvasSaveInput(
                      organizationId,
                      diagramId,
                      serverVersion,
                      viewportRef.current,
                      nodesRef.current
                    )
                  )
                  setVersion(result.version)
                  setSaveState('saved')
                  setConflictOpen(false)
                } catch {
                  setSaveState('error')
                  toast.error('Overwrite failed — try again.')
                }
              }
            }}
          />
        </EditorActionsContext.Provider>
      </div>

      {/* Neither dialog owns canvas state: the AI one invalidates
        * diagrams.getById and lets the hydration path redraw, and the code
        * one only reads nodes/edges. */}
      <AiSchemaDialog
        open={aiOpen}
        onOpenChange={setAiOpen}
        organizationId={organizationId}
        diagramId={diagramId}
        entityCount={nodes.length}
      />
      <SchemaCodeDialog
        open={codeOpen}
        onOpenChange={setCodeOpen}
        diagramName={graph?.name ?? "Untitled design"}
        nodes={nodes}
        edges={edges}
      />

      <CanvasStepsHint />
    </div>
  )
}

/* ── Hydration boundary helpers ──────────────────────────────────────────── */

function parseColorToken(value: string | null) {
  return value !== null && isEntityColorTokenKey(value) ? value : null
}

function parseCardinality(value: string): CardinalityValue {
  return isCardinalityValue(value) ? value : 'MANY_TO_ONE'
}

function parseOnDelete(value: string): OnDeleteValue {
  return isOnDeleteValue(value) ? value : 'restrict'
}

/**
 * SOURCE OF TRUTH KEYWORDS: ConflictDialog
 *
 * WHAT:  Reload-or-overwrite chooser shown when saveCanvas reports CONFLICT.
 * WHY:   Acceptance criterion — a stale writer must choose explicitly; neither
 *          branch silently clobbers.
 */
function ConflictDialog({
  open,
  onOpenChange,
  onReload,
  onOverwrite,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onReload: () => void | Promise<void>
  onOverwrite: () => void | Promise<void>
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>This design changed elsewhere</AlertDialogTitle>
          <AlertDialogDescription>
            Another editor saved newer changes. Reload to see them, or overwrite with your
            version.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => void onReload()}>
            Reload
          </Button>
          <Button onClick={() => void onOverwrite()}>Overwrite</Button>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  )
}
