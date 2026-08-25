/**
 * SOURCE OF TRUTH KEYWORDS: STRIPE_ELEMENT_COLORS, getCardElementStyle,
 *   CardElementStyle, stripe elements theme, card element colors,
 *   stripe iframe colors
 *
 * WHAT:  The literal colors + CardElement style object Stripe's hosted iframe
 *        needs, derived per theme.
 * WHY:   Stripe Elements renders inside a cross-origin iframe, so it CANNOT
 *        read our CSS variables or Tailwind tokens — it only accepts literal
 *        color strings. This file is the SINGLE sanctioned exception to the
 *        no-hardcoded-colors rule; before it, the same hexes were duplicated in
 *        two card forms and drifted from the palette. Values are hand-matched
 *        to the green/black theme tokens in src/app/globals.css — update them
 *        here (and only here) when the palette changes.
 * WHERE: src/components/global/billing/payment-card-form.tsx and
 *        add-payment-method-dialog.tsx, both fed by `resolvedTheme`.
 */

/* Hand-matched to globals.css: `text` ≈ --foreground, `placeholder` ≈
 * --muted-foreground, `invalid` ≈ --destructive, per theme. */
export const STRIPE_ELEMENT_COLORS = {
  dark: {
    text: '#f2f6f3',
    placeholder: '#94a49a',
    invalid: '#f26d5b',
  },
  light: {
    text: '#131b16',
    placeholder: '#6b7a71',
    invalid: '#d64532',
  },
} as const

export interface CardElementStyle {
  base: {
    fontSize: string
    color: string
    '::placeholder': { color: string }
  }
  invalid: { color: string }
}

/**
 * SOURCE OF TRUTH KEYWORDS: getCardElementStyle
 *
 * WHAT:  Builds the CardElement `style` object for the resolved theme.
 * WHY:   Both card forms need the identical treatment; only the font size
 *        differs between the compact onboarding form and the billing dialog.
 * WHERE: Passed straight into <CardElement options={{ style }} />.
 */
export function getCardElementStyle(
  isDark: boolean,
  fontSize: string = '15px'
): CardElementStyle {
  const palette = isDark ? STRIPE_ELEMENT_COLORS.dark : STRIPE_ELEMENT_COLORS.light
  return {
    base: {
      fontSize,
      color: palette.text,
      '::placeholder': { color: palette.placeholder },
    },
    invalid: { color: palette.invalid },
  }
}
