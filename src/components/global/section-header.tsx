/**
 * SOURCE OF TRUTH KEYWORDS: SectionHeader, SectionHeaderProps
 *
 * WHAT:  A page/section title primitive — a large display heading + optional
 *        muted description.
 * WHY:   Reused across settings pages (and anywhere a titled section is needed)
 *        so headings stay consistent and visually dominant — the editorial
 *        display face at heavy weight, tight tracking, uppercase.
 * WHERE: settings/billing, settings/organization, etc. Pairs with
 *        SettingsSection.
 */

export interface SectionHeaderProps {
  title: string
  description?: string
}

export function SectionHeader({ title, description }: SectionHeaderProps) {
  return (
    <div className="space-y-2">
      <h2 className="font-heading text-3xl font-extrabold uppercase leading-none tracking-tight md:text-4xl">
        {title}
      </h2>
      {description ? (
        <p className="max-w-prose text-sm text-muted-foreground">{description}</p>
      ) : null}
    </div>
  )
}
