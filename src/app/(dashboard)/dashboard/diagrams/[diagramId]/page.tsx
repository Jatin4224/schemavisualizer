/**
 * SOURCE OF TRUTH KEYWORDS: DiagramEditorPage
 *
 * WHAT:  /dashboard/diagrams/[diagramId] route — unwraps the async route param
 *        and mounts the editor view.
 * WHERE: Linked from the diagram cards on /dashboard/diagrams.
 */

import type { Metadata } from 'next'

import { DiagramEditorView } from './_components/diagram-editor-view'

export const metadata: Metadata = {
  title: 'Diagram',
}

export default async function DiagramEditorPage({
  params,
}: {
  params: Promise<{ diagramId: string }>
}) {
  const { diagramId } = await params
  return <DiagramEditorView diagramId={diagramId} />
}
