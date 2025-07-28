import { Config } from './web3Service';

export interface AppConfig extends Config {
  appName: string;
  version: string;
  testModelCID: string;
  availableModels: Array<{
    id: string;
    name: string;
    description: string;
    cid: string;
    isActive: boolean;
  }>;
}

export class ConfigService {
  private static instance: ConfigService;
  private config: AppConfig | null = null;

  private constructor() {}

  static getInstance(): ConfigService {
    if (!ConfigService.instance) {
      ConfigService.instance = new ConfigService();
    }
    return ConfigService.instance;
  }

  async loadConfig(): Promise<AppConfig> {
    if (this.config) {
      return this.config;
    }

    try {
      // Try to load configuration from multiple sources
      const config = await this.loadFromMultipleSources();
      this.config = config;
      return config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw new Error('Configuration could not be loaded');
    }
  }

  private async loadFromMultipleSources(): Promise<AppConfig> {
    // Default configuration
    const defaultConfig: Partial<AppConfig> = {
      appName: 'Surgent - Decentralized AI Network',
      version: '1.0.0',
      ethNodeUrl: 'http://localhost:8545',
      ipfsHost: '127.0.0.1',
      ipfsPort: 5001,
      testModelCID: 'QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe',
      availableModels: [
        {
          id: 'dialogpt-small',
          name: 'DialoGPT Small',
          description: 'Small conversational model for testing',
          cid: 'QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe',
          isActive: true
        },
        {
          id: 'gpt-3.5-turbo',
          name: 'GPT-3.5 Turbo',
          description: 'Advanced language model',
          cid: 'QmExampleGPT35TurboCID123456789',
          isActive: true
        }
      ]
    };

    // Try to load from environment variables
    const envConfig = this.loadFromEnvironment();
    
    // Try to load from deployment.json
    const deploymentConfig = await this.loadFromDeploymentFile();

    // Try to load from orchestrator config
    const orchestratorConfig = await this.loadFromOrchestratorConfig();

    // Merge configurations (priority: orchestrator > deployment > env > default)
    const mergedConfig = {
      ...defaultConfig,
      ...envConfig,
      ...deploymentConfig,
      ...orchestratorConfig
    } as AppConfig;

    // Validate required fields
    this.validateConfig(mergedConfig);

    return mergedConfig;
  }

  private loadFromEnvironment(): Partial<AppConfig> {
    const env = import.meta.env || (window as any).__ENV__ || {};
    
    return {
      ethNodeUrl: env.VITE_ETH_NODE_URL || env.ETH_NODE_URL,
      defaultAccount: env.VITE_DEFAULT_ACCOUNT || env.DEFAULT_ACCOUNT,
      privateKey: env.VITE_PRIVATE_KEY || env.PRIVATE_KEY,
      contractAddress: env.VITE_CONTRACT_ADDRESS || env.CONTRACT_ADDRESS,
      modelRegistryAddress: env.VITE_MODEL_REGISTRY_ADDRESS || env.MODEL_REGISTRY_ADDRESS,
      ipfsHost: env.VITE_IPFS_HOST || env.IPFS_HOST,
      ipfsPort: parseInt(env.VITE_IPFS_PORT || env.IPFS_PORT || '5001'),
    };
  }

  private async loadFromDeploymentFile(): Promise<Partial<AppConfig>> {
    try {
      const response = await fetch('/deployment.json');
      if (response.ok) {
        const deployment = await response.json();
        return {
          contractAddress: deployment.inferenceCoordinator,
          modelRegistryAddress: deployment.modelRegistry,
        };
      }
    } catch (error) {
      console.warn('Could not load deployment.json:', error);
    }
    return {};
  }

  private async loadFromOrchestratorConfig(): Promise<Partial<AppConfig>> {
    try {
      const response = await fetch('/config.yaml');
      if (response.ok) {
        const configText = await response.text();
        // Simple YAML parsing for basic key-value pairs
        const config = this.parseSimpleYaml(configText);
        
        return {
          ethNodeUrl: config.eth_node_url,
          defaultAccount: config.default_account,
          privateKey: config.private_key,
          contractAddress: config.contract_address,
          modelRegistryAddress: config.model_registry_address,
          ipfsHost: config.ipfs_host,
          ipfsPort: parseInt(config.ipfs_port || '5001'),
        };
      }
    } catch (error) {
      console.warn('Could not load orchestrator config:', error);
    }
    return {};
  }

  private parseSimpleYaml(yamlText: string): Record<string, string> {
    const result: Record<string, string> = {};
    const lines = yamlText.split('\n');
    
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > 0) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim().replace(/['"]/g, '');
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  private validateConfig(config: AppConfig): void {
    const requiredFields = ['ethNodeUrl', 'defaultAccount', 'privateKey', 'contractAddress'];
    const missingFields = requiredFields.filter(field => !config[field as keyof AppConfig]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required configuration fields: ${missingFields.join(', ')}`);
    }

    // Validate Ethereum address format
    if (config.defaultAccount && !/^0x[a-fA-F0-9]{40}$/.test(config.defaultAccount)) {
      throw new Error('Invalid default account address format');
    }

    if (config.contractAddress && !/^0x[a-fA-F0-9]{40}$/.test(config.contractAddress)) {
      throw new Error('Invalid contract address format');
    }

    // Validate private key format
    if (config.privateKey && !/^0x[a-fA-F0-9]{64}$/.test(config.privateKey)) {
      throw new Error('Invalid private key format');
    }
  }

  getConfig(): AppConfig | null {
    return this.config;
  }

  updateConfig(updates: Partial<AppConfig>): void {
    if (this.config) {
      this.config = { ...this.config, ...updates };
    }
  }
}
