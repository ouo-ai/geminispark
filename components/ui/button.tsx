import type * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background",
  {
    variants: {
      variant: {
        // Primary - lime filled button
        default: "bg-primary text-primary-foreground hover:bg-primary/80 active:bg-primary/70",
        // Secondary - subtle background with visible hover
        secondary:
          "bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 hover:border-primary/40 active:bg-primary/30",
        // Outline - bordered with clear hover feedback
        outline:
          "border border-border bg-transparent text-foreground hover:bg-foreground/10 hover:border-foreground/30 active:bg-foreground/15",
        // Ghost - minimal style with visible hover
        ghost: "text-muted-foreground hover:text-foreground hover:bg-foreground/10 active:bg-foreground/15",
        // Destructive
        destructive: "bg-destructive text-white hover:bg-destructive/90 active:bg-destructive/80",
        // Link style
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2 has-[>svg]:px-3",
        sm: "h-8 rounded-md gap-1.5 px-3 has-[>svg]:px-2.5 text-xs",
        lg: "h-10 rounded-md px-6 has-[>svg]:px-4",
        xl: "h-12 rounded-md px-8 has-[>svg]:px-6 text-base",
        icon: "size-9",
        "icon-sm": "size-8",
        "icon-lg": "size-10",
      },
      rounded: {
        default: "rounded-md",
        full: "rounded-full",
        lg: "rounded-lg",
        xl: "rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
      rounded: "default",
    },
  },
)

function Button({
  className,
  variant,
  size,
  rounded,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return <Comp data-slot="button" className={cn(buttonVariants({ variant, size, rounded, className }))} {...props} />
}

export { Button, buttonVariants }
