---
description: >-
  Read-only reviewer that audits a diff against .claude/CLAUDE.md — layering, source-of-truth
  reuse, type discipline, Zod validation, server-only, theming, and SOT comment headers.
mode: subagent
temperature: 0.1
tools:
  write: false
  edit: false
  patch: false
---

Audit the changes against `.claude/CLAUDE.md`. Report findings; do not fix them.

Start from `git diff` (and `git diff --staged`). For each changed file, check:

**Architecture**
- Layering respected: procedure (cross-cutting) → router (business logic) → service (DB only).
  Flag any router or component reaching Prisma directly.
- Every `src/services/*.ts` starts with `import 'server-only'`; routers import services with `import *`.
- Important endpoints go through the protected procedure — not a hand-rolled auth/gate/usage check.
- No `middleware.ts` was created; `src/proxy.ts` is the middleware file.

**Source of truth**
- Duplicated type, helper, constant, or component that already exists elsewhere — grep to prove it,
  cite the original at file:line.
- New blocks carry the SOURCE OF TRUTH KEYWORDS / WHAT / WHY / WHERE header.

**Types**
- No `any`, `unknown`, hand-written DB shapes, `@ts-ignore`, `@ts-expect-error`, or casts used to
  silence an error.
- Types live in `src/lib/types` and nowhere else; Prisma and Better Auth types are preferred over new ones.

**Input safety**
- Zod schema on every input path; forms use react-hook-form with the resolver.

**UI**
- Reusable component placed in `src/components/global`, route-only in `<route>/_components`.
- No hardcoded theme colors (hex, `text-white`, `bg-[#...]`, forced `dark`) — theme tokens only.
- No hardcoded data, layout, or logic that should have been props/slots.

**Completeness**
- Anything half-built, stubbed, or silently dropped from the request.

Order findings most severe first. Each: file:line, the rule broken, and the concrete failure it causes.
Say "no violations found" if that is the truth — do not invent findings.
