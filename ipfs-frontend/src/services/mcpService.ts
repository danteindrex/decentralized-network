import { AIService } from './aiService';
import { ConfigService } from './configService';

// MCP (Model Context Protocol) service for communicating with backend
export interface MCPResponse {
  content: string
  action?: string
  success?: boolean
  data?: any
}

class MCPService {
  private aiService: AIService | null = null;
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      const configService = ConfigService.getInstance();
      const config = await configService.loadConfig();
      this.aiService = new AIService(config);
      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize MCP service:', error);
      throw error;
    }
  }

  async sendMessage(message: string): Promise<MCPResponse> {
    try {
      await this.initialize();
      
      if (!this.aiService) {
        throw new Error('AI service not initialized');
      }

      const response = await this.aiService.processChatMessage(message);
      
      return {
        content: response,
        success: true,
        action: this.determineAction(message)
      };
    } catch (error) {
      console.error('MCP service error:', error);
      
      return {
        content: `I apologize, but I encountered an error: ${error}\n\nPlease check your network connection and configuration.`,
        success: false,
        action: 'error'
      };
    }
  }

  private determineAction(message: string): string {
    const lowerMessage = message.toLowerCase();
    
    if (lowerMessage.includes('upload') || lowerMessage.includes('file')) {
      return 'upload';
    }
    if (lowerMessage.includes('download')) {
      return 'download';
    }
    if (lowerMessage.includes('inference') || lowerMessage.includes('run')) {
      return 'inference';
    }
    if (lowerMessage.includes('status') || lowerMessage.includes('stats')) {
      return 'status';
    }
    if (lowerMessage.includes('history')) {
      return 'history';
    }
    
    return 'chat';
  }

  getAIService(): AIService | null {
    return this.aiService;
  }
}

// Export singleton instance
export const mcpService = new MCPService();
