---
description: Plan and build a feature across procedure -> router -> service -> UI
---

Feature: **$ARGUMENTS**

Follow `docs/07-adding-a-feature.md` and the layering in `.claude/CLAUDE.md`. Before writing code,
produce the plan below and confirm it with me.

**1. Reuse audit (grep first)**
Existing procedures, routers, services, types (`src/lib/types`), registry/config entries
(`src/lib/config`), and global components this feature can plug into. Name file:line for each.
Anything you propose to create new, justify with the search that came up empty.

**2. Data**
Prisma schema changes (if any) and the Prisma types the feature will use. No hand-written
shapes for anything the database already describes.

**3. Service layer** (`src/services/*.service.ts`)
DB access only. `import 'server-only'` at the top. Imported into routers with `import * as`.

**4. Router** (`src/trpc/routers`)
Business logic, orchestration, decisions. Built on the protected procedure — do not re-implement
auth, tenancy, feature gates, usage checks, or audit logging; the procedure already does them.

**5. Validation**
Zod schemas for every input, react-hook-form on the client per shadcn's react-hook-form approach.

**6. UI**
Reuse or extend an existing component first. New reusable component -> `src/components/global/<NAME>`;
route-only -> `<route>/_components`. Theme tokens only — no hex, no `text-white`, no forced `dark`.
If it is a complex component, ask me for a shadcn block link before designing one yourself.

**7. Wiring + exports**
Barrel exports, object exports where the pattern already does that, registry entries, permissions.

**8. Loose ends**
Anything I did not ask for that the feature still needs to be complete — say it, don't skip it.

Every new block gets the SOURCE OF TRUTH KEYWORDS / WHAT / WHY / WHERE header. Finish with
`npm run typecheck`.
