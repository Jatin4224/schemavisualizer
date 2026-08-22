/*
 * Copyright (c) 2026 Web Prodigies LLC
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * SOURCE OF TRUTH KEYWORDS: APP_NAME, APP_URL, APP_DOMAIN,
 *   APP_DESCRIPTION, APP_METADATA_BASE, BRANDING, AUTH_ROUTES,
 *   REGISTRATION_OPEN, PLANS, PlanKey, PlanDefinition, ROUTES,
 *   AppRouteKey, PLAN_ORDER, BillingInterval, getPlanPriceId, getPlanByPriceId,
 *   getNextPlan, isPaidPlan, portalConfig, isPortalEnabled,
 *   isPortalOwnerEmail, PORTAL_PATH
 *
 * WHAT:  Barrel re-export for the CLIENT-SAFE `src/lib/config/*` modules only.
 * WHY:   Single import surface (`@/lib/config`) so consumers don't depend on
 *        the per-concern split. Server-only config (prisma, stripe, resend)
 *        is deliberately NOT re-exported here: this barrel is imported by
 *        client components, and re-exporting them pulled PrismaClient, the
 *        Stripe SDK and the Resend SDK into the browser bundle (module-not-found
 *        on `./runtime/library.js` plus leaked server code). Import those from
 *        their own module — `@/lib/config/prisma`, `@/lib/config/stripe`,
 *        `@/lib/config/resend` — which is already the dominant call site shape.
 * WHERE: Imported broadly across the app, including client components.
 */

export {
  APP_NAME,
  APP_URL,
  APP_DOMAIN,
  APP_DESCRIPTION,
  APP_METADATA_BASE,
  BRANDING,
} from './branding'
export { AUTH_ROUTES } from './auth-routes'
export type { AuthRouteKey } from './auth-routes'
export { ROUTES } from './routes'
export type { AppRouteKey } from './routes'
export { REGISTRATION_OPEN } from './registration'
export {
  PLAN_KEYS,
  PLANS,
  PLAN_ORDER,
  isPaidPlan,
  getPlanPriceId,
  getPlanByPriceId,
  getNextPlan,
} from './plans'
export type { PlanKey, PlanDefinition, BillingInterval } from './plans'
export {
  portalConfig,
  isPortalEnabled,
  isPortalOwnerEmail,
  PORTAL_PATH,
} from './portal'
