import React from "react"
import ReactDOM from "react-dom/client"
import App from "./App"
import "./index.css"

// Handle unhandled promise rejections
window.addEventListener("unhandledrejection", (event) => {
  console.warn("Unhandled promise rejection:", event.reason)
  // Prevent the default behavior (logging to console)
  event.preventDefault()
})

// Handle uncaught errors
window.addEventListener("error", (event) => {
  console.warn("Uncaught error:", event.error)
})

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
