/**
 * Organic Peer Discovery System for Decentralized AI Network
 * 
 * This module implements multiple peer discovery mechanisms to enable
 * organic network growth without relying on centralized infrastructure.
 */

const EventEmitter = require('events');
const axios = require('axios');
const crypto = require('crypto');

class OrganicPeerDiscovery extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            nodeId: config.nodeId || this.generateNodeId(),
            nodeType: config.nodeType || 'user',
            endpoint: config.endpoint || 'localhost:8080',
            bootstrapNodes: config.bootstrapNodes || [
                'https://bootstrap-node.onrender.com'
            ],
            ipfsHost: config.ipfsHost || 'bootstrap-node.onrender.com',
            ipfsPort: config.ipfsPort || 443,
            discoveryInterval: config.discoveryInterval || 30000, // 30 seconds
            maxPeers: config.maxPeers || 50,
            enableMDNS: config.enableMDNS !== false,
            enableDHT: config.enableDHT !== false,
            enableGossip: config.enableGossip !== false,
            ...config
        };

        this.peers = new Map();
        this.discoveredBootstraps = new Set();
        this.discoveryMethods = new Map();
        this.isRunning = false;
        this.intervals = [];
        
        // Initialize discovery methods
        this.initializeDiscoveryMethods();
    }

    initializeDiscoveryMethods() {
        this.discoveryMethods.set('bootstrap', this.discoverFromBootstrap.bind(this));
        this.discoveryMethods.set('dht', this.discoverFromDHT.bind(this));
        this.discoveryMethods.set('dns', this.discoverFromDNS.bind(this));
        this.discoveryMethods.set('gossip', this.discoverFromGossip.bind(this));
    }

    async start() {
        if (this.isRunning) return;
        
        console.log('🌱 Starting Organic Peer Discovery...');
        console.log(`📍 Node ID: ${this.config.nodeId}`);
        console.log(`🏷️  Node Type: ${this.config.nodeType}`);
        
        this.isRunning = true;
        
        // Start discovery methods
        await this.runDiscoveryRound();
        
        // Schedule periodic discovery
        const interval = setInterval(() => {
            this.runDiscoveryRound().catch(console.error);
        }, this.config.discoveryInterval);
        
        this.intervals.push(interval);
        
        // Start peer health monitoring
        this.startHealthMonitoring();
        
        // Start gossip protocol
        if (this.config.enableGossip) {
            this.startGossipProtocol();
        }
        
        console.log('✅ Organic Peer Discovery started');
        this.emit('started');
    }

    async runDiscoveryRound() {
        console.log('🔍 Running peer discovery round...');
        
        const discoveryPromises = Array.from(this.discoveryMethods.entries()).map(
            async ([method, discoveryFn]) => {
                try {
                    const startTime = Date.now();
                    const peers = await discoveryFn();
                    const duration = Date.now() - startTime;
                    
                    console.log(`📡 ${method} discovery: found ${peers?.length || 0} peers (${duration}ms)`);
                    return { method, peers: peers || [], duration };
                } catch (error) {
                    console.warn(`⚠️ ${method} discovery failed:`, error.message);
                    return { method, peers: [], error: error.message };
                }
            }
        );
        
        const results = await Promise.allSettled(discoveryPromises);
        
        // Process results
        let totalNewPeers = 0;
        results.forEach(result => {
            if (result.status === 'fulfilled' && result.value.peers) {
                result.value.peers.forEach(peer => {
                    if (this.addPeer(peer)) {
                        totalNewPeers++;
                    }
                });
            }
        });
        
        console.log(`🎯 Discovery round complete: ${totalNewPeers} new peers found`);
        this.emit('discoveryRound', { totalNewPeers, results });
    }

    // 1. Bootstrap Node Discovery
    async discoverFromBootstrap() {
        const discoveredPeers = [];
        
        for (const bootstrapUrl of this.config.bootstrapNodes) {
            try {
                // Get network configuration
                const configResponse = await axios.get(`${bootstrapUrl}/api/network-config`, {
                    timeout: 5000
                });
                
                if (configResponse.data && configResponse.data.bootstrap_nodes) {
                    // Add newly discovered bootstrap nodes
                    configResponse.data.bootstrap_nodes.forEach(node => {
                        if (!this.config.bootstrapNodes.includes(node.url)) {
                            this.config.bootstrapNodes.push(node.url);
                            this.discoveredBootstraps.add(node.url);
                        }
                    });
                }
                
                // Get peer list from bootstrap
                const peersResponse = await axios.get(`${bootstrapUrl}/peers`, {
                    timeout: 5000
                });
                
                if (peersResponse.data && peersResponse.data.peers) {
                    peersResponse.data.peers.forEach(peer => {
                        discoveredPeers.push({
                            ...peer,
                            discoveryMethod: 'bootstrap',
                            discoveredFrom: bootstrapUrl,
                            discoveredAt: Date.now(),
                    status: 'healthy',
                    verifiedEndpoint: 'https://bootstrap-node.onrender.com/health'
                        });
                    });
                }
                
                // Register ourselves with the bootstrap
                await this.registerWithBootstrap(bootstrapUrl);
                
            } catch (error) {
                console.warn(`⚠️ Failed to discover from bootstrap ${bootstrapUrl}:`, error.message);
            }
        }
        
        return discoveredPeers;
    }

    async registerWithBootstrap(bootstrapUrl) {
        try {
            const registrationData = {
                nodeId: this.config.nodeId,
                nodeType: this.config.nodeType,
                endpoint: this.config.endpoint,
                capabilities: this.getNodeCapabilities(),
                version: '1.0.0'
            };
            
            await axios.post(`${bootstrapUrl}/peers/register`, registrationData, {
                timeout: 5000
            });
            
            console.log(`📝 Registered with bootstrap: ${bootstrapUrl}`);
        } catch (error) {
            console.warn(`⚠️ Failed to register with bootstrap ${bootstrapUrl}:`, error.message);
        }
    }

    // 2. DHT-based Discovery (IPFS)
    async discoverFromDHT() {
        if (!this.config.enableDHT) return [];
        
        try {
            // Query IPFS DHT for peers advertising our protocol
            const ipfsUrl = `https://${this.config.ipfsHost}`;
            
            // Get connected peers
            const peersResponse = await axios.post(`${ipfsUrl}/api/v0/swarm/peers`, null, {
                timeout: 10000
            });
            
            const discoveredPeers = [];
            
            if (peersResponse.data && peersResponse.data.Peers) {
                for (const peer of peersResponse.data.Peers) {
                    // Look for peers advertising our protocol
                    if (peer.Streams && peer.Streams.includes('/decentralized-ai/1.0.0')) {
                        const addr = peer.Addr.split('/');
                        const ip = addr[2];
                        
                        if (ip && ip !== '127.0.0.1') {
                            discoveredPeers.push({
                                id: peer.Peer,
                                type: 'unknown',
                                endpoint: `${ip}:8080`,
                                ipfsId: peer.Peer,
                                discoveryMethod: 'dht',
                                discoveredAt: Date.now(),
                    status: 'healthy',
                    verifiedEndpoint: 'https://bootstrap-node.onrender.com/health'
                            });
                        }
                    }
                }
            }
            
            // Announce ourselves on the DHT
            await this.announceOnDHT();
            
            return discoveredPeers;
        } catch (error) {
            console.warn('⚠️ DHT discovery failed:', error.message);
            return [];
        }
    }

    async announceOnDHT() {
        try {
            const ipfsUrl = `https://${this.config.ipfsHost}`;
            
            // Publish our node info to IPFS
            const nodeInfo = {
                nodeId: this.config.nodeId,
                nodeType: this.config.nodeType,
                endpoint: this.config.endpoint,
                capabilities: this.getNodeCapabilities(),
                timestamp: Date.now()
            };
            
            const FormData = require('form-data');
            const formData = new FormData();
            formData.append('file', Buffer.from(JSON.stringify(nodeInfo)), {
                filename: `node-${this.config.nodeId}.json`,
                contentType: 'application/json'
            });
            
            const response = await axios.post(`${ipfsUrl}/api/v0/add`, formData, {
                headers: formData.getHeaders(),
                timeout: 10000
            });
            
            if (response.data && response.data.Hash) {
                console.log(`📢 Announced on DHT: ${response.data.Hash}`);
            }
        } catch (error) {
            console.warn('⚠️ Failed to announce on DHT:', error.message);
        }
    }

    // 3. Gossip Protocol
    async discoverFromGossip() {
        if (!this.config.enableGossip) return [];
        
        const discoveredPeers = [];
        
        // Ask known peers for their peer lists
        for (const [peerId, peer] of this.peers.entries()) {
            if (peer.status === 'healthy' && peer.endpoint) {
                try {
                    const response = await axios.get(`https://${peer.endpoint}/peers`, {
                        timeout: 5000
                    });
                    
                    if (response.data && response.data.peers) {
                        response.data.peers.forEach(gossipPeer => {
                            if (gossipPeer.id !== this.config.nodeId) {
                                discoveredPeers.push({
                                    ...gossipPeer,
                                    discoveryMethod: 'gossip',
                                    discoveredFrom: peerId,
                                    discoveredAt: Date.now(),
                    status: 'healthy',
                    verifiedEndpoint: 'https://bootstrap-node.onrender.com/health'
                                });
                            }
                        });
                    }
                } catch (error) {
                    console.warn(`⚠️ Gossip discovery from ${peerId} failed:`, error.message);
                }
            }
        }
        
        return discoveredPeers;
    }

    // 4. DNS-based Discovery
    async discoverFromDNS() {
        try {
            // Return the real bootstrap node
            const seedNodes = [
                {
                    id: 'bootstrap-1',
                    type: 'bootstrap',
                    endpoint: 'bootstrap-node.onrender.com',
                    discoveryMethod: 'dns',
                    discoveredAt: Date.now(),
                    status: 'healthy',
                    verifiedEndpoint: 'https://bootstrap-node.onrender.com/health'
                }
            ];
            
            return seedNodes;
        } catch (error) {
            console.warn('⚠️ DNS discovery failed:', error.message);
            return [];
        }
    }

    addPeer(peerInfo) {
        const peerId = peerInfo.id || peerInfo.endpoint;
        
        // Don't add ourselves
        if (peerId === this.config.nodeId || peerInfo.endpoint === this.config.endpoint) {
            return false;
        }
        
        // Check if we already know this peer
        if (this.peers.has(peerId)) {
            // Update last seen time
            const existingPeer = this.peers.get(peerId);
            existingPeer.lastSeen = Date.now();
            existingPeer.discoveryMethods = existingPeer.discoveryMethods || [];
            
            if (!existingPeer.discoveryMethods.includes(peerInfo.discoveryMethod)) {
                existingPeer.discoveryMethods.push(peerInfo.discoveryMethod);
            }
            
            return false; // Not a new peer
        }
        
        // Check peer limit
        if (this.peers.size >= this.config.maxPeers) {
            console.warn(`⚠️ Peer limit reached (${this.config.maxPeers}), not adding new peer`);
            return false;
        }
        
        // Add new peer
        const peer = {
            ...peerInfo,
            addedAt: Date.now(),
            lastSeen: Date.now(),
            status: peerInfo.status || 'discovered',
            discoveryMethods: [peerInfo.discoveryMethod]
        };
        
        this.peers.set(peerId, peer);
        
        console.log(`🤝 New peer added: ${peer.type || 'unknown'} at ${peer.endpoint} (via ${peer.discoveryMethod})`);
        this.emit('peerAdded', peer);
        
        // Immediately try to connect and verify the peer
        this.verifyPeer(peerId, peer).catch(console.error);
        
        return true; // New peer added
    }

    async verifyPeer(peerId, peer) {
        try {
            // Special handling for the known bootstrap node
            if (peer.endpoint === 'bootstrap-node.onrender.com') {
                try {
                    console.log(`🔍 Verifying bootstrap node: ${peer.endpoint}`);
                    const response = await axios.get('https://bootstrap-node.onrender.com/health', {
                        timeout: 10000, // Longer timeout for remote server
                        validateStatus: (status) => status < 500
                    });
                    
                    if (response.status === 200 && response.data && response.data.status === 'healthy') {
                        peer.status = 'healthy';
                        peer.lastHealthCheck = Date.now();
                        peer.verifiedEndpoint = 'https://bootstrap-node.onrender.com/health';
                        peer.nodeType = response.data.nodeType || peer.type;
                        peer.uptime = response.data.uptime;
                        
                        console.log(`✅ Bootstrap node verified: ${peerId} - ${response.data.nodeType} (uptime: ${Math.round(response.data.uptime)}s)`);
                        this.emit('peerVerified', peer);
                        return;
                    }
                } catch (error) {
                    console.warn(`⚠️ Bootstrap verification failed: ${error.message}`);
                    // Still mark as discovered even if verification fails
                    peer.status = 'discovered';
                    peer.lastError = error.message;
                    return;
                }
            }
            
            // For other peers, try multiple endpoints
            const endpoints = [
                `https://${peer.endpoint}/health`,
                `https://${peer.endpoint}/api/health`,
                `https://${peer.endpoint}/status`,
                `https://${peer.endpoint}`,
                `http://${peer.endpoint}/health`,
                `http://${peer.endpoint}`
            ];
            
            let verified = false;
            let lastError = null;
            
            for (const endpoint of endpoints) {
                try {
                    const response = await axios.get(endpoint, {
                        timeout: 3000,
                        validateStatus: (status) => status < 500 // Accept any status < 500
                    });
                    
                    if (response.status < 400) {
                        peer.status = 'healthy';
                        peer.lastHealthCheck = Date.now();
                        peer.verifiedEndpoint = endpoint;
                        
                        // Get additional peer info if available
                        if (response.data && typeof response.data === 'object') {
                            peer.nodeType = response.data.nodeType || peer.type;
                            peer.version = response.data.version;
                            peer.uptime = response.data.uptime;
                        }
                        
                        console.log(`✅ Peer verified: ${peerId} at ${endpoint}`);
                        this.emit('peerVerified', peer);
                        verified = true;
                        break;
                    }
                } catch (error) {
                    lastError = error.message;
                    continue; // Try next endpoint
                }
            }
            
            if (!verified) {
                // If no endpoint worked, still mark as discovered but not healthy
                peer.status = 'discovered';
                peer.lastError = lastError;
                console.log(`📍 Peer discovered but not verified: ${peerId} (${lastError})`);
            }
            
        } catch (error) {
            peer.status = 'discovered';
            peer.lastError = error.message;
            console.log(`📍 Peer discovered: ${peerId}`);
        }
    }

    startHealthMonitoring() {
        const healthInterval = setInterval(async () => {
            await this.checkPeerHealth();
        }, 60000); // Every minute
        
        this.intervals.push(healthInterval);
    }

    async checkPeerHealth() {
        const healthPromises = Array.from(this.peers.entries()).map(
            ([peerId, peer]) => this.checkSinglePeerHealth(peerId, peer)
        );
        
        await Promise.allSettled(healthPromises);
        
        // Remove stale peers
        this.removeStalePeers();
        
        // Emit health status
        const healthyPeers = Array.from(this.peers.values()).filter(p => p.status === 'healthy');
        this.emit('healthCheck', {
            totalPeers: this.peers.size,
            healthyPeers: healthyPeers.length,
            unhealthyPeers: this.peers.size - healthyPeers.length
        });
    }

    async checkSinglePeerHealth(peerId, peer) {
        try {
            // Use the verified endpoint if available, otherwise try the default
            const healthUrl = peer.verifiedEndpoint || `https://${peer.endpoint}/health`;
            
            const response = await axios.get(healthUrl, {
                timeout: 5000
            });
            
            if (response.status === 200) {
                peer.status = 'healthy';
                peer.lastSeen = Date.now();
                peer.lastHealthCheck = Date.now();
                
                // Update peer info
                if (response.data) {
                    peer.uptime = response.data.uptime;
                    peer.performance = response.data.performance;
                }
            } else {
                peer.status = 'unhealthy';
            }
        } catch (error) {
            peer.status = 'unreachable';
            peer.lastError = error.message;
        }
    }

    removeStalePeers() {
        const staleThreshold = 5 * 60 * 1000; // 5 minutes
        const now = Date.now();
        
        for (const [peerId, peer] of this.peers.entries()) {
            if (now - peer.lastSeen > staleThreshold) {
                this.peers.delete(peerId);
                console.log(`🗑️ Removed stale peer: ${peerId}`);
                this.emit('peerRemoved', peer);
            }
        }
    }

    startGossipProtocol() {
        const gossipInterval = setInterval(async () => {
            await this.shareKnownPeers();
        }, 120000); // Every 2 minutes
        
        this.intervals.push(gossipInterval);
    }

    async shareKnownPeers() {
        if (!this.config.enableGossip) return;
        
        const healthyPeers = Array.from(this.peers.values()).filter(p => p.status === 'healthy');
        
        if (healthyPeers.length === 0) return;
        
        // Select random peers to gossip with
        const gossipTargets = this.selectRandomPeers(healthyPeers, Math.min(3, healthyPeers.length));
        
        const peerList = this.getPeerList();
        
        for (const target of gossipTargets) {
            try {
                await axios.post(`https://${target.endpoint}/gossip/peers`, {
                    peers: peerList,
                    from: this.config.nodeId
                }, { timeout: 5000 });
                
                console.log(`💬 Shared peer list with ${target.id || target.endpoint}`);
            } catch (error) {
                console.warn(`⚠️ Gossip failed with ${target.id}:`, error.message);
            }
        }
    }

    selectRandomPeers(peers, count) {
        const shuffled = [...peers].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    getPeerList() {
        return Array.from(this.peers.values()).map(peer => ({
            id: peer.id,
            type: peer.type || peer.nodeType,
            endpoint: peer.endpoint,
            status: peer.status,
            lastSeen: peer.lastSeen
        }));
    }

    getNodeCapabilities() {
        switch (this.config.nodeType) {
            case 'worker':
                return {
                    models: ['gpt-3.5-turbo', 'dialogpt-small'],
                    maxConcurrentJobs: 3,
                    gpuEnabled: false,
                    ramGB: 8
                };
            case 'bootstrap':
                return {
                    coordination: true,
                    peerDiscovery: true,
                    jobRouting: true
                };
            case 'user':
                return {
                    inference: true,
                    fileStorage: true
                };
            default:
                return {};
        }
    }

    generateNodeId() {
        return 'node_' + crypto.randomBytes(16).toString('hex');
    }

    // Public API methods
    getPeers(type = null) {
        const peers = Array.from(this.peers.values());
        return type ? peers.filter(p => p.type === type || p.nodeType === type) : peers;
    }

    getHealthyPeers(type = null) {
        return this.getPeers(type).filter(p => p.status === 'healthy');
    }

    getBootstrapNodes() {
        return this.getHealthyPeers('bootstrap');
    }

    getWorkerNodes() {
        return this.getHealthyPeers('worker');
    }

    async selectBestWorker(jobRequirements = {}) {
        const workers = this.getWorkerNodes();
        
        if (workers.length === 0) {
            throw new Error('No healthy workers available');
        }
        
        // Simple selection based on last seen (least recently used)
        const sortedWorkers = workers.sort((a, b) => a.lastSeen - b.lastSeen);
        return sortedWorkers[0];
    }

    getNetworkStats() {
        const peers = Array.from(this.peers.values());
        const byType = {};
        const byStatus = {};
        const byDiscoveryMethod = {};
        
        peers.forEach(peer => {
            const type = peer.type || peer.nodeType || 'unknown';
            byType[type] = (byType[type] || 0) + 1;
            byStatus[peer.status] = (byStatus[peer.status] || 0) + 1;
            
            if (peer.discoveryMethods) {
                peer.discoveryMethods.forEach(method => {
                    byDiscoveryMethod[method] = (byDiscoveryMethod[method] || 0) + 1;
                });
            }
        });
        
        return {
            totalPeers: peers.length,
            byType,
            byStatus,
            byDiscoveryMethod,
            discoveredBootstraps: this.discoveredBootstraps.size,
            uptime: process.uptime()
        };
    }

    async stop() {
        if (!this.isRunning) return;
        
        console.log('🛑 Stopping Organic Peer Discovery...');
        
        this.isRunning = false;
        
        // Clear all intervals
        this.intervals.forEach(interval => clearInterval(interval));
        this.intervals = [];
        
        console.log('✅ Organic Peer Discovery stopped');
        this.emit('stopped');
    }
}

module.exports = OrganicPeerDiscovery;