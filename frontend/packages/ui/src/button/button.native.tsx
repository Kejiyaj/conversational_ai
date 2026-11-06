import { cn } from "cn"
import { Pressable, Text, type PressableProps } from "react-native"

import type { ButtonOptions, ButtonSize, ButtonVariant } from "./button.types"

// Adapted from the React Native Reusables Button, using the shared variant and size names.
const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-primary active:opacity-90",
  outline: "border border-border bg-background active:bg-muted",
  secondary: "bg-secondary active:opacity-90",
  ghost: "active:bg-muted",
  destructive: "bg-destructive/10 active:bg-destructive/20",
  link: "",
}

const textClasses: Record<ButtonVariant, string> = {
  default: "text-primary-foreground",
  outline: "text-foreground",
  secondary: "text-secondary-foreground",
  ghost: "text-foreground",
  destructive: "text-destructive",
  link: "text-primary underline",
}

const sizeClasses: Record<ButtonSize, string> = {
  default: "h-8 gap-1.5 px-2.5",
  xs: "h-6 gap-1 px-2",
  sm: "h-7 gap-1 px-2.5",
  lg: "h-9 gap-1.5 px-2.5",
  icon: "size-8",
  "icon-xs": "size-6",
  "icon-sm": "size-7",
  "icon-lg": "size-9",
}

const textSizeClasses: Record<ButtonSize, string> = {
  default: "text-sm",
  xs: "text-xs",
  sm: "text-xs",
  lg: "text-sm",
  icon: "text-sm",
  "icon-xs": "text-xs",
  "icon-sm": "text-xs",
  "icon-lg": "text-sm",
}

export type ButtonProps = Omit<PressableProps, "children" | "disabled"> & ButtonOptions

function Button({ className, variant = "default", size = "default", disabled, children, ...props }: ButtonProps) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-center rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn("font-medium", textClasses[variant], textSizeClasses[size])}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

export { Button }
