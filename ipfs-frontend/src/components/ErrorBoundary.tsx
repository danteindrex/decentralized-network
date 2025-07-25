import React from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { AlertCircle, RefreshCw } from "lucide-react"

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

interface ErrorBoundaryProps {
  children: React.ReactNode
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("Error caught by boundary:", error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            backgroundColor: "white",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <Card style={{ width: "100%", maxWidth: "400px" }}>
            <CardHeader>
              <CardTitle style={{ display: "flex", alignItems: "center", gap: "8px", color: "red" }}>
                <AlertCircle size={20} />
                Something went wrong
              </CardTitle>
              <CardDescription>An error occurred while loading the application.</CardDescription>
            </CardHeader>
            <CardContent style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {this.state.error && (
                <div
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    backgroundColor: "#f5f5f5",
                    padding: "12px",
                    borderRadius: "4px",
                    fontFamily: "monospace",
                  }}
                >
                  {this.state.error.message}
                </div>
              )}
              <Button onClick={() => window.location.reload()} style={{ width: "100%" }}>
                <RefreshCw size={16} style={{ marginRight: "8px" }} />
                Reload Page
              </Button>
            </CardContent>
          </Card>
        </div>
      )
    }

    return this.props.children
  }
}
