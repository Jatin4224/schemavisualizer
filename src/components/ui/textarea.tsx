import * as React from "react"

import { cn } from "@/lib/utils"

/**
 * SOURCE OF TRUTH KEYWORDS: Textarea, multiline input, form textarea
 *
 * WHAT:  The app-wide multi-line text input.
 * WHY:   Matches the Input field language: squared corners, hairline token
 *        border, faint dark-mode fill, coral focus ring.
 * WHERE: Every multi-line form field in the app.
 */

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "flex field-sizing-content min-h-20 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base transition-colors outline-none placeholder:text-muted-foreground/70 focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40 disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm dark:bg-input/20 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
