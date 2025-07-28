const fs = require('fs');
const path = require('path');
const yaml = require('yaml');
const os = require('os');

class ConfigManager {
    constructor(configPath = null) {
        this.configPath = configPath || path.join(__dirname, '..', 'config', 'network.yaml');
        this.config = null;
        this.envOverrides = {};
        
        this.loadConfig();
        this.loadEnvironmentOverrides();
    }
    
    loadConfig() {
        try {
            if (!fs.existsSync(this.configPath)) {
                throw new Error(`Configuration file not found: ${this.configPath}`);
            }
            
            const configContent = fs.readFileSync(this.configPath, 'utf8');
            this.config = yaml.parse(configContent);
            
            // Resolve environment variable references in config
            this.config = this.resolveEnvironmentVariables(this.config);
            
            console.log(`✅ Configuration loaded from ${this.configPath}`);
        } catch (err) {
            console.error(`❌ Failed to load configuration: ${err.message}`);
            throw err;
        }
    }
    
    loadEnvironmentOverrides() {
        // Load environment variables that override config values
        // Format: SECTION_SUBSECTION_KEY (e.g., NETWORK_CHAIN_ID)
        
        const envVars = process.env;
        
        for (const [key, value] of Object.entries(envVars)) {
            if (this.isConfigOverride(key)) {
                const configPath = this.envKeyToConfigPath(key);
                this.envOverrides[configPath] = this.parseEnvValue(value);
            }
        }
        
        if (Object.keys(this.envOverrides).length > 0) {
            console.log(`🔧 Found ${Object.keys(this.envOverrides).length} environment overrides`);
        }
    }
    
    isConfigOverride(envKey) {
        // Check if this environment variable is a config override
        const configSections = ['NETWORK', 'SECURITY', 'RESOURCES', 'CONTRACTS', 
                               'MODELS', 'STORAGE', 'LOGGING', 'MONITORING', 'DEVELOPMENT'];
        
        return configSections.some(section => envKey.startsWith(`${section}_`));
    }
    
    envKeyToConfigPath(envKey) {
        // Convert NETWORK_CHAIN_ID to network.chain_id
        return envKey.toLowerCase().replace(/_/g, '.');
    }
    
    parseEnvValue(value) {
        // Parse environment variable value to appropriate type
        
        // Boolean values
        if (value.toLowerCase() === 'true' || value === '1') return true;
        if (value.toLowerCase() === 'false' || value === '0') return false;
        
        // Number values
        if (/^\d+$/.test(value)) return parseInt(value);
        if (/^\d+\.\d+$/.test(value)) return parseFloat(value);
        
        // Array values (comma-separated)
        if (value.includes(',')) {
            return value.split(',').map(v => v.trim());
        }
        
        // String values
        return value;
    }
    
    resolveEnvironmentVariables(obj) {
        // Recursively resolve ${ENV_VAR} references in configuration
        
        if (typeof obj === 'string') {
            return obj.replace(/\$\{([^}]+)\}/g, (match, envVar) => {
                return process.env[envVar] || match;
            });
        }
        
        if (Array.isArray(obj)) {
            return obj.map(item => this.resolveEnvironmentVariables(item));
        }
        
        if (obj && typeof obj === 'object') {
            const resolved = {};
            for (const [key, value] of Object.entries(obj)) {
                resolved[key] = this.resolveEnvironmentVariables(value);
            }
            return resolved;
        }
        
        return obj;
    }
    
    get(keyPath, defaultValue = undefined) {
        // Get configuration value using dot notation (e.g., 'network.chain_id')
        
        // Check environment overrides first
        if (this.envOverrides[keyPath] !== undefined) {
            return this.envOverrides[keyPath];
        }
        
        // Navigate through config object
        const keys = keyPath.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }
    
    getNodeConfig(nodeType, nodeId = null) {
        // Get configuration specific to a node type
        
        const baseConfig = {
            // Network settings
            chainId: this.get('network.chain_id'),
            networkId: this.get('network.network_id'),
            bootstrapNodes: this.get('network.bootstrap_nodes', []),
            
            // Ports
            blockchainPort: this.get('network.ports.blockchain_base') + this.getPortOffset(nodeType),
            rpcPort: this.get('network.ports.rpc_base') + this.getPortOffset(nodeType),
            wsPort: this.get('network.ports.ws_base') + this.getPortOffset(nodeType),
            healthPort: this.get('network.ports.health_base') + this.getPortOffset(nodeType),
            metricsPort: this.get('network.ports.metrics_base') + this.getPortOffset(nodeType),
            
            // Security
            keyDirectory: this.get('security.key_directory').replace('${HOME}', os.homedir()),
            useSecureKeys: this.get('security.use_secure_keys'),
            apiRateLimit: this.get('security.api_rate_limit'),
            requestTimeout: this.get('security.request_timeout'),
            
            // Resources
            resourceDefaults: this.get('resources.defaults'),
            resourceLimits: this.get('resources.limits'),
            
            // Storage
            ipfsHost: this.get('storage.ipfs.host'),
            ipfsPort: this.get('storage.ipfs.port'),
            dataDirectory: this.get('storage.local.data_directory'),
            
            // Logging
            logLevel: this.get('logging.level'),
            logFormat: this.get('logging.format'),
            
            // Monitoring
            healthCheckInterval: this.get('monitoring.health.check_interval'),
            metricsEnabled: this.get('monitoring.metrics.enabled'),
            
            // Node ID
            nodeId: nodeId || `${nodeType}-${Date.now()}`
        };
        
        // Add node-type specific configuration
        const nodeTypeConfig = this.get(`node_types.${nodeType}`, {});
        
        return { ...baseConfig, ...nodeTypeConfig };
    }
    
    getPortOffset(nodeType) {
        // Get port offset based on node type to avoid conflicts
        const offsets = {
            bootstrap: 0,
            worker: 100,
            owner: 200,
            user: 300,
            orchestrator: 400
        };
        
        return offsets[nodeType] || Math.floor(Math.random() * 1000);
    }
    
    getBlockchainConfig() {
        // Get blockchain-specific configuration
        return {
            ethNodeUrl: this.getEthNodeUrl(),
            contractAddresses: {
                inferenceCoordinator: this.get('contracts.inference_coordinator'),
                modelRegistry: this.get('contracts.model_registry')
            },
            gasSettings: {
                gasPrice: this.get('security.gas_price_gwei'),
                gasLimit: this.get('security.gas_limit')
            },
            minimumPayment: this.get('contracts.minimum_payment_wei'),
            platformFee: this.get('contracts.platform_fee_basis_points')
        };
    }
    
    getEthNodeUrl() {
        // Get Ethereum node URL from environment or config
        return process.env.ETH_NODE_URL || 
               process.env.ETH_NODE || 
               `http://localhost:${this.get('network.ports.rpc_base')}`;
    }
    
    getModelConfig() {
        // Get model management configuration
        return {
            cache: this.get('models.cache'),
            loading: this.get('models.loading'),
            storage: {
                modelsDirectory: this.get('storage.local.models_directory'),
                tempDirectory: this.get('storage.local.temp_directory')
            }
        };
    }
    
    getLoggingConfig() {
        // Get logging configuration
        return {
            level: this.get('logging.level'),
            format: this.get('logging.format'),
            files: this.get('logging.files'),
            structured: this.get('logging.structured')
        };
    }
    
    isTestMode() {
        // Check if running in test mode
        return this.get('development.test_mode', false) || 
               process.env.NODE_ENV === 'test';
    }
    
    getTestKeys() {
        // Get test private keys (only in development/test mode)
        if (!this.isTestMode() && !this.get('development.debug_mode')) {
            throw new Error('Test keys are only available in test/debug mode');
        }
        
        return this.get('development.test_private_keys');
    }
    
    validateConfig() {
        // Validate configuration for common issues
        const issues = [];
        
        // Check required sections
        const requiredSections = ['network', 'security', 'resources', 'storage'];
        for (const section of requiredSections) {
            if (!this.get(section)) {
                issues.push(`Missing required configuration section: ${section}`);
            }
        }
        
        // Check port conflicts
        const basePorts = [
            this.get('network.ports.blockchain_base'),
            this.get('network.ports.rpc_base'),
            this.get('network.ports.ws_base'),
            this.get('network.ports.health_base'),
            this.get('network.ports.metrics_base')
        ];
        
        const portSet = new Set(basePorts);
        if (portSet.size !== basePorts.length) {
            issues.push('Port conflicts detected in base port configuration');
        }
        
        // Check resource percentages
        const defaults = this.get('resources.defaults');
        if (defaults) {
            const totalPercent = defaults.cpu_percent + defaults.ram_percent + 
                               defaults.gpu_percent + defaults.storage_percent;
            if (totalPercent > 80) {
                issues.push('Resource allocation percentages may be too high (total > 80%)');
            }
        }
        
        return issues;
    }
    
    saveConfig(newConfig = null) {
        // Save configuration back to file
        const configToSave = newConfig || this.config;
        
        try {
            const yamlContent = yaml.stringify(configToSave, { indent: 2 });
            fs.writeFileSync(this.configPath, yamlContent);
            console.log(`✅ Configuration saved to ${this.configPath}`);
        } catch (err) {
            console.error(`❌ Failed to save configuration: ${err.message}`);
            throw err;
        }
    }
    
    updateContractAddresses(addresses) {
        // Update contract addresses after deployment
        if (addresses.inferenceCoordinator) {
            this.config.contracts.inference_coordinator = addresses.inferenceCoordinator;
        }
        
        if (addresses.modelRegistry) {
            this.config.contracts.model_registry = addresses.modelRegistry;
        }
        
        this.saveConfig();
        console.log('✅ Contract addresses updated in configuration');
    }
    
    createEnvironmentFile(nodeType, outputPath = null) {
        // Create environment file for a specific node type
        const nodeConfig = this.getNodeConfig(nodeType);
        const outputFile = outputPath || `.env.${nodeType}`;
        
        let envContent = `# Environment configuration for ${nodeType} node\n`;
        envContent += `# Generated on ${new Date().toISOString()}\n\n`;
        
        // Add key configuration
        if (nodeConfig.useSecureKeys) {
            envContent += `# Secure key file path\n`;
            envContent += `${nodeType.toUpperCase()}_KEY_FILE=${path.join(nodeConfig.keyDirectory, `${nodeType}.key`)}\n\n`;
        }
        
        // Add network configuration
        envContent += `# Network Configuration\n`;
        envContent += `CHAIN_ID=${nodeConfig.chainId}\n`;
        envContent += `NETWORK_ID=${nodeConfig.networkId}\n`;
        envContent += `RPC_PORT=${nodeConfig.rpcPort}\n`;
        envContent += `WS_PORT=${nodeConfig.wsPort}\n`;
        envContent += `HEALTH_PORT=${nodeConfig.healthPort}\n`;
        envContent += `METRICS_PORT=${nodeConfig.metricsPort}\n\n`;
        
        // Add storage configuration
        envContent += `# Storage Configuration\n`;
        envContent += `IPFS_HOST=${nodeConfig.ipfsHost}\n`;
        envContent += `IPFS_PORT=${nodeConfig.ipfsPort}\n`;
        envContent += `DATA_DIRECTORY=${nodeConfig.dataDirectory}\n\n`;
        
        // Add resource configuration
        envContent += `# Resource Configuration\n`;
        envContent += `CPU_CONTRIBUTION=${nodeConfig.resourceDefaults.cpu_percent}\n`;
        envContent += `RAM_CONTRIBUTION=${nodeConfig.resourceDefaults.ram_percent}\n`;
        envContent += `GPU_CONTRIBUTION=${nodeConfig.resourceDefaults.gpu_percent}\n`;
        envContent += `STORAGE_CONTRIBUTION=${nodeConfig.resourceDefaults.storage_percent}\n\n`;
        
        // Add monitoring configuration
        envContent += `# Monitoring Configuration\n`;
        envContent += `LOG_LEVEL=${nodeConfig.logLevel}\n`;
        envContent += `HEALTH_CHECK_INTERVAL=${nodeConfig.healthCheckInterval}\n`;
        
        try {
            fs.writeFileSync(outputFile, envContent);
            console.log(`✅ Environment file created: ${outputFile}`);
            return outputFile;
        } catch (err) {
            console.error(`❌ Failed to create environment file: ${err.message}`);
            throw err;
        }
    }
}

// Singleton instance
let globalConfigManager = null;

function getConfigManager(configPath = null) {
    if (!globalConfigManager || configPath) {
        globalConfigManager = new ConfigManager(configPath);
    }
    return globalConfigManager;
}

module.exports = { ConfigManager, getConfigManager };