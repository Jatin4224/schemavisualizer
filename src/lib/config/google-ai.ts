/**
 * SOURCE OF TRUTH KEYWORDS: GOOGLE_AI_MODELS, GoogleAiModelKey,
 *   isGoogleAiConfigured, getGoogleAiModels, GOOGLE_AI_API_KEY_ENV
 *
 * WHAT:  Lazy Google Generative AI (Gemini) provider plus the registry of which
 *        model backs each AI task in the app.
 * WHY:   Mirrors the resend/stripe config pattern — the SDK is constructed on
 *        first call, never at import, so a missing key can't break the build and
 *        callers guard on isGoogleAiConfigured() instead of crashing. Model IDs
 *        live in ONE map so swapping models (or adding a new AI task) is a
 *        one-line change and never a grep through service code.
 * WHERE: Consumed by src/services/ai-schema.service.ts. Server-only — NOT
 *        re-exported from src/lib/config/index.ts (that barrel is imported by
 *        client components and must stay free of server SDKs).
 */

import 'server-only'

import { createGoogleGenerativeAI } from '@ai-sdk/google'
import type { LanguageModel } from 'ai'

/** The env var name @ai-sdk/google uses by convention. */
export const GOOGLE_AI_API_KEY_ENV = 'GOOGLE_GENERATIVE_AI_API_KEY'

/**
 * SOURCE OF TRUTH KEYWORDS: GOOGLE_AI_MODELS, GoogleAiModelKey
 *
 * WHAT:  Task key -> ordered Gemini model chain. `schemaDesign` backs the chatbot.
 * WHY:   Google retires model ids over time (gemini-2.5-flash already 404s for
 *        new keys). Keeping ids here means an upgrade touches one line, and a
 *        second AI task adds a key rather than a second provider file.
 * WHERE: Read by getGoogleAiModels().
 */
export const GOOGLE_AI_MODELS = {
  /* Ordered fallback chain. Gemini flash models return a retryable 503
   * ("experiencing high demand") under load often enough that a single-model
   * setup fails real requests, so callers walk this list and only surface an
   * error once every entry has been tried. Newest first. */
  schemaDesign: [
    'gemini-3.7-flash',
    'gemini-3.5-flash',
    'gemini-3-flash-preview',
  ],
} as const satisfies Record<string, readonly string[]>

export type GoogleAiModelKey = keyof typeof GOOGLE_AI_MODELS

/**
 * SOURCE OF TRUTH KEYWORDS: isGoogleAiConfigured
 *
 * WHAT:  True when the Gemini API key is present.
 * WHY:   Lets the router return a clean PRECONDITION_FAILED instead of leaking
 *        an SDK stack trace when the key is missing in a fresh checkout.
 * WHERE: Guard in src/services/ai-schema.service.ts and the ai-schema router.
 */
export function isGoogleAiConfigured(): boolean {
  return Boolean(process.env[GOOGLE_AI_API_KEY_ENV])
}

let provider: ReturnType<typeof createGoogleGenerativeAI> | null = null

/**
 * SOURCE OF TRUTH KEYWORDS: getGoogleAiModels
 *
 * WHAT:  Returns the ordered model chain for a task, or an empty array when the
 *        API key is absent.
 * WHY:   Lazy + cached provider construction keeps the SDK out of the import
 *        path; returning empty (rather than throwing) matches the fail-soft
 *        posture of getResendClient(). Callers try entries in order.
 * WHERE: Called by src/services/ai-schema.service.ts.
 */
export function getGoogleAiModels(task: GoogleAiModelKey): LanguageModel[] {
  const apiKey = process.env[GOOGLE_AI_API_KEY_ENV]
  if (!apiKey) return []
  if (!provider) provider = createGoogleGenerativeAI({ apiKey })
  const client = provider
  return GOOGLE_AI_MODELS[task].map((modelId) => client(modelId))
}
