import type * as React from "react"

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

export function Input({ style, ...props }: InputProps) {
  return (
    <input
      style={{
        width: "100%",
        padding: "12px",
        border: "1px solid #d0d0d0",
        borderRadius: "6px",
        fontSize: "14px",
        backgroundColor: "white",
        color: "black",
        outline: "none",
        transition: "border-color 0.2s",
        ...style,
      }}
      {...props}
    />
  )
}
