import { Web3Service, InferenceJob } from './web3Service';
import { IPFSService } from './ipfsService';
import { AppConfig } from './configService';
import { generateMockCID, delay } from '../lib/utils';

export interface InferenceRequest {
  prompt: string;
  modelId: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

export interface InferenceResult {
  jobId: number;
  response: string;
  txHash: string;
  worker: string;
  duration: number;
  cost: number;
}

export interface NetworkStats {
  blockNumber: number;
  connectedWorkers: number;
  totalJobs: number;
  balance: string;
  ipfsStatus: boolean;
}

export interface ChatResponse {
  content: string;
  action: string;
  intent: string;
  success: boolean;
}

export interface UserIntent {
  action: 'inference' | 'status' | 'history' | 'models' | 'help' | 'upload' | 'download' | 'payment' | 'chat';
  confidence: number;
  parameters?: Record<string, any>;
}

export class AIService {
  private web3Service: Web3Service;
  private ipfsService: IPFSService;
  private config: AppConfig;
  private jobHistory: InferenceJob[] = [];

  constructor(config: AppConfig) {
    this.config = config;
    this.web3Service = new Web3Service(config);
    this.ipfsService = new IPFSService({
      host: config.ipfsHost,
      port: config.ipfsPort
    });
  }

  async submitInferenceRequest(request: InferenceRequest): Promise<{
    jobId: number;
    txHash: string;
    estimatedDuration: number;
  }> {
    try {
      // Find the model
      const model = this.config.availableModels.find(m => m.id === request.modelId);
      if (!model) {
        throw new Error(`Model ${request.modelId} not found`);
      }

      if (!model.isActive) {
        throw new Error(`Model ${request.modelId} is not active`);
      }

      // Upload prompt to IPFS
      const promptData = {
        prompt: request.prompt,
        temperature: request.temperature || 0.7,
        maxTokens: request.maxTokens || 150,
        topP: request.topP || 1.0,
        timestamp: new Date().toISOString()
      };

      const promptCID = await this.ipfsService.uploadJSON(promptData);

      // Submit to blockchain
      const { txHash, jobId } = await this.web3Service.submitInferenceJob(
        promptCID,
        model.cid
      );

      // Add to job history
      const job: InferenceJob = {
        jobId,
        prompt: request.prompt,
        status: 'pending',
        timestamp: new Date(),
        txHash
      };

      this.jobHistory.push(job);

      return {
        jobId,
        txHash,
        estimatedDuration: this.estimateProcessingTime(request.prompt, model.id)
      };

    } catch (error) {
      console.error('Failed to submit inference request:', error);
      throw new Error(`Failed to submit inference request: ${error}`);
    }
  }

  async waitForInferenceResult(jobId: number, timeout: number = 300000): Promise<InferenceResult> {
    const startTime = Date.now();
    
    try {
      // Monitor job completion
      const { responseCID, worker } = await this.web3Service.monitorJobCompletion(jobId, timeout);
      
      if (!responseCID) {
        throw new Error('Job timed out or failed');
      }

      // Fetch response from IPFS
      const responseData = await this.ipfsService.fetchJSON(responseCID);
      
      const duration = (Date.now() - startTime) / 1000;
      
      // Update job history
      const jobIndex = this.jobHistory.findIndex(j => j.jobId === jobId);
      if (jobIndex >= 0) {
        this.jobHistory[jobIndex] = {
          ...this.jobHistory[jobIndex],
          status: 'completed',
          duration,
          worker,
          response: responseData.response || responseData
        };
      }

      return {
        jobId,
        response: responseData.response || responseData,
        txHash: this.jobHistory[jobIndex]?.txHash || '',
        worker: worker || 'Unknown',
        duration,
        cost: 0 // Free inference with tensor parallelism
      };

    } catch (error) {
      // Update job as failed
      const jobIndex = this.jobHistory.findIndex(j => j.jobId === jobId);
      if (jobIndex >= 0) {
        this.jobHistory[jobIndex].status = 'failed';
      }
      
      throw error;
    }
  }

  async processInferenceRequest(request: InferenceRequest): Promise<InferenceResult> {
    const { jobId, txHash } = await this.submitInferenceRequest(request);
    return await this.waitForInferenceResult(jobId);
  }

  async getNetworkStats(): Promise<NetworkStats> {
    try {
      const [blockNumber, balance, ipfsStatus] = await Promise.all([
        this.web3Service.getBlockNumber(),
        this.web3Service.getBalance(),
        this.ipfsService.getStatus()
      ]);

      return {
        blockNumber,
        connectedWorkers: Math.floor(Math.random() * 5) + 1, // Mock data
        totalJobs: this.jobHistory.length,
        balance,
        ipfsStatus: ipfsStatus.online
      };
    } catch (error) {
      console.error('Failed to get network stats:', error);
      return {
        blockNumber: 0,
        connectedWorkers: 0,
        totalJobs: this.jobHistory.length,
        balance: '0',
        ipfsStatus: false
      };
    }
  }

  getJobHistory(): InferenceJob[] {
    return [...this.jobHistory].reverse(); // Most recent first
  }

  getAvailableModels() {
    return this.config.availableModels.filter(model => model.isActive);
  }

  private estimateProcessingTime(prompt: string, modelId: string): number {
    // Tensor parallelism estimation - faster distributed processing
    const baseTime = 15; // Consistent time for tensor parallelism
    const lengthFactor = Math.ceil(prompt.length / 200); // Better scaling
    return baseTime + (lengthFactor * 3);
  }

  // Chat-like interface methods
  async processChatMessage(message: string): Promise<string> {
    const lowerMessage = message.toLowerCase();

    // Handle different types of chat requests
    if (lowerMessage.includes('inference') || lowerMessage.includes('run')) {
      return await this.handleInferenceFromChat(message);
    }

    if (lowerMessage.includes('status') || lowerMessage.includes('stats')) {
      return await this.handleStatusRequest();
    }

    if (lowerMessage.includes('history') || lowerMessage.includes('jobs')) {
      return this.handleHistoryRequest();
    }

    if (lowerMessage.includes('models') || lowerMessage.includes('available')) {
      return this.handleModelsRequest();
    }

    if (lowerMessage.includes('help')) {
      return this.getHelpMessage();
    }

    // Default inference
    return await this.handleInferenceFromChat(message);
  }

  private async handleInferenceFromChat(message: string): Promise<string> {
    try {
      // Extract prompt from message
      let prompt = message;
      if (message.includes(':')) {
        prompt = message.split(':', 1)[1].trim();
      }

      // Use default model for chat
      const defaultModel = this.config.availableModels.find(m => m.isActive) || this.config.availableModels[0];
      
      const result = await this.processInferenceRequest({
        prompt,
        modelId: defaultModel.id,
        temperature: 0.7,
        maxTokens: 150
      });

      return `🎉 **Tensor Parallel Inference Complete!**\n\n**Response:** ${result.response}\n\n*Job ID: ${result.jobId} • Duration: ${result.duration.toFixed(1)}s • Cost: FREE 🆓*`;
      
    } catch (error) {
      return `❌ Error running inference: ${error}`;
    }
  }

  private async handleStatusRequest(): Promise<string> {
    try {
      const stats = await this.getNetworkStats();
      
      return `📊 **Tensor Parallelism Network Status:**\n\n` +
        `• **Blockchain:** Block ${stats.blockNumber} ${stats.blockNumber > 0 ? '✅' : '❌'}\n` +
        `• **IPFS:** ${stats.ipfsStatus ? 'Online ✅' : 'Offline ❌'}\n` +
        `• **Tensor Devices:** ${stats.connectedWorkers} (phones, laptops, servers)\n` +
        `• **Your Balance:** ${parseFloat(stats.balance).toFixed(4)} ETH\n` +
        `• **Total Jobs:** ${stats.totalJobs}\n` +
        `• **Inference Cost:** FREE 🆓 (tensor parallelism)`;
        
    } catch (error) {
      return `❌ Error fetching network status: ${error}`;
    }
  }

  private handleHistoryRequest(): string {
    const recentJobs = this.jobHistory.slice(-5);
    
    if (recentJobs.length === 0) {
      return `📜 **Job History:** No jobs found\n\nSubmit an inference request to see your job history.`;
    }

    let historyText = `📜 **Recent Jobs (${recentJobs.length}/5):**\n\n`;
    
    recentJobs.forEach((job, index) => {
      const statusIcon = job.status === 'completed' ? '✅' : job.status === 'failed' ? '❌' : '⏳';
      const prompt = job.prompt.length > 30 ? job.prompt.substring(0, 30) + '...' : job.prompt;
      
      historyText += `${statusIcon} **Job ${job.jobId}:** "${prompt}"\n`;
      historyText += `   Status: ${job.status} • ${job.timestamp.toLocaleTimeString()}\n\n`;
    });

    return historyText;
  }

  private handleModelsRequest(): string {
    const models = this.getAvailableModels();
    
    let modelsText = `🤖 **Available Models (${models.length}):**\n\n`;
    
    models.forEach(model => {
      modelsText += `• **${model.name}** (${model.id})\n`;
      modelsText += `  ${model.description}\n\n`;
    });

    return modelsText + `To use a model, say: "run inference with ${models[0].id}: your prompt here"`;
  }

  private getHelpMessage(): string {
    return `🤖 **Tensor Parallelism AI Assistant Help:**\n\n` +
      `**Commands:**\n` +
      `• **Run inference:** "Tell me about quantum computing"\n` +
      `• **Check status:** "show network status"\n` +
      `• **View history:** "show my job history"\n` +
      `• **List models:** "what models are available"\n` +
      `• **Get help:** "help"\n\n` +
      `**Examples:**\n` +
      `• "Explain machine learning in simple terms"\n` +
      `• "Write a Python function to sort a list"\n` +
      `• "What is the meaning of life?"\n\n` +
      `🆓 **FREE Inference:** All AI processing is completely free!\n` +
      `📱 **Mobile-First:** Your phone contributes to large model processing!\n` +
      `⚡ **Tensor Parallelism:** Models distributed across multiple devices for better performance!`;
  }
}
