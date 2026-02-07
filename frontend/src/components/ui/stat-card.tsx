import * as React from "react"
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
}

export function StatCard({
  icon: Icon,
  value,
  label,
  trend,
  trendValue,
  className,
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

  return (
    <Card
      className={cn(
        "relative overflow-hidden",
        !prefersReducedMotion && "animate-card-enter",
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
}
