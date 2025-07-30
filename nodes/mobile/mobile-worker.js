/**
 * Mobile Worker Node - Lightweight AI Compute Node for Smartphones
 * 
 * Capabilities:
 * - Sign AI inference tasks
 * - Validate results from full nodes
 * - Participate in consensus
 * - Earn tokens for participation
 * - Discover and connect to peers
 */

class MobileWorkerNode {
    constructor(config = {}) {
        this.config = {
            nodeType: 'mobile-worker',
            maxConcurrentTasks: 3, // Limited for mobile
            batteryThreshold: 0.2, // Stop when battery < 20%
            dataUsageLimit: 100 * 1024 * 1024, // 100MB per day
            enableBackgroundMode: true,
            ...config
        };
        
        this.nodeId = this.generateNodeId();
        this.wallet = null;
        this.peers = new Map();
        this.activeTasks = new Map();
        this.earnings = { daily: 0, total: 0 };
        this.stats = {
            tasksCompleted: 0,
            uptime: 0,
            dataUsed: 0
        };
        
        this.isActive = false;
        this.batteryLevel = 1.0;
        this.networkQuality = 'good';
    }

    async initialize() {
        console.log('📱 Initializing Mobile Worker Node...');
        
        // Initialize wallet
        await this.initializeWallet();
        
        // Check device capabilities
        await this.checkDeviceCapabilities();
        
        // Connect to network
        await this.connectToNetwork();
        
        // Start task listener
        this.startTaskListener();
        
        // Start monitoring
        this.startMonitoring();
        
        console.log('✅ Mobile Worker Node ready');
        this.emit('ready');
    }

    async initializeWallet() {
        // Check for existing wallet
        const savedWallet = localStorage.getItem('mobile-wallet');
        
        if (savedWallet) {
            this.wallet = JSON.parse(savedWallet);
            console.log('💰 Wallet loaded:', this.wallet.address.substring(0, 8) + '...');
        } else {
            // Generate new wallet
            this.wallet = await this.generateWallet();
            localStorage.setItem('mobile-wallet', JSON.stringify(this.wallet));
            console.log('🆕 New wallet created:', this.wallet.address.substring(0, 8) + '...');
        }
    }

    async generateWallet() {
        // Simplified wallet generation for mobile
        const crypto = window.crypto || require('crypto');
        const privateKey = crypto.getRandomValues(new Uint8Array(32));
        
        return {
            address: '0x' + Array.from(privateKey.slice(0, 20)).map(b => b.toString(16).padStart(2, '0')).join(''),
            privateKey: Array.from(privateKey).map(b => b.toString(16).padStart(2, '0')).join(''),
            balance: 0
        };
    }

    async checkDeviceCapabilities() {
        // Check battery API
        if ('getBattery' in navigator) {
            const battery = await navigator.getBattery();
            this.batteryLevel = battery.level;
            
            battery.addEventListener('levelchange', () => {
                this.batteryLevel = battery.level;
                this.adjustPerformanceMode();
            });
        }
        
        // Check network connection
        if ('connection' in navigator) {
            const connection = navigator.connection;
            this.networkQuality = this.getNetworkQuality(connection);
            
            connection.addEventListener('change', () => {
                this.networkQuality = this.getNetworkQuality(connection);
                this.adjustPerformanceMode();
            });
        }
        
        // Check available memory
        if ('memory' in performance) {
            const memory = performance.memory;
            console.log(`📊 Memory: ${Math.round(memory.usedJSHeapSize / 1024 / 1024)}MB used`);
        }
        
        console.log(`🔋 Battery: ${Math.round(this.batteryLevel * 100)}%`);
        console.log(`📶 Network: ${this.networkQuality}`);
    }

    getNetworkQuality(connection) {
        const effectiveType = connection.effectiveType;
        
        switch (effectiveType) {
            case '4g': return 'excellent';
            case '3g': return 'good';
            case '2g': return 'poor';
            default: return 'unknown';
        }
    }

    adjustPerformanceMode() {
        if (this.batteryLevel < this.config.batteryThreshold) {
            this.setMode('power-save');
        } else if (this.networkQuality === 'poor') {
            this.setMode('low-bandwidth');
        } else {
            this.setMode('normal');
        }
    }

    setMode(mode) {
        switch (mode) {
            case 'power-save':
                this.config.maxConcurrentTasks = 1;
                console.log('🔋 Switched to power-save mode');
                break;
            case 'low-bandwidth':
                this.config.maxConcurrentTasks = 2;
                console.log('📶 Switched to low-bandwidth mode');
                break;
            case 'normal':
                this.config.maxConcurrentTasks = 3;
                console.log('⚡ Switched to normal mode');
                break;
        }
    }

    async connectToNetwork() {
        console.log('🌐 Connecting to AI network...');
        
        // Discover bootstrap nodes
        const bootstrapNodes = await this.discoverBootstrapNodes();
        
        // Connect to nearest bootstrap
        for (const bootstrap of bootstrapNodes) {
            try {
                await this.connectToBootstrap(bootstrap);
                console.log('✅ Connected to bootstrap:', bootstrap.url);
                break;
            } catch (error) {
                console.warn('⚠️ Failed to connect to bootstrap:', error.message);
            }
        }
        
        // Start peer discovery
        this.startPeerDiscovery();
    }

    async discoverBootstrapNodes() {
        // Use hardcoded bootstrap nodes for mobile
        return [
            { url: 'http://35.160.120.126:8080', priority: 1 },
            { url: 'http://44.233.151.27:8080', priority: 2 },
            { url: 'http://34.211.200.85:8080', priority: 3 }
        ];
    }

    async connectToBootstrap(bootstrap) {
        const response = await fetch(`${bootstrap.url}/peers/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nodeId: this.nodeId,
                nodeType: this.config.nodeType,
                endpoint: 'mobile', // Mobile nodes don't have fixed endpoints
                capabilities: this.getCapabilities(),
                wallet: this.wallet.address
            })
        });
        
        if (!response.ok) {
            throw new Error(`Registration failed: ${response.status}`);
        }
        
        const result = await response.json();
        console.log('📝 Registered with network');
        return result;
    }

    getCapabilities() {
        return {
            taskSigning: true,
            resultValidation: true,
            lightCompute: true,
            maxConcurrentTasks: this.config.maxConcurrentTasks,
            batteryLevel: this.batteryLevel,
            networkQuality: this.networkQuality,
            platform: 'mobile'
        };
    }

    startPeerDiscovery() {
        // Use WebRTC for peer-to-peer connections
        setInterval(async () => {
            await this.discoverNearbyPeers();
        }, 30000); // Every 30 seconds
    }

    async discoverNearbyPeers() {
        // Simplified peer discovery for mobile
        console.log('🔍 Discovering nearby peers...');
        
        // In a real implementation, this would use:
        // - WebRTC signaling servers
        // - Local network discovery (mDNS)
        // - Bluetooth Low Energy
        // - Location-based discovery
    }

    startTaskListener() {
        console.log('👂 Listening for AI tasks...');
        
        // Simulate receiving tasks from the network
        setInterval(() => {
            if (this.shouldAcceptTasks()) {
                this.simulateIncomingTask();
            }
        }, 5000); // Check every 5 seconds
    }

    shouldAcceptTasks() {
        return (
            this.isActive &&
            this.batteryLevel > this.config.batteryThreshold &&
            this.activeTasks.size < this.config.maxConcurrentTasks &&
            this.stats.dataUsed < this.config.dataUsageLimit
        );
    }

    simulateIncomingTask() {
        if (Math.random() < 0.1) { // 10% chance of receiving a task
            const task = this.generateMockTask();
            this.handleIncomingTask(task);
        }
    }

    generateMockTask() {
        const taskTypes = ['sign', 'validate', 'micro-compute'];
        const type = taskTypes[Math.floor(Math.random() * taskTypes.length)];
        
        return {
            id: 'task_' + Date.now(),
            type: type,
            data: this.generateTaskData(type),
            reward: 0.01 + Math.random() * 0.05, // 0.01-0.06 tokens
            deadline: Date.now() + 30000, // 30 seconds
            requiredCapabilities: [type]
        };
    }

    generateTaskData(type) {
        switch (type) {
            case 'sign':
                return {
                    message: 'AI inference request #' + Math.floor(Math.random() * 1000),
                    hash: 'hash_' + Math.random().toString(36).substr(2, 16)
                };
            case 'validate':
                return {
                    result: 'AI response: The answer is 42',
                    originalHash: 'hash_' + Math.random().toString(36).substr(2, 16)
                };
            case 'micro-compute':
                return {
                    operation: 'sentiment_analysis',
                    text: 'This is a sample text for analysis'
                };
            default:
                return {};
        }
    }

    async handleIncomingTask(task) {
        console.log(`📝 New ${task.type} task received:`, task.id);
        
        // Add to active tasks
        this.activeTasks.set(task.id, {
            ...task,
            startTime: Date.now(),
            status: 'processing'
        });
        
        try {
            // Process the task based on type
            const result = await this.processTask(task);
            
            // Submit result
            await this.submitTaskResult(task.id, result);
            
            // Update earnings
            this.earnings.daily += task.reward;
            this.earnings.total += task.reward;
            this.stats.tasksCompleted++;
            
            console.log(`✅ Task ${task.id} completed. Earned: ${task.reward} tokens`);
            this.emit('taskCompleted', { task, result, reward: task.reward });
            
        } catch (error) {
            console.error(`❌ Task ${task.id} failed:`, error.message);
            this.emit('taskFailed', { task, error });
        } finally {
            this.activeTasks.delete(task.id);
        }
    }

    async processTask(task) {
        const processingTime = 500 + Math.random() * 2000; // 0.5-2.5 seconds
        
        switch (task.type) {
            case 'sign':
                await this.delay(processingTime);
                return this.signMessage(task.data.message);
                
            case 'validate':
                await this.delay(processingTime);
                return this.validateResult(task.data);
                
            case 'micro-compute':
                await this.delay(processingTime);
                return this.performMicroCompute(task.data);
                
            default:
                throw new Error(`Unknown task type: ${task.type}`);
        }
    }

    signMessage(message) {
        // Simplified message signing
        const signature = 'sig_' + btoa(message + this.wallet.privateKey).substr(0, 32);
        return {
            message,
            signature,
            signer: this.wallet.address
        };
    }

    validateResult(data) {
        // Simplified result validation
        const isValid = data.result.length > 0 && data.originalHash.startsWith('hash_');
        return {
            isValid,
            validator: this.wallet.address,
            confidence: 0.8 + Math.random() * 0.2
        };
    }

    performMicroCompute(data) {
        // Simplified micro-computation
        switch (data.operation) {
            case 'sentiment_analysis':
                const sentiment = data.text.includes('good') || data.text.includes('great') ? 'positive' : 'neutral';
                return { sentiment, confidence: 0.7 + Math.random() * 0.3 };
            default:
                return { result: 'processed', confidence: 0.5 };
        }
    }

    async submitTaskResult(taskId, result) {
        // In a real implementation, this would submit to the network
        console.log(`📤 Submitting result for task ${taskId}`);
        
        // Update data usage
        this.stats.dataUsed += JSON.stringify(result).length;
        
        // Simulate network submission
        await this.delay(200 + Math.random() * 300);
    }

    startMonitoring() {
        // Update stats every minute
        setInterval(() => {
            this.stats.uptime = Date.now() - this.startTime;
            this.saveStats();
            this.emit('statsUpdated', this.stats);
        }, 60000);
        
        // Reset daily earnings at midnight
        setInterval(() => {
            const now = new Date();
            if (now.getHours() === 0 && now.getMinutes() === 0) {
                this.earnings.daily = 0;
                console.log('🌅 Daily earnings reset');
            }
        }, 60000);
    }

    saveStats() {
        const data = {
            earnings: this.earnings,
            stats: this.stats,
            nodeId: this.nodeId
        };
        localStorage.setItem('mobile-node-stats', JSON.stringify(data));
    }

    loadStats() {
        const saved = localStorage.getItem('mobile-node-stats');
        if (saved) {
            const data = JSON.parse(saved);
            this.earnings = data.earnings || { daily: 0, total: 0 };
            this.stats = data.stats || { tasksCompleted: 0, uptime: 0, dataUsed: 0 };
        }
    }

    // Public API methods
    start() {
        this.isActive = true;
        this.startTime = Date.now();
        this.loadStats();
        console.log('🚀 Mobile Worker Node started');
        this.emit('started');
    }

    stop() {
        this.isActive = false;
        this.saveStats();
        console.log('🛑 Mobile Worker Node stopped');
        this.emit('stopped');
    }

    getStatus() {
        return {
            isActive: this.isActive,
            nodeId: this.nodeId,
            batteryLevel: this.batteryLevel,
            networkQuality: this.networkQuality,
            activeTasks: this.activeTasks.size,
            earnings: this.earnings,
            stats: this.stats
        };
    }

    generateNodeId() {
        return 'mobile_' + Math.random().toString(36).substr(2, 16);
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // Event emitter functionality
    emit(event, data) {
        if (this.listeners && this.listeners[event]) {
            this.listeners[event].forEach(callback => callback(data));
        }
    }

    on(event, callback) {
        if (!this.listeners) this.listeners = {};
        if (!this.listeners[event]) this.listeners[event] = [];
        this.listeners[event].push(callback);
    }
}

// Export for use in different environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MobileWorkerNode;
} else {
    window.MobileWorkerNode = MobileWorkerNode;
}