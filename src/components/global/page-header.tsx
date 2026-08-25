'use client'

/**
 * SOURCE OF TRUTH KEYWORDS: PageHeader, ContentLayout
 *
 * WHAT:  The dashboard page chrome — a sticky, blurred header (sidebar trigger,
 *        title, action slot) and a ContentLayout wrapper that pairs the header
 *        with a padded content region.
 * WHY:   Every dashboard page renders the same header treatment; centralizing
 *        it here means a page is just `<ContentLayout title=... actions=...>`.
 *        The app is dark-only (forcedTheme in the root layout), so there is no
 *        theme toggle here.
 * WHERE: Used by pages under src/app/(dashboard)/** and (portal)/**. Pairs with
 *        the sidebar from src/components/global/sidebar.
 */

import * as React from 'react'

import { Separator } from '@/components/ui/separator'
import { SidebarTrigger } from '@/components/ui/sidebar'

export interface PageHeaderProps {
  title: string
  actions?: React.ReactNode
}

export function PageHeader({ title, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-20 flex h-16 shrink-0 items-center gap-3 border-b bg-background/90 px-4 backdrop-blur-md md:px-6">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-1 h-4" />
      <h1 className="font-heading truncate text-base font-extrabold uppercase tracking-tight md:text-lg">
        {title}
      </h1>
      {actions ? <div className="ml-auto flex items-center gap-2">{actions}</div> : null}
    </header>
  )
}

export interface ContentLayoutProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function ContentLayout({ title, actions, children }: ContentLayoutProps) {
  return (
    <>
      <PageHeader title={title} actions={actions} />
      <div className="flex flex-1 flex-col gap-6 p-4 md:p-8">{children}</div>
    </>
  )
}
