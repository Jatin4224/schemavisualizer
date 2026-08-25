"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: Label, form label, field label
 *
 * WHAT:  The app-wide form label (radix).
 * WHY:   Editorial micro-label treatment: semibold with slight tracking so
 *        every form reads like a printed spec sheet.
 * WHERE: Every form via shadcn Form / Field.
 */

function Label({ className, ...props }: React.ComponentProps<"label">) {
  return (
    <label
      data-slot="label"
      className={cn(
        "flex items-center gap-2 text-[0.8125rem] leading-none font-semibold tracking-wide select-none group-data-[disabled=true]:pointer-events-none group-data-[disabled=true]:opacity-50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
}

export { Label }
