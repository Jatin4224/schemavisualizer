/**
 * SOURCE OF TRUTH KEYWORDS: DiagramsPage
 *
 * WHAT:  /dashboard/diagrams route — thin shell; DiagramsClient does the work.
 * WHERE: RESOURCES.diagrams.nav.href.
 */

import type { Metadata } from 'next'

import { DiagramsClient } from './_components/diagrams-client'

export const metadata: Metadata = {
  title: 'Diagrams',
}

export default function DiagramsPage() {
  return <DiagramsClient />
}
