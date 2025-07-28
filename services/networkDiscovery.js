const Web3 = require('web3');
const EventEmitter = require('events');

class NetworkDiscovery extends EventEmitter {
    constructor(config) {
        super();
        this.config = config;
        this.web3 = new Web3(config.ethNodeUrl);
        this.peers = new Map();
        this.healthChecks = new Map();
        this.discoveryInterval = null;
        this.isBootstrap = config.nodeType === 'bootstrap';
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
    }

    async registerNode() {
        try {
            const nodeInfo = {
                nodeId: this.generateNodeId(),
                nodeType: this.config.nodeType,
                endpoint: this.config.endpoint,
                capabilities: this.getNodeCapabilities(),
                timestamp: Date.now(),
                version: this.config.version || '1.0.0'
            };

            // Register on blockchain (simplified)
            console.log(`📝 Registering ${this.config.nodeType} node:`, nodeInfo.nodeId.substring(0, 8) + '...');
            
            this.emit('nodeRegistered', nodeInfo);
            return nodeInfo;
        } catch (error) {
            console.error('❌ Failed to register node:', error.message);
            throw error;
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
            this.discoverFromBlockchain(),
            this.discoverFromDHT(),
            this.discoverFromBootstrap()
        ]);
    }

    async discoverFromBlockchain() {
        // Query blockchain for active nodes
        // This would read from a NodeRegistry contract
        console.log('🔍 Discovering peers from blockchain...');
        
        // Mock implementation - in real version, query contract events
        const mockPeers = [
            { id: 'peer1', type: 'worker', endpoint: 'worker1.example.com:8000' },
            { id: 'peer2', type: 'worker', endpoint: 'worker2.example.com:8000' }
        ];

        mockPeers.forEach(peer => this.addPeer(peer));
    }

    async discoverFromDHT() {
        // Use IPFS DHT for peer discovery
        console.log('🔍 Discovering peers from IPFS DHT...');
        // Implementation would use IPFS peer discovery
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

    addPeer(peerInfo) {
        const peerId = peerInfo.id || peerInfo.endpoint;
        if (!this.peers.has(peerId)) {
            this.peers.set(peerId, {
                ...peerInfo,
                addedAt: Date.now(),
                lastSeen: Date.now(),
                status: 'discovered'
            });
            
            console.log(`✅ New peer discovered: ${peerInfo.type} at ${peerInfo.endpoint}`);
            this.emit('peerDiscovered', peerInfo);
        } else {
            // Update last seen
            this.peers.get(peerId).lastSeen = Date.now();
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
    }

    async checkSinglePeerHealth(peerId, peer) {
        try {
            // Implement health check based on peer type
            const isHealthy = await this.pingPeer(peer);
            
            if (isHealthy) {
                peer.status = 'healthy';
                peer.lastSeen = Date.now();
            } else {
                peer.status = 'unhealthy';
            }
            
            // Remove peers that haven't been seen for too long
            if (Date.now() - peer.lastSeen > 300000) { // 5 minutes
                this.peers.delete(peerId);
                console.log(`🗑️ Removed stale peer: ${peerId}`);
                this.emit('peerRemoved', peer);
            }
            
        } catch (error) {
            console.warn(`⚠️ Health check failed for ${peerId}:`, error.message);
        }
    }

    async pingPeer(peer) {
        // Implement ping based on peer type
        switch (peer.type) {
            case 'worker':
                return await this.pingWorker(peer);
            case 'bootstrap':
                return await this.pingBootstrap(peer);
            default:
                return false;
        }
    }

    async pingWorker(worker) {
        try {
            const response = await fetch(`http://${worker.endpoint}/health`, {
                timeout: 5000
            });
            return response.ok;
        } catch {
            return false;
        }
    }

    async pingBootstrap(bootstrap) {
        try {
            const response = await fetch(`http://${bootstrap.endpoint}/peers`, {
                timeout: 5000
            });
            return response.ok;
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
        // Return number of currently processing jobs
        return 0; // Implement based on your job system
    }

    getAvailability() {
        // Return current availability percentage
        return 100; // Implement based on resource usage
    }

    async getPerformanceMetrics() {
        // Return performance metrics
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
        return 'node_' + Math.random().toString(36).substr(2, 16);
    }

    // Public API methods
    getPeers(type = null) {
        const peers = Array.from(this.peers.values());
        return type ? peers.filter(p => p.type === type) : peers;
    }

    getHealthyWorkers() {
        return this.getPeers('worker').filter(p => p.status === 'healthy');
    }

    async selectWorkerForJob(jobRequirements = {}) {
        const healthyWorkers = this.getHealthyWorkers();
        
        if (healthyWorkers.length === 0) {
            throw new Error('No healthy workers available');
        }

        // Simple load balancing - select worker with least recent activity
        const selectedWorker = healthyWorkers.reduce((best, current) => 
            current.lastJobAt < best.lastJobAt ? current : best
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
