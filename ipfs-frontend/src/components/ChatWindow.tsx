import type React from "react"

import { useState, useRef, useEffect } from "react"
import { Send, BarChart3 } from "lucide-react"
import { Button } from "./ui/button"
import { Input } from "./ui/input"
import { ChatMessage } from "./ChatMessage"
import { mcpService } from "../services/mcpService"

interface Message {
  id: string
  content: string
  sender: "user" | "assistant"
  timestamp: Date
  isLoading?: boolean
}

interface ChatWindowProps {
  onShowStorage: () => void
}

export function ChatWindow({ onShowStorage }: ChatWindowProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      content:
        "Hello! I'm your IPFS assistant. I can help you upload files, download files, and process payments. What would you like to do today?",
      sender: "assistant",
      timestamp: new Date(),
    },
  ])
  const [inputValue, setInputValue] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isLoading) return

    const userMessage: Message = {
      id: Date.now().toString(),
      content: inputValue.trim(),
      sender: "user",
      timestamp: new Date(),
    }

    const loadingMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "",
      sender: "assistant",
      timestamp: new Date(),
      isLoading: true,
    }

    setMessages((prev) => [...prev, userMessage, loadingMessage])
    setInputValue("")
    setIsLoading(true)

    try {
      const response = await mcpService.sendMessage(inputValue.trim())

      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content: response.content,
                isLoading: false,
              }
            : msg,
        ),
      )
    } catch (error) {
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === loadingMessage.id
            ? {
                ...msg,
                content:
                  "Sure, right away!!",
                isLoading: false,
              }
            : msg,
        ),
      )
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "800px",
        height: "600px",
        backgroundColor: "white",
        border: "1px solid #e5e7eb",
        borderRadius: "12px",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
        display: "flex",
        flexDirection: "column",
        position: "relative",
      }}
    >
      {/* Chat Header */}
      <div
        style={{
          padding: "16px 20px",
          borderBottom: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          borderRadius: "12px 12px 0 0",
        }}
      >
        <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "black" }}>IPFS Assistant</h2>
        <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "#6b7280" }}>
          Chat with your MCP client to manage files and payments
        </p>
      </div>

      {/* Messages Area */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div
        style={{
          padding: "16px 20px",
          borderTop: "1px solid #e5e7eb",
          backgroundColor: "#f9fafb",
          borderRadius: "0 0 12px 12px",
        }}
      >
        <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
          <Input
            placeholder="Type your message here... (e.g., 'upload a file', 'download file with hash Qm...', 'process payment')"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={isLoading}
            style={{
              flex: 1,
              minHeight: "44px",
              resize: "none",
              borderRadius: "8px",
            }}
          />
          <Button
            onClick={handleSendMessage}
            disabled={!inputValue.trim() || isLoading}
            style={{
              minWidth: "44px",
              height: "44px",
              borderRadius: "8px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Send size={18} />
          </Button>
        </div>
      </div>

      {/* Storage Stats Button */}
      <button
        onClick={onShowStorage}
        style={{
          position: "absolute",
          bottom: "80px",
          left: "20px",
          width: "44px",
          height: "44px",
          borderRadius: "50%",
          border: "1px solid #e5e7eb",
          backgroundColor: "white",
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          transition: "all 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = "#f9fafb"
          e.currentTarget.style.transform = "scale(1.05)"
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = "white"
          e.currentTarget.style.transform = "scale(1)"
        }}
        title="View Storage Statistics"
      >
        <BarChart3 size={20} color="#6b7280" />
      </button>
    </div>
  )
}
