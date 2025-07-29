const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Web3 } = require('web3');

// Initialize Express app
const app = express();
app.use(cors());
app.use(express.json());

// Configuration
const CONFIG_FILE = path.join(__dirname, '../../config.json');
let config = {};

// Load configuration
function loadConfig() {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
            console.log('Configuration loaded');
        } else {
            // Default configuration
            config = {
                eth_node: process.env.ETH_NODE || 'http://localhost:8545',
                ipfs_host: process.env.IPFS_HOST || 'localhost',
                ipfs_port: process.env.IPFS_PORT || 5001,
                contract_address: process.env.CONTRACT_ADDRESS || '',
                model_registry_address: process.env.MODEL_REGISTRY_ADDRESS || '',
                network_id: process.env.NETWORK_ID || 'decentralized-ai-network',
                bootstrap_nodes: []
            };
        }
    } catch (error) {
        console.error('Error loading config:', error);
    }
}

// Get network information
async function getNetworkStatus() {
    try {
        const web3 = new Web3(config.eth_node);
        const networkId = await web3.eth.net.getId();
        const blockNumber = await web3.eth.getBlockNumber();
        const peerCount = await web3.eth.net.getPeerCount();
        
        return {
            online: true,
            networkId,
            blockNumber,
            peerCount
        };
    } catch (error) {
        return {
            online: false,
            error: error.message
        };
    }
}

// API Endpoints

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get network configuration for new users
app.get('/api/network-config', async (req, res) => {
    try {
        const networkStatus = await getNetworkStatus();
        
        // Build list of active bootstrap nodes
        const activeBootstrapNodes = [
            { 
                url: `http://${req.hostname}:8545`, 
                ipfs: `${req.hostname}:5001`,
                api: `http://${req.hostname}:8080`
            }
        ];
        
        // Add other known bootstrap nodes from config
        if (config.bootstrap_nodes && config.bootstrap_nodes.length > 0) {
            activeBootstrapNodes.push(...config.bootstrap_nodes);
        }
        
        const response = {
            network_id: config.network_id,
            contract_address: config.contract_address,
            model_registry_address: config.model_registry_address,
            bootstrap_nodes: activeBootstrapNodes,
            network_status: networkStatus,
            timestamp: new Date().toISOString()
        };
        
        res.json(response);
    } catch (error) {
        console.error('Error getting network config:', error);
        res.status(500).json({ error: 'Failed to get network configuration' });
    }
});

// Get list of available models
app.get('/api/models', async (req, res) => {
    try {
        // This would query the ModelRegistry contract
        const models = [
            {
                id: 'llama2-7b',
                name: 'Llama 2 7B',
                cid: 'QmExampleModelCID1',
                size: '7GB',
                type: 'text-generation'
            },
            {
                id: 'codellama-7b',
                name: 'Code Llama 7B',
                cid: 'QmExampleModelCID2',
                size: '7GB',
                type: 'code-generation'
            }
        ];
        
        res.json({ models });
    } catch (error) {
        console.error('Error getting models:', error);
        res.status(500).json({ error: 'Failed to get models' });
    }
});

// Get network statistics
app.get('/api/stats', async (req, res) => {
    try {
        const web3 = new Web3(config.eth_node);
        const latestBlock = await web3.eth.getBlock('latest');
        const gasPrice = await web3.eth.getGasPrice();
        
        // This would query the InferenceCoordinator contract for real stats
        const stats = {
            total_jobs: 0,
            active_workers: 0,
            completed_inferences: 0,
            average_response_time: 0,
            network_hash_rate: 0,
            current_block: latestBlock.number,
            gas_price: web3.utils.fromWei(gasPrice, 'gwei'),
            timestamp: new Date().toISOString()
        };
        
        res.json(stats);
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Failed to get network statistics' });
    }
});

// Register new node (for network growth)
app.post('/api/register-node', async (req, res) => {
    try {
        const { nodeType, address, capabilities, endpoint } = req.body;
        
        // Validate input
        if (!nodeType || !address) {
            return res.status(400).json({ error: 'Missing required fields' });
        }
        
        // This would register the node in a database or smart contract
        console.log('New node registration:', {
            nodeType,
            address,
            capabilities,
            endpoint,
            ip: req.ip
        });
        
        res.json({
            success: true,
            message: 'Node registered successfully',
            network_config: {
                contract_address: config.contract_address,
                model_registry_address: config.model_registry_address
            }
        });
    } catch (error) {
        console.error('Error registering node:', error);
        res.status(500).json({ error: 'Failed to register node' });
    }
});

// Peer discovery endpoint
app.get('/api/peers', async (req, res) => {
    try {
        // This would return a list of known active peers
        const peers = [
            {
                id: 'peer1',
                type: 'worker',
                endpoint: 'http://worker1.network:8080',
                capabilities: ['inference', 'gpu'],
                status: 'active'
            },
            {
                id: 'peer2',
                type: 'storage',
                endpoint: 'http://storage1.network:8080',
                capabilities: ['ipfs', 'large-storage'],
                status: 'active'
            }
        ];
        
        res.json({ peers });
    } catch (error) {
        console.error('Error getting peers:', error);
        res.status(500).json({ error: 'Failed to get peers' });
    }
});

// WebSocket support for real-time updates
const WebSocket = require('ws');
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('New WebSocket connection');
    
    // Send initial network status
    getNetworkStatus().then(status => {
        ws.send(JSON.stringify({
            type: 'network-status',
            data: status
        }));
    });
    
    // Send updates every 30 seconds
    const interval = setInterval(async () => {
        if (ws.readyState === WebSocket.OPEN) {
            const status = await getNetworkStatus();
            ws.send(JSON.stringify({
                type: 'network-status',
                data: status
            }));
        }
    }, 30000);
    
    ws.on('close', () => {
        clearInterval(interval);
    });
});

// Start server
const PORT = process.env.PORT || 8080;
loadConfig();

server.listen(PORT, () => {
    console.log(`Bootstrap API server running on port ${PORT}`);
    console.log(`Network ID: ${config.network_id}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        console.log('Server closed');
        process.exit(0);
    });
});