/**
 * SOURCE OF TRUTH KEYWORDS: CanvasShell, CanvasShellProps, CanvasProvider
 *
 * Barrel for reusable canvas primitives (CLAUDE.md: global components live in
 * components/global/<NAME>). Import from '@/components/global/canvas'.
 *
 * CanvasProvider is only needed when YOUR component calls a canvas hook
 * (useReactFlow); CanvasShell mounts its own store otherwise.
 */

export { CanvasShell, CanvasProvider } from './canvas-shell'
export type { CanvasShellProps } from './canvas-shell'
