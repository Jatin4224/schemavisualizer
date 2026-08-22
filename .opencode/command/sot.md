---
description: Source-of-truth grep sweep before creating a type, function, component, or constant
agent: sot-scout
---

Run a SOURCE OF TRUTH sweep for: **$ARGUMENTS**

Do not write any code. Report only.

1. Grep `SOURCE OF TRUTH KEYWORDS` lines for the concept and its synonyms across `src/`.
2. Then widen: symbol names, file names, and near-miss spellings.
3. Check the layer-specific homes: `src/lib/types` (types), `src/lib/config` (registry/config),
   `src/services` (DB access), `src/trpc/routers` (business logic), `src/trpc/procedures`
   (cross-cutting), `src/components/global` (reusable UI).
4. If it is a Prisma- or Better Auth-owned shape, say so — those types are never re-declared.

Answer in this shape:

- **Exists**: file:line + the exact symbol to reuse, and how to extend it if it is close but not exact.
- **Does not exist**: the strongest evidence you searched for (list the queries you ran), plus
  where the new thing must live and what its SOT keyword header should say.
