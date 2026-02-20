import * as React from "react"
import { Link } from "react-router-dom"
import { LucideIcon, TrendingDown, TrendingUp, Minus } from "lucide-react"
import { cn } from "@/lib/utils"
import { Card, CardContent } from "./card"
import { useReducedMotion } from "./animations"

interface StatCardProps {
  icon: LucideIcon
  value: string | number
  label: string
  trend?: "up" | "down" | "neutral"
  trendValue?: string
  className?: string
  /** Optional link target for clickable stat cards */
  href?: string
  /** Compact mode for single-row stat bar */
  compact?: boolean
}

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  trendValue,
  className,
  href,
  compact,
}: StatCardProps) {
  const prefersReducedMotion = useReducedMotion()

  const TrendIcon = trend === "up"
    ? TrendingUp
    : trend === "down"
      ? TrendingDown
      : Minus

  const trendColor = trend === "up"
    ? "text-success"
    : trend === "down"
      ? "text-destructive"
      : "text-muted-foreground"

  // Phase 3: Compact mode for single-row stat bar
  if (compact) {
    const content = (
      <div className={cn(
        "flex items-center gap-3 rounded-lg border border-border bg-card p-3 transition-colors",
        href && "hover:bg-muted/50 cursor-pointer",
        className
      )}>
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 flex-shrink-0">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-bold tracking-tight leading-none">{value}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
        </div>
      </div>
    )

    if (href) {
      return <Link to={href}>{content}</Link>
    }
    return content
  }

  const card = (
    <Card
      className={cn(
        "relative overflow-hidden",
        !prefersReducedMotion && "animate-card-enter",
        href && "hover:bg-muted/30 cursor-pointer transition-colors",
        className
      )}
    >
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10">
            <Icon className="h-6 w-6 text-primary" />
          </div>
          {trend && trendValue && (
            <div className={cn("flex items-center gap-1 text-sm", trendColor)}>
              <TrendIcon className="h-4 w-4" />
              <span>{trendValue}</span>
            </div>
          )}
        </div>
        <div className="mt-4 space-y-1">
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  )

  if (href) {
    return <Link to={href}>{card}</Link>
  }
  return card
}
