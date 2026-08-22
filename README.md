# gaudrail_coding_template

Multi-tenant SaaS app on Next.js 16 (App Router, Turbopack) + tRPC 11 + Prisma 6 (PostgreSQL)
+ Better Auth + Stripe, with Tailwind 4 / shadcn-ui, Zod 4 and react-hook-form.

## Setup

Requires Node 20+ and a PostgreSQL database (this project uses [Neon](https://neon.tech)).

```bash
git clone <repo-url>
cd hackthon
npm install                 # postinstall runs `prisma generate`
cp .env.example .env        # then fill it in — see below
npx prisma migrate dev      # applies prisma/migrations to your database
npm run dev                 # http://localhost:3000
```

### Environment

`.env` lives at the **repo root**, not in `src/`. Next.js and `prisma.config.ts` both load the
root file; an `.env` anywhere else is silently ignored. `.env` is gitignored and must never be
committed — `.env.example` is the shared, value-free template.

Minimum to boot:

| Variable | Notes |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `BETTER_AUTH_SECRET` | `openssl rand -base64 32` — required in production |
| `BETTER_AUTH_URL` / `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally; must match each other |

Everything else is optional and fails soft locally: without `RESEND_API_KEY` verification and
invite links are logged to the server console instead of emailed; without `UPSTASH_REDIS_*` rate
limiters fail open; without `STRIPE_SECRET_KEY` billing calls error clearly while the rest of the
app runs. `.env.example` documents every key inline.

**When you add code that reads a new env var, add the key to `.env.example` in the same commit** —
it is the only signal other developers have that the variable exists.

### Database

Migrations in `prisma/migrations/` are committed and are the source of truth for schema.

- Changing `prisma/schema.prisma` → `npx prisma migrate dev --name <what-changed>`, commit the
  generated migration folder with the schema change.
- Pulling someone else's schema change → `npx prisma migrate dev` (applies, then regenerates).
- Never edit an applied migration, and never run `prisma db push` against a shared database — it
  drifts the schema away from the migration history.

The generated client lands in `src/generated/prisma` (gitignored) and is imported as
`@/generated/prisma`. If imports of it fail to resolve, run `npx prisma generate` and restart dev.

## Commands

```bash
npm run dev        # next dev (Turbopack)
npm run build      # production build
npm run lint       # eslint
npm run typecheck  # tsc --noEmit — must pass before you push
```

## Contributing

Read **[AGENTS.md](AGENTS.md)** first — it maps the codebase and the workflow. The coding rules
themselves live in **[.claude/CLAUDE.md](.claude/CLAUDE.md)**, and `docs/` explains the reasoning
behind them (start at `docs/01-architecture.md`, then `docs/07-adding-a-feature.md`).

The short version:

1. Grep `SOURCE OF TRUTH KEYWORDS` before creating anything — reuse beats re-creating.
2. Respect the layers: tRPC procedure (auth/tenancy/gates) → router (business logic) →
   `*.service.ts` (database only, `import 'server-only'` at the top).
3. Types come from Prisma → Better Auth `$Infer` → `src/lib/types`. No `any`, no `unknown`,
   no `@ts-ignore`.
4. Zod on every input; react-hook-form for forms.
5. Theme tokens only in UI — no hex, no `text-white`, no forced `dark`.
6. `npm run typecheck` and `npm run lint` clean before you push.

### Working with agents

The repo is configured for both Claude Code and opencode; both read the same rulebook, so no
per-tool setup is needed beyond installing your tool of choice and authenticating it.

- **Claude Code** reads `.claude/CLAUDE.md` automatically.
- **opencode** reads `AGENTS.md` automatically and loads `.claude/CLAUDE.md` through the
  `instructions` array in `opencode.json`. The committed `.opencode/` folder adds
  `/sot`, `/verify` and `/feature` commands plus the `@sot-scout` and `@pattern-reviewer`
  subagents. Run `opencode` from the repo root so it picks all of this up.
