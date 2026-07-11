"use client"

import * as React from "react"
import { mergeProps } from "@base-ui/react/merge-props"
import { useRender } from "@base-ui/react/use-render"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  // Game-piece buttons: 2px edge reserved in the base so every variant keeps
  // the same geometry; the loud variants ink the edge and travel into their
  // own offset shadow on press.
  "group/button inline-flex shrink-0 items-center justify-center rounded-lg border-2 border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "border-foreground bg-primary text-primary-foreground shadow-[3px_3px_0_0_var(--foreground)] hover:bg-primary/90 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_var(--foreground)]",
        outline:
          "border-foreground bg-card text-foreground shadow-[2px_2px_0_0_var(--foreground)] hover:bg-accent aria-expanded:bg-accent active:translate-x-0.5 active:translate-y-0.5 active:shadow-none",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/70 aria-expanded:bg-secondary aria-expanded:text-secondary-foreground active:translate-y-px",
        ghost:
          "hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground active:translate-y-px",
        destructive:
          "border-foreground bg-destructive text-white shadow-[3px_3px_0_0_var(--foreground)] hover:bg-destructive/90 focus-visible:border-destructive focus-visible:ring-destructive/30 active:translate-x-0.5 active:translate-y-0.5 active:shadow-[1px_1px_0_0_var(--foreground)]",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default:
          "h-8 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2",
        xs: "h-6 gap-1 rounded-[min(var(--radius-md),10px)] px-2 text-xs in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
        sm: "h-7 gap-1 rounded-[min(var(--radius-md),12px)] px-2.5 text-[0.8rem] in-data-[slot=button-group]:rounded-lg has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3.5",
        lg: "h-9 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-3 has-data-[icon=inline-start]:pl-3",
        xl: "h-12 gap-2 rounded-xl px-6 text-base has-data-[icon=inline-end]:pr-5 has-data-[icon=inline-start]:pl-5",
        icon: "size-8",
        "icon-xs":
          "size-6 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-lg [&_svg:not([class*='size-'])]:size-3",
        "icon-sm":
          "size-7 rounded-[min(var(--radius-md),12px)] in-data-[slot=button-group]:rounded-lg",
        "icon-lg": "size-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  render,
  children,
  ...props
}: useRender.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean }) {
  // The rest of the primitives are on Base UI; keep the familiar shadcn `asChild`
  // API but map it to Base UI's `render` so the whole UI layer sits on one
  // substrate (this dropped the last Radix Slot dependency).
  const resolvedRender =
    render ?? (asChild && React.isValidElement(children) ? children : undefined)
  return useRender({
    defaultTagName: "button",
    props: mergeProps<"button">(
      { className: cn(buttonVariants({ variant, size }), className) },
      resolvedRender ? props : { ...props, children }
    ),
    render: resolvedRender,
    state: { slot: "button" },
  })
}

export { Button, buttonVariants }
