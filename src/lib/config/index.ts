/**
 * SOURCE OF TRUTH KEYWORDS: APP_NAME, APP_URL, APP_DOMAIN,
 *   APP_DESCRIPTION, APP_METADATA_BASE, BRANDING, AUTH_ROUTES,
 *   REGISTRATION_OPEN, EMAIL_AUTH_ENABLED, GOOGLE_OAUTH_ENABLED,
 *   AUTH_METHODS_AVAILABLE, PLANS, PlanKey, PlanDefinition, ROUTES,
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
  EMAIL_AUTH_ENABLED,
  GOOGLE_OAUTH_ENABLED,
  AUTH_METHODS_AVAILABLE,
} from './auth-methods'
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
export {
  DATA_TYPES,
  DATA_TYPE_KEYS,
  getDataType,
  isDataTypeKey,
} from './data-types'
export type { DataTypeKey, DataTypeDefinition } from './data-types'
export {
  ENTITY_COLOR_TOKENS,
  ENTITY_COLOR_TOKEN_KEYS,
  getEntityColorToken,
} from './entity-colors'
export type {
  EntityColorToken,
  EntityColorTokenKey,
} from './entity-colors'
