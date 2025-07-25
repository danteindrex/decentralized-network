import { User, Bot } from "lucide-react"

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  isLoading?: boolean
}

interface ChatMessageProps {
  message: Message
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.sender === "user"

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: isUser ? "row-reverse" : "row",
        alignItems: "flex-start",
        gap: "12px",
        maxWidth: "100%",
      }}
    >
      {/* Avatar */}
      <div
        style={{
          width: "36px",
          height: "36px",
          borderRadius: "50%",
          backgroundColor: isUser ? "#000" : "#f3f4f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
      >
        {isUser ? <User size={18} color="white" /> : <Bot size={18} color="#6b7280" />}
      </div>

      {/* Message Content */}
      <div
        style={{
          maxWidth: "70%",
          display: "flex",
          flexDirection: "column",
          alignItems: isUser ? "flex-end" : "flex-start",
        }}
      >
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "18px",
            backgroundColor: isUser ? "#000" : "#f3f4f6",
            color: isUser ? "white" : "#1f2937",
            fontSize: "14px",
            lineHeight: "1.5",
            wordWrap: "break-word",
            position: "relative",
          }}
        >
          {message.isLoading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#6b7280",
                  animation: "pulse 1.5s ease-in-out infinite",
                }}
              />
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#6b7280",
                  animation: "pulse 1.5s ease-in-out infinite 0.2s",
                }}
              />
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "#6b7280",
                  animation: "pulse 1.5s ease-in-out infinite 0.4s",
                }}
              />
            </div>
          ) : (
            message.content
          )}
        </div>
        <span
          style={{
            fontSize: "12px",
            color: "#9ca3af",
            marginTop: "4px",
            marginLeft: isUser ? "0" : "16px",
            marginRight: isUser ? "16px" : "0",
          }}
        >
          {formatTime(message.timestamp)}
        </span>
      </div>
    </div>
  )
}
