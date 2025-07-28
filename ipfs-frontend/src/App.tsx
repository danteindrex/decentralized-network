import { useState, useEffect } from "react"
import { ChatWindow } from "./components/ChatWindow"
import { Dashboard } from "./components/Dashboard"
import { Navbar } from "./components/Navbar"
import { StoragePopup } from "./components/StoragePopup"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { CustomCursor } from "./components/CustomCursor"
import { ToastProvider } from "./contexts/ToastContext"
import { ToastContainer } from "./components/ui/toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs"
import { 
  MessageSquare, 
  BarChart3, 
  Database, 
  Settings, 
  TrendingUp 
} from "lucide-react"

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [showStoragePopup, setShowStoragePopup] = useState(false)
  const [activeTab, setActiveTab] = useState("chat")

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 1000) // Slightly longer to show the loading state

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center", color: "white" }}>
          <div
            style={{
              width: "60px",
              height: "60px",
              border: "4px solid rgba(255,255,255,0.3)",
              borderTop: "4px solid white",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 24px",
            }}
          ></div>
          <h2 style={{ fontSize: "24px", fontWeight: "600", marginBottom: "8px" }}>
            🧠 Surgent
          </h2>
          <p style={{ opacity: 0.9, fontSize: "16px" }}>Decentralized AI Network</p>
          <p style={{ opacity: 0.7, fontSize: "14px", marginTop: "8px" }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <CustomCursor />
        <div className="glass card-3d animate-fade-scale" style={{ minHeight: "100vh" }}>
          <Navbar />
          
          {/* Main App Header */}
          <div style={{ 
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
            color: "white",
            padding: "2rem 1rem",
            textAlign: "center"
          }}>
            <h1 style={{ fontSize: "2.5rem", fontWeight: "700", marginBottom: "0.5rem" }}>
              🧠 Surgent - Decentralized AI Network
            </h1>
            <p style={{ fontSize: "1.1rem", opacity: 0.9 }}>
              Advanced AI inference platform with IPFS storage and blockchain coordination
            </p>
          </div>

          {/* Tabbed Interface */}
          <div style={{ padding: "2rem" }}>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-5 mb-6">
                <TabsTrigger value="chat" className="flex items-center gap-2">
                  <MessageSquare className="w-4 h-4" />
                  AI Chat
                </TabsTrigger>
                <TabsTrigger value="dashboard" className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  Dashboard
                </TabsTrigger>
                <TabsTrigger value="storage" className="flex items-center gap-2">
                  <Database className="w-4 h-4" />
                  Storage
                </TabsTrigger>
                <TabsTrigger value="analytics" className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4" />
                  Analytics
                </TabsTrigger>
                <TabsTrigger value="settings" className="flex items-center gap-2">
                  <Settings className="w-4 h-4" />
                  Settings
                </TabsTrigger>
              </TabsList>

              <TabsContent value="chat" className="mt-0">
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minHeight: "600px" 
                }}>
                  <ChatWindow onShowStorage={() => setShowStoragePopup(true)} />
                </div>
              </TabsContent>

              <TabsContent value="dashboard" className="mt-0">
                <Dashboard />
              </TabsContent>

              <TabsContent value="storage" className="mt-0">
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  minHeight: "400px" 
                }}>
                  <div style={{ 
                    background: "white", 
                    padding: "3rem", 
                    borderRadius: "12px",
                    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
                    textAlign: "center",
                    maxWidth: "600px"
                  }}>
                    <Database className="w-16 h-16 mx-auto mb-4 text-gray-400" />
                    <h3 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
                      Storage Management
                    </h3>
                    <p style={{ color: "#6b7280", marginBottom: "2rem" }}>
                      Use the chat interface or click the storage button to manage your IPFS files.
                    </p>
                    <button 
                      onClick={() => setShowStoragePopup(true)}
                      style={{
                        background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
                        color: "white",
                        padding: "0.75rem 2rem",
                        borderRadius: "8px",
                        border: "none",
                        fontSize: "1rem",
                        fontWeight: "500",
                        cursor: "pointer"
                      }}
                    >
                      Open Storage Manager
                    </button>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="analytics" className="mt-0">
                <div style={{ 
                  background: "white", 
                  borderRadius: "12px", 
                  padding: "2rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
                    Network Analytics
                  </h2>
                  <div style={{ 
                    display: "grid", 
                    gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", 
                    gap: "1.5rem",
                    marginTop: "2rem"
                  }}>
                    <div style={{ 
                      background: "#f8fafc", 
                      padding: "1.5rem", 
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Job Performance</h3>
                      <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                        Track inference job completion times and success rates over time.
                      </p>
                      <div style={{ marginTop: "1rem", color: "#10b981", fontSize: "1.5rem", fontWeight: "700" }}>
                        98.5% Success Rate
                      </div>
                    </div>
                    <div style={{ 
                      background: "#f8fafc", 
                      padding: "1.5rem", 
                      borderRadius: "8px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <h3 style={{ fontWeight: "600", marginBottom: "0.5rem" }}>Network Growth</h3>
                      <p style={{ color: "#6b7280", fontSize: "0.9rem" }}>
                        Monitor the growth of worker nodes and network capacity.
                      </p>
                      <div style={{ marginTop: "1rem", color: "#3b82f6", fontSize: "1.5rem", fontWeight: "700" }}>
                        +12% This Week
                      </div>
                    </div>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="settings" className="mt-0">
                <div style={{ 
                  background: "white", 
                  borderRadius: "12px", 
                  padding: "2rem",
                  boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)"
                }}>
                  <h2 style={{ fontSize: "1.5rem", fontWeight: "600", marginBottom: "1rem" }}>
                    Network Configuration
                  </h2>
                  <div style={{ maxWidth: "600px" }}>
                    <div style={{ marginBottom: "1.5rem" }}>
                      <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem" }}>
                        Ethereum Node URL
                      </label>
                      <input 
                        type="text" 
                        placeholder="http://localhost:8545"
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          fontSize: "0.9rem"
                        }}
                        readOnly
                      />
                    </div>
                    <div style={{ marginBottom: "1.5rem" }}>
                      <label style={{ display: "block", fontWeight: "500", marginBottom: "0.5rem" }}>
                        IPFS Gateway
                      </label>
                      <input 
                        type="text" 
                        placeholder="http://127.0.0.1:5001"
                        style={{
                          width: "100%",
                          padding: "0.75rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "8px",
                          fontSize: "0.9rem"
                        }}
                        readOnly
                      />
                    </div>
                    <div style={{ 
                      background: "#fef3c7", 
                      border: "1px solid #f59e0b", 
                      borderRadius: "8px", 
                      padding: "1rem",
                      marginTop: "1.5rem"
                    }}>
                      <p style={{ color: "#92400e", fontSize: "0.9rem" }}>
                        ⚠️ Configuration is loaded automatically from deployment files. 
                        Settings shown here are read-only for security.
                      </p>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
          
          {showStoragePopup && <StoragePopup onClose={() => setShowStoragePopup(false)} />}
        </div>
        <ToastContainer />
      </ErrorBoundary>
    </ToastProvider>
  )
}

export default App
