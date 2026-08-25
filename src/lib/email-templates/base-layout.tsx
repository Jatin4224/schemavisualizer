/**
 * SOURCE OF TRUTH KEYWORDS: BaseLayout, emailStyles, EmailButton
 *
 * WHAT:  Shared chrome for every transactional email — Html/Head/Body/Container
 *        wrapper, brand header, footer, the `emailStyles` token object, and a
 *        small <EmailButton> CTA.
 * WHY:   One visual source so a rebrand (logo, colors, footer) happens here and
 *        flows to every template; tokens keep inline styles consistent across
 *        the verification, reset, and invitation emails.
 * WHERE: Imported by every template under src/lib/email-templates/transactional/*;
 *        templates are rendered to HTML in src/services/email.service.ts.
 */

import * as React from 'react'
import {
  Body,
  Button,
  Container,
  Head,
  Hr,
  Html,
  Preview,
  Text,
} from '@react-email/components'
import { APP_NAME } from '@/lib/config/branding'

/**
 * SOURCE OF TRUTH KEYWORDS: emailStyles
 *
 * WHAT:  Inline style tokens shared by all templates (email clients ignore
 *        external CSS, so styles must be inline).
 * WHY:   Single place to tune typography/colors. Email is the one surface that
 *        CANNOT read the theme tokens in src/app/globals.css — no CSS custom
 *        properties, no external stylesheet — so these literal hexes are the
 *        sanctioned mirror of the green/black palette. Keep them in step with
 *        globals.css when the brand changes; nothing else in the app hardcodes
 *        colors.
 * WHERE: Spread into <Text>/<Button> style props in the templates.
 */
export const emailStyles = {
  body: {
    /* ≈ --background (dark) */
    backgroundColor: '#080b09',
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    margin: 0,
    padding: '40px 0',
  },
  container: {
    /* ≈ --card (dark) with a --border hairline */
    backgroundColor: '#161b18',
    border: '1px solid #2a322d',
    borderRadius: '12px',
    margin: '0 auto',
    maxWidth: '520px',
    padding: '40px',
  },
  brand: {
    /* ≈ --primary: the wordmark carries the brand green */
    color: '#4ade8a',
    fontSize: '20px',
    fontWeight: 700,
    margin: '0 0 24px',
  },
  title: {
    /* ≈ --foreground */
    color: '#f2f6f3',
    fontSize: '22px',
    fontWeight: 600,
    margin: '0 0 16px',
  },
  paragraph: {
    color: '#c3ccc7',
    fontSize: '15px',
    lineHeight: '24px',
    margin: '0 0 16px',
  },
  ctaButton: {
    /* ≈ --primary / --primary-foreground */
    backgroundColor: '#4ade8a',
    borderRadius: '8px',
    color: '#0c1410',
    display: 'inline-block',
    fontSize: '15px',
    fontWeight: 600,
    padding: '12px 24px',
    textDecoration: 'none',
  },
  note: {
    /* ≈ --muted-foreground */
    color: '#94a49a',
    fontSize: '13px',
    lineHeight: '20px',
    margin: '16px 0 0',
  },
  hr: {
    /* ≈ --border */
    borderColor: '#2a322d',
    margin: '28px 0',
  },
  footer: {
    color: '#7d8a83',
    fontSize: '12px',
    lineHeight: '18px',
    margin: 0,
  },
} as const

/**
 * SOURCE OF TRUTH KEYWORDS: EmailButton
 *
 * WHAT:  A styled CTA button wrapping @react-email Button.
 * WHY:   Keeps the CTA visual identical across templates.
 * WHERE: Used inside each template's body.
 */
export function EmailButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Button href={href} style={emailStyles.ctaButton}>
      {children}
    </Button>
  )
}

/**
 * SOURCE OF TRUTH KEYWORDS: BaseLayout
 *
 * WHAT:  Outer wrapper rendering the brand header, the template body
 *        (children), and the footer.
 * WHY:   Every template renders inside this so layout/footer live in one place.
 * WHERE: Wraps the body of every transactional template.
 */
export function BaseLayout({
  preview,
  children,
}: {
  preview: string
  children: React.ReactNode
}) {
  return (
    <Html>
      {/* Declares the design as dark so clients with a dark mode leave the
          palette alone instead of force-inverting it into unreadable mush. */}
      <Head>
        <meta name="color-scheme" content="dark" />
        <meta name="supported-color-schemes" content="dark" />
      </Head>
      <Preview>{preview}</Preview>
      <Body style={emailStyles.body}>
        <Container style={emailStyles.container}>
          <Text style={emailStyles.brand}>{APP_NAME}</Text>
          {children}
          <Hr style={emailStyles.hr} />
          <Text style={emailStyles.footer}>
            © {APP_NAME}. If you didn’t expect this email, you can safely ignore it.
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
