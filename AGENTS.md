# AGENTS.md

Entry point for opencode (and any AGENTS.md-aware agent) working in this repo.

## The rulebook

**`.claude/CLAUDE.md` is the single source of truth for how code is written here.**
It is loaded into every opencode session automatically via the `instructions` array in
`opencode.json`. Do not copy those rules into this file — if anything here ever conflicts
with `.claude/CLAUDE.md`, `.claude/CLAUDE.md` wins.

This file only carries what the rulebook does not: where things live, and how to run them.

## Why this repo

Multi-tenant SaaS boilerplate on Next.js 16 + tRPC 11 + Prisma 6 + Better Auth + Stripe,
Tailwind 4 + shadcn/ui, Zod 4 + react-hook-form. Everything is layered and globalized;
nothing is one-off.

## Where code lives

| Path | What belongs there |
| --- | --- |
| `src/trpc/procedures` | Protected/base procedures — auth, tenancy, feature gates, rate limits, audit |
| `src/trpc/routers` | Business logic: validation, orchestration, decisions |
| `src/services/*.service.ts` | The **only** layer that touches the database — every file starts with `import 'server-only'` |
| `src/lib/types` | Every custom type in the app. Types are never written anywhere else |
| `src/lib/config` | Registry / configuration that drives the app |
| `src/components/global/<NAME>` | Reusable components (configurable, slot-friendly) |
| `src/app/<route>/_components` | Components used by exactly one route |
| `src/proxy.ts` | Request middleware. **Never create `middleware.ts`** — the framework reads `proxy.ts` |
| `prisma/` | Schema and migrations; generated client is imported from `@/generated/prisma` |
| `docs/` | The *why* behind the rules — read on demand, not upfront |

## Read on demand (don't preload)

`docs/01-architecture.md` (mental model) → `docs/02-the-registry.md` (the file that drives
everything) → `docs/03-procedures-and-routers.md` (where your code goes) →
`docs/07-adding-a-feature.md` (end-to-end walkthrough) → `docs/08-types-and-grep.md`
(type hierarchy + grep navigation). Pull the one page you need, not the folder.

## Workflow for any change

1. **Grep first.** Search `SOURCE OF TRUTH KEYWORDS` for the symbol/type/component you are
   about to write. Reuse or extend what exists. Creating a duplicate because grep felt like
   work is the single worst failure mode here.
2. **Pick the layer.** Procedure (cross-cutting) → router (business logic) → service (DB only).
   Never let a router talk to Prisma directly.
3. **Type from the top of the hierarchy.** Prisma types → Better Auth `$Infer` → existing
   `src/lib/types` → only then a new type (in `src/lib/types`, with a SOT keyword header).
   No `any`, no `unknown`, no hardcoded shapes, no `@ts-ignore`.
4. **Validate every input with Zod**, wired through react-hook-form for forms.
5. **Comment the block** with the SOURCE OF TRUTH KEYWORDS / WHAT / WHY / WHERE header so the
   next agent can grep it.
6. **Prove it.** `npm run typecheck` (and `npm run lint`) must pass before you hand anything
   back. Never report a clean build you did not run.

## Commands

```bash
npm run dev        # next dev
npm run build      # next build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit  <- required before handing off
npx prisma generate
```

Schema-changing Prisma commands (`migrate`, `db push`) and any `git commit`/`git push` are
gated to ask in `opencode.json`. Do not create seed, probe, or throwaway scripts without
explicit permission — everything in this repo must be production-shippable.

## opencode extras in this repo

- `/sot <symbol>` — source-of-truth grep sweep before you create anything
- `/verify` — typecheck + lint + report honestly
- `/feature <description>` — plan a feature across procedure → router → service → UI
- `@sot-scout` — read-only subagent for locating existing patterns
- `@pattern-reviewer` — read-only subagent that audits a diff against `.claude/CLAUDE.md`
