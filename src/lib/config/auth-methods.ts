/**
 * SOURCE OF TRUTH KEYWORDS: EMAIL_AUTH_ENABLED, GOOGLE_OAUTH_ENABLED,
 *   AUTH_METHODS_AVAILABLE, NEXT_PUBLIC_EMAIL_AUTH_ENABLED, auth methods,
 *   credential login, social only, provider toggle, sign-in surface
 *
 * WHAT:  Which sign-in methods the app currently offers.
 * WHY:   Turning a method off is an env flip, not a code edit — and the same
 *        flag hides the UI *and* closes the server route, so a hidden form can
 *        never be reached by posting straight at the API. Mirrors the
 *        REGISTRATION_OPEN flag in ./registration.
 * WHERE: Read by src/lib/better-auth/auth.ts (server gate on emailAndPassword)
 *        and by AuthForm (src/components/global/auth/auth-form.tsx), which
 *        picks the credential surface or the social-only surface from it.
 */

/* Opt-out, like REGISTRATION_OPEN: email+password stays on unless explicitly
 * turned off, so an unset var never silently locks people out. */
export const EMAIL_AUTH_ENABLED =
  process.env['NEXT_PUBLIC_EMAIL_AUTH_ENABLED'] !== 'false'

/* Client-visible half of the Google check. auth.ts additionally requires
 * GOOGLE_CLIENT_SECRET before it registers the provider — that value is
 * server-only, so the browser can key off nothing but the public client ID. */
export const GOOGLE_OAUTH_ENABLED = Boolean(
  process.env['NEXT_PUBLIC_GOOGLE_CLIENT_ID']
)

/* Guards the "every method is disabled" misconfiguration — the UI shows a
 * notice instead of a panel with no way into the app. */
export const AUTH_METHODS_AVAILABLE = EMAIL_AUTH_ENABLED || GOOGLE_OAUTH_ENABLED
