/**
 * SOURCE OF TRUTH KEYWORDS: ENTITY_COLOR_TOKENS, EntityColorToken,
 *   ENTITY_COLOR_TOKEN_KEYS, getEntityColorToken
 *
 * WHAT:  Allowlist of theme-token keys a DiagramEntity may use as its accent
 *        color, each mapped to token-based utility classes (dot, strip).
 * WHY:   DiagramEntity.color stores a KEY from this map — never a hex — per the
 *        theming rule (no hardcoded colors). Light/dark correctness falls out
 *        for free because every class resolves to a theme token.
 * WHERE: Persisted value validated by src/lib/types/diagram.ts; classes
 *        consumed by the entity-node card UI and the color picker.
 */

export interface EntityColorToken {
  /** Human label shown in the color picker. */
  label: string
  /** Small round swatch (picker + card header dot). */
  dot: string
  /** Accent strip / header tint applied to the entity card. */
  strip: string
}

export const ENTITY_COLOR_TOKENS = {
  default: {
    label: 'Default',
    dot: 'bg-muted-foreground',
    strip: 'border-border',
  },
  primary: {
    label: 'Primary',
    dot: 'bg-primary',
    strip: 'border-primary',
  },
  secondary: {
    label: 'Secondary',
    dot: 'bg-secondary-foreground',
    strip: 'border-secondary',
  },
  accent: {
    label: 'Accent',
    dot: 'bg-accent-foreground',
    strip: 'border-accent',
  },
  destructive: {
    label: 'Destructive',
    dot: 'bg-destructive',
    strip: 'border-destructive',
  },
  muted: {
    label: 'Muted',
    dot: 'bg-muted-foreground',
    strip: 'border-muted',
  },
} as const satisfies Record<string, EntityColorToken>

export type EntityColorTokenKey = keyof typeof ENTITY_COLOR_TOKENS

export const ENTITY_COLOR_TOKEN_KEYS = Object.keys(
  ENTITY_COLOR_TOKENS
) as readonly EntityColorTokenKey[]

/**
 * SOURCE OF TRUTH KEYWORDS: getEntityColorToken
 *
 * WHAT:  Safe lookup of an EntityColorToken by its persisted key, falling back
 *        to `default` so a legacy/unknown value never breaks rendering.
 * WHERE: Called by the entity-node card UI.
 */
export function getEntityColorToken(key: string | null | undefined): EntityColorToken {
  if (!key) return ENTITY_COLOR_TOKENS.default
  return (
    (ENTITY_COLOR_TOKENS as Record<string, EntityColorToken>)[key] ??
    ENTITY_COLOR_TOKENS.default
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: isEntityColorTokenKey
 *
 * WHAT:  Cast-free type guard narrowing a persisted `color` string to an
 *        EntityColorTokenKey (null passes through as null).
 * WHY:   DiagramEntity.color is a plain String column storing a token KEY;
 *        this is the sanctioned DB-string → union boundary (no enums by
 *        design), keeping `as`/`any` out of consumers.
 * WHERE: buildSnapshotPayload in src/services/diagram.service.ts; the color picker.
 */
export function isEntityColorTokenKey(value: string): value is EntityColorTokenKey {
  return Object.prototype.hasOwnProperty.call(ENTITY_COLOR_TOKENS, value)
}
