/**
 * SOURCE OF TRUTH KEYWORDS: prisma, DbClient
 *
 * WHAT:  Singleton PrismaClient cached on globalThis in dev to survive HMR,
 *        plus the shared DbClient union accepted by services that may run
 *        either inside an active tx or against the singleton.
 * WHY:   Without the global cache, Next.js dev hot-reloads create a new client
 *        on every change and the connection pool blows up; in production a
 *        fresh instance is created exactly once at module init.
 * WHERE: Imported directly as `@/lib/config/prisma` by auth.ts, every service,
 *        and the tRPC context. Deliberately NOT re-exported from the
 *        `@/lib/config` barrel — that barrel is imported by client components,
 *        and re-exporting the client dragged PrismaClient into the browser
 *        bundle. `server-only` above makes that a build error, not a leak.
 */

import 'server-only'

import { PrismaClient, type Prisma } from '@/generated/prisma'

type GlobalWithPrisma = typeof globalThis & {
  __prisma?: PrismaClient
}

const globalForPrisma = globalThis as GlobalWithPrisma

export const prisma = globalForPrisma.__prisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.__prisma = prisma

/**
 * SOURCE OF TRUTH KEYWORDS: DbClient
 *
 * WHAT:  Union of the singleton client and an active tx client.
 * WHY:   Services that may run inside `prisma.$transaction(...)` accept this
 *        so callers can pass `tx` and the write enlists in the active tx.
 * WHERE: Used by every service that takes a `db` parameter.
 */
export type DbClient = PrismaClient | Prisma.TransactionClient
