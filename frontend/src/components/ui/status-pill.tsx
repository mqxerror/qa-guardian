import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"
import { useReducedMotion } from "./animations"

const statusPillVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      status: {
        passed: "bg-success/15 text-success border border-success/20",
        failed: "bg-destructive/15 text-destructive border border-destructive/20",
        running: "bg-primary/15 text-primary border border-primary/20",
        pending: "bg-warning/15 text-warning border border-warning/20",
        warning: "bg-warning/15 text-warning border border-warning/20",
        info: "bg-info/15 text-info border border-info/20",
        skipped: "bg-muted text-muted-foreground border border-border",
      },
    },
    defaultVariants: {
      status: "info",
    },
  }
)

interface StatusPillProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusPillVariants> {
  /** Show pulsing animation for running status */
  animate?: boolean
}

export function StatusPill({
  status,
  animate = true,
  className,
  children,
  ...props
}: StatusPillProps) {
  const prefersReducedMotion = useReducedMotion()

  const shouldAnimate =
    animate &&
    status === "running" &&
    !prefersReducedMotion

  return (
    <span
      className={cn(
        statusPillVariants({ status }),
        shouldAnimate && "animate-pulse-subtle",
        className
      )}
      {...props}
    >
      {children || status}
    </span>
  )
}

// Helper to convert common status strings to our status type
export function getStatusFromString(
  statusString: string
): "passed" | "failed" | "running" | "pending" | "warning" | "info" | "skipped" {
  const normalized = statusString.toLowerCase()

  if (["pass", "passed", "success", "completed"].includes(normalized)) {
    return "passed"
  }
  if (["fail", "failed", "error", "failure"].includes(normalized)) {
    return "failed"
  }
  if (["running", "in_progress", "active", "executing"].includes(normalized)) {
    return "running"
  }
  if (["pending", "queued", "waiting"].includes(normalized)) {
    return "pending"
  }
  if (["warning", "warn", "flaky"].includes(normalized)) {
    return "warning"
  }
  if (["skipped", "skip", "disabled", "cancelled"].includes(normalized)) {
    return "skipped"
  }
  return "info"
}
