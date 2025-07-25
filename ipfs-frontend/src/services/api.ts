// Mock API service with better error handling
export interface FileInfo {
  id: string
  name: string
  size: number
  hash: string
  uploadedAt: string
  mimeType?: string
}

export interface StorageInfo {
  usedSpace: number
  totalSpace: number
  fileCount: number
}

// Simulate network delay
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const fileService = {
  async uploadFile(file: File): Promise<FileInfo> {
    try {
      await delay(2000) // Simulate upload time

      return {
        id: Math.random().toString(36).substr(2, 9),
        name: file.name,
        size: file.size,
        hash: `Qm${Math.random().toString(36).substr(2, 44)}`,
        uploadedAt: new Date().toISOString(),
        mimeType: file.type,
      }
    } catch (error) {
      throw new Error("Failed to upload file. Please try again.")
    }
  },

  async downloadFile(hash: string, filename: string): Promise<void> {
    try {
      await delay(1000) // Simulate download time

      // Create a mock file download
      const content = `Mock file content for ${filename}\nHash: ${hash}\nDownloaded at: ${new Date().toISOString()}`
      const blob = new Blob([content], { type: "text/plain" })
      const url = window.URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
    } catch (error) {
      throw new Error("Failed to download file. Please try again.")
    }
  },

  async getFiles(): Promise<FileInfo[]> {
    try {
      await delay(1000) // Simulate API call

      return [
        {
          id: "1",
          name: "example.txt",
          size: 1024,
          hash: "QmExampleHash1234567890abcdef",
          uploadedAt: new Date(Date.now() - 86400000).toISOString(),
          mimeType: "text/plain",
        },
        {
          id: "2",
          name: "image.jpg",
          size: 2048000,
          hash: "QmImageHash1234567890abcdef",
          uploadedAt: new Date(Date.now() - 172800000).toISOString(),
          mimeType: "image/jpeg",
        },
      ]
    } catch (error) {
      throw new Error("Failed to fetch files. Please try again.")
    }
  },

  async getStorageInfo(): Promise<StorageInfo> {
    try {
      await delay(500) // Simulate API call

      return {
        usedSpace: 2049024,
        totalSpace: 1073741824, // 1GB
        fileCount: 2,
      }
    } catch (error) {
      throw new Error("Failed to fetch storage info. Please try again.")
    }
  },

  async deleteFile(hash: string): Promise<void> {
    try {
      await delay(1000) // Simulate API call
      // Mock successful deletion
    } catch (error) {
      throw new Error("Failed to delete file. Please try again.")
    }
  },
}
