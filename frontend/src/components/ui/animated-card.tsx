import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "./card"
import { useReducedMotion } from "./animations"

interface AnimatedCardProps extends React.HTMLAttributes<HTMLDivElement> {
  /** Visual hierarchy variant */
  variant?: "hero" | "primary" | "secondary" | "interactive"
  /** Stagger delay index for list animations (0-7) */
  staggerIndex?: number
  children: React.ReactNode
}

const variantStyles = {
  hero: "bg-gradient-to-br from-primary/10 to-card border-primary/20 shadow-lg shadow-primary/5",
  primary: "bg-card border-border hover:border-primary/30 transition-colors",
  secondary: "bg-muted/50 border-border/50",
  interactive: "bg-card border-border hover:bg-muted/50 cursor-pointer transition-all hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5",
}

export function AnimatedCard({
  variant = "primary",
  staggerIndex,
  className,
  children,
  ...props
}: AnimatedCardProps) {
  const prefersReducedMotion = useReducedMotion()

  // Calculate stagger delay (max 8 items, rest appear instantly)
  const delayMs = staggerIndex !== undefined && staggerIndex < 8
    ? staggerIndex * 50
    : 0

  return (
    <Card
      className={cn(
        variantStyles[variant],
        !prefersReducedMotion && "animate-card-enter",
        className
      )}
      style={{
        animationDelay: !prefersReducedMotion ? `${delayMs}ms` : undefined,
        animationFillMode: !prefersReducedMotion ? "backwards" : undefined,
      }}
      {...props}
    >
      {children}
    </Card>
  )
}
