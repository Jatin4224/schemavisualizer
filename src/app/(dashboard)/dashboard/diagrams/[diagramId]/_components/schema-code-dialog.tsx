'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: SchemaCodeDialog, CodeBlock
 *
 * WHAT:  The "View code" modal — the current design rendered as a Prisma schema,
 *        PostgreSQL DDL, or a portable JSON design file.
 * WHY:   Generation runs CLIENT-SIDE from live canvas state, not from the last
 *        server snapshot, so the code always matches what the user is looking at
 *        — including an edit made a second ago. The generators are the same pure
 *        modules a server-side export will call, so the two can never drift.
 *        Memoized on nodes/edges/target: re-emitting three dialects on every
 *        drag frame would be wasted work on a large design.
 *        Plain <pre> with line numbers rather than a syntax highlighter: no new
 *        dependency, and the theme's --font-mono already reads well.
 * WHERE: Opened from the canvas toolbar in diagram-editor.tsx.
 */

import * as React from 'react'
import { CheckIcon, CopyIcon, FileCode2Icon } from 'lucide-react'
import { toast } from 'sonner'

import { CODEGEN_TARGETS, CODEGEN_TARGET_KEYS, graphFromFlow } from '@/lib/codegen'
import type { CodegenTargetKey, EntityFlowNode, RelationFlowEdge } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export function SchemaCodeDialog({
  open,
  onOpenChange,
  diagramName,
  nodes,
  edges,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  diagramName: string
  nodes: readonly EntityFlowNode[]
  edges: readonly RelationFlowEdge[]
}) {
  const [target, setTarget] = React.useState<CodegenTargetKey>('prisma')

  const file = React.useMemo(() => {
    const graph = graphFromFlow({ name: diagramName, nodes, edges })
    return CODEGEN_TARGETS[target].generate(graph)
  }, [diagramName, nodes, edges, target])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[820px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileCode2Icon className="h-4 w-4 text-primary" />
            Generated code
          </DialogTitle>
          <DialogDescription>
            {CODEGEN_TARGETS[target].description}. Regenerates as you edit the canvas.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={target}
          onValueChange={(value) => setTarget(value as CodegenTargetKey)}
          className="gap-3"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <TabsList>
              {CODEGEN_TARGET_KEYS.map((key) => (
                <TabsTrigger key={key} value={key}>
                  {CODEGEN_TARGETS[key].label}
                </TabsTrigger>
              ))}
            </TabsList>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="font-mono">
                {file.path}
              </Badge>
              <CopyButton contents={file.contents} />
            </div>
          </div>

          {CODEGEN_TARGET_KEYS.map((key) => (
            <TabsContent key={key} value={key}>
              {/* Only the active tab's file is computed, so every tab renders
                * the same memoized value. */}
              <CodeBlock contents={file.contents} />
            </TabsContent>
          ))}
        </Tabs>

        <p className="text-xs text-muted-foreground">
          Composite keys, indexes and enums are not modelled yet, so they are absent from the
          output.
        </p>
      </DialogContent>
    </Dialog>
  )
}

/* Line-numbered, horizontally scrollable code view. The pre scrolls inside its
 * own box so a long SQL line never widens the dialog. */
function CodeBlock({ contents }: { contents: string }) {
  const lines = contents.split('\n')
  return (
    <div className="max-h-[52vh] overflow-auto rounded-md border bg-background">
      <pre className="min-w-max p-3 font-mono text-xs leading-relaxed">
        <code>
          {lines.map((line, index) => (
            <span key={index} className="block">
              <span className="mr-4 inline-block w-8 select-none text-right text-muted-foreground">
                {index + 1}
              </span>
              {line || ' '}
            </span>
          ))}
        </code>
      </pre>
    </div>
  )
}

function CopyButton({ contents }: { contents: string }) {
  const [copied, setCopied] = React.useState(false)

  React.useEffect(() => {
    if (!copied) return
    const timer = setTimeout(() => setCopied(false), 1800)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(contents)
      setCopied(true)
    } catch {
      /* Clipboard is blocked in insecure contexts and some embedded views. */
      toast.error('Could not copy — select the text and copy manually.')
    }
  }

  return (
    <Button variant="outline" size="sm" className="gap-1.5" onClick={() => void handleCopy()}>
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? 'Copied' : 'Copy'}
    </Button>
  )
}
