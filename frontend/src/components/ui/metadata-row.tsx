import * as React from "react"
import { LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface MetadataRowProps {
  icon: LucideIcon
  label: string
  value: React.ReactNode
  className?: string
}

export function MetadataRow({
  icon: Icon,
  label,
  value,
  className,
}: MetadataRowProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="text-sm text-muted-foreground">{label}:</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

// Vertical stack variant for multiple metadata items
interface MetadataListProps {
  children: React.ReactNode
  className?: string
}

export function MetadataList({ children, className }: MetadataListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {children}
    </div>
  )
}
