---
description: Typecheck + lint the repo and report the result honestly
---

Verify the working tree is clean and shippable.

Changed files:
!`git status --porcelain`

Run, in order, and show real output:

1. `npm run typecheck`
2. `npm run lint`

Then:

- Fix every error you introduced — at the source, never with `any`, `unknown`, `@ts-ignore`,
  `@ts-expect-error`, or a widened type.
- Pre-existing failures unrelated to the current change: list them separately, do not silently absorb them.
- If anything still fails, say so plainly with the output. Never report a clean run you did not get.
