/**
 * SOURCE OF TRUTH KEYWORDS: resend, getResendClient, RESEND_DEFAULT_FROM,
 *   isResendConfigured
 *
 * WHAT:  Lazy Resend client singleton plus the resolved default "From" address.
 * WHY:   The SDK is constructed on first send (not at import) so a missing
 *        RESEND_API_KEY never throws during build/import — the email service
 *        guards on isResendConfigured() and no-ops in that case, mirroring the
 *        rate-limiter's fail-open posture so local dev runs without an account.
 * WHERE: Consumed by src/services/email.service.ts; re-exported from
 *        src/lib/config/index.ts.
 */

import 'server-only'

import { Resend } from 'resend'
import { APP_NAME } from '@/lib/config/branding'

/* Test-only fallback sender. Resend accepts `onboarding@resend.dev` for
 * sandbox sends; production must set RESEND_FROM_EMAIL to a verified domain. */
const FALLBACK_FROM_EMAIL = 'onboarding@resend.dev'

/**
 * SOURCE OF TRUTH KEYWORDS: RESEND_DEFAULT_FROM
 *
 * WHAT:  The `Name <email>` From header used for every transactional send.
 * WHY:   Centralized so the brand name (APP_NAME) and sender address resolve
 *        in one place; falls back to the Resend sandbox address when unset.
 * WHERE: Default `from` in src/services/email.service.ts.
 */
export const RESEND_DEFAULT_FROM = `${APP_NAME} <${process.env['RESEND_FROM_EMAIL'] || FALLBACK_FROM_EMAIL}>`

/**
 * SOURCE OF TRUTH KEYWORDS: isResendConfigured
 *
 * WHAT:  True when RESEND_API_KEY is present.
 * WHY:   The email service checks this before sending so a missing key is a
 *        warn-and-no-op, not a crash.
 * WHERE: Guard in src/services/email.service.ts.
 */
export function isResendConfigured(): boolean {
  return Boolean(process.env['RESEND_API_KEY'])
}

let client: Resend | null = null

/**
 * SOURCE OF TRUTH KEYWORDS: getResendClient
 *
 * WHAT:  Returns the cached Resend client, or null when no API key is set.
 * WHY:   Lazy construction keeps `new Resend()` out of the import path so the
 *        bundle builds without the key; the instance is cached after first use.
 * WHERE: Called by src/services/email.service.ts.
 */
export function getResendClient(): Resend | null {
  const apiKey = process.env['RESEND_API_KEY']
  if (!apiKey) return null
  if (!client) client = new Resend(apiKey)
  return client
}
