import type { ReactNode } from "react"

// The options every Button implementation must support (spec 007 contracts/button-api.md).
// Variants and sizes follow the Figma "button" component.
export type ButtonVariant = "primary" | "secondary" | "link" | "ai" | "ghost"

export type ButtonSize = "sm" | "md" | "lg" | "icon"

export type ButtonOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
  children?: ReactNode
}
