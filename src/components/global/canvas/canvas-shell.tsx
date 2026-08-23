'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasShell, CanvasShellProps, CANVAS_SHELL,
 *   XYFLOW_THEME_VARS
 *
 * WHAT:  The reusable pan/zoom canvas primitive — a themed wrapper around
 *        @xyflow/react's ReactFlow that bakes in the app's theme tokens,
 *        grid background, controls, minimap, snap-to-grid and a toolbar slot.
 * WHY:   Every canvas surface (today the Schema Studio editor) shares one
 *        styling + behavior contract instead of re-theming ReactFlow per
 *        route. Slots keep it configurable: callers own nodes/edges/handlers
 *        and pass custom node/edge types plus any toolbar UI.
 * WHERE: Consumed by src/app/(dashboard)/dashboard/diagrams/[diagramId]/_components.
 */

import * as React from 'react'
import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type EdgeTypes,
  type Node,
  type NodeTypes,
  type OnConnect,
  type EdgeMouseHandler,
  type OnEdgesChange,
  type OnMoveEnd,
  type OnNodeDrag,
  type OnNodesChange,
  type OnSelectionChangeFunc,
  type Viewport,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export interface CanvasShellProps<N extends Node, E extends Edge> {
  nodes: N[]
  edges: E[]
  onNodesChange: OnNodesChange<N>
  onEdgesChange: OnEdgesChange<E>
  onConnect?: OnConnect
  /** Fired after pan/zoom settles — persist the camera here. */
  onMoveEnd?: OnMoveEnd
  onNodeDragStop?: OnNodeDrag<N>
  onEdgeDoubleClick?: EdgeMouseHandler<E>
  onSelectionChange?: OnSelectionChangeFunc<N, E>
  /** Rendered as a floating panel top-left (add-entity button, toggles…). */
  toolbar?: React.ReactNode
  /** Rendered as a floating panel top-right (legends, keys, counts…). */
  legend?: React.ReactNode
  /**
   * Centered layer above the canvas for empty states and coach marks. Give it
   * `pointer-events-none` unless it is meant to swallow canvas drags.
   */
  overlay?: React.ReactNode
  nodeTypes?: NodeTypes
  edgeTypes?: EdgeTypes
  /** Restore point for the persisted camera. */
  defaultViewport?: Viewport
  minimap?: boolean
  snapToGrid?: boolean
  fitView?: boolean
  /** True while the graph is loading — dims the canvas instead of flashing. */
  loading?: boolean
}

/* Maps app theme tokens onto xyflow's CSS variable surface so edges,
 * minimap and controls follow light/dark automatically (no hardcoded colors). */
const XYFLOW_THEME_VARS = {
  '--xy-background-color': 'var(--background)',
  '--xy-edge-stroke': 'var(--border)',
  '--xy-edge-stroke-width': '1.5',
  '--xy-edge-stroke-selected': 'var(--primary)',
  '--xy-connectionline-stroke': 'var(--muted-foreground)',
  '--xy-attribution-background-color-default': 'transparent',
  '--xy-minimap-background-color': 'var(--card)',
  '--xy-minimap-mask-background-color': 'color-mix(in oklab, var(--background) 55%, transparent)',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-background-color-hover': 'var(--accent)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
} as const

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasProviderMountedContext, CanvasProvider,
 *   ReactFlowProvider, useReactFlow, canvas store
 *
 * WHAT:  Tracks whether a CanvasProvider is already mounted above this point.
 * WHY:   ReactFlowProvider creates a NEW store every time it mounts, so nesting
 *        two of them silently splits the canvas in half — a useReactFlow() call
 *        above the inner provider would read a detached store and return wrong
 *        coordinates instead of erroring. This flag lets CanvasShell stay
 *        plug-and-play (auto-mounting a provider when it is the only consumer)
 *        while never double-mounting under a caller that brought its own.
 * WHERE: Set by CanvasProvider, read by CanvasShell below.
 */
const CanvasProviderMountedContext = React.createContext(false)

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasProvider, ReactFlowProvider, useReactFlow
 *
 * WHAT:  Mounts the canvas store ABOVE the subtree that needs it.
 * WHY:   Any component that calls useReactFlow (screenToFlowPosition, fitView,
 *        getNodes…) must sit BELOW the provider. Rendering CanvasShell does not
 *        satisfy that — the provider would be that component's child. Wrap the
 *        hook-calling component in this instead.
 * WHERE: DiagramEditor wraps DiagramEditorInner with it; any future canvas
 *        feature whose orchestrator needs canvas hooks does the same.
 */
export function CanvasProvider({ children }: { children: React.ReactNode }) {
  return (
    <CanvasProviderMountedContext.Provider value={true}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </CanvasProviderMountedContext.Provider>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasShellInner
 *
 * WHAT:  The themed ReactFlow core. Always renders below a canvas store.
 * WHERE: Wrapped by CanvasShell below.
 */
function CanvasShellInner<N extends Node, E extends Edge>({
  nodes,
  edges,
  onNodesChange,
  onEdgesChange,
  onConnect,
  onMoveEnd,
  onNodeDragStop,
  onEdgeDoubleClick,
  onSelectionChange,
  toolbar,
  legend,
  overlay,
  nodeTypes,
  edgeTypes,
  defaultViewport,
  minimap = true,
  snapToGrid = false,
  fitView = true,
  loading = false,
}: CanvasShellProps<N, E>) {
  return (
    <div
      className="relative h-full w-full"
      /* CSS custom properties aren't in csstype's property map — a lone
       * documented assertion keeps the token mapping type-honest. */
      style={XYFLOW_THEME_VARS as React.CSSProperties}
    >
      {loading ? (
        <div className="absolute inset-0 z-10 animate-pulse bg-background/50" aria-hidden />
      ) : null}
      <ReactFlow<N, E>
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        /* Optional handlers are spread conditionally — exactOptionalPropertyTypes
         * forbids passing explicit `undefined` into ReactFlow's prop types. */
        {...(onConnect ? { onConnect } : {})}
        {...(onMoveEnd ? { onMoveEnd } : {})}
        {...(onNodeDragStop ? { onNodeDragStop } : {})}
        {...(onEdgeDoubleClick ? { onEdgeDoubleClick } : {})}
        {...(onSelectionChange ? { onSelectionChange } : {})}
        {...(nodeTypes ? { nodeTypes } : {})}
        {...(edgeTypes ? { edgeTypes } : {})}
        {...(defaultViewport ? { defaultViewport } : {})}
        snapToGrid={snapToGrid}
        snapGrid={[16, 16]}
        fitView={fitView}
        fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: true }}
        deleteKeyCode={['Backspace', 'Delete']}
        multiSelectionKeyCode="Shift"
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={24} size={1.5} color="var(--border)" />
        {minimap ? (
          <MiniMap pannable zoomable className="hidden md:block rounded-md border shadow-sm" />
        ) : null}
        <Controls showInteractive={false} className="rounded-md border shadow-sm" />
        {toolbar ? <Panel position="top-left">{toolbar}</Panel> : null}
        {legend ? <Panel position="top-right">{legend}</Panel> : null}
      </ReactFlow>

      {/* Sibling of ReactFlow rather than a Panel — Panel has no centered
       * position, and an empty state belongs in the middle of the viewport. */}
      {overlay ? <div className="absolute inset-0 z-10">{overlay}</div> : null}
    </div>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: CanvasShell, CanvasProvider, ReactFlowProvider
 *
 * WHAT:  Public canvas component. Mounts a canvas store itself ONLY when no
 *        CanvasProvider is already above it, so exactly one store ever exists.
 * WHY:   Simple callers just drop in <CanvasShell /> and it works. Callers whose
 *        own component calls useReactFlow wrap that component in CanvasProvider
 *        — and this then reuses that store rather than nesting a second one.
 * WHERE: Diagram editor today; any future canvas feature tomorrow.
 */
export function CanvasShell<N extends Node, E extends Edge>(props: CanvasShellProps<N, E>) {
  const hasProvider = React.useContext(CanvasProviderMountedContext)

  if (hasProvider) return <CanvasShellInner {...props} />

  return (
    <CanvasProvider>
      <CanvasShellInner {...props} />
    </CanvasProvider>
  )
}
