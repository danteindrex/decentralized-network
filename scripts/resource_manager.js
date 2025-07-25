const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync, spawn } = require('child_process');

class ResourceManager {
    constructor(nodeId, config = {}) {
        this.nodeId = nodeId;
        this.config = {
            cpuPercent: 10,
            ramPercent: 15,
            gpuPercent: 10,
            storagePercent: 5,
            enforceHardLimits: true,
            useContainers: false,
            useCgroups: process.platform === 'linux',
            ...config
        };
        
        this.cgroupPath = `/sys/fs/cgroup/decentralized-vllm-${nodeId}`;
        this.capabilities = this.detectCapabilities();
        this.allocation = this.calculateAllocation();
        this.processes = new Map(); // Track spawned processes
    }

    detectCapabilities() {
        const cpuCores = os.cpus().length;
        const totalMemGB = Math.floor(os.totalmem() / (1024 * 1024 * 1024));
        const storage = this.detectStorage();
        const gpu = this.detectGPU();

        return { cpuCores, totalMemGB, storage, gpu };
    }

    detectStorage() {
        try {
            if (process.platform === 'linux' || process.platform === 'darwin') {
                const df = execSync('df -BG / | tail -1', { encoding: 'utf8' });
                const parts = df.trim().split(/\s+/);
                return {
                    totalGB: parseInt(parts[1].replace('G', '')),
                    freeGB: parseInt(parts[3].replace('G', ''))
                };
            }
        } catch (err) {
            console.warn('Could not detect storage:', err.message);
        }
        return { totalGB: 100, freeGB: 50 }; // Fallback
    }

    detectGPU() {
        try {
            if (process.platform === 'linux') {
                const nvidia = execSync('nvidia-smi --query-gpu=memory.total,name --format=csv,noheader,nounits', { encoding: 'utf8' });
                const lines = nvidia.trim().split('\n');
                if (lines.length > 0 && lines[0] !== '') {
                    const [memory, name] = lines[0].split(', ');
                    return {
                        available: true,
                        memoryMB: parseInt(memory),
                        model: name.trim()
                    };
                }
            }
        } catch (err) {
            // GPU not available or nvidia-smi not installed
        }
        return { available: false, memoryMB: 0, model: 'None' };
    }

    calculateAllocation() {
        return {
            cpu: {
                total: this.capabilities.cpuCores,
                allocated: Math.max(1, Math.floor(this.capabilities.cpuCores * this.config.cpuPercent / 100))
            },
            ram: {
                total: this.capabilities.totalMemGB,
                allocated: Math.floor(this.capabilities.totalMemGB * this.config.ramPercent / 100)
            },
            storage: {
                total: this.capabilities.storage.totalGB,
                allocated: Math.floor(this.capabilities.storage.totalGB * this.config.storagePercent / 100)
            },
            gpu: this.capabilities.gpu.available ? {
                total: Math.floor(this.capabilities.gpu.memoryMB / 1024),
                allocated: Math.floor((this.capabilities.gpu.memoryMB / 1024) * this.config.gpuPercent / 100)
            } : null
        };
    }

    async setupResourceLimits() {
        console.log('🔧 Setting up resource limits for node:', this.nodeId);
        
        const results = {};
        
        // Try cgroups first (Linux only)
        if (this.config.useCgroups && process.platform === 'linux') {
            results.cgroups = await this.setupCgroups();
        }
        
        // Setup storage quotas
        results.storage = await this.setupStorageQuota();
        
        // Setup process monitoring
        results.monitoring = this.setupProcessMonitoring();
        
        console.log('✅ Resource limits configured:', results);
        return results;
    }

    async setupCgroups() {
        try {
            // Check if cgroups v1 is available
            if (!fs.existsSync('/sys/fs/cgroup/memory')) {
                console.warn('⚠️ cgroups not available, using soft limits only');
                return { success: false, reason: 'cgroups_not_available' };
            }

            // Create memory cgroup
            const memoryPath = `/sys/fs/cgroup/memory/decentralized-vllm-${this.nodeId}`;
            if (!fs.existsSync(memoryPath)) {
                fs.mkdirSync(memoryPath, { recursive: true });
            }

            // Set memory limit (convert GB to bytes)
            const memoryLimitBytes = this.allocation.ram.allocated * 1024 * 1024 * 1024;
            fs.writeFileSync(`${memoryPath}/memory.limit_in_bytes`, memoryLimitBytes.toString());
            
            // Create CPU cgroup
            const cpuPath = `/sys/fs/cgroup/cpu/decentralized-vllm-${this.nodeId}`;
            if (!fs.existsSync(cpuPath)) {
                fs.mkdirSync(cpuPath, { recursive: true });
            }

            // Set CPU quota (allocated cores * 100000 microseconds per core)
            const cpuQuota = this.allocation.cpu.allocated * 100000;
            fs.writeFileSync(`${cpuPath}/cpu.cfs_quota_us`, cpuQuota.toString());
            fs.writeFileSync(`${cpuPath}/cpu.cfs_period_us`, '100000');

            console.log(`✅ cgroups configured - RAM: ${this.allocation.ram.allocated}GB, CPU: ${this.allocation.cpu.allocated} cores`);
            return { 
                success: true, 
                memoryPath, 
                cpuPath,
                memoryLimitGB: this.allocation.ram.allocated,
                cpuCores: this.allocation.cpu.allocated
            };

        } catch (err) {
            console.warn('⚠️ Failed to setup cgroups:', err.message);
            return { success: false, reason: err.message };
        }
    }

    async setupStorageQuota() {
        try {
            const storageDir = path.join(process.cwd(), 'data', `node-${this.nodeId}`, 'storage');
            
            // Create storage directory
            if (!fs.existsSync(storageDir)) {
                fs.mkdirSync(storageDir, { recursive: true });
            }

            // Create quota file
            const quotaInfo = {
                maxSizeGB: this.allocation.storage.allocated,
                currentSizeGB: 0,
                createdAt: new Date().toISOString(),
                nodeId: this.nodeId
            };

            const quotaFile = path.join(storageDir, '.quota');
            fs.writeFileSync(quotaFile, JSON.stringify(quotaInfo, null, 2));

            console.log(`✅ Storage quota set: ${this.allocation.storage.allocated}GB in ${storageDir}`);
            return { 
                success: true, 
                path: storageDir, 
                quotaGB: this.allocation.storage.allocated 
            };

        } catch (err) {
            console.warn('⚠️ Failed to setup storage quota:', err.message);
            return { success: false, reason: err.message };
        }
    }

    setupProcessMonitoring() {
        // Start monitoring resource usage
        this.monitoringInterval = setInterval(() => {
            this.monitorResourceUsage();
        }, 10000); // Every 10 seconds

        console.log('✅ Process monitoring started');
        return { success: true, interval: 10000 };
    }

    monitorResourceUsage() {
        try {
            const usage = {
                cpu: this.getCurrentCPUUsage(),
                ram: this.getCurrentRAMUsage(),
                storage: this.getCurrentStorageUsage(),
                timestamp: new Date().toISOString()
            };

            // Check for violations
            this.checkResourceViolations(usage);

            // Save usage stats
            this.saveUsageStats(usage);

        } catch (err) {
            console.warn('⚠️ Resource monitoring error:', err.message);
        }
    }

    getCurrentCPUUsage() {
        const loadAvg = os.loadavg()[0];
        return Math.min(100, (loadAvg / this.capabilities.cpuCores) * 100);
    }

    getCurrentRAMUsage() {
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        return Math.floor(usedMem / (1024 * 1024 * 1024));
    }

    getCurrentStorageUsage() {
        try {
            const storageDir = path.join(process.cwd(), 'data', `node-${this.nodeId}`, 'storage');
            if (!fs.existsSync(storageDir)) return 0;

            // Calculate directory size recursively
            const calculateSize = (dir) => {
                let size = 0;
                const files = fs.readdirSync(dir);
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    const stats = fs.statSync(filePath);
                    
                    if (stats.isDirectory()) {
                        size += calculateSize(filePath);
                    } else {
                        size += stats.size;
                    }
                }
                
                return size;
            };

            const sizeBytes = calculateSize(storageDir);
            return Math.floor(sizeBytes / (1024 * 1024 * 1024)); // Convert to GB

        } catch (err) {
            return 0;
        }
    }

    checkResourceViolations(usage) {
        const violations = [];

        if (usage.cpu > (this.allocation.cpu.allocated / this.capabilities.cpuCores * 100) * 1.2) {
            violations.push(`CPU usage (${usage.cpu.toFixed(1)}%) exceeds allocation`);
        }

        if (usage.ram > this.allocation.ram.allocated * 1.2) {
            violations.push(`RAM usage (${usage.ram}GB) exceeds allocation`);
        }

        if (usage.storage > this.allocation.storage.allocated) {
            violations.push(`Storage usage (${usage.storage}GB) exceeds allocation`);
        }

        if (violations.length > 0 && this.config.enforceHardLimits) {
            console.warn('🚨 Resource violations detected:', violations);
            this.enforceResourceLimits(violations);
        }
    }

    enforceResourceLimits(violations) {
        // Kill processes that exceed limits
        for (const [pid, processInfo] of this.processes) {
            try {
                if (processInfo.type === 'ai-inference' && violations.length > 0) {
                    console.warn(`🔨 Terminating process ${pid} due to resource violations`);
                    process.kill(pid, 'SIGTERM');
                    this.processes.delete(pid);
                }
            } catch (err) {
                // Process might already be dead
                this.processes.delete(pid);
            }
        }
    }

    spawnConstrainedProcess(command, args, options = {}) {
        const spawnOptions = {
            ...options,
            env: {
                ...process.env,
                ...options.env,
                // Set resource limits via environment
                ALLOCATED_CPU_CORES: this.allocation.cpu.allocated.toString(),
                ALLOCATED_RAM_GB: this.allocation.ram.allocated.toString(),
                ALLOCATED_STORAGE_GB: this.allocation.storage.allocated.toString(),
                NODE_ID: this.nodeId
            }
        };

        const child = spawn(command, args, spawnOptions);
        
        // Track the process
        this.processes.set(child.pid, {
            type: options.processType || 'unknown',
            command,
            args,
            startTime: Date.now()
        });

        // Add to cgroup if available
        if (this.config.useCgroups && fs.existsSync(`/sys/fs/cgroup/memory/decentralized-vllm-${this.nodeId}`)) {
            try {
                fs.writeFileSync(`/sys/fs/cgroup/memory/decentralized-vllm-${this.nodeId}/cgroup.procs`, child.pid.toString());
                fs.writeFileSync(`/sys/fs/cgroup/cpu/decentralized-vllm-${this.nodeId}/cgroup.procs`, child.pid.toString());
                console.log(`✅ Process ${child.pid} added to cgroups`);
            } catch (err) {
                console.warn(`⚠️ Failed to add process ${child.pid} to cgroups:`, err.message);
            }
        }

        // Clean up when process exits
        child.on('exit', () => {
            this.processes.delete(child.pid);
        });

        return child;
    }

    saveUsageStats(usage) {
        const statsDir = path.join(process.cwd(), 'data', `node-${this.nodeId}`, 'stats');
        if (!fs.existsSync(statsDir)) {
            fs.mkdirSync(statsDir, { recursive: true });
        }

        const statsFile = path.join(statsDir, 'resource-usage.json');
        let stats = [];

        try {
            if (fs.existsSync(statsFile)) {
                stats = JSON.parse(fs.readFileSync(statsFile, 'utf8'));
            }
        } catch (err) {
            stats = [];
        }

        stats.push(usage);

        // Keep only last 1000 entries
        if (stats.length > 1000) {
            stats = stats.slice(-1000);
        }

        fs.writeFileSync(statsFile, JSON.stringify(stats, null, 2));
    }

    getResourceReport() {
        const currentUsage = {
            cpu: this.getCurrentCPUUsage(),
            ram: this.getCurrentRAMUsage(),
            storage: this.getCurrentStorageUsage()
        };

        return {
            nodeId: this.nodeId,
            capabilities: this.capabilities,
            allocation: this.allocation,
            currentUsage,
            utilization: {
                cpu: (currentUsage.cpu / (this.allocation.cpu.allocated / this.capabilities.cpuCores * 100) * 100).toFixed(1) + '%',
                ram: (currentUsage.ram / this.allocation.ram.allocated * 100).toFixed(1) + '%',
                storage: (currentUsage.storage / this.allocation.storage.allocated * 100).toFixed(1) + '%'
            },
            activeProcesses: this.processes.size
        };
    }

    cleanup() {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
        }

        // Terminate all tracked processes
        for (const [pid, processInfo] of this.processes) {
            try {
                process.kill(pid, 'SIGTERM');
            } catch (err) {
                // Process might already be dead
            }
        }

        console.log('✅ Resource manager cleanup completed');
    }
}

module.exports = ResourceManager;