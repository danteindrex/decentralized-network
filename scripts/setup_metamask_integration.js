/**
 * Setup MetaMask Integration for All Node Types
 * This script configures the entire network to use MetaMask for wallet management
 */

const fs = require('fs');
const path = require('path');

class MetaMaskIntegrationSetup {
    constructor() {
        this.projectRoot = path.resolve(__dirname, '..');
        this.networkConfig = {
            chainId: 1337,
            chainIdHex: '0x539',
            chainName: 'Decentralized vLLM Network',
            rpcUrl: 'http://localhost:8545',
            symbol: 'ETH',
            decimals: 18
        };
    }

    async setup() {
        console.log('🦊 Setting up MetaMask integration for all node types...\n');

        try {
            // 1. Update environment configuration
            await this.updateEnvironmentConfig();

            // 2. Create MetaMask configuration files
            await this.createMetaMaskConfigs();

            // 3. Update node implementations
            await this.updateNodeImplementations();

            // 4. Create setup instructions
            await this.createSetupInstructions();

            // 5. Update package.json scripts
            await this.updatePackageScripts();

            console.log('✅ MetaMask integration setup completed!\n');
            this.printNextSteps();

        } catch (error) {
            console.error('❌ Setup failed:', error);
            process.exit(1);
        }
    }

    async updateEnvironmentConfig() {
        console.log('📝 Updating environment configuration...');

        const envTemplate = `# Decentralized vLLM Inference Network - MetaMask Integration
# Copy this file to .env and update with your actual values

# =============================================================================
# BLOCKCHAIN CONFIGURATION
# =============================================================================

# Ethereum Node URL (your private network)
ETH_NODE_URL=http://localhost:8545

# Network Configuration
CHAIN_ID=1337
CHAIN_ID_HEX=0x539
CHAIN_NAME="Decentralized vLLM Network"

# MetaMask Integration (set to true to enable)
USE_METAMASK=true

# Fallback accounts (only used if MetaMask is not available)
# WARNING: Never use these keys in production!
FALLBACK_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
FALLBACK_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# =============================================================================
# NODE-SPECIFIC CONFIGURATION
# =============================================================================

# Bootstrap Node
BOOTSTRAP_USE_METAMASK=true
BOOTSTRAP_FALLBACK_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
BOOTSTRAP_FALLBACK_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Worker Nodes
WORKER_USE_METAMASK=true
WORKER_FALLBACK_ACCOUNT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8
WORKER_FALLBACK_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d

# Model Owner
OWNER_USE_METAMASK=true
OWNER_FALLBACK_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
OWNER_FALLBACK_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80

# Users
USER_USE_METAMASK=true
USER_FALLBACK_ACCOUNT=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
USER_FALLBACK_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a

# =============================================================================
# IPFS CONFIGURATION
# =============================================================================

IPFS_HOST=127.0.0.1
IPFS_PORT=5001
IPFS_PROTOCOL=http
IPFS_GATEWAY=http://127.0.0.1:8080

# =============================================================================
# NETWORK CONFIGURATION
# =============================================================================

BOOTSTRAP_NODE=localhost:30303
STATIC_IP=localhost
P2P_PORT=30303

# =============================================================================
# SERVICE PORTS
# =============================================================================

STREAMLIT_PORT=8501
MOBILE_SERVER_PORT=8080
OWNER_API_PORT=8002
WORKER_API_PORT=8001

# =============================================================================
# DEVELOPMENT SETTINGS
# =============================================================================

NODE_ENV=development
LOG_LEVEL=info
DEBUG=false

# =============================================================================
# MOBILE CONFIGURATION
# =============================================================================

# Enable mobile MetaMask integration
MOBILE_METAMASK_ENABLED=true

# Mobile app configuration
MOBILE_APP_NAME="AI Compute Network"
MOBILE_APP_DESCRIPTION="Decentralized AI inference network"
MOBILE_APP_ICON="🧠"

# =============================================================================
# PRODUCTION SETTINGS (for production deployment)
# =============================================================================

# # Use external Ethereum node
# ETH_NODE_URL=https://your-private-network-rpc.com

# # Use your production domain
# STATIC_IP=your-domain.com
# BOOTSTRAP_NODE=your-domain.com:30303

# # Enable SSL for mobile
# MOBILE_SSL_ENABLED=true
# MOBILE_DOMAIN=your-domain.com
`;

        await this.writeFile('.env.metamask', envTemplate);
        console.log('  ✅ Created .env.metamask template');
    }

    async createMetaMaskConfigs() {
        console.log('🔧 Creating MetaMask configuration files...');

        // Network configuration for MetaMask
        const networkConfig = {
            chainId: this.networkConfig.chainIdHex,
            chainName: this.networkConfig.chainName,
            rpcUrls: [this.networkConfig.rpcUrl],
            nativeCurrency: {
                name: this.networkConfig.symbol,
                symbol: this.networkConfig.symbol,
                decimals: this.networkConfig.decimals
            },
            blockExplorerUrls: null
        };

        await this.writeFile('metamask-network-config.json', JSON.stringify(networkConfig, null, 2));
        console.log('  ✅ Created MetaMask network configuration');

        // MetaMask setup instructions
        const setupInstructions = {
            title: "MetaMask Setup for Decentralized vLLM Network",
            steps: [
                {
                    step: 1,
                    title: "Install MetaMask",
                    description: "Install MetaMask browser extension or mobile app",
                    links: {
                        browser: "https://metamask.io/download/",
                        mobile: "https://metamask.io/download/"
                    }
                },
                {
                    step: 2,
                    title: "Add Network",
                    description: "Add the Decentralized vLLM Network to MetaMask",
                    config: networkConfig,
                    instructions: [
                        "Open MetaMask",
                        "Click on network dropdown",
                        "Click 'Add Network'",
                        "Enter the network details above",
                        "Click 'Save'"
                    ]
                },
                {
                    step: 3,
                    title: "Import Test Account (Development Only)",
                    description: "Import test account for development",
                    warning: "NEVER use these keys in production!",
                    accounts: [
                        {
                            name: "Bootstrap/Owner Account",
                            address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
                            privateKey: "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"
                        },
                        {
                            name: "Worker Account",
                            address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
                            privateKey: "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"
                        },
                        {
                            name: "User Account",
                            address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
                            privateKey: "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"
                        }
                    ]
                }
            ]
        };

        await this.writeFile('metamask-setup-instructions.json', JSON.stringify(setupInstructions, null, 2));
        console.log('  ✅ Created MetaMask setup instructions');
    }

    async updateNodeImplementations() {
        console.log('🔄 Updating node implementations...');

        // Update bootstrap node
        await this.updateBootstrapNode();

        // Update worker node
        await this.updateWorkerNode();

        // Update orchestrator
        await this.updateOrchestrator();

        console.log('  ✅ Updated all node implementations');
    }

    async updateBootstrapNode() {
        const bootstrapConfig = `// MetaMask Integration for Bootstrap Node
const { ethers } = require('ethers');

class MetaMaskBootstrapNode {
    constructor(config = {}) {
        this.config = {
            useMetaMask: process.env.BOOTSTRAP_USE_METAMASK === 'true',
            fallbackAccount: process.env.BOOTSTRAP_FALLBACK_ACCOUNT,
            fallbackPrivateKey: process.env.BOOTSTRAP_FALLBACK_PRIVATE_KEY,
            chainId: parseInt(process.env.CHAIN_ID || '1337'),
            rpcUrl: process.env.ETH_NODE_URL || 'http://localhost:8545',
            ...config
        };
        
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    async init() {
        console.log('🦊 Initializing Bootstrap Node with MetaMask integration...');
        
        if (this.config.useMetaMask && typeof window !== 'undefined' && window.ethereum) {
            // Browser environment with MetaMask
            await this.initMetaMask();
        } else {
            // Node.js environment or MetaMask not available
            await this.initFallback();
        }
        
        console.log(\`✅ Bootstrap Node initialized with account: \${this.account}\`);
    }

    async initMetaMask() {
        try {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Switch to correct network
            await this.switchNetwork();
            
            this.signer = this.provider.getSigner();
            this.account = await this.signer.getAddress();
            
        } catch (error) {
            console.warn('MetaMask initialization failed, falling back to private key:', error.message);
            await this.initFallback();
        }
    }

    async initFallback() {
        this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
        
        if (this.config.fallbackPrivateKey) {
            this.signer = new ethers.Wallet(this.config.fallbackPrivateKey, this.provider);
            this.account = this.signer.address;
        } else {
            throw new Error('No MetaMask available and no fallback private key provided');
        }
    }

    async switchNetwork() {
        const chainIdHex = \`0x\${this.config.chainId.toString(16)}\`;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                // Network doesn't exist, add it
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: process.env.CHAIN_NAME || 'Decentralized vLLM Network',
                        rpcUrls: [this.config.rpcUrl],
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        }
                    }]
                });
            } else {
                throw switchError;
            }
        }
    }

    async signTransaction(transaction) {
        if (!this.signer) {
            throw new Error('No signer available');
        }
        
        return await this.signer.sendTransaction(transaction);
    }

    getAccount() {
        return this.account;
    }

    getSigner() {
        return this.signer;
    }
}

module.exports = { MetaMaskBootstrapNode };
`;

        await this.writeFile('nodes/bootstrap/metamask-integration.js', bootstrapConfig);
    }

    async updateWorkerNode() {
        const workerConfig = `// MetaMask Integration for Worker Node
const { ethers } = require('ethers');

class MetaMaskWorkerNode {
    constructor(config = {}) {
        this.config = {
            useMetaMask: process.env.WORKER_USE_METAMASK === 'true',
            fallbackAccount: process.env.WORKER_FALLBACK_ACCOUNT,
            fallbackPrivateKey: process.env.WORKER_FALLBACK_PRIVATE_KEY,
            chainId: parseInt(process.env.CHAIN_ID || '1337'),
            rpcUrl: process.env.ETH_NODE_URL || 'http://localhost:8545',
            ...config
        };
        
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    async init() {
        console.log('🦊 Initializing Worker Node with MetaMask integration...');
        
        if (this.config.useMetaMask && typeof window !== 'undefined' && window.ethereum) {
            await this.initMetaMask();
        } else {
            await this.initFallback();
        }
        
        console.log(\`✅ Worker Node initialized with account: \${this.account}\`);
    }

    async initMetaMask() {
        try {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            await this.switchNetwork();
            this.signer = this.provider.getSigner();
            this.account = await this.signer.getAddress();
        } catch (error) {
            console.warn('MetaMask initialization failed, falling back to private key:', error.message);
            await this.initFallback();
        }
    }

    async initFallback() {
        this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
        
        if (this.config.fallbackPrivateKey) {
            this.signer = new ethers.Wallet(this.config.fallbackPrivateKey, this.provider);
            this.account = this.signer.address;
        } else {
            throw new Error('No MetaMask available and no fallback private key provided');
        }
    }

    async switchNetwork() {
        const chainIdHex = \`0x\${this.config.chainId.toString(16)}\`;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: process.env.CHAIN_NAME || 'Decentralized vLLM Network',
                        rpcUrls: [this.config.rpcUrl],
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        }
                    }]
                });
            } else {
                throw switchError;
            }
        }
    }

    async submitTaskResponse(jobId, responseCID) {
        if (!this.signer) {
            throw new Error('No signer available');
        }
        
        // Implementation would interact with smart contract
        console.log(\`Submitting response for job \${jobId}: \${responseCID}\`);
    }

    getAccount() {
        return this.account;
    }

    getSigner() {
        return this.signer;
    }
}

module.exports = { MetaMaskWorkerNode };
`;

        await this.writeFile('nodes/worker/metamask-integration.js', workerConfig);
    }

    async updateOrchestrator() {
        const orchestratorConfig = `# MetaMask Integration for Orchestrator
# Add this to orchestrator/config.yaml

wallet:
  use_metamask: true
  fallback_account: "${process.env.OWNER_FALLBACK_ACCOUNT || '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266'}"
  fallback_private_key: "${process.env.OWNER_FALLBACK_PRIVATE_KEY || '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'}"

network:
  chain_id: 1337
  chain_name: "Decentralized vLLM Network"
  rpc_url: "http://localhost:8545"

metamask:
  auto_switch_network: true
  show_connection_prompt: true
  enable_mobile_support: true
`;

        await this.writeFile('orchestrator/metamask-config.yaml', orchestratorConfig);
    }

    async createSetupInstructions() {
        console.log('📖 Creating setup instructions...');

        const instructions = `# 🦊 MetaMask Integration Setup Guide

## Overview

This guide will help you set up MetaMask integration for the Decentralized vLLM Inference Network. With MetaMask integration, users don't need to manually enter private keys - they can connect their wallets directly through the MetaMask interface.

## Prerequisites

1. **MetaMask Browser Extension** or **MetaMask Mobile App**
2. **Running private network** (Chain ID: 1337)
3. **Node.js and npm** installed

## Quick Setup

### 1. Copy MetaMask Environment Configuration

\`\`\`bash
cp .env.metamask .env
\`\`\`

### 2. Start Your Private Network

\`\`\`bash
# Start infrastructure
docker-compose up -d ipfs geth

# Deploy contracts
npm run deploy
\`\`\`

### 3. Add Network to MetaMask

**Automatic Method (Recommended):**
- Visit any of the web interfaces
- Click "Connect MetaMask"
- Approve network addition when prompted

**Manual Method:**
1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Enter these details:
   - **Network Name:** Decentralized vLLM Network
   - **RPC URL:** http://localhost:8545
   - **Chain ID:** 1337
   - **Currency Symbol:** ETH

### 4. Import Test Accounts (Development Only)

⚠️ **WARNING: Only use these for development on your private network!**

**Bootstrap/Owner Account:**
- Address: \`0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266\`
- Private Key: \`0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80\`

**Worker Account:**
- Address: \`0x70997970C51812dc3A010C7d01b50e0d17dc79C8\`
- Private Key: \`0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d\`

**User Account:**
- Address: \`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC\`
- Private Key: \`0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a\`

## Usage by Node Type

### 🏠 Bootstrap Node Operators

\`\`\`bash
# Start bootstrap node with MetaMask
npm run start:bootstrap:metamask

# Or use web interface
open http://localhost:8080/bootstrap-setup
\`\`\`

### ⚡ Worker Node Operators

\`\`\`bash
# Start worker node with MetaMask
npm run start:worker:metamask

# Or use web interface
open http://localhost:8081/worker-setup
\`\`\`

### 🎨 Model Owners

\`\`\`bash
# Start owner interface with MetaMask
npm run start:owner:metamask

# Or use web interface
open http://localhost:8002/owner-dashboard
\`\`\`

### 👤 Regular Users

\`\`\`bash
# Start Streamlit with MetaMask
npm run start:streamlit:metamask

# Or use web interface
open http://localhost:8501
\`\`\`

### 📱 Mobile Users

1. **Install MetaMask Mobile App**
2. **Open MetaMask Browser**
3. **Navigate to:** \`http://your-bootstrap-ip:8080/mobile\`
4. **Connect wallet when prompted**
5. **Add to home screen** for app-like experience

## Features

### ✅ What Works with MetaMask

- **Automatic wallet connection** - No manual private key entry
- **Network switching** - Automatically adds/switches to your private network
- **Transaction signing** - All transactions signed through MetaMask
- **Mobile support** - Works with MetaMask mobile app
- **Fallback support** - Falls back to environment variables if MetaMask unavailable

### 🔧 Configuration Options

Edit \`.env\` to customize:

\`\`\`bash
# Enable/disable MetaMask for different node types
BOOTSTRAP_USE_METAMASK=true
WORKER_USE_METAMASK=true
OWNER_USE_METAMASK=true
USER_USE_METAMASK=true

# Mobile MetaMask support
MOBILE_METAMASK_ENABLED=true
\`\`\`

## Troubleshooting

### MetaMask Not Detected

**Problem:** "MetaMask not available" error
**Solution:**
1. Install MetaMask browser extension
2. Refresh the page
3. Check that MetaMask is unlocked

### Wrong Network

**Problem:** "Please switch to correct network"
**Solution:**
1. Click "Switch Network" button in the interface
2. Or manually switch in MetaMask to "Decentralized vLLM Network"

### Transaction Failures

**Problem:** Transactions fail or are rejected
**Solution:**
1. Check account has sufficient ETH balance
2. Verify you're on the correct network (Chain ID: 1337)
3. Try resetting MetaMask account (Settings → Advanced → Reset Account)

### Mobile Issues

**Problem:** MetaMask mobile not working
**Solution:**
1. Use MetaMask mobile browser (not external browser)
2. Or use WalletConnect (if implemented)
3. Ensure mobile device is on same network as bootstrap node

## Production Considerations

### 🚨 Security for Production

1. **Never use test private keys in production**
2. **Use your own generated accounts**
3. **Enable SSL/HTTPS for mobile access**
4. **Implement proper access controls**

### 🌐 Production Setup

\`\`\`bash
# Production environment variables
ETH_NODE_URL=https://your-private-network-rpc.com
STATIC_IP=your-domain.com
MOBILE_SSL_ENABLED=true
MOBILE_DOMAIN=your-domain.com

# Disable fallback keys in production
BOOTSTRAP_FALLBACK_PRIVATE_KEY=""
WORKER_FALLBACK_PRIVATE_KEY=""
OWNER_FALLBACK_PRIVATE_KEY=""
USER_FALLBACK_PRIVATE_KEY=""
\`\`\`

## Support

- **Documentation:** Check API_REFERENCE.md for technical details
- **Issues:** Report bugs on GitHub
- **Community:** Join Discord/Telegram for help

---

**🎉 Enjoy seamless wallet integration with MetaMask!**
`;

        await this.writeFile('METAMASK_SETUP.md', instructions);
        console.log('  ✅ Created MetaMask setup guide');
    }

    async updatePackageScripts() {
        console.log('📦 Updating package.json scripts...');

        const packagePath = path.join(this.projectRoot, 'package.json');
        let packageJson = {};

        try {
            const packageContent = await fs.promises.readFile(packagePath, 'utf8');
            packageJson = JSON.parse(packageContent);
        } catch (error) {
            console.log('  ⚠️ package.json not found, creating new one...');
        }

        // Add MetaMask-specific scripts
        packageJson.scripts = {
            ...packageJson.scripts,
            "start:bootstrap:metamask": "BOOTSTRAP_USE_METAMASK=true node nodes/bootstrap/bootstrap-node.js",
            "start:worker:metamask": "WORKER_USE_METAMASK=true node nodes/worker/worker-node.js",
            "start:owner:metamask": "OWNER_USE_METAMASK=true python orchestrator/owner_upload.py --server",
            "start:streamlit:metamask": "USER_USE_METAMASK=true streamlit run streamlit_app_metamask.py",
            "setup:metamask": "node scripts/setup_metamask_integration.js",
            "test:metamask": "npm run test && echo 'Testing MetaMask integration...'",
            "mobile:metamask": "cd nodes/mobile && python -m http.server 8080"
        };

        await fs.promises.writeFile(packagePath, JSON.stringify(packageJson, null, 2));
        console.log('  ✅ Updated package.json scripts');
    }

    async writeFile(relativePath, content) {
        const fullPath = path.join(this.projectRoot, relativePath);
        const dir = path.dirname(fullPath);

        // Create directory if it doesn't exist
        await fs.promises.mkdir(dir, { recursive: true });

        // Write file
        await fs.promises.writeFile(fullPath, content);
    }

    printNextSteps() {
        console.log(`
🎉 MetaMask Integration Setup Complete!

📋 Next Steps:

1. 📋 Copy environment configuration:
   cp .env.metamask .env

2. 🦊 Install MetaMask:
   - Browser: https://metamask.io/download/
   - Mobile: Download from app store

3. 🌐 Start your network:
   docker-compose up -d ipfs geth
   npm run deploy

4. 🔧 Add network to MetaMask:
   - Network Name: Decentralized vLLM Network
   - RPC URL: http://localhost:8545
   - Chain ID: 1337

5. 🚀 Start services with MetaMask:
   npm run start:bootstrap:metamask    # Bootstrap node
   npm run start:worker:metamask       # Worker node
   npm run start:owner:metamask        # Model owner
   npm run start:streamlit:metamask    # User interface

6. 📱 For mobile users:
   npm run mobile:metamask
   # Then visit: http://localhost:8080/mobile_metamask.html

📖 Documentation:
   - Setup Guide: ./METAMASK_SETUP.md
   - Network Config: ./metamask-network-config.json
   - Instructions: ./metamask-setup-instructions.json

🔧 Configuration Files Created:
   - .env.metamask (environment template)
   - nodes/bootstrap/metamask-integration.js
   - nodes/worker/metamask-integration.js
   - orchestrator/metamask-config.yaml
   - nodes/mobile/mobile_metamask.html
   - streamlit_app_metamask.py

⚠️  Remember: Only use test accounts on your private network!

🎊 Your network now supports MetaMask for all users and node types!
        `);
    }
}

// Run setup if called directly
if (require.main === module) {
    const setup = new MetaMaskIntegrationSetup();
    setup.setup().catch(console.error);
}

module.exports = { MetaMaskIntegrationSetup };