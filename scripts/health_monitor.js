const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

class HealthMonitor {
    constructor(nodeType, nodeId, config = {}) {
        this.nodeType = nodeType;
        this.nodeId = nodeId;
        this.config = {
            port: config.healthPort || 9090,
            metricsPort: config.metricsPort || 9091,
            checkInterval: config.checkInterval || 30000, // 30 seconds
            ...config
        };
        
        this.app = express();
        this.metricsApp = express();
        
        this.healthData = {
            status: 'starting',
            uptime: 0,
            lastCheck: null,
            services: {},
            resources: {},
            errors: []
        };
        
        this.setupRoutes();
        this.startHealthChecks();
    }
    
    setupRoutes() {
        // Health check endpoint
        this.app.get('/health', (req, res) => {
            const health = this.getHealthStatus();
            const statusCode = health.status === 'healthy' ? 200 : 503;
            
            res.status(statusCode).json({
                nodeType: this.nodeType,
                nodeId: this.nodeId,
                timestamp: new Date().toISOString(),
                ...health
            });
        });
        
        // Detailed health information
        this.app.get('/health/detailed', (req, res) => {
            res.json({
                nodeType: this.nodeType,
                nodeId: this.nodeId,
                timestamp: new Date().toISOString(),
                ...this.healthData,
                system: this.getSystemInfo(),
                process: this.getProcessInfo()
            });
        });
        
        // Ready check (for Kubernetes-style deployments)
        this.app.get('/ready', (req, res) => {
            const ready = this.isReady();
            res.status(ready ? 200 : 503).json({
                ready,
                nodeType: this.nodeType,
                nodeId: this.nodeId,
                timestamp: new Date().toISOString()
            });
        });
        
        // Live check
        this.app.get('/live', (req, res) => {
            res.json({
                alive: true,
                nodeType: this.nodeType,
                nodeId: this.nodeId,
                timestamp: new Date().toISOString(),
                uptime: process.uptime()
            });
        });
        
        // Metrics endpoint (Prometheus-style)
        this.metricsApp.get('/metrics', (req, res) => {
            res.set('Content-Type', 'text/plain');
            res.send(this.getPrometheusMetrics());
        });
        
        // Resource usage endpoint
        this.app.get('/resources', (req, res) => {
            res.json({
                nodeType: this.nodeType,
                nodeId: this.nodeId,
                timestamp: new Date().toISOString(),
                resources: this.getResourceUsage()
            });
        });
    }
    
    getHealthStatus() {
        const now = Date.now();
        const uptime = process.uptime();
        
        // Determine overall health status
        let status = 'healthy';
        const issues = [];
        
        // Check service health
        for (const [serviceName, serviceHealth] of Object.entries(this.healthData.services)) {
            if (!serviceHealth.healthy) {
                status = 'degraded';
                issues.push(`${serviceName}: ${serviceHealth.error || 'unhealthy'}`);
            }
        }
        
        // Check resource constraints
        const resources = this.getResourceUsage();
        if (resources.cpu > 90) {
            status = 'degraded';
            issues.push(`High CPU usage: ${resources.cpu.toFixed(1)}%`);
        }
        
        if (resources.memory.usage > 90) {
            status = 'degraded';
            issues.push(`High memory usage: ${resources.memory.usage.toFixed(1)}%`);
        }
        
        // If too many issues, mark as unhealthy
        if (issues.length > 2) {
            status = 'unhealthy';
        }
        
        return {
            status,
            uptime: uptime,
            lastCheck: new Date().toISOString(),
            issues: issues.length > 0 ? issues : undefined,
            services: Object.keys(this.healthData.services).length,
            healthyServices: Object.values(this.healthData.services).filter(s => s.healthy).length
        };
    }
    
    isReady() {
        // Node is ready if all critical services are healthy
        const criticalServices = ['blockchain', 'storage']; // Define based on node type
        
        return criticalServices.every(service => 
            this.healthData.services[service] && this.healthData.services[service].healthy
        );
    }
    
    getSystemInfo() {
        return {
            platform: os.platform(),
            arch: os.arch(),
            nodeVersion: process.version,
            hostname: os.hostname(),
            loadAverage: os.loadavg(),
            cpus: os.cpus().length,
            totalMemory: os.totalmem(),
            freeMemory: os.freemem()
        };
    }
    
    getProcessInfo() {
        const memUsage = process.memoryUsage();
        
        return {
            pid: process.pid,
            uptime: process.uptime(),
            memoryUsage: {
                rss: memUsage.rss,
                heapTotal: memUsage.heapTotal,
                heapUsed: memUsage.heapUsed,
                external: memUsage.external
            }
        };
    }
    
    getResourceUsage() {
        const memUsage = process.memoryUsage();
        const totalMem = os.totalmem();
        const freeMem = os.freemem();
        const usedMem = totalMem - freeMem;
        
        return {
            cpu: this.getCurrentCPUUsage(),
            memory: {
                total: Math.floor(totalMem / (1024 * 1024 * 1024)), // GB
                used: Math.floor(usedMem / (1024 * 1024 * 1024)), // GB
                free: Math.floor(freeMem / (1024 * 1024 * 1024)), // GB
                usage: (usedMem / totalMem) * 100, // Percentage
                process: {
                    rss: Math.floor(memUsage.rss / (1024 * 1024)), // MB
                    heap: Math.floor(memUsage.heapUsed / (1024 * 1024)) // MB
                }
            },
            storage: this.getStorageUsage(),
            network: this.getNetworkInfo()
        };
    }
    
    getCurrentCPUUsage() {
        const loadAvg = os.loadavg()[0]; // 1-minute load average
        const cpuCount = os.cpus().length;
        return Math.min(100, (loadAvg / cpuCount) * 100);
    }
    
    getStorageUsage() {
        try {
            // This is a simplified version - in production you'd check actual disk usage
            const dataDir = path.join(process.cwd(), 'data');
            if (fs.existsSync(dataDir)) {
                const stats = fs.statSync(dataDir);
                return {
                    dataDirectory: dataDir,
                    exists: true,
                    size: stats.size
                };
            }
        } catch (err) {
            return { error: err.message };
        }
        return { exists: false };
    }
    
    getNetworkInfo() {
        const interfaces = os.networkInterfaces();
        const networkInfo = {};
        
        for (const [name, addresses] of Object.entries(interfaces)) {
            networkInfo[name] = addresses.filter(addr => !addr.internal);
        }
        
        return networkInfo;
    }
    
    getPrometheusMetrics() {
        const resources = this.getResourceUsage();
        const uptime = process.uptime();
        const memUsage = process.memoryUsage();
        
        let metrics = '';
        
        // Node uptime
        metrics += `# HELP node_uptime_seconds Process uptime in seconds\n`;
        metrics += `# TYPE node_uptime_seconds counter\n`;
        metrics += `node_uptime_seconds{node_type="${this.nodeType}",node_id="${this.nodeId}"} ${uptime}\n\n`;
        
        // CPU usage
        metrics += `# HELP node_cpu_usage CPU usage percentage\n`;
        metrics += `# TYPE node_cpu_usage gauge\n`;
        metrics += `node_cpu_usage{node_type="${this.nodeType}",node_id="${this.nodeId}"} ${resources.cpu}\n\n`;
        
        // Memory metrics
        metrics += `# HELP node_memory_usage_bytes Memory usage in bytes\n`;
        metrics += `# TYPE node_memory_usage_bytes gauge\n`;
        metrics += `node_memory_usage_bytes{node_type="${this.nodeType}",node_id="${this.nodeId}",type="rss"} ${memUsage.rss}\n`;
        metrics += `node_memory_usage_bytes{node_type="${this.nodeType}",node_id="${this.nodeId}",type="heap_total"} ${memUsage.heapTotal}\n`;
        metrics += `node_memory_usage_bytes{node_type="${this.nodeType}",node_id="${this.nodeId}",type="heap_used"} ${memUsage.heapUsed}\n\n`;
        
        // Service health
        metrics += `# HELP node_service_healthy Service health status (1=healthy, 0=unhealthy)\n`;
        metrics += `# TYPE node_service_healthy gauge\n`;
        for (const [serviceName, serviceHealth] of Object.entries(this.healthData.services)) {
            const healthValue = serviceHealth.healthy ? 1 : 0;
            metrics += `node_service_healthy{node_type="${this.nodeType}",node_id="${this.nodeId}",service="${serviceName}"} ${healthValue}\n`;
        }
        
        return metrics;
    }
    
    // Service registration methods
    registerService(serviceName, healthChecker) {
        this.healthData.services[serviceName] = {
            healthy: false,
            lastCheck: null,
            error: null,
            checker: healthChecker
        };
    }
    
    updateServiceHealth(serviceName, healthy, error = null) {
        if (this.healthData.services[serviceName]) {
            this.healthData.services[serviceName] = {
                ...this.healthData.services[serviceName],
                healthy,
                error,
                lastCheck: new Date().toISOString()
            };
        }
    }
    
    async checkServiceHealth(serviceName) {
        const service = this.healthData.services[serviceName];
        if (!service || !service.checker) return;
        
        try {
            const result = await service.checker();
            this.updateServiceHealth(serviceName, result.healthy, result.error);
        } catch (err) {
            this.updateServiceHealth(serviceName, false, err.message);
        }
    }
    
    startHealthChecks() {
        // Update health status regularly
        setInterval(() => {
            this.healthData.uptime = process.uptime();
            this.healthData.lastCheck = new Date().toISOString();
            this.healthData.resources = this.getResourceUsage();
            
            // Check all registered services
            for (const serviceName of Object.keys(this.healthData.services)) {
                this.checkServiceHealth(serviceName);
            }
            
        }, this.config.checkInterval);
        
        console.log(`📊 Health monitoring started for ${this.nodeType}:${this.nodeId}`);
    }
    
    start() {
        return new Promise((resolve, reject) => {
            try {
                // Start health endpoint
                this.healthServer = this.app.listen(this.config.port, () => {
                    console.log(`✅ Health endpoint listening on port ${this.config.port}`);
                    console.log(`   Health: http://localhost:${this.config.port}/health`);
                    console.log(`   Ready: http://localhost:${this.config.port}/ready`);
                    console.log(`   Live: http://localhost:${this.config.port}/live`);
                });
                
                // Start metrics endpoint
                this.metricsServer = this.metricsApp.listen(this.config.metricsPort, () => {
                    console.log(`📈 Metrics endpoint listening on port ${this.config.metricsPort}`);
                    console.log(`   Metrics: http://localhost:${this.config.metricsPort}/metrics`);
                });
                
                this.healthData.status = 'healthy';
                resolve();
                
            } catch (err) {
                reject(err);
            }
        });
    }
    
    stop() {
        return new Promise((resolve) => {
            let stopped = 0;
            const onStop = () => {
                stopped++;
                if (stopped === 2) resolve();
            };
            
            if (this.healthServer) {
                this.healthServer.close(onStop);
            } else {
                onStop();
            }
            
            if (this.metricsServer) {
                this.metricsServer.close(onStop);
            } else {
                onStop();
            }
        });
    }
}

module.exports = HealthMonitor;