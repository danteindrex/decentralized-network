import { useState, useEffect } from "react"
import { X, HardDrive, Download, File } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Button } from "./ui/button"
import { fileService, type StorageInfo, type FileInfo } from "../services/api"
import { formatFileSize } from "../lib/utils"
import { useToast } from "../contexts/ToastContext"

interface StoragePopupProps {
  onClose: () => void
}

export function StoragePopup({ onClose }: StoragePopupProps) {
  const [storageInfo, setStorageInfo] = useState<StorageInfo | null>(null)
  const [files, setFiles] = useState<FileInfo[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set())
  const { addToast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [storageData, filesData] = await Promise.all([fileService.getStorageInfo(), fileService.getFiles()])
        setStorageInfo(storageData)
        setFiles(filesData)
      } catch (error) {
        console.error("Failed to fetch data:", error)
        addToast({
          type: "error",
          title: "Fetch Failed",
          message: "Failed to load storage information and files.",
        })
      } finally {
        setIsLoading(false)
      }
    }

    fetchData()
  }, [addToast])

  const handleDownload = async (file: FileInfo) => {
    setDownloadingFiles((prev) => new Set(prev).add(file.hash))

    addToast({
      type: "info",
      title: "Download Started",
      message: `Downloading ${file.name}...`,
    })

    try {
      await fileService.downloadFile(file.hash, file.name)
      addToast({
        type: "success",
        title: "Download Successful",
        message: `${file.name} has been downloaded successfully.`,
      })
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Download failed"
      addToast({
        type: "error",
        title: "Download Failed",
        message: `Failed to download ${file.name}: ${errorMessage}`,
      })
    } finally {
      setDownloadingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.hash)
        return newSet
      })
    }
  }

  const storagePercentage = storageInfo ? (storageInfo.usedSpace / storageInfo.totalSpace) * 100 : 0

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
        padding: "20px",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "80vh",
          animation: "slideIn 0.3s ease-out",
        }}
      >
        <Card>
          <CardHeader>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <CardTitle style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <HardDrive size={20} />
                Storage & Files
              </CardTitle>
              <button
                onClick={onClose}
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
                  e.currentTarget.style.backgroundColor = "#f3f4f6"
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = "#6b7280"
                  e.currentTarget.style.backgroundColor = "transparent"
                }}
              >
                <X size={20} />
              </button>
            </div>
          </CardHeader>
          <CardContent style={{ maxHeight: "60vh", overflowY: "auto" }}>
            {isLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#6b7280" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    border: "3px solid #f3f3f3",
                    borderTop: "3px solid #000",
                    borderRadius: "50%",
                    animation: "spin 1s linear infinite",
                    margin: "0 auto 16px",
                  }}
                ></div>
                Loading storage information...
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
                {/* Storage Usage Section */}
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                    Storage Usage
                  </h3>
                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        fontSize: "14px",
                        marginBottom: "8px",
                        color: "#374151",
                      }}
                    >
                      <span>Used Space</span>
                      <span>
                        {storageInfo ? formatFileSize(storageInfo.usedSpace) : "0 Bytes"} /{" "}
                        {storageInfo ? formatFileSize(storageInfo.totalSpace) : "0 Bytes"}
                      </span>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "12px",
                        backgroundColor: "#f3f4f6",
                        borderRadius: "6px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${storagePercentage}%`,
                          height: "100%",
                          backgroundColor:
                            storagePercentage > 80 ? "#ef4444" : storagePercentage > 60 ? "#f59e0b" : "#000",
                          borderRadius: "6px",
                          transition: "width 0.5s ease-in-out",
                        }}
                      ></div>
                    </div>
                    <div style={{ textAlign: "center", marginTop: "8px", fontSize: "12px", color: "#6b7280" }}>
                      {storagePercentage.toFixed(1)}% used
                    </div>
                  </div>

                  {/* Storage Statistics Grid */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", marginTop: "16px" }}>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "16px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <p
                        style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px 0", textTransform: "uppercase" }}
                      >
                        Files Stored
                      </p>
                      <p style={{ fontSize: "24px", fontWeight: "bold", margin: 0, color: "#111827" }}>
                        {storageInfo?.fileCount || 0}
                      </p>
                    </div>
                    <div
                      style={{
                        textAlign: "center",
                        padding: "16px",
                        backgroundColor: "#f9fafb",
                        borderRadius: "8px",
                        border: "1px solid #e5e7eb",
                      }}
                    >
                      <p
                        style={{ fontSize: "12px", color: "#6b7280", margin: "0 0 4px 0", textTransform: "uppercase" }}
                      >
                        Available Space
                      </p>
                      <p style={{ fontSize: "18px", fontWeight: "bold", margin: 0, color: "#111827" }}>
                        {storageInfo ? formatFileSize(storageInfo.totalSpace - storageInfo.usedSpace) : "0 Bytes"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Files List Section */}
                <div>
                  <h3 style={{ fontSize: "16px", fontWeight: "600", marginBottom: "16px", color: "#111827" }}>
                    Your Files ({files.length})
                  </h3>
                  {files.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "32px", color: "#6b7280" }}>
                      <File size={32} style={{ marginBottom: "12px", opacity: 0.5 }} />
                      <p>No files uploaded yet</p>
                      <p style={{ fontSize: "14px", marginTop: "4px" }}>
                        Upload files through the chat to see them here
                      </p>
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        maxHeight: "300px",
                        overflowY: "auto",
                      }}
                    >
                      {files.map((file) => (
                        <div
                          key={file.hash}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "12px",
                            border: "1px solid #e5e7eb",
                            borderRadius: "8px",
                            backgroundColor: "#f9fafb",
                          }}
                        >
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <p style={{ fontWeight: "500", marginBottom: "4px", fontSize: "14px" }}>{file.name}</p>
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "12px",
                                fontSize: "12px",
                                color: "#6b7280",
                              }}
                            >
                              <span>{formatFileSize(file.size)}</span>
                              <span>{new Date(file.uploadedAt).toLocaleDateString()}</span>
                              <span style={{ fontFamily: "monospace", fontSize: "11px" }}>
                                {file.hash.substring(0, 16)}...
                              </span>
                            </div>
                          </div>
                          <Button
                            onClick={() => handleDownload(file)}
                            disabled={downloadingFiles.has(file.hash)}
                            size="sm"
                            style={{ marginLeft: "12px", minWidth: "80px" }}
                          >
                            {downloadingFiles.has(file.hash) ? (
                              "..."
                            ) : (
                              <>
                                <Download size={14} style={{ marginRight: "4px" }} />
                                Download
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
