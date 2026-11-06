import type { ReactNode } from "react"

// The options every Button implementation must support (spec 007 contracts/button-api.md).
export type ButtonVariant = "default" | "outline" | "secondary" | "ghost" | "destructive" | "link"

export type ButtonSize = "default" | "xs" | "sm" | "lg" | "icon" | "icon-xs" | "icon-sm" | "icon-lg"

export type ButtonOptions = {
  variant?: ButtonVariant
  size?: ButtonSize
  className?: string
  disabled?: boolean
  children?: ReactNode
}
