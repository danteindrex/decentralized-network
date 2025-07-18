#!/usr/bin/env node

/**
 * Resource Configuration Tool
 * Easy way to configure how much of your system resources to contribute
 */

const fs = require('fs');
const path = require('path');
const readline = require('readline');

class ResourceConfigurator {
    constructor() {
        this.configPath = path.join(__dirname, 'resource-config.json');
        this.userConfigPath = path.join(__dirname, 'user-resource-config.json');
        this.config = this.loadConfig();
        
        this.rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });
    }

    loadConfig() {
        try {
            return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
        } catch (err) {
            console.error('❌ Could not load resource config:', err.message);
            process.exit(1);
        }
    }

    async start() {
        console.log('🔧 AI Compute Network - Resource Configuration');
        console.log('==============================================\n');
        
        console.log('This tool helps you configure how much of your system resources');
        console.log('to contribute to the AI compute network.\n');

        // Show current system info
        await this.showSystemInfo();
        
        // Show presets
        await this.showPresets();
        
        // Configure resources
        await this.configureResources();
        
        this.rl.close();
    }

    async showSystemInfo() {
        const WorkerNode = require('./worker/worker-node.js');
        const tempNode = new WorkerNode({ skipStart: true });
        
        console.log('💻 Your System Information:');
        console.log('----------------------------');
        console.log(`Platform: ${tempNode.capabilities.platform}`);
        console.log(`CPU: ${tempNode.capabilities.cpuModel}`);
        console.log(`CPU Cores: ${tempNode.capabilities.cpuCores}`);
        console.log(`Total RAM: ${tempNode.capabilities.totalMemory}GB`);
        console.log(`Total Storage: ${tempNode.capabilities.totalStorage}GB`);
        
        if (tempNode.capabilities.gpu.available) {
            console.log(`GPU: ${tempNode.capabilities.gpu.model}`);
            console.log(`GPU Memory: ${tempNode.capabilities.gpu.memory}GB`);
        } else {
            console.log('GPU: Not available');
        }
        console.log('');
    }

    async showPresets() {
        console.log('��� Available Presets:');
        console.log('---------------------');
        
        Object.entries(this.config.presets).forEach(([name, preset], index) => {
            console.log(`${index + 1}. ${name.toUpperCase()}`);
            console.log(`   ${preset.description}`);
            console.log(`   Storage: ${preset.storage}% | CPU: ${preset.cpu}% | RAM: ${preset.ram}% | GPU: ${preset.gpu}%`);
            console.log('');
        });
    }

    async configureResources() {
        const choice = await this.question('Choose configuration method:\n1. Use preset\n2. Custom configuration\n\nEnter choice (1-2): ');
        
        if (choice === '1') {
            await this.usePreset();
        } else if (choice === '2') {
            await this.customConfiguration();
        } else {
            console.log('❌ Invalid choice. Using balanced preset.');
            await this.applyPreset('balanced');
        }
    }

    async usePreset() {
        const presetNames = Object.keys(this.config.presets);
        console.log('\nAvailable presets:');
        presetNames.forEach((name, index) => {
            console.log(`${index + 1}. ${name}`);
        });
        
        const choice = await this.question('\nEnter preset number: ');
        const presetIndex = parseInt(choice) - 1;
        
        if (presetIndex >= 0 && presetIndex < presetNames.length) {
            const presetName = presetNames[presetIndex];
            await this.applyPreset(presetName);
        } else {
            console.log('❌ Invalid preset. Using balanced preset.');
            await this.applyPreset('balanced');
        }
    }

    async customConfiguration() {
        console.log('\n🎛️  Custom Resource Configuration');
        console.log('Enter the percentage of each resource to contribute:\n');
        
        const resources = {};
        
        // Configure each resource type
        for (const [resourceType, resourceConfig] of Object.entries(this.config.resourceContribution)) {
            const percentage = await this.configureResource(resourceType, resourceConfig);
            resources[resourceType] = percentage;
        }
        
        await this.applyCustomConfig(resources);
    }

    async configureResource(resourceType, resourceConfig) {
        const prompt = `${resourceType.toUpperCase()} (${resourceConfig.minimum}-${resourceConfig.maximum}%, default ${resourceConfig.percentage}%): `;
        const input = await this.question(prompt);
        
        if (input === '') {
            return resourceConfig.percentage;
        }
        
        const percentage = parseInt(input);
        
        if (isNaN(percentage) || percentage < resourceConfig.minimum || percentage > resourceConfig.maximum) {
            console.log(`⚠️  Invalid value. Using default ${resourceConfig.percentage}%`);
            return resourceConfig.percentage;
        }
        
        return percentage;
    }

    async applyPreset(presetName) {
        const preset = this.config.presets[presetName];
        if (!preset) {
            console.log('❌ Preset not found');
            return;
        }
        
        const userConfig = {
            preset: presetName,
            storageContribution: preset.storage,
            cpuContribution: preset.cpu,
            gpuContribution: preset.gpu,
            ramContribution: preset.ram,
            appliedAt: new Date().toISOString()
        };
        
        this.saveUserConfig(userConfig);
        
        console.log(`\n✅ Applied ${presetName.toUpperCase()} preset:`);
        console.log(`   Storage: ${preset.storage}%`);
        console.log(`   CPU: ${preset.cpu}%`);
        console.log(`   RAM: ${preset.ram}%`);
        console.log(`   GPU: ${preset.gpu}%`);
        
        await this.showEstimatedContribution(userConfig);
    }

    async applyCustomConfig(resources) {
        const userConfig = {
            preset: 'custom',
            storageContribution: resources.storage,
            cpuContribution: resources.cpu,
            gpuContribution: resources.gpu,
            ramContribution: resources.ram,
            appliedAt: new Date().toISOString()
        };
        
        this.saveUserConfig(userConfig);
        
        console.log('\n✅ Applied custom configuration:');
        console.log(`   Storage: ${resources.storage}%`);
        console.log(`   CPU: ${resources.cpu}%`);
        console.log(`   RAM: ${resources.ram}%`);
        console.log(`   GPU: ${resources.gpu}%`);
        
        await this.showEstimatedContribution(userConfig);
    }

    async showEstimatedContribution(userConfig) {
        const WorkerNode = require('./worker/worker-node.js');
        const tempNode = new WorkerNode({ 
            skipStart: true,
            ...userConfig
        });
        
        console.log('\n📊 Estimated Resource Contribution:');
        console.log('-----------------------------------');
        console.log(`Storage: ${tempNode.resourceAllocation.storage.allocated}GB of ${tempNode.capabilities.totalStorage}GB`);
        console.log(`CPU: ${tempNode.resourceAllocation.cpu.allocated} cores of ${tempNode.capabilities.cpuCores}`);
        console.log(`RAM: ${tempNode.resourceAllocation.ram.allocated}GB of ${tempNode.capabilities.totalMemory}GB`);
        
        if (tempNode.capabilities.gpu.available) {
            console.log(`GPU: ${tempNode.resourceAllocation.gpu.allocated}GB of ${tempNode.capabilities.gpu.memory}GB`);
        }
        
        console.log('\n💡 Tips:');
        console.log('- Higher contributions may earn more rewards');
        console.log('- Start conservative and increase gradually');
        console.log('- Monitor system performance after starting');
        console.log('- You can reconfigure anytime by running this tool again');
    }

    saveUserConfig(config) {
        try {
            fs.writeFileSync(this.userConfigPath, JSON.stringify(config, null, 2));
            console.log(`\n💾 Configuration saved to ${this.userConfigPath}`);
        } catch (err) {
            console.error('❌ Failed to save configuration:', err.message);
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
    const configurator = new ResourceConfigurator();
    configurator.start().catch(console.error);
}

module.exports = ResourceConfigurator;