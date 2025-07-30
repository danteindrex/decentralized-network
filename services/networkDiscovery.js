const { Web3 } = require('web3');
const EventEmitter = require('events');
const axios = require('axios');

class NetworkDiscovery extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.web3 = new Web3(config.ethNodeUrl);
        this.peers = new Map();
        this.healthChecks = new Map();
        this.discoveryInterval = null;
        this.isBootstrap = config.nodeType === 'bootstrap';
        this.nodeId = this.generateNodeId();
        
        // Real peer discovery configuration
        this.realPeers = new Map(); // Track actual connected peers
        this.registeredPeers = new Map(); // Track peers that registered with us
    }

    async start() {
        console.log(`🌐 Starting network discovery (${this.config.nodeType} node)...`);
        
        // Start peer discovery
        this.startPeerDiscovery();
        
        // Start health monitoring
        this.startHealthMonitoring();
        
        // Register this node
        await this.registerNode();
        
        // Start broadcasting availability
        if (!this.isBootstrap) {
            this.startHeartbeat();
        }
        
        // Start real peer discovery methods
        this.startRealPeerDiscovery();
    }

    async registerNode() {
        try {
            const nodeInfo = {
                nodeId: this.nodeId,
                nodeType: this.config.nodeType,
                endpoint: this.config.endpoint,
                capabilities: this.getNodeCapabilities(),
                timestamp: Date.now(),
                version: this.config.version || '1.0.0'
            };

            console.log(`📝 Registering ${this.config.nodeType} node:`, nodeInfo.nodeId.substring(0, 8) + '...');
            
            this.emit('nodeRegistered', nodeInfo);
            return nodeInfo;
        } catch (error) {
            console.error('❌ Failed to register node:', error.message);
            throw error;
        }
    }

    startRealPeerDiscovery() {

        // Method 1: Monitor blockchain network info
        this.monitorBlockchainNetwork();
        
        // Method 2: Cross-reference with registered peers
        this.crossReferenceRegisteredPeers();
        
        // Method 3: Active network scanning (for local development)
        if (this.config.enableLocalScanning) {
            this.startLocalNetworkScanning();
        }
    }

    async monitorBlockchainNetwork() {
        setInterval(async () => {
            try {
                // Get basic network info instead of peer list
                const peerCount = await this.web3.eth.net.getPeerCount();
                const networkId = await this.web3.eth.net.getId();
                const isListening = await this.web3.eth.net.isListening();
                
                if (peerCount > 0) {
                    console.log(`🔗 Blockchain network: ${peerCount} peers, Network ID: ${networkId}, Listening: ${isListening}`);
                }
                
                // Try to discover active miners from recent blocks
                await this.discoverMinersFromBlocks();
                
            } catch (error) {
                console.warn('⚠️ Failed to get blockchain network info:', error.message);
            }
        }, 30000); // Every 30 seconds
    }

    async discoverMinersFromBlocks() {
        try {
            // Get recent blocks to find active miners
            const latestBlock = await this.web3.eth.getBlockNumber();
            const latestBlockNum = Number(latestBlock); // Convert BigInt to number safely
            
            // Only check last few blocks to avoid performance issues
            const blocksToCheck = Math.min(5, latestBlockNum);
            
            for (let i = 0; i < blocksToCheck; i++) {
                const blockNumber = latestBlockNum - i;
                const block = await this.web3.eth.getBlock(blockNumber);
                
                if (block && block.miner) {
                    console.log(`📦 Block ${blockNumber} mined by ${block.miner.substring(0, 8)}...`);
                    
                    // In a real implementation, we'd query a registry contract
                    // to map miner addresses to network endpoints
                }
            }
        } catch (error) {
            console.warn('⚠️ Failed to discover miners from blocks:', error.message);
        }
    }

    crossReferenceRegisteredPeers() {
        setInterval(() => {
            // Cross-reference registered peers with actual connections
            for (const [peerId, registeredPeer] of this.registeredPeers.entries()) {
                // Check if this registered peer is actually reachable
                this.verifyRegisteredPeer(registeredPeer).then(isHealthy => {
                    if (isHealthy) {
                        registeredPeer.status = 'healthy';
                        registeredPeer.lastSeen = Date.now();
                        this.addPeer(registeredPeer);
                    } else {
                        registeredPeer.status = 'disconnected';
                    }
                }).catch(error => {
                    console.warn(`⚠️ Failed to verify peer ${peerId}:`, error.message);
                });
            }
        }, 45000); // Every 45 seconds
    }

    startLocalNetworkScanning() {
        // For development: scan local network for other instances
        setInterval(async () => {
            await this.scanLocalNetwork();
        }, 60000); // Every minute
    }

    async scanLocalNetwork() {
        try {
            // Scan common ports on localhost and local IPs
            const localIPs = ['127.0.0.1', 'localhost'];
            const ports = [8080, 8081, 8082, 8083, 8084, 8085]; // Common dev ports
            
            for (const ip of localIPs) {
                for (const port of ports) {
                    try {
                        const response = await axios.get(`http://${ip}:${port}/health`, { 
                            timeout: 1000 
                        });
                        
                        if (response.data && response.data.nodeType && response.data.nodeId !== this.nodeId) {
                            const peer = {
                                id: response.data.nodeId,
                                type: response.data.nodeType,
                                endpoint: `${ip}:${port}`,
                                discoveryMethod: 'local-scan',
                                status: 'healthy',
                                uptime: response.data.uptime
                            };
                            
                            this.addRealPeer(peer);
                            console.log(`🏠 Found local peer: ${peer.type} at ${peer.endpoint}`);
                        }
                    } catch (e) {
                        // Port not responding, continue
                    }
                }
            }
        } catch (error) {
            console.warn('⚠️ Local network scan error:', error.message);
        }
    }

    addRealPeer(peerInfo) {
        const peerId = peerInfo.id || peerInfo.endpoint;
        
        // Don't add ourselves
        if (peerId === this.nodeId) return;
        
        if (!this.realPeers.has(peerId)) {
            this.realPeers.set(peerId, {
                ...peerInfo,
                addedAt: Date.now(),
                lastSeen: Date.now()
            });
            
            console.log(`✅ Real peer connected: ${peerInfo.type} at ${peerInfo.endpoint} (via ${peerInfo.discoveryMethod})`);
            
            // Also add to main peers list
            this.addPeer(peerInfo);
        } else {
            // Update last seen
            this.realPeers.get(peerId).lastSeen = Date.now();
        }
    }

    // Method to register a peer (called from API)
    registerPeer(peerInfo) {
        const peerId = peerInfo.id || peerInfo.endpoint;
        
        this.registeredPeers.set(peerId, {
            ...peerInfo,
            registeredAt: Date.now(),
            lastSeen: Date.now(),
            status: 'registered'
        });
        
        console.log(`📝 Peer registered: ${peerInfo.nodeType} at ${peerInfo.endpoint}`);
        
        // Immediately try to verify this peer
        this.verifyRegisteredPeer(peerInfo);
        
        return peerInfo;
    }

    async verifyRegisteredPeer(peerInfo) {
        try {
            const response = await axios.get(`http://${peerInfo.endpoint}/health`, { 
                timeout: 5000 
            });
            
            if (response.data && response.data.status === 'healthy') {
                peerInfo.status = 'verified';
                this.addPeer(peerInfo);
                console.log(`✅ Peer verified: ${peerInfo.nodeType} at ${peerInfo.endpoint}`);
                return true;
            }
            return false;
        } catch (error) {
            console.warn(`⚠️ Failed to verify peer ${peerInfo.endpoint}:`, error.message);
            peerInfo.status = 'unverified';
            return false;
        }
    }

    startPeerDiscovery() {
        this.discoveryInterval = setInterval(async () => {
            try {
                await this.discoverPeers();
            } catch (error) {
                console.error('🔍 Peer discovery error:', error.message);
            }
        }, 30000); // Every 30 seconds
    }

    async discoverPeers() {
        // Discover peers through multiple methods
        await Promise.all([
            this.discoverFromBootstrap()
        ]);
    }

    async discoverFromBootstrap() {
        if (this.isBootstrap) return;
        
        // Connect to known bootstrap nodes
        const bootstrapNodes = this.config.bootstrapNodes || [];
        for (const bootstrap of bootstrapNodes) {
            try {
                await this.connectToBootstrap(bootstrap);
            } catch (error) {
                console.warn(`⚠️ Failed to connect to bootstrap ${bootstrap}:`, error.message);
            }
        }
    }

    async connectToBootstrap(bootstrapUrl) {
        try {
            const response = await axios.get(`${bootstrapUrl}/peers`, { timeout: 5000 });
            
            if (response.data && response.data.peers) {
                response.data.peers.forEach(peer => {
                    if (peer.id !== this.nodeId) {
                        this.addPeer({
                            ...peer,
                            discoveryMethod: 'bootstrap-query'
                        });
                    }
                });
            }
        } catch (error) {
            throw new Error(`Bootstrap connection failed: ${error.message}`);
        }
    }

    addPeer(peerInfo) {
        const peerId = peerInfo.id || peerInfo.endpoint;
        
        // Don't add ourselves
        if (peerId === this.nodeId) return;
        
        if (!this.peers.has(peerId)) {
            this.peers.set(peerId, {
                ...peerInfo,
                addedAt: Date.now(),
                lastSeen: Date.now(),
                status: peerInfo.status || 'discovered'
            });
            
            console.log(`🤝 Peer discovered: ${peerInfo.type} at ${peerInfo.endpoint}`);
            this.emit('peerDiscovered', peerInfo);
        } else {
            // Update last seen
            const existingPeer = this.peers.get(peerId);
            existingPeer.lastSeen = Date.now();
            if (peerInfo.status) {
                existingPeer.status = peerInfo.status;
            }
        }
    }

    startHealthMonitoring() {
        setInterval(async () => {
            await this.checkPeerHealth();
        }, 60000); // Every minute
    }

    async checkPeerHealth() {
        const healthPromises = Array.from(this.peers.entries()).map(([peerId, peer]) => 
            this.checkSinglePeerHealth(peerId, peer)
        );
        
        await Promise.allSettled(healthPromises);
        
        // Clean up stale peers
        this.cleanupStalePeers();
    }

    cleanupStalePeers() {
        const staleThreshold = 300000; // 5 minutes
        const now = Date.now();
        
        for (const [peerId, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > staleThreshold) {
                this.peers.delete(peerId);
                this.realPeers.delete(peerId);
                this.registeredPeers.delete(peerId);
                
                console.log(`🗑️ Removed stale peer: ${peerId}`);
                this.emit('peerRemoved', peer);
            }
        }
    }

    async checkSinglePeerHealth(peerId, peer) {
        try {
            const isHealthy = await this.pingPeer(peer);
            
            if (isHealthy) {
                peer.status = 'healthy';
                peer.lastSeen = Date.now();
            } else {
                peer.status = 'unhealthy';
            }
            
        } catch (error) {
            console.warn(`⚠️ Health check failed for ${peerId}:`, error.message);
            peer.status = 'unreachable';
        }
    }

    async pingPeer(peer) {
        try {
            const response = await axios.get(`http://${peer.endpoint}/health`, {
                timeout: 5000
            });
            return response.status === 200;
        } catch {
            return false;
        }
    }

    startHeartbeat() {
        // Workers send periodic heartbeats to bootstrap
        setInterval(async () => {
            await this.sendHeartbeat();
        }, 45000); // Every 45 seconds
    }

    async sendHeartbeat() {
        const heartbeat = {
            nodeId: this.nodeId,
            nodeType: this.config.nodeType,
            status: await this.getNodeStatus(),
            timestamp: Date.now()
        };

        this.emit('heartbeat', heartbeat);
        console.log('💓 Heartbeat sent');
    }

    async getNodeStatus() {
        return {
            activeJobs: this.getActiveJobCount(),
            availability: this.getAvailability(),
            performance: await this.getPerformanceMetrics()
        };
    }

    getActiveJobCount() {
        return 0; // Implement based on your job system
    }

    getAvailability() {
        return 100; // Implement based on resource usage
    }

    async getPerformanceMetrics() {
        return {
            avgResponseTime: 12.5,
            successRate: 98.7,
            uptime: process.uptime()
        };
    }

    getNodeCapabilities() {
        switch (this.config.nodeType) {
            case 'worker':
                return {
                    models: ['gpt-3.5-turbo', 'dialogpt-small'],
                    maxConcurrentJobs: 5,
                    gpuEnabled: true,
                    ramGB: 16
                };
            case 'bootstrap':
                return {
                    coordination: true,
                    peerDiscovery: true,
                    jobRouting: true
                };
            default:
                return {};
        }
    }

    generateNodeId() {
        const crypto = require('crypto');
        return 'node_' + crypto.randomBytes(8).toString('hex');
    }

    // Public API methods
    getPeers(type = null) {
        const peers = Array.from(this.peers.values());
        return type ? peers.filter(p => p.type === type) : peers;
    }

    getHealthyWorkers() {
        return this.getPeers('worker').filter(p => p.status === 'healthy');
    }

    getRealPeers() {
        return Array.from(this.realPeers.values());
    }

    getRegisteredPeers() {
        return Array.from(this.registeredPeers.values());
    }

    async selectWorkerForJob(jobRequirements = {}) {
        const healthyWorkers = this.getHealthyWorkers();
        
        if (healthyWorkers.length === 0) {
            throw new Error('No healthy workers available');
        }

        // Simple load balancing - select worker with least recent activity
        const selectedWorker = healthyWorkers.reduce((best, current) => 
            (current.lastJobAt || 0) < (best.lastJobAt || 0) ? current : best
        );

        return selectedWorker;
    }

    async stop() {
        if (this.discoveryInterval) {
            clearInterval(this.discoveryInterval);
        }
        console.log('🛑 Network discovery stopped');
    }
}

module.exports = NetworkDiscovery;