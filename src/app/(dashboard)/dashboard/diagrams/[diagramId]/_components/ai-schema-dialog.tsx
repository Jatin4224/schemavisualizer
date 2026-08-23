'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: AiSchemaDialog, AiChatTurn, AI_PROMPT_EXAMPLES
 *
 * WHAT:  The "Ask AI" modal — describe a product in plain English and the
 *        entities, fields and relations appear on the canvas behind it.
 * WHY:   The dialog owns NO canvas state. On success it invalidates
 *        diagrams.getById and the editor's existing hydration path redraws, so
 *        there is exactly one code path turning a server graph into nodes and
 *        edges. The transcript is in-memory: this is a command surface, not a
 *        chat history, and the design itself is the persisted artifact.
 * WHERE: Opened from the canvas toolbar in diagram-editor.tsx. Calls
 *        aiSchema.create, which carries the plan cap, counter, audit row and
 *        rate limit automatically.
 */

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { AlertCircleIcon, Loader2Icon, SparklesIcon } from 'lucide-react'
import { toast } from 'sonner'

import { trpc } from '@/trpc/react-provider'
import { FeatureGate } from '@/components/feature-gate'
import { aiSchemaFormSchema, type AiSchemaFormValues, type AiSchemaMode } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

/** Seeds an empty canvas — one tap instead of staring at a blank prompt box. */
const AI_PROMPT_EXAMPLES = [
  'LMS with courses, lessons, students, enrollments and quizzes',
  'E-commerce store with products, variants, carts and orders',
  'Ride hailing app with drivers, riders, trips and payments',
  'Hospital system with patients, doctors, appointments and prescriptions',
] as const

interface AiChatTurn {
  id: number
  role: 'user' | 'assistant'
  text: string
  /** Present on a successful assistant turn — renders the outcome chips. */
  stats?: {
    entities: number
    fields: number
    relations: number
    dropped: number
  }
  isError?: boolean
}

export function AiSchemaDialog({
  open,
  onOpenChange,
  organizationId,
  diagramId,
  entityCount,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  diagramId: string
  entityCount: number
}) {
  const utils = trpc.useUtils()
  const [turns, setTurns] = React.useState<AiChatTurn[]>([])
  /* Replace wipes the canvas first, so it defaults off — a stray prompt must
   * never silently destroy an existing design. */
  const [mode, setMode] = React.useState<AiSchemaMode>('extend')
  const scrollRef = React.useRef<HTMLDivElement | null>(null)

  const generate = trpc.aiSchema.create.useMutation()

  const form = useForm<AiSchemaFormValues>({
    resolver: zodResolver(aiSchemaFormSchema),
    defaultValues: { prompt: '' },
  })

  /* Pin the transcript to the newest turn. */
  React.useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [turns, generate.isPending])

  /* Id is derived from the previous turn inside the updater rather than from a
   * counter ref — a ref read would be reachable from render through
   * form.handleSubmit, which the react-hooks rules (rightly) reject. */
  function pushTurn(turn: Omit<AiChatTurn, 'id'>) {
    setTurns((current) => [
      ...current,
      { ...turn, id: (current[current.length - 1]?.id ?? 0) + 1 },
    ])
  }

  async function onSubmit(values: AiSchemaFormValues) {
    const prompt = values.prompt.trim()
    if (!prompt || generate.isPending) return

    pushTurn({ role: 'user', text: prompt })
    form.reset({ prompt: '' })

    try {
      const result = await generate.mutateAsync({
        organizationId,
        diagramId,
        prompt,
        mode,
      })

      /* The editor re-hydrates from this query, so invalidating is what draws
       * the new entities. Gates too: a generation moves both the aiSchema and
       * the diagramEntities counters. */
      await Promise.all([
        utils.diagrams.getById.invalidate({ organizationId, diagramId }),
        utils.usage.getFeatureGates.invalidate({ organizationId }),
      ])

      pushTurn({
        role: 'assistant',
        text: result.summary,
        stats: {
          entities: result.entitiesCreated,
          fields: result.fieldsCreated,
          relations: result.relationsCreated,
          dropped: result.droppedEntities + result.droppedRelations,
        },
      })
      /* Follow-up prompts should build on what is now on the canvas. */
      setMode('extend')
      toast.success(`Added ${result.entitiesCreated} entities to the design`)
    } catch (error) {
      const text =
        error instanceof Error
          ? error.message
          : 'Something went wrong generating that schema.'
      pushTurn({ role: 'assistant', text, isError: true })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SparklesIcon className="h-4 w-4 text-primary" />
            Ask AI to design your schema
          </DialogTitle>
          <DialogDescription>
            Describe the product in plain English. The tables, columns and relationships
            appear on the canvas behind this dialog.
          </DialogDescription>
        </DialogHeader>

        {/* Transcript. Fixed height so the dialog does not resize per turn. */}
        <div ref={scrollRef} className="max-h-64 min-h-32 space-y-3 overflow-y-auto pr-1">
          {turns.length === 0 ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">
                {entityCount === 0
                  ? 'Try one of these, or describe your own product:'
                  : 'Ask for more tables and they will be added to what you already have:'}
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {AI_PROMPT_EXAMPLES.map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => form.setValue('prompt', example, { shouldValidate: true })}
                    className="rounded-md border bg-background px-2.5 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={turn.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
              >
                <div
                  className={[
                    'max-w-[85%] rounded-lg px-3 py-2 text-xs',
                    turn.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : turn.isError
                        ? 'border border-destructive/40 bg-destructive/10 text-destructive'
                        : 'border bg-card text-foreground',
                  ].join(' ')}
                >
                  {turn.isError ? (
                    <span className="mb-1 flex items-center gap-1.5 font-medium">
                      <AlertCircleIcon className="h-3 w-3" />
                      Generation failed
                    </span>
                  ) : null}
                  <p className="whitespace-pre-wrap">{turn.text}</p>
                  {turn.stats ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      <Badge variant="secondary">{turn.stats.entities} entities</Badge>
                      <Badge variant="secondary">{turn.stats.fields} fields</Badge>
                      <Badge variant="secondary">{turn.stats.relations} relations</Badge>
                      {turn.stats.dropped > 0 ? (
                        <Badge variant="outline">{turn.stats.dropped} skipped as invalid</Badge>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>
            ))
          )}

          {generate.isPending ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2Icon className="h-3 w-3 animate-spin" />
              Designing your schema — a large domain can take up to a minute…
            </div>
          ) : null}
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <FormField
              control={form.control}
              name="prompt"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea
                      {...field}
                      rows={3}
                      autoFocus
                      disabled={generate.isPending}
                      placeholder={
                        mode === 'replace'
                          ? 'Describe the schema to build from scratch…'
                          : 'Describe what to add — e.g. "add reviews and ratings"…'
                      }
                      className="resize-none text-sm"
                      onKeyDown={(event) => {
                        /* Enter sends, Shift+Enter newlines — the convention
                         * every chat surface uses. */
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault()
                          void form.handleSubmit(onSubmit)()
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex items-center justify-between gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground">
                <Switch
                  checked={mode === 'replace'}
                  onCheckedChange={(checked) => setMode(checked ? 'replace' : 'extend')}
                  disabled={generate.isPending}
                  aria-label="Replace the existing design instead of adding to it"
                />
                {mode === 'replace' ? 'Replace the whole design' : 'Add to the current design'}
              </label>

              <FeatureGate resource="aiSchema">
                <Button type="submit" className="gap-1.5" disabled={generate.isPending}>
                  {generate.isPending ? (
                    <Loader2Icon className="h-4 w-4 animate-spin" />
                  ) : (
                    <SparklesIcon className="h-4 w-4" />
                  )}
                  Generate
                </Button>
              </FeatureGate>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
