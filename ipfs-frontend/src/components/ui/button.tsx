import type * as React from "react"

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "outline"
  size?: "default" | "sm" | "lg"
  children: React.ReactNode
}

export function Button({ variant = "default", size = "default", children, style, ...props }: ButtonProps) {
  const baseStyles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "6px",
    fontSize: "14px",
    fontWeight: "500",
    border: "1px solid",
    cursor: "pointer",
    transition: "all 0.2s",
    ...style,
  }

  const variantStyles: React.CSSProperties =
    variant === "outline"
      ? {
          backgroundColor: "white",
          borderColor: "#d0d0d0",
          color: "black",
        }
      : {
          backgroundColor: "black",
          borderColor: "black",
          color: "white",
        }

  const sizeStyles: React.CSSProperties = size === "sm" ? { padding: "8px 12px" } : { padding: "12px 16px" }

  return (
    <button
      style={{
        ...baseStyles,
        ...variantStyles,
        ...sizeStyles,
      }}
      {...props}
    >
      {children}
    </button>
  )
}
