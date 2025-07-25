import { useState, useEffect } from "react"
import { ChatWindow } from "./components/ChatWindow"
import { Navbar } from "./components/Navbar"
import { StoragePopup } from "./components/StoragePopup"
import { ErrorBoundary } from "./components/ErrorBoundary"
import { ToastProvider } from "./contexts/ToastContext"
import { ToastContainer } from "./components/ui/toast"

function App() {
  const [isLoading, setIsLoading] = useState(true)
  const [showStoragePopup, setShowStoragePopup] = useState(false)

  useEffect(() => {
    // Simulate app initialization
    const timer = setTimeout(() => {
      setIsLoading(false)
    }, 100)

    return () => clearTimeout(timer)
  }, [])

  if (isLoading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "white",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              width: "40px",
              height: "40px",
              border: "3px solid #f3f3f3",
              borderTop: "3px solid #000",
              borderRadius: "50%",
              animation: "spin 1s linear infinite",
              margin: "0 auto 16px",
            }}
          ></div>
          <p style={{ color: "#666" }}>Loading Surgent Portal...</p>
        </div>
      </div>
    )
  }

  return (
    <ToastProvider>
      <ErrorBoundary>
        <div style={{ minHeight: "100vh", backgroundColor: "white", display: "flex", flexDirection: "column" }}>
          <Navbar />
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: "20px" }}>
            <ChatWindow onShowStorage={() => setShowStoragePopup(true)} />
          </div>
          {showStoragePopup && <StoragePopup onClose={() => setShowStoragePopup(false)} />}
        </div>
        <ToastContainer />
      </ErrorBoundary>
    </ToastProvider>
  )
}

export default App
