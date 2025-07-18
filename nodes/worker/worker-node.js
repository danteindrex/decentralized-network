#!/usr/bin/env node

/**
 * Worker/Compute Node
 * - All the rest (laptops, desktops, phones)
 * - No static IP required
 * - Runs either:
 *   - a pruned full node + miner (CPU/GPU tasks) or
 *   - a light client (phones) that signs jobs and talks JSON-RPC to a nearby worker
 * - Job: run AI tasks, seal blocks, keep chain alive
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

class WorkerNode {
    constructor(config = {}) {
        // Load user configuration if available
        const userConfig = this.loadUserConfig();
        
        this.config = {
            chainId: 1337,
            networkId: 1337,
            port: 30303 + Math.floor(Math.random() * 1000), // Random port
            rpcPort: 8545 + Math.floor(Math.random() * 1000),
            wsPort: 8546 + Math.floor(Math.random() * 1000),
            dataDir: './data/worker-' + Date.now(),
            nodeType: this.detectNodeType(),
            bootstrapNodes: this.loadBootstrapNodes(),
            // Resource contribution settings (from user config or defaults)
            storageContribution: userConfig.storageContribution || config.storageContribution || 5,
            cpuContribution: userConfig.cpuContribution || config.cpuContribution || 10,
            gpuContribution: userConfig.gpuContribution || config.gpuContribution || 10,
            ramContribution: userConfig.ramContribution || config.ramContribution || 15,
            ...config
        };

        this.capabilities = this.detectCapabilities();
        this.resourceAllocation = this.calculateResourceAllocation();
        this.isRunning = false;
        
        console.log(`🔧 Detected node type: ${this.config.nodeType}`);
        console.log(`💪 Capabilities:`, this.capabilities);
        console.log(`📊 Resource Allocation:`, this.resourceAllocation);
        
        // Start watching for configuration changes
        if (!config.skipStart) {
            this.startConfigWatcher();
        }
    }

    loadUserConfig() {
        try {
            const configPath = path.join(__dirname, '../user-resource-config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                console.log('📋 Loaded user resource configuration');
                return config;
            }
        } catch (err) {
            console.warn('⚠️  Could not load user config:', err.message);
        }
        return {};
    }

    startConfigWatcher() {
        console.log('👁️  Starting configuration watcher...');
        
        const signalPath = path.join(__dirname, '../.resource-update-signal');
        const runtimeConfigPath = path.join(__dirname, '../runtime-config.json');
        
        // Watch for signal file changes
        const checkForUpdates = () => {
            if (fs.existsSync(signalPath)) {
                console.log('🔄 Configuration update signal received');
                this.reloadConfiguration();
                
                // Clean up signal file
                try {
                    fs.unlinkSync(signalPath);
                } catch (err) {
                    // Ignore cleanup errors
                }
            }
        };
        
        // Check every 2 seconds
        setInterval(checkForUpdates, 2000);
        
        // Also watch the runtime config file directly
        if (fs.existsSync(runtimeConfigPath)) {
            fs.watchFile(runtimeConfigPath, (curr, prev) => {
                if (curr.mtime > prev.mtime) {
                    console.log('🔄 Runtime configuration file changed');
                    this.reloadConfiguration();
                }
            });
        }
    }

    async reloadConfiguration() {
        try {
            console.log('🔄 Reloading resource configuration...');
            
            const userConfig = this.loadUserConfig();
            const oldAllocation = { ...this.resourceAllocation };
            
            // Update configuration
            this.config.storageContribution = userConfig.storageContribution || this.config.storageContribution;
            this.config.cpuContribution = userConfig.cpuContribution || this.config.cpuContribution;
            this.config.gpuContribution = userConfig.gpuContribution || this.config.gpuContribution;
            this.config.ramContribution = userConfig.ramContribution || this.config.ramContribution;
            
            // Recalculate resource allocation
            this.resourceAllocation = this.calculateResourceAllocation();
            
            // Show changes
            this.showConfigurationChanges(oldAllocation, this.resourceAllocation);
            
            // Apply new constraints
            this.setupResourceConstraints();
            
            console.log('✅ Configuration reloaded successfully');
            
        } catch (err) {
            console.error('❌ Failed to reload configuration:', err.message);
        }
    }

    showConfigurationChanges(oldAllocation, newAllocation) {
        console.log('📊 Resource Allocation Changes:');
        console.log('------------------------------');
        
        const resources = ['storage', 'cpu', 'ram'];
        if (this.capabilities.gpu.available) {
            resources.push('gpu');
        }
        
        resources.forEach(resource => {
            const oldValue = oldAllocation[resource]?.allocated || 0;
            const newValue = newAllocation[resource]?.allocated || 0;
            const change = newValue - oldValue;
            const unit = resource === 'cpu' ? 'cores' : 'GB';
            
            if (change !== 0) {
                const arrow = change > 0 ? '↗️' : '↘️';
                const sign = change > 0 ? '+' : '';
                console.log(`   ${resource.toUpperCase()}: ${oldValue} → ${newValue} ${unit} (${sign}${change} ${unit}) ${arrow}`);
            } else {
                console.log(`   ${resource.toUpperCase()}: ${newValue} ${unit} (no change)`);
            }
        });
        
        console.log('');
    }

    detectNodeType() {
        const platform = os.platform();
        const arch = os.arch();
        const totalMem = os.totalmem();
        
        // Simple heuristics for node type detection
        if (platform === 'android' || platform === 'ios') {
            return 'light'; // Mobile devices
        }
        
        if (totalMem < 4 * 1024 * 1024 * 1024) { // Less than 4GB RAM
            return 'light';
        }
        
        return 'full'; // Desktop/laptop with sufficient resources
    }

    detectCapabilities() {
        const cpus = os.cpus().length;
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        
        // Detect storage
        const storage = this.detectStorage();
        
        // Detect GPU
        const gpu = this.detectGPU();
        
        return {
            cpuCores: cpus,
            cpuModel: cpus > 0 ? os.cpus()[0].model : 'Unknown',
            totalMemory: Math.floor(totalMem / (1024 * 1024 * 1024)), // GB
            freeMemory: Math.floor(freeMem / (1024 * 1024 * 1024)), // GB
            totalStorage: storage.total, // GB
            freeStorage: storage.free, // GB
            gpu: gpu,
            canMine: totalMem >= 2 * 1024 * 1024 * 1024, // 2GB minimum
            canRunAI: totalMem >= 4 * 1024 * 1024 * 1024, // 4GB minimum for AI
            platform: os.platform(),
            arch: os.arch()
        };
    }

    detectStorage() {
        try {
            let totalGB = 0;
            let freeGB = 0;
            
            if (os.platform() === 'linux' || os.platform() === 'darwin') {
                const df = execSync('df -BG / | tail -1', { encoding: 'utf8' });
                const parts = df.trim().split(/\s+/);
                totalGB = parseInt(parts[1].replace('G', ''));
                freeGB = parseInt(parts[3].replace('G', ''));
            } else if (os.platform() === 'win32') {
                // Windows - use wmic
                const result = execSync('wmic logicaldisk where caption="C:" get size,freespace /value', { encoding: 'utf8' });
                const lines = result.split('\n');
                let size = 0, free = 0;
                
                lines.forEach(line => {
                    if (line.startsWith('FreeSpace=')) {
                        free = parseInt(line.split('=')[1]) / (1024 * 1024 * 1024);
                    }
                    if (line.startsWith('Size=')) {
                        size = parseInt(line.split('=')[1]) / (1024 * 1024 * 1024);
                    }
                });
                
                totalGB = Math.floor(size);
                freeGB = Math.floor(free);
            }
            
            return { total: totalGB, free: freeGB };
        } catch (err) {
            console.warn('⚠️  Could not detect storage:', err.message);
            return { total: 100, free: 50 }; // Default fallback
        }
    }

    detectGPU() {
        try {
            let gpuInfo = { available: false, memory: 0, model: 'None' };
            
            if (os.platform() === 'linux') {
                try {
                    // Try nvidia-smi for NVIDIA GPUs
                    const nvidia = execSync('nvidia-smi --query-gpu=memory.total,name --format=csv,noheader,nounits', { encoding: 'utf8' });
                    const lines = nvidia.trim().split('\n');
                    if (lines.length > 0 && lines[0] !== '') {
                        const [memory, name] = lines[0].split(', ');
                        gpuInfo = {
                            available: true,
                            memory: Math.floor(parseInt(memory) / 1024), // Convert MB to GB
                            model: name.trim(),
                            type: 'NVIDIA'
                        };
                    }
                } catch (nvidiaErr) {
                    // Try lspci for other GPUs
                    try {
                        const lspci = execSync('lspci | grep -i vga', { encoding: 'utf8' });
                        if (lspci.includes('AMD') || lspci.includes('Intel') || lspci.includes('NVIDIA')) {
                            gpuInfo = {
                                available: true,
                                memory: 2, // Estimate 2GB for integrated
                                model: lspci.split(':')[2]?.trim() || 'Unknown GPU',
                                type: 'Integrated'
                            };
                        }
                    } catch (lspciErr) {
                        // No GPU detected
                    }
                }
            } else if (os.platform() === 'win32') {
                try {
                    const wmic = execSync('wmic path win32_VideoController get name,AdapterRAM /value', { encoding: 'utf8' });
                    const lines = wmic.split('\n');
                    let name = '', ram = 0;
                    
                    lines.forEach(line => {
                        if (line.startsWith('AdapterRAM=') && line.split('=')[1]) {
                            ram = parseInt(line.split('=')[1]) / (1024 * 1024 * 1024); // Convert to GB
                        }
                        if (line.startsWith('Name=') && line.split('=')[1]) {
                            name = line.split('=')[1].trim();
                        }
                    });
                    
                    if (name && ram > 0) {
                        gpuInfo = {
                            available: true,
                            memory: Math.floor(ram),
                            model: name,
                            type: name.includes('NVIDIA') ? 'NVIDIA' : name.includes('AMD') ? 'AMD' : 'Other'
                        };
                    }
                } catch (wmicErr) {
                    // No GPU detected
                }
            }
            
            return gpuInfo;
        } catch (err) {
            console.warn('⚠️  Could not detect GPU:', err.message);
            return { available: false, memory: 0, model: 'None' };
        }
    }

    calculateResourceAllocation() {
        const allocation = {
            storage: {
                total: this.capabilities.totalStorage,
                allocated: Math.floor(this.capabilities.totalStorage * this.config.storageContribution / 100),
                percentage: this.config.storageContribution
            },
            cpu: {
                total: this.capabilities.cpuCores,
                allocated: Math.max(1, Math.floor(this.capabilities.cpuCores * this.config.cpuContribution / 100)),
                percentage: this.config.cpuContribution
            },
            ram: {
                total: this.capabilities.totalMemory,
                allocated: Math.floor(this.capabilities.totalMemory * this.config.ramContribution / 100),
                percentage: this.config.ramContribution
            }
        };

        // GPU allocation (if available)
        if (this.capabilities.gpu.available) {
            allocation.gpu = {
                total: this.capabilities.gpu.memory,
                allocated: Math.floor(this.capabilities.gpu.memory * this.config.gpuContribution / 100),
                percentage: this.config.gpuContribution,
                model: this.capabilities.gpu.model
            };
        }

        return allocation;
    }

    loadBootstrapNodes() {
        try {
            const bootstrapPath = path.join(__dirname, '../bootstrap-info.json');
            if (fs.existsSync(bootstrapPath)) {
                const info = JSON.parse(fs.readFileSync(bootstrapPath, 'utf8'));
                return [info.enode];
            }
        } catch (err) {
            console.warn('⚠️  Could not load bootstrap info:', err.message);
        }
        
        // Fallback bootstrap nodes
        return [
            'enode://default@localhost:30303' // Replace with actual bootstrap
        ];
    }

    async start() {
        console.log('🚀 Starting Worker Node...');
        console.log(`🔗 Node Type: ${this.config.nodeType}`);
        console.log(`📡 Bootstrap Nodes: ${this.config.bootstrapNodes.join(', ')}`);
        
        if (this.config.nodeType === 'light') {
            await this.startLightClient();
        } else {
            await this.startFullNode();
        }
    }

    async startLightClient() {
        console.log('📱 Starting Light Client...');
        
        const gethArgs = [
            '--datadir', this.config.dataDir,
            '--networkid', this.config.networkId.toString(),
            '--port', this.config.port.toString(),
            '--http',
            '--http.addr', '127.0.0.1',
            '--http.port', this.config.rpcPort.toString(),
            '--http.api', 'eth,net,web3,personal',
            '--ws',
            '--ws.addr', '127.0.0.1',
            '--ws.port', this.config.wsPort.toString(),
            '--ws.api', 'eth,net,web3',
            '--syncmode', 'light',
            '--maxpeers', '10',
            '--bootnodes', this.config.bootstrapNodes.join(','),
            '--nat', 'none'
        ];

        await this.initGenesis();
        await this.startGeth(gethArgs);
        
        // Start AI task listener for light clients
        this.startAITaskListener();
    }

    async startFullNode() {
        console.log('🖥️  Starting Full Node...');
        
        const gethArgs = [
            '--datadir', this.config.dataDir,
            '--networkid', this.config.networkId.toString(),
            '--port', this.config.port.toString(),
            '--http',
            '--http.addr', '127.0.0.1',
            '--http.port', this.config.rpcPort.toString(),
            '--http.api', 'eth,net,web3,personal,txpool,miner',
            '--ws',
            '--ws.addr', '127.0.0.1',
            '--ws.port', this.config.wsPort.toString(),
            '--ws.api', 'eth,net,web3',
            '--syncmode', 'fast',
            '--gcmode', 'archive',
            '--maxpeers', '50',
            '--bootnodes', this.config.bootstrapNodes.join(','),
            '--nat', 'any'
        ];

        // Enable mining if capable
        if (this.capabilities.canMine) {
            gethArgs.push(
                '--mine',
                '--miner.threads', Math.min(this.capabilities.cpuCores, 4).toString(),
                '--miner.etherbase', '0x71562b71999873db5b286df957af199ec94617f7'
            );
            console.log('⛏️  Mining enabled');
        }

        await this.initGenesis();
        await this.startGeth(gethArgs);
        
        // Start AI compute services
        if (this.capabilities.canRunAI) {
            this.startAICompute();
        }
    }

    async startGeth(args) {
        return new Promise((resolve, reject) => {
            const geth = spawn('geth', args, {
                stdio: 'inherit',
                env: { ...process.env }
            });

            geth.on('error', (err) => {
                console.error('❌ Failed to start geth:', err);
                reject(err);
            });

            geth.on('exit', (code) => {
                console.log(`🛑 Worker node exited with code ${code}`);
                process.exit(code);
            });

            // Handle graceful shutdown
            process.on('SIGINT', () => {
                console.log('\n🛑 Shutting down worker node...');
                geth.kill('SIGTERM');
            });

            // Give geth time to start
            setTimeout(() => resolve(), 5000);
        });
    }

    async initGenesis() {
        const genesisPath = path.join(__dirname, '../../genesis.json');
        if (!fs.existsSync(genesisPath)) {
            console.error('❌ Genesis file not found');
            process.exit(1);
        }

        const initArgs = ['init', '--datadir', this.config.dataDir, genesisPath];
        
        return new Promise((resolve, reject) => {
            const init = spawn('geth', initArgs, { stdio: 'pipe' });
            
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

    startAICompute() {
        console.log('🧠 Starting AI Compute Services...');
        
        // Setup resource-constrained environment
        this.setupResourceConstraints();
        
        // Start the orchestrator for AI tasks with resource limits
        const orchestratorPath = path.join(__dirname, '../../orchestrator/main.py');
        
        if (fs.existsSync(orchestratorPath)) {
            const python = spawn('python3', [orchestratorPath], {
                stdio: 'inherit',
                env: {
                    ...process.env,
                    ETH_NODE: `http://localhost:${this.config.rpcPort}`,
                    NODE_TYPE: 'worker',
                    // Resource allocation environment variables
                    ALLOCATED_CPU_CORES: this.resourceAllocation.cpu.allocated.toString(),
                    ALLOCATED_RAM_GB: this.resourceAllocation.ram.allocated.toString(),
                    ALLOCATED_STORAGE_GB: this.resourceAllocation.storage.allocated.toString(),
                    ALLOCATED_GPU_MEMORY: this.resourceAllocation.gpu?.allocated?.toString() || '0',
                    GPU_AVAILABLE: this.capabilities.gpu.available.toString(),
                    GPU_MODEL: this.capabilities.gpu.model || 'None'
                }
            });

            python.on('error', (err) => {
                console.warn('⚠️  AI Compute service failed to start:', err.message);
            });
        }

        // Start resource monitoring
        this.startResourceMonitoring();
        
        // Start AI task processing
        this.startAITaskProcessing();
    }

    setupResourceConstraints() {
        console.log('⚙️  Setting up resource constraints...');
        
        // Create dedicated storage directory for AI tasks
        const aiStorageDir = path.join(this.config.dataDir, 'ai-storage');
        if (!fs.existsSync(aiStorageDir)) {
            fs.mkdirSync(aiStorageDir, { recursive: true });
        }

        // Set storage quota (simplified - in production use proper quota tools)
        const quotaFile = path.join(aiStorageDir, '.quota');
        fs.writeFileSync(quotaFile, JSON.stringify({
            maxSizeGB: this.resourceAllocation.storage.allocated,
            currentSizeGB: 0,
            createdAt: new Date().toISOString()
        }));

        console.log(`📁 AI Storage allocated: ${this.resourceAllocation.storage.allocated}GB`);
        console.log(`🖥️  CPU cores allocated: ${this.resourceAllocation.cpu.allocated}/${this.capabilities.cpuCores}`);
        console.log(`🧠 RAM allocated: ${this.resourceAllocation.ram.allocated}GB/${this.capabilities.totalMemory}GB`);
        
        if (this.capabilities.gpu.available) {
            console.log(`🎮 GPU memory allocated: ${this.resourceAllocation.gpu.allocated}GB/${this.capabilities.gpu.memory}GB`);
        }
    }

    startResourceMonitoring() {
        console.log('📊 Starting resource monitoring...');
        
        // Monitor resource usage every 30 seconds
        setInterval(() => {
            this.monitorResourceUsage();
        }, 30000);
    }

    monitorResourceUsage() {
        try {
            // Check current resource usage
            const currentUsage = {
                cpu: this.getCurrentCPUUsage(),
                ram: this.getCurrentRAMUsage(),
                storage: this.getCurrentStorageUsage(),
                timestamp: new Date().toISOString()
            };

            // Log if usage exceeds allocation
            if (currentUsage.cpu > this.resourceAllocation.cpu.allocated * 100) {
                console.warn(`⚠️  CPU usage (${currentUsage.cpu}%) exceeds allocation`);
            }

            if (currentUsage.ram > this.resourceAllocation.ram.allocated) {
                console.warn(`⚠️  RAM usage (${currentUsage.ram}GB) exceeds allocation`);
            }

            if (currentUsage.storage > this.resourceAllocation.storage.allocated) {
                console.warn(`⚠️  Storage usage (${currentUsage.storage}GB) exceeds allocation`);
            }

            // Save usage stats
            this.saveUsageStats(currentUsage);

        } catch (err) {
            console.warn('⚠️  Resource monitoring error:', err.message);
        }
    }

    getCurrentCPUUsage() {
        // Simplified CPU usage calculation
        const loadAvg = os.loadavg()[0]; // 1-minute load average
        return Math.min(100, (loadAvg / this.capabilities.cpuCores) * 100);
    }

    getCurrentRAMUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return Math.floor(usedMem / (1024 * 1024 * 1024)); // GB
    }

    getCurrentStorageUsage() {
        try {
            const aiStorageDir = path.join(this.config.dataDir, 'ai-storage');
            if (!fs.existsSync(aiStorageDir)) return 0;

            // Calculate directory size (simplified)
            const stats = fs.statSync(aiStorageDir);
            return Math.floor(stats.size / (1024 * 1024 * 1024)); // GB
        } catch (err) {
            return 0;
        }
    }

    saveUsageStats(usage) {
        const statsFile = path.join(this.config.dataDir, 'resource-stats.json');
        let stats = [];
        
        try {
            if (fs.existsSync(statsFile)) {
                stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            }
        } catch (err) {
            stats = [];
        }

        stats.push(usage);
        
        // Keep only last 100 entries
        if (stats.length > 100) {
            stats = stats.slice(-100);
        }

        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    }

    startAITaskProcessing() {
        console.log('🤖 Starting AI task processing...');
        
        // Simulate AI task processing with resource constraints
        setInterval(() => {
            this.processAITasks();
        }, 15000); // Process tasks every 15 seconds
    }

    async processAITasks() {
        try {
            // Check if we have available resources
            const currentUsage = {
                cpu: this.getCurrentCPUUsage(),
                ram: this.getCurrentRAMUsage(),
                storage: this.getCurrentStorageUsage()
            };

            // Only process if within resource limits
            const canProcess = 
                currentUsage.cpu < (this.resourceAllocation.cpu.allocated * 80) && // 80% threshold
                currentUsage.ram < (this.resourceAllocation.ram.allocated * 0.8) &&
                currentUsage.storage < (this.resourceAllocation.storage.allocated * 0.8);

            if (!canProcess) {
                console.log('⏸️  Skipping AI task - resource limits reached');
                return;
            }

            // Simulate AI task processing
            console.log('🔄 Processing AI task...');
            
            // Record task in blockchain
            await this.recordAITaskOnChain({
                taskId: 'task_' + Date.now(),
                nodeId: this.config.dataDir.split('-').pop(),
                resourcesUsed: {
                    cpu: Math.min(this.resourceAllocation.cpu.allocated, 2), // Max 2 cores per task
                    ram: Math.min(this.resourceAllocation.ram.allocated, 4), // Max 4GB per task
                    gpu: this.capabilities.gpu.available ? Math.min(this.resourceAllocation.gpu.allocated, 2) : 0
                },
                timestamp: new Date().toISOString(),
                status: 'completed'
            });

            console.log('✅ AI task completed and recorded on blockchain');

        } catch (err) {
            console.warn('⚠️  AI task processing error:', err.message);
        }
    }

    async recordAITaskOnChain(taskData) {
        // Simplified blockchain recording
        // In production, this would interact with your smart contracts
        
        const taskRecord = {
            ...taskData,
            blockNumber: 'pending',
            transactionHash: '0x' + Math.random().toString(16).substr(2, 64)
        };

        // Save to local task history
        const tasksFile = path.join(this.config.dataDir, 'ai-tasks.json');
        let tasks = [];
        
        try {
            if (fs.existsSync(tasksFile)) {
                tasks = JSON.parse(fs.readFileSync(tasksFile, 'utf8'));
            }
        } catch (err) {
            tasks = [];
        }

        tasks.push(taskRecord);
        
        // Keep only last 1000 tasks
        if (tasks.length > 1000) {
            tasks = tasks.slice(-1000);
        }

        fs.writeFileSync(tasksFile, JSON.stringify(tasks, null, 2));
        
        console.log(`📝 Task recorded: ${taskData.taskId}`);
    }

    startAITaskListener() {
        console.log('👂 Starting AI Task Listener (Light Client)...');
        
        // For light clients, we listen for tasks and forward to nearby workers
        // This is a simplified implementation
        setInterval(() => {
            this.checkForAITasks();
        }, 10000); // Check every 10 seconds
    }

    async checkForAITasks() {
        // Simplified task checking for light clients
        // In production, this would connect to the smart contract
        console.log('🔍 Checking for AI tasks...');
    }
}

// CLI usage
if (require.main === module) {
    const config = {
        nodeType: process.env.NODE_TYPE || 'auto' // auto-detect
    };

    const worker = new WorkerNode(config);
    worker.start().catch(console.error);
}

module.exports = WorkerNode;