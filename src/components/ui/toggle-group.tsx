"use client"

import { ToggleGroup as ToggleGroupPrimitive } from "@base-ui/react/toggle-group"
import { Toggle as TogglePrimitive } from "@base-ui/react/toggle"
import { cn } from "cn"

function ToggleGroup<Value extends string = string>({
  className,
  ...props
}: ToggleGroupPrimitive.Props<Value>) {
  return (
    <ToggleGroupPrimitive
      data-slot="toggle-group"
      className={cn(
        "inline-flex items-center gap-1 rounded-lg border border-input bg-transparent p-1 dark:bg-input/30",
        className
      )}
      {...props}
    />
  )
}

function ToggleGroupItem<Value extends string = string>({
  className,
  ...props
}: TogglePrimitive.Props<Value>) {
  return (
    <TogglePrimitive
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-7 items-center justify-center rounded-md px-3 text-sm font-medium text-muted-foreground whitespace-nowrap transition-colors outline-none select-none hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 data-pressed:bg-primary data-pressed:text-primary-foreground data-pressed:shadow-xs",
        className
      )}
      {...props}
    />
  )
}

export { ToggleGroup, ToggleGroupItem }
