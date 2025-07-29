const { Web3, HttpProvider } = require('web3');
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Enhanced configuration with auto-discovery
let config = {
    eth_node: process.env.ETH_NODE || 'http://localhost:8545',
    ipfs_host: process.env.IPFS_HOST || 'localhost',
    ipfs_port: process.env.IPFS_PORT || 5001,
    contract_address: '',
    model_registry_address: '',
    default_account: '',
    private_key: '',
    network_id: 'decentralized-ai-network',
    bootstrap_nodes: [],
    bootstrap_url: process.env.BOOTSTRAP_URL || process.env.DOCKER_BOOTSTRAP_URL || 'http://localhost:8080'
};

let userDataPath = '';

// Enhanced auto-configuration with Docker support
async function autoDiscoverConfig() {
    console.log('Auto-discovering network configuration...');
    
    // Priority order for bootstrap discovery:
    // 1. Environment variable BOOTSTRAP_URL
    // 2. Docker service name resolution
    // 3. Local network scan
    // 4. Known public endpoints
    
    const bootstrapCandidates = [
        process.env.BOOTSTRAP_URL,
        process.env.DOCKER_BOOTSTRAP_URL,
        'http://bootstrap:8080', // Docker service name
        'http://bootstrap-node:8080', // Alternative Docker service name
        'http://localhost:8080',
        'http://192.168.1.103:8080' // Your local IP
    ].filter(Boolean);
    
    // Try each candidate
    for (const url of bootstrapCandidates) {
        try {
            console.log(`Trying bootstrap at ${url}...`);
            const response = await axios.get(`${url}/api/network-config`, { 
                timeout: 3000,
                validateStatus: () => true 
            });
            
            if (response.status === 200 && response.data) {
                console.log(`✅ Found bootstrap node at ${url}`);
                
                // Extract configuration
                const networkConfig = response.data;
                config.bootstrap_url = url;
                config.network_id = networkConfig.network_id;
                config.contract_address = networkConfig.contract_address;
                config.model_registry_address = networkConfig.model_registry_address;
                config.bootstrap_nodes = networkConfig.bootstrap_nodes || [];
                
                // Use first bootstrap node for eth/ipfs if available
                if (networkConfig.bootstrap_nodes && networkConfig.bootstrap_nodes.length > 0) {
                    const primary = networkConfig.bootstrap_nodes[0];
                    config.eth_node = primary.url || config.eth_node;
                    if (primary.ipfs) {
                        const [host, port] = primary.ipfs.split(':');
                        config.ipfs_host = host;
                        config.ipfs_port = parseInt(port) || 5001;
                    }
                }
                
                return true;
            }
        } catch (error) {
            console.log(`❌ Bootstrap at ${url} not available`);
        }
    }
    
    console.log('⚠️  No bootstrap nodes found, using local configuration');
    return false;
}

// Generate wallet if needed
async function ensureWallet() {
    if (!config.default_account || !config.private_key) {
        console.log('Generating new wallet...');
        const Web3 = require('web3');
        const web3 = new Web3();
        const account = web3.eth.accounts.create();
        config.default_account = account.address;
        config.private_key = account.privateKey;
        console.log(`✅ Generated wallet: ${account.address}`);
    }
}

// Initialize with auto-configuration
async function initialize() {
    await autoDiscoverConfig();
    await ensureWallet();
    return config;
}

// Set configuration
function setConfig(newConfig) {
    config = { ...config, ...newConfig };
    console.log('Network config updated');
}

// Get current configuration
function getConfig() {
    return { ...config };
}

// Initialize Web3 with retry logic
function initWeb3() {
    try {
        console.log('Initializing Web3 with:', config.eth_node);
        const w3 = new Web3(new HttpProvider(config.eth_node));
        
        // Load contract ABI
        let contractAbi;
        try {
            const artifactPath = path.join(__dirname, '../../../../artifacts/contracts/InferenceCoordinator.sol/InferenceCoordinator.json');
            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                contractAbi = artifact.abi;
            } else {
                // Simplified ABI fallback
                contractAbi = getSimplifiedABI();
            }
        } catch (e) {
            contractAbi = getSimplifiedABI();
        }
        
        let contract = null;
        if (config.contract_address && config.contract_address !== '') {
            contract = new w3.eth.Contract(contractAbi, config.contract_address);
        }
        
        return { w3, contract };
    } catch (e) {
        console.error("Failed to initialize Web3:", e);
        return { w3: null, contract: null };
    }
}

// Simplified ABI for fallback
function getSimplifiedABI() {
    return [
        {
            "inputs": [{"name": "promptCID", "type": "string"}, {"name": "modelCID", "type": "string"}],
            "name": "submitPromptWithCID",
            "outputs": [{"name": "", "type": "uint256"}],
            "stateMutability": "payable",
            "type": "function"
        },
        {
            "anonymous": false,
            "inputs": [
                {"indexed": true, "name": "jobId", "type": "uint256"},
                {"indexed": true, "name": "controller", "type": "address"},
                {"name": "promptCID", "type": "string"},
                {"name": "modelId", "type": "string"},
                {"name": "modelCID", "type": "string"},
                {"name": "payment", "type": "uint256"}
            ],
            "name": "InferenceRequested",
            "type": "event"
        },
        {
            "anonymous": false,
            "inputs": [
                {"indexed": true, "name": "jobId", "type": "uint256"},
                {"indexed": true, "name": "worker", "type": "address"},
                {"name": "responseCID", "type": "string"}
            ],
            "name": "InferenceCompleted",
            "type": "event"
        }
    ];
}

// Export all existing functions plus new ones
module.exports = {
    // Configuration
    initialize,
    setConfig,
    getConfig,
    autoDiscoverConfig,
    ensureWallet,
    
    // Existing functions (import from original network-service.js)
    ...require('./network-service'),
    
    // Override initWeb3 with enhanced version
    initWeb3
};