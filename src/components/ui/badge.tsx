import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors",
        {
          default: "border-transparent bg-primary text-primary-foreground",
          secondary: "border-transparent bg-secondary text-secondary-foreground",
          destructive: "border-transparent bg-destructive text-destructive-foreground",
          outline: "text-foreground",
          success: "border-transparent bg-emerald-500/15 text-emerald-600 dark:text-emerald-400",
          warning: "border-transparent bg-amber-500/15 text-amber-600 dark:text-amber-400",
          info: "border-transparent bg-blue-500/15 text-blue-600 dark:text-blue-400",
        }[variant],
        className
      )}
      {...props}
    />
  );
}

export { Badge };
