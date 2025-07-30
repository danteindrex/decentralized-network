#!/usr/bin/env node

/**
 * Bootstrap/Rendez-vous Node with Real Peer Discovery
 * - Network coordinator and peer discovery hub
 * - Must have static IP + port 30303 open
 * - Runs full node with mining
 * - Job: coordinate network growth and peer management
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');
const NetworkDiscovery = require('../../services/networkDiscovery');

class BootstrapNode {
    constructor(config = {}) {
        this.config = {
            chainId: 1337,
            networkId: 1337,
            port: 30303,
            rpcPort: 8545,
            wsPort: 8546,
            dataDir: './data/bootstrap',
            staticIP: config.staticIP || 'localhost',
            bootnodes: config.bootnodes || [],
            ...config
        };
        
        this.nodeKey = this.generateNodeKey();
        this.enode = this.generateEnode();
        this.networkDiscovery = null;
        this.apiServer = null;
        this.peers = new Map();
        this.jobQueue = [];
    }

    generateNodeKey() {
        // Generate or load existing node key
        const keyPath = path.join(this.config.dataDir, 'nodekey');
        if (fs.existsSync(keyPath)) {
            return fs.readFileSync(keyPath, 'utf8').trim();
        }
        
        // Generate new key (simplified - in production use proper crypto)
        const crypto = require('crypto');
        const key = crypto.randomBytes(32).toString('hex');
        
        // Ensure data directory exists
        if (!fs.existsSync(this.config.dataDir)) {
            fs.mkdirSync(this.config.dataDir, { recursive: true });
        }
        
        fs.writeFileSync(keyPath, key);
        return key;
    }

    generateEnode() {
        // Generate enode URL for this bootstrap node
        const publicKey = this.derivePublicKey(this.nodeKey);
        return `enode://${publicKey}@${this.config.staticIP}:${this.config.port}`;
    }

    derivePublicKey(privateKey) {
        // Simplified public key derivation (use proper secp256k1 in production)
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(privateKey).digest('hex');
    }

    async start() {
        console.log('🚀 Starting Bootstrap Node with Real Peer Discovery...');
        console.log(`📍 Static IP: ${this.config.staticIP}`);
        console.log(`🔗 Enode: ${this.enode}`);
        console.log(`⛓️  Chain ID: ${this.config.chainId}`);
        
        const gethArgs = [
            '--datadir', this.config.dataDir,
            '--networkid', this.config.networkId.toString(),
            '--port', this.config.port.toString(),
            '--http',
            '--http.addr', '0.0.0.0',
            '--http.port', this.config.rpcPort.toString(),
            '--http.api', 'eth,net,web3,personal,txpool,clique',
            '--ws',
            '--ws.addr', '0.0.0.0',
            '--ws.port', this.config.wsPort.toString(),
            '--ws.api', 'eth,net,web3',
            '--nodekey', path.join(this.config.dataDir, 'nodekey'),
            '--nat', 'extip:' + this.config.staticIP,
            '--gcmode', 'archive', // Keep full state for bootstrap
            '--syncmode', 'full'
        ];

        // Add bootnodes if any
        if (this.config.bootnodes.length > 0) {
            gethArgs.push('--bootnodes', this.config.bootnodes.join(','));
        }

        // Initialize genesis if needed
        await this.initGenesis();

        const geth = spawn('/usr/local/bin/geth', gethArgs, {
            stdio: 'inherit',
            env: { ...process.env }
        });

        geth.on('error', (err) => {
            console.error('❌ Failed to start geth:', err);
            process.exit(1);
        });

        geth.on('exit', (code) => {
            console.log(`🛑 Bootstrap node exited with code ${code}`);
            process.exit(code);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down bootstrap node...');
            geth.kill('SIGTERM');
        });

        // Save enode info for other nodes
        this.saveBootstrapInfo();
        
        // Start peer discovery and API server
        await this.startPeerDiscovery();
        await this.startAPIServer();
    }

    async initGenesis() {
        const genesisPath = path.join(__dirname, '../../genesis.json');
        if (!fs.existsSync(genesisPath)) {
            console.error('❌ Genesis file not found');
            process.exit(1);
        }

        const initArgs = ['init', '--datadir', this.config.dataDir, genesisPath];
        
        return new Promise((resolve, reject) => {
            const init = spawn('/usr/local/bin/geth', initArgs, { stdio: 'pipe' });
            
            init.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ Genesis initialized');
                    resolve();
                } else {
                    reject(new Error(`Genesis init failed with code ${code}`));
                }
            });
        });
    }

    saveBootstrapInfo() {
        const info = {
            enode: this.enode,
            staticIP: this.config.staticIP,
            port: this.config.port,
            rpcPort: this.config.rpcPort,
            wsPort: this.config.wsPort,
            chainId: this.config.chainId,
            timestamp: new Date().toISOString()
        };

        const infoPath = path.join(__dirname, '../bootstrap-info.json');
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
        console.log(`📝 Bootstrap info saved to ${infoPath}`);
    }

    async startPeerDiscovery() {
        console.log('🔍 Starting real peer discovery service...');
        
        const discoveryConfig = {
            nodeType: 'bootstrap',
            ethNodeUrl: `http://localhost:${this.config.rpcPort}`,
            endpoint: `${this.config.staticIP}:8080`,
            version: '1.0.0',
            enableLocalScanning: true // Enable local network scanning for development
        };

        this.networkDiscovery = new NetworkDiscovery(discoveryConfig);
        
        // Listen for peer events
        this.networkDiscovery.on('peerDiscovered', (peer) => {
            console.log(`🤝 Real peer discovered: ${peer.type} at ${peer.endpoint} (via ${peer.discoveryMethod})`);
            this.peers.set(peer.id || peer.endpoint, peer);
        });

        this.networkDiscovery.on('peerRemoved', (peer) => {
            console.log(`👋 Peer removed: ${peer.endpoint}`);
            this.peers.delete(peer.id || peer.endpoint);
        });

        await this.networkDiscovery.start();
        console.log('✅ Real peer discovery service started');
    }

    async startAPIServer() {
        console.log('🌐 Starting bootstrap API server...');
        
        const app = express();
        app.use(cors());
        app.use(express.json());

        // Network info endpoint
        app.get('/network/info', (req, res) => {
            const realPeers = this.networkDiscovery ? this.networkDiscovery.getRealPeers() : [];
            const registeredPeers = this.networkDiscovery ? this.networkDiscovery.getRegisteredPeers() : [];
            
            res.json({
                enode: this.enode,
                staticIP: this.config.staticIP,
                chainId: this.config.chainId,
                networkId: this.config.networkId,
                rpcEndpoint: `http://${this.config.staticIP}:${this.config.rpcPort}`,
                wsEndpoint: `ws://${this.config.staticIP}:${this.config.wsPort}`,
                peerCount: this.peers.size,
                realPeerCount: realPeers.length,
                registeredPeerCount: registeredPeers.length,
                uptime: process.uptime()
            });
        });

        // Network configuration endpoint for auto-config
        app.get('/api/network-config', (req, res) => {
            // Load deployment info
            const deploymentPath = path.join(__dirname, '../../deployment.json');
            let contracts = {};
            if (fs.existsSync(deploymentPath)) {
                contracts = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
            }
            
            // Get list of known bootstrap nodes (including real discovered ones)
            // For Render deployment, use the public URL with RPC proxy
            const publicUrl = process.env.RENDER_EXTERNAL_URL || `http://${this.config.staticIP}:8080`;
            const bootstrapNodes = [
                { 
                    url: `${publicUrl}/rpc`, 
                    ipfs: `${this.config.staticIP}:5001`,
                    isProxy: true 
                }
            ];
            
            // Add other known bootstrap nodes from real peers
            const realPeers = this.networkDiscovery ? this.networkDiscovery.getRealPeers() : [];
            for (const peer of realPeers) {
                if (peer.type === 'bootstrap' && peer.endpoint) {
                    const [host, port] = peer.endpoint.split(':');
                    bootstrapNodes.push({
                        url: `http://${host}:8545`,
                        ipfs: `${host}:5001`
                    });
                }
            }
            
            res.json({
                network_id: 'decentralized-ai-network',
                chain_id: this.config.chainId,
                contract_address: contracts.InferenceCoordinator || '',
                model_registry_address: contracts.ModelRegistry || '',
                node_profile_registry_address: contracts.NodeProfileRegistry || '',
                bootstrap_nodes: bootstrapNodes,
                version: '1.0.0',
                timestamp: Date.now()
            });
        });

        // Get all peers (including real and registered)
        app.get('/peers', (req, res) => {
            const { type } = req.query;
            let peers = Array.from(this.peers.values());
            
            if (type) {
                peers = peers.filter(p => p.type === type);
            }
            
            // Add discovery method info
            const realPeers = this.networkDiscovery ? this.networkDiscovery.getRealPeers() : [];
            const registeredPeers = this.networkDiscovery ? this.networkDiscovery.getRegisteredPeers() : [];
            
            res.json({
                peers,
                count: peers.length,
                totalPeers: this.peers.size,
                realPeers: realPeers.length,
                registeredPeers: registeredPeers.length,
                discoveryMethods: {
                    gethConnections: realPeers.filter(p => p.discoveryMethod === 'geth-connection').length,
                    localScan: realPeers.filter(p => p.discoveryMethod === 'local-scan').length,
                    registration: registeredPeers.length
                }
            });
        });

        // Get healthy workers for job routing
        app.get('/workers', (req, res) => {
            const healthyWorkers = this.networkDiscovery ? 
                this.networkDiscovery.getHealthyWorkers() : [];
            
            res.json({
                workers: healthyWorkers,
                count: healthyWorkers.length
            });
        });

        // Register new peer (enhanced with real peer discovery)
        app.post('/peers/register', (req, res) => {
            const { nodeId, nodeType, endpoint, capabilities } = req.body;
            
            if (!nodeId || !nodeType || !endpoint) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            // Use the network discovery service to register the peer
            const peerInfo = this.networkDiscovery.registerPeer({
                id: nodeId,
                nodeType,
                endpoint,
                capabilities,
                version: req.body.version || '1.0.0'
            });

            // Also add to our local peers map
            this.peers.set(nodeId, peerInfo);
            
            res.json({ 
                success: true, 
                message: 'Peer registered successfully',
                peerInfo,
                bootstrapInfo: {
                    enode: this.enode,
                    rpcEndpoint: `http://${this.config.staticIP}:${this.config.rpcPort}`,
                    networkId: this.config.networkId
                }
            });
        });

        // Worker heartbeat endpoint
        app.post('/heartbeat', (req, res) => {
            const { nodeId, status } = req.body;
            
            if (this.peers.has(nodeId)) {
                const peer = this.peers.get(nodeId);
                peer.lastHeartbeat = Date.now();
                peer.status = status || 'active';
                peer.performance = req.body.performance;
                
                res.json({ success: true, message: 'Heartbeat received' });
            } else {
                res.status(404).json({ error: 'Peer not found' });
            }
        });

        // Job routing - select best worker for job
        app.post('/jobs/route', (req, res) => {
            const { jobRequirements } = req.body;
            
            try {
                const worker = this.networkDiscovery ? 
                    this.networkDiscovery.selectWorkerForJob(jobRequirements) : null;
                
                if (worker) {
                    res.json({ worker, success: true });
                } else {
                    res.status(503).json({ error: 'No available workers' });
                }
            } catch (error) {
                res.status(503).json({ error: error.message });
            }
        });

        // Health check
        app.get('/health', (req, res) => {
            const realPeers = this.networkDiscovery ? this.networkDiscovery.getRealPeers() : [];
            
            res.json({ 
                status: 'healthy',
                nodeType: 'bootstrap',
                uptime: process.uptime(),
                peers: this.peers.size,
                realPeers: realPeers.length,
                timestamp: Date.now()
            });
        });

        // Debug endpoint to see discovery details
        app.get('/debug/discovery', (req, res) => {
            if (!this.networkDiscovery) {
                return res.json({ error: 'Network discovery not initialized' });
            }
            
            res.json({
                realPeers: this.networkDiscovery.getRealPeers(),
                registeredPeers: this.networkDiscovery.getRegisteredPeers(),
                allPeers: this.networkDiscovery.getPeers(),
                healthyWorkers: this.networkDiscovery.getHealthyWorkers()
            });
        });

        // RPC Proxy endpoint - Forward RPC calls to local geth
        app.post('/rpc', async (req, res) => {
            try {
                const axios = require('axios');
                const response = await axios.post(`http://localhost:8545`, req.body, {
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    timeout: 30000
                });
                res.json(response.data);
            } catch (error) {
                console.error('RPC Proxy Error:', error.message);
                res.status(500).json({
                    jsonrpc: "2.0",
                    error: {
                        code: -32603,
                        message: "Internal error: " + error.message
                    },
                    id: req.body.id || null
                });
            }
        });

        // Start server
        const PORT = 8080;
        this.apiServer = app.listen(PORT, '0.0.0.0', () => {
            console.log(`✅ Bootstrap API server running on port ${PORT}`);
            console.log(`📡 Network endpoint: http://${this.config.staticIP}:${PORT}`);
            console.log(`🔍 Real peer discovery enabled with local scanning`);
        });
    }
}

// CLI usage
if (require.main === module) {
    const config = {
        staticIP: process.env.STATIC_IP || 'localhost'
    };

    const bootstrap = new BootstrapNode(config);
    bootstrap.start().catch(console.error);
}

module.exports = BootstrapNode;