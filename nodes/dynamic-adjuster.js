#!/usr/bin/env node

/**
 * Dynamic Resource Adjuster
 * Allows real-time adjustment of compute contribution percentages
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawn } = require('child_process');

class DynamicAdjuster {
    constructor() {
        this.configPath = path.join(__dirname, 'user-resource-config.json');
        this.runtimeConfigPath = path.join(__dirname, 'runtime-config.json');
        this.nodeProcesses = new Map();
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    async start() {
        console.log('🎛️  AI Compute Network - Dynamic Resource Adjuster');
        console.log('================================================\n');
        
        // Check if any nodes are running
        await this.detectRunningNodes();
        
        // Show current configuration
        await this.showCurrentConfig();
        
        // Main adjustment loop
        await this.adjustmentLoop();
        
        this.rl.close();
    }

    async detectRunningNodes() {
        console.log('🔍 Detecting running nodes...');
        
        try {
            // Check for running geth processes (simplified detection)
            const { execSync } = require('child_process');
            const processes = execSync('ps aux | grep -E "(geth|node.*worker)" | grep -v grep', { encoding: 'utf8' });
            
            if (processes.trim()) {
                console.log('✅ Found running nodes:');
                processes.split('\n').forEach(line => {
                    if (line.trim()) {
                        const parts = line.trim().split(/\s+/);
                        const pid = parts[1];
                        const command = parts.slice(10).join(' ');
                        console.log(`   PID ${pid}: ${command.substring(0, 80)}...`);
                    }
                });
            } else {
                console.log('⚠️  No running nodes detected');
            }
        } catch (err) {
            console.log('⚠️  Could not detect running processes');
        }
        
        console.log('');
    }

    async showCurrentConfig() {
        try {
            const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
            
            console.log('📊 Current Resource Configuration:');
            console.log('----------------------------------');
            console.log(`Storage: ${config.storageContribution}%`);
            console.log(`CPU: ${config.cpuContribution}%`);
            console.log(`RAM: ${config.ramContribution}%`);
            console.log(`GPU: ${config.gpuContribution}%`);
            console.log(`Applied: ${new Date(config.appliedAt).toLocaleString()}`);
            console.log('');
            
        } catch (err) {
            console.log('⚠️  No configuration found. Run configure-resources.js first.\n');
        }
    }

    async adjustmentLoop() {
        while (true) {
            console.log('🎛️  Adjustment Options:');
            console.log('1. Increase CPU contribution');
            console.log('2. Decrease CPU contribution');
            console.log('3. Increase GPU contribution');
            console.log('4. Decrease GPU contribution');
            console.log('5. Increase RAM contribution');
            console.log('6. Decrease RAM contribution');
            console.log('7. Increase Storage contribution');
            console.log('8. Decrease Storage contribution');
            console.log('9. Set custom percentages');
            console.log('10. Show current usage');
            console.log('11. Apply preset');
            console.log('12. Reset to defaults');
            console.log('0. Exit');
            
            const choice = await this.question('\nEnter your choice (0-12): ');
            
            switch (choice) {
                case '1':
                    await this.adjustResource('cpu', 5);
                    break;
                case '2':
                    await this.adjustResource('cpu', -5);
                    break;
                case '3':
                    await this.adjustResource('gpu', 5);
                    break;
                case '4':
                    await this.adjustResource('gpu', -5);
                    break;
                case '5':
                    await this.adjustResource('ram', 5);
                    break;
                case '6':
                    await this.adjustResource('ram', -5);
                    break;
                case '7':
                    await this.adjustResource('storage', 2);
                    break;
                case '8':
                    await this.adjustResource('storage', -2);
                    break;
                case '9':
                    await this.setCustomPercentages();
                    break;
                case '10':
                    await this.showCurrentUsage();
                    break;
                case '11':
                    await this.applyPreset();
                    break;
                case '12':
                    await this.resetToDefaults();
                    break;
                case '0':
                    console.log('👋 Goodbye!');
                    return;
                default:
                    console.log('❌ Invalid choice. Please try again.\n');
            }
        }
    }

    async adjustResource(resourceType, delta) {
        try {
            const config = this.loadCurrentConfig();
            const resourceKey = resourceType + 'Contribution';
            const currentValue = config[resourceKey] || 0;
            const newValue = Math.max(0, Math.min(100, currentValue + delta));
            
            if (newValue === currentValue) {
                console.log(`⚠️  ${resourceType.toUpperCase()} already at ${delta > 0 ? 'maximum' : 'minimum'} safe limit\n`);
                return;
            }
            
            config[resourceKey] = newValue;
            config.lastModified = new Date().toISOString();
            
            // Apply the change
            await this.applyConfigChange(config);
            
            console.log(`✅ ${resourceType.toUpperCase()} contribution ${delta > 0 ? 'increased' : 'decreased'} to ${newValue}%`);
            
            // Show impact
            await this.showResourceImpact(resourceType, currentValue, newValue);
            
        } catch (err) {
            console.log(`❌ Failed to adjust ${resourceType}:`, err.message);
        }
        
        console.log('');
    }

    async setCustomPercentages() {
        console.log('\n🎯 Set Custom Percentages:');
        console.log('-------------------------');
        
        const config = this.loadCurrentConfig();
        
        const newCpu = await this.getValidPercentage('CPU', config.cpuContribution, 0, 80);
        const newGpu = await this.getValidPercentage('GPU', config.gpuContribution, 0, 90);
        const newRam = await this.getValidPercentage('RAM', config.ramContribution, 0, 70);
        const newStorage = await this.getValidPercentage('Storage', config.storageContribution, 0, 50);
        
        config.cpuContribution = newCpu;
        config.gpuContribution = newGpu;
        config.ramContribution = newRam;
        config.storageContribution = newStorage;
        config.lastModified = new Date().toISOString();
        
        await this.applyConfigChange(config);
        
        console.log('\n✅ Custom configuration applied:');
        console.log(`   CPU: ${newCpu}%`);
        console.log(`   GPU: ${newGpu}%`);
        console.log(`   RAM: ${newRam}%`);
        console.log(`   Storage: ${newStorage}%`);
        console.log('');
    }

    async getValidPercentage(resourceName, currentValue, min, max) {
        while (true) {
            const input = await this.question(`${resourceName} (${min}-${max}%, current: ${currentValue}%): `);
            
            if (input === '') {
                return currentValue;
            }
            
            const value = parseInt(input);
            
            if (!isNaN(value) && value >= min && value <= max) {
                return value;
            }
            
            console.log(`⚠️  Please enter a value between ${min} and ${max}`);
        }
    }

    async showCurrentUsage() {
        console.log('\n📊 Current Resource Usage:');
        console.log('-------------------------');
        
        try {
            // Find worker data directories
            const dataDir = path.join(__dirname, '../data');
            if (!fs.existsSync(dataDir)) {
                console.log('⚠️  No worker data found. Start a worker node first.');
                return;
            }
            
            const workerDirs = fs.readdirSync(dataDir).filter(dir => dir.startsWith('worker-'));
            
            if (workerDirs.length === 0) {
                console.log('⚠️  No worker nodes found.');
                return;
            }
            
            // Show usage for each worker
            for (const workerDir of workerDirs.slice(0, 3)) { // Show max 3 workers
                const statsPath = path.join(dataDir, workerDir, 'resource-stats.json');
                
                if (fs.existsSync(statsPath)) {
                    const stats = JSON.parse(fs.readFileSync(statsPath, 'utf8'));
                    const latest = stats[stats.length - 1];
                    
                    if (latest) {
                        console.log(`Worker ${workerDir}:`);
                        console.log(`   CPU: ${latest.cpu.toFixed(1)}%`);
                        console.log(`   RAM: ${latest.ram}GB`);
                        console.log(`   Storage: ${latest.storage}GB`);
                        console.log(`   Last updated: ${new Date(latest.timestamp).toLocaleTimeString()}`);
                        console.log('');
                    }
                }
            }
            
        } catch (err) {
            console.log('⚠️  Could not read usage stats:', err.message);
        }
    }

    async applyPreset() {
        const presets = {
            '1': { name: 'conservative', cpu: 5, gpu: 5, ram: 10, storage: 2 },
            '2': { name: 'balanced', cpu: 10, gpu: 10, ram: 15, storage: 5 },
            '3': { name: 'generous', cpu: 20, gpu: 25, ram: 30, storage: 10 },
            '4': { name: 'mobile', cpu: 5, gpu: 0, ram: 5, storage: 1 }
        };
        
        console.log('\n📋 Available Presets:');
        console.log('1. Conservative (5% CPU, 5% GPU, 10% RAM, 2% Storage)');
        console.log('2. Balanced (10% CPU, 10% GPU, 15% RAM, 5% Storage)');
        console.log('3. Generous (20% CPU, 25% GPU, 30% RAM, 10% Storage)');
        console.log('4. Mobile (5% CPU, 0% GPU, 5% RAM, 1% Storage)');
        
        const choice = await this.question('\nSelect preset (1-4): ');
        const preset = presets[choice];
        
        if (!preset) {
            console.log('❌ Invalid preset selection.\n');
            return;
        }
        
        const config = this.loadCurrentConfig();
        config.cpuContribution = preset.cpu;
        config.gpuContribution = preset.gpu;
        config.ramContribution = preset.ram;
        config.storageContribution = preset.storage;
        config.preset = preset.name;
        config.lastModified = new Date().toISOString();
        
        await this.applyConfigChange(config);
        
        console.log(`\n✅ Applied ${preset.name} preset successfully!\n`);
    }

    async resetToDefaults() {
        const confirm = await this.question('⚠️  Reset to default configuration? (y/N): ');
        
        if (confirm.toLowerCase() !== 'y') {
            console.log('❌ Reset cancelled.\n');
            return;
        }
        
        const config = {
            preset: 'balanced',
            storageContribution: 5,
            cpuContribution: 10,
            gpuContribution: 10,
            ramContribution: 15,
            appliedAt: new Date().toISOString(),
            lastModified: new Date().toISOString()
        };
        
        await this.applyConfigChange(config);
        
        console.log('✅ Reset to default balanced configuration.\n');
    }

    loadCurrentConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (err) {
            // Return default config if none exists
            return {
                preset: 'balanced',
                storageContribution: 5,
                cpuContribution: 10,
                gpuContribution: 10,
                ramContribution: 15,
                appliedAt: new Date().toISOString()
            };
        }
    }

    async applyConfigChange(config) {
        // Save the new configuration
        fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
        
        // Create runtime config for running nodes
        const runtimeConfig = {
            ...config,
            action: 'update_resources',
            timestamp: new Date().toISOString()
        };
        
        fs.writeFileSync(this.runtimeConfigPath, JSON.stringify(runtimeConfig, null, 2));
        
        // Signal running nodes to reload configuration
        await this.signalRunningNodes();
    }

    async signalRunningNodes() {
        try {
            // Create a signal file that running nodes can watch
            const signalPath = path.join(__dirname, '.resource-update-signal');
            fs.writeFileSync(signalPath, new Date().toISOString());
            
            console.log('📡 Signaled running nodes to update configuration');
            
            // Clean up signal file after a moment
            setTimeout(() => {
                if (fs.existsSync(signalPath)) {
                    fs.unlinkSync(signalPath);
                }
            }, 5000);
            
        } catch (err) {
            console.log('⚠️  Could not signal running nodes:', err.message);
        }
    }

    async showResourceImpact(resourceType, oldValue, newValue) {
        try {
            const WorkerNode = require('./worker/worker-node.js');
            
            // Create temporary node instances to calculate impact
            const oldConfig = { [resourceType + 'Contribution']: oldValue };
            const newConfig = { [resourceType + 'Contribution']: newValue };
            
            const oldNode = new WorkerNode({ ...oldConfig, skipStart: true });
            const newNode = new WorkerNode({ ...newConfig, skipStart: true });
            
            const oldAllocation = oldNode.resourceAllocation[resourceType];
            const newAllocation = newNode.resourceAllocation[resourceType];
            
            const change = newAllocation.allocated - oldAllocation.allocated;
            const unit = resourceType === 'cpu' ? 'cores' : 'GB';
            
            console.log(`📈 Impact: ${change > 0 ? '+' : ''}${change} ${unit} (${oldAllocation.allocated} → ${newAllocation.allocated} ${unit})`);
            
        } catch (err) {
            // Ignore impact calculation errors
        }
    }

    question(prompt) {
        return new Promise((resolve) => {
            this.rl.question(prompt, resolve);
        });
    }
}

// CLI usage
if (require.main === module) {
    const adjuster = new DynamicAdjuster();
    adjuster.start().catch(console.error);
}

module.exports = DynamicAdjuster;