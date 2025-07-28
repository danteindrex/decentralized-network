import { useEffect, useState } from "react"
import { CheckCircle, AlertCircle, Info, AlertTriangle, X } from "lucide-react"
import { useToast, type Toast } from "../../contexts/ToastContext"

interface ToastItemProps {
  toast: Toast
  onRemove: (id: string) => void
}

function ToastItem({ toast, onRemove }: ToastItemProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isLeaving, setIsLeaving] = useState(false)

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 10)
    return () => clearTimeout(timer)
  }, [])

  const handleRemove = () => {
    setIsLeaving(true)
    setTimeout(() => onRemove(toast.id), 300)
  }

  const getIcon = () => {
    switch (toast.type) {
      case "success":
        return <CheckCircle size={20} color="#22c55e" />
      case "error":
        return <AlertCircle size={20} color="#ef4444" />
      case "warning":
        return <AlertTriangle size={20} color="#f59e0b" />
      case "info":
        return <Info size={20} color="#3b82f6" />
      default:
        return <Info size={20} color="#6b7280" />
    }
  }

  const getBackgroundColor = () => {
    switch (toast.type) {
      case "success":
        return "#f0fdf4"
      case "error":
        return "#fef2f2"
      case "warning":
        return "#fffbeb"
      case "info":
        return "#eff6ff"
      default:
        return "#f9fafb"
    }
  }

  const getBorderColor = () => {
    switch (toast.type) {
      case "success":
        return "#22c55e"
      case "error":
        return "#ef4444"
      case "warning":
        return "#f59e0b"
      case "info":
        return "#3b82f6"
      default:
        return "#d1d5db"
    }
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "16px",
        backgroundColor: getBackgroundColor(),
        border: `1px solid ${getBorderColor()}`,
        borderRadius: "8px",
        boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
        marginBottom: "8px",
        maxWidth: "400px",
        transform: isLeaving ? "translateX(100%)" : isVisible ? "translateX(0)" : "translateX(100%)",
        opacity: isLeaving ? 0 : isVisible ? 1 : 0,
        transition: "all 0.3s ease-in-out",
      }}
    >
      <div style={{ flexShrink: 0, marginTop: "2px" }}>{getIcon()}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <h4
          style={{
            fontSize: "14px",
            fontWeight: "600",
            margin: "0 0 4px 0",
            color: "#111827",
          }}
        >
          {toast.title}
        </h4>
        {toast.message && (
          <p
            style={{
              fontSize: "13px",
              color: "#6b7280",
              margin: 0,
              lineHeight: "1.4",
            }}
          >
            {toast.message}
          </p>
        )}
      </div>
      <button
        onClick={handleRemove}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "4px",
          borderRadius: "4px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          transition: "color 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.color = "#374151"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.color = "#6b7280"
        }}
      >
        <X size={16} />
      </button>
    </div>
  )
}

export function ToastContainer() {
  const { toasts, removeToast } = useToast()

  if (toasts.length === 0) return null

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 1000,
        pointerEvents: "none",
      }}
    >
      <div style={{ pointerEvents: "auto" }}>
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </div>
  )
}
