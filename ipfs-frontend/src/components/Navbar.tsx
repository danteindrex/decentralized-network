import { useState } from "react"
import { Github } from "lucide-react"

export function Navbar() {
  const [activeTab, setActiveTab] = useState("home")

  const navItems = [
    { id: "home", label: "Home" },
    { id: "about", label: "About" },
    { id: "github", label: "GitHub", icon: <Github size={16} /> },
  ]

  return (
    <nav
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "16px 32px",
        backgroundColor: "white",
        borderBottom: "1px solid #e5e7eb",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.1)",
      }}
    >
      {/* Company Name */}
      <div style={{ display: "flex", alignItems: "center" }}>
        <h1
          style={{
            fontSize: "24px",
            fontWeight: "bold",
            color: "black",
            margin: 0,
            letterSpacing: "-0.025em",
          }}
        >
          Surgent
        </h1>
      </div>

      {/* Navigation Items */}
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 16px",
              border: "none",
              borderRadius: "6px",
              backgroundColor: activeTab === item.id ? "#f3f4f6" : "transparent",
              color: activeTab === item.id ? "black" : "#6b7280",
              fontSize: "14px",
              fontWeight: "500",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              if (activeTab !== item.id) {
                e.currentTarget.style.backgroundColor = "#f9fafb"
                e.currentTarget.style.color = "#374151"
              }
            }}
            onMouseLeave={(e) => {
              if (activeTab !== item.id) {
                e.currentTarget.style.backgroundColor = "transparent"
                e.currentTarget.style.color = "#6b7280"
              }
            }}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  )
}
