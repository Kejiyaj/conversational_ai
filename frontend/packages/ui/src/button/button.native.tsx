import { Pressable, Text, type PressableProps } from "react-native"

import { cn } from "../lib/cn"
import type { ButtonOptions, ButtonSize, ButtonVariant } from "./button.types"

// Adapted from the React Native Reusables Button, using the shared variant and size names and the
// Figma colors. React Native has no CSS gradients, so "ai" is a solid strong blue for now.
const variantClasses: Record<ButtonVariant, string> = {
  primary: "border border-primary bg-primary active:bg-primary-strong",
  secondary: "border border-primary bg-white active:bg-info-75",
  link: "",
  ai: "bg-primary-strong active:opacity-90",
  ghost: "active:bg-info-75",
}

const textClasses: Record<ButtonVariant, string> = {
  primary: "font-bold text-white",
  secondary: "font-bold text-primary",
  link: "font-bold text-primary underline",
  ai: "font-bold text-white",
  ghost: "text-ink",
}

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 gap-2 px-4",
  md: "h-11 gap-2 px-8",
  lg: "h-12 gap-2 px-8",
  icon: "size-8",
}

const textSizeClasses: Record<ButtonSize, string> = {
  sm: "text-sm",
  md: "text-sm",
  lg: "text-base",
  icon: "text-sm",
}

export type ButtonProps = Omit<PressableProps, "children" | "disabled"> & ButtonOptions

function Button({ className, variant = "secondary", size = "lg", disabled, children, ...props }: ButtonProps) {
  return (
    <Pressable
      role="button"
      disabled={disabled}
      className={cn(
        "flex-row items-center justify-center rounded-full",
        variantClasses[variant],
        sizeClasses[size],
        variant === "link" && "h-auto px-0",
        disabled && "opacity-50",
        className
      )}
      {...props}
    >
      {typeof children === "string" ? (
        <Text className={cn(textClasses[variant], textSizeClasses[size])}>{children}</Text>
      ) : (
        children
      )}
    </Pressable>
  )
}

export { Button }
