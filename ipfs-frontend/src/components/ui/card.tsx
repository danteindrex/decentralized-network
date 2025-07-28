import type * as React from "react"

interface CardProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

interface CardHeaderProps {
  children: React.ReactNode
}

interface CardTitleProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

interface CardDescriptionProps {
  children: React.ReactNode
}

interface CardContentProps {
  children: React.ReactNode
  style?: React.CSSProperties
}

export function Card({ children, style }: CardProps) {
  return (
    <div
      style={{
        border: "1px solid #e0e0e0",
        borderRadius: "8px",
        backgroundColor: "white",
        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.1)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children }: CardHeaderProps) {
  return <div style={{ padding: "20px 20px 0 20px" }}>{children}</div>
}

export function CardTitle({ children, style }: CardTitleProps) {
  return (
    <h3
      style={{
        fontSize: "18px",
        fontWeight: "600",
        margin: "0 0 8px 0",
        color: "black",
        ...style,
      }}
    >
      {children}
    </h3>
  )
}

export function CardDescription({ children }: CardDescriptionProps) {
  return (
    <p
      style={{
        fontSize: "14px",
        color: "#666",
        margin: "0 0 16px 0",
      }}
    >
      {children}
    </p>
  )
}

export function CardContent({ children, style }: CardContentProps) {
  return <div style={{ padding: "0 20px 20px 20px", ...style }}>{children}</div>
}
