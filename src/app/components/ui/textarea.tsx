import * as React from "react";

import { cn } from "./utils";

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "resize-none border-input placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex field-sizing-content min-h-16 w-full rounded-md border bg-input-background px-3 py-2 text-base transition-[color,box-shadow,border-color,background-color] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/[0.08] dark:bg-[var(--shell-elevated)] dark:text-[#e5e7eb] dark:placeholder:text-[#6b7280] dark:hover:border-white/[0.14] md:text-sm",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };
