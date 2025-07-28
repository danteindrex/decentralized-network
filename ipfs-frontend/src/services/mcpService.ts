// MCP (Model Context Protocol) service for communicating with backend
export interface MCPResponse {
  content: string
  action?: string
  success?: boolean
  data?: any
}

export const mcpService = {
  async sendMessage(message: string): Promise<MCPResponse> {
    // This will be replaced with actual MCP client integration
    throw new Error("MCP service not implemented - connect your actual MCP backend here")
  },
}
