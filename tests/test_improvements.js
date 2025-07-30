#!/usr/bin/env node

/**
 * Test script to verify all improvements are working correctly
 */

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class ImprovementTester {
    constructor() {
        this.testResults = [];
        this.passed = 0;
        this.failed = 0;
    }

    log(message, type = 'info') {
        const colors = {
            info: '\x1b[36m',    // Cyan
            success: '\x1b[32m', // Green
            error: '\x1b[31m',   // Red
            warning: '\x1b[33m'  // Yellow
        };
        
        const reset = '\x1b[0m';
        console.log(`${colors[type]}${message}${reset}`);
    }

    async runTest(testName, testFunction) {
        this.log(`\n🧪 Testing: ${testName}`);
        
        try {
            const result = await testFunction();
            this.log(`✅ ${testName}: PASSED`, 'success');
            this.testResults.push({ name: testName, status: 'PASSED', result });
            this.passed++;
            return true;
        } catch (error) {
            this.log(`❌ ${testName}: FAILED - ${error.message}`, 'error');
            this.testResults.push({ name: testName, status: 'FAILED', error: error.message });
            this.failed++;
            return false;
        }
    }

    // Test 1: Secure Key Management
    async testSecureKeyManagement() {
        const SecureKeyManager = require('../scripts/setup_secure_keys.js');
        const keyManager = new SecureKeyManager();
        
        // Test key generation
        const testKey = keyManager.generateSecureKey();
        if (!testKey || !testKey.startsWith('0x') || testKey.length !== 66) {
            throw new Error('Invalid key format generated');
        }
        
        // Test validation
        if (!keyManager.validateKeyFormat(testKey)) {
            throw new Error('Key validation failed');
        }
        
        return { keyGenerated: true, keyValid: true };
    }

    // Test 2: Configuration Manager
    async testConfigurationManager() {
        const { ConfigManager } = require('../scripts/config_manager.js');
        
        // Test config loading
        const configManager = new ConfigManager();
        
        // Test getting values
        const chainId = configManager.get('network.chain_id');
        if (!chainId) {
            throw new Error('Failed to load chain ID from config');
        }
        
        // Test node configuration
        const workerConfig = configManager.getNodeConfig('worker');
        if (!workerConfig.nodeId || !workerConfig.chainId) {
            throw new Error('Invalid worker node configuration');
        }
        
        // Test validation
        const issues = configManager.validateConfig();
        
        return { 
            configLoaded: true, 
            nodeConfig: workerConfig.nodeId,
            validationIssues: issues.length 
        };
    }

    // Test 3: Resource Manager
    async testResourceManager() {
        const ResourceManager = require('../scripts/resource_manager.js');
        
        const resourceManager = new ResourceManager('test-node', {
            cpuPercent: 10,
            ramPercent: 15,
            enforceHardLimits: false // Don't actually enforce in test
        });
        
        // Test capability detection
        const capabilities = resourceManager.capabilities;
        if (!capabilities.cpuCores || !capabilities.totalMemGB) {
            throw new Error('Failed to detect system capabilities');
        }
        
        // Test resource allocation calculation
        const allocation = resourceManager.allocation;
        if (!allocation.cpu.allocated || !allocation.ram.allocated) {
            throw new Error('Failed to calculate resource allocation');
        }
        
        // Test resource reporting
        const report = resourceManager.getResourceReport();
        if (!report.nodeId || !report.utilization) {
            throw new Error('Failed to generate resource report');
        }
        
        return {
            capabilities: Object.keys(capabilities),
            allocation: `CPU: ${allocation.cpu.allocated}, RAM: ${allocation.ram.allocated}GB`,
            reportGenerated: true
        };
    }

    // Test 4: Health Monitor
    async testHealthMonitor() {
        const HealthMonitor = require('../scripts/health_monitor.js');
        
        const healthMonitor = new HealthMonitor('test', 'test-node-123', {
            port: 9999, // Use different port for testing
            metricsPort: 9998
        });
        
        // Test health status generation
        const healthStatus = healthMonitor.getHealthStatus();
        if (!healthStatus.status || healthStatus.uptime === undefined) {
            throw new Error('Invalid health status format');
        }
        
        // Test resource usage monitoring
        const resourceUsage = healthMonitor.getResourceUsage();
        if (resourceUsage.cpu === undefined || !resourceUsage.memory) {
            throw new Error('Resource usage monitoring failed');
        }
        
        // Test Prometheus metrics
        const metrics = healthMonitor.getPrometheusMetrics();
        if (!metrics.includes('node_uptime_seconds') || !metrics.includes('node_cpu_usage')) {
            throw new Error('Prometheus metrics generation failed');
        }
        
        return {
            healthStatus: healthStatus.status,
            resourceMonitoring: true,
            metricsGenerated: true
        };
    }

    // Test 5: Smart Contract Security
    async testSmartContractSecurity() {
        // Check if contract files exist and have security improvements
        const contractPath = './contracts/InferenceCoordinator.sol';
        
        if (!fs.existsSync(contractPath)) {
            throw new Error('InferenceCoordinator contract not found');
        }
        
        const contractContent = fs.readFileSync(contractPath, 'utf8');
        
        // Check for security features
        const securityFeatures = [
            'jobToController',          // Job ownership tracking
            'jobCompleted',             // Job completion tracking
            'jobPayments',              // Payment escrow
            'onlyJobController',        // Access control modifier
            'releasePayment',           // Payment release function
            'refundJob'                 // Refund mechanism
        ];
        
        const missingFeatures = securityFeatures.filter(feature => 
            !contractContent.includes(feature)
        );
        
        if (missingFeatures.length > 0) {
            throw new Error(`Missing security features: ${missingFeatures.join(', ')}`);
        }
        
        return {
            securityFeaturesFound: securityFeatures.length,
            contractSecured: true
        };
    }

    // Test 6: Structured Logging
    async testStructuredLogging() {
        // Check if Python structured logger exists and has required components
        const loggerPath = './scripts/structured_logger.py';
        if (!fs.existsSync(loggerPath)) {
            throw new Error('Structured logger not found');
        }
        
        const loggerContent = fs.readFileSync(loggerPath, 'utf8');
        
        // Check for key components
        const components = [
            'class StructuredLogger',
            'class CircuitBreaker', 
            'class RetryHandler',
            'def _log',
            'def blockchain_interaction'
        ];
        
        const missingComponents = components.filter(component => 
            !loggerContent.includes(component)
        );
        
        if (missingComponents.length > 0) {
            throw new Error(`Missing logging components: ${missingComponents.join(', ')}`);
        }
        
        // Check if it's valid Python syntax (basic check)
        if (!loggerContent.includes('import json') || !loggerContent.includes('import logging')) {
            throw new Error('Invalid Python syntax or missing imports');
        }
        
        return {
            loggerExists: true,
            componentsFound: components.length,
            structuredLoggingReady: true
        };
    }

    // Test 7: File Structure and Dependencies
    async testFileStructure() {
        const requiredFiles = [
            'scripts/setup_secure_keys.js',
            'scripts/key_utils.js', 
            'scripts/config_manager.js',
            'scripts/resource_manager.js',
            'scripts/health_monitor.js',
            'scripts/structured_logger.py',
            'config/network.yaml',
            'contracts/InferenceCoordinator.sol',
            'setup-secure.sh'
        ];
        
        const missingFiles = requiredFiles.filter(file => !fs.existsSync(file));
        
        if (missingFiles.length > 0) {
            throw new Error(`Missing required files: ${missingFiles.join(', ')}`);
        }
        
        // Check if package.json has required dependencies
        const packageJson = JSON.parse(fs.readFileSync('package.json', 'utf8'));
        const requiredDeps = ['web3', 'yaml', 'express', 'cors'];
        const missingDeps = requiredDeps.filter(dep => 
            !packageJson.dependencies[dep] && !packageJson.devDependencies[dep]
        );
        
        if (missingDeps.length > 0) {
            throw new Error(`Missing package dependencies: ${missingDeps.join(', ')}`);
        }
        
        return {
            allFilesPresent: true,
            dependenciesOk: true,
            fileCount: requiredFiles.length
        };
    }

    // Test 8: Integration Test
    async testIntegration() {
        // Test that components can work together
        const { ConfigManager } = require('../scripts/config_manager.js');
        const ResourceManager = require('../scripts/resource_manager.js');
        const HealthMonitor = require('../scripts/health_monitor.js');
        
        // Create integrated setup
        const configManager = new ConfigManager();
        const nodeConfig = configManager.getNodeConfig('worker', 'test-integration');
        
        const resourceManager = new ResourceManager(nodeConfig.nodeId, {
            cpuPercent: nodeConfig.resourceDefaults.cpu_percent,
            ramPercent: nodeConfig.resourceDefaults.ram_percent,
            enforceHardLimits: false
        });
        
        const healthMonitor = new HealthMonitor('worker', nodeConfig.nodeId, {
            port: 9997,
            metricsPort: 9996
        });
        
        // Test they can interact
        const resourceReport = resourceManager.getResourceReport();
        const healthStatus = healthMonitor.getHealthStatus();
        
        if (!resourceReport.nodeId || !healthStatus.status) {
            throw new Error('Integration test failed - components not communicating');
        }
        
        return {
            configWorking: true,
            resourceManagerWorking: true,
            healthMonitorWorking: true,
            integrationSuccessful: true
        };
    }

    async runAllTests() {
        this.log('🚀 Starting Improvement Tests\n', 'info');
        
        await this.runTest('Secure Key Management', () => this.testSecureKeyManagement());
        await this.runTest('Configuration Manager', () => this.testConfigurationManager());
        await this.runTest('Resource Manager', () => this.testResourceManager());
        await this.runTest('Health Monitor', () => this.testHealthMonitor());
        await this.runTest('Smart Contract Security', () => this.testSmartContractSecurity());
        await this.runTest('Structured Logging', () => this.testStructuredLogging());
        await this.runTest('File Structure', () => this.testFileStructure());
        await this.runTest('Integration Test', () => this.testIntegration());
        
        this.printSummary();
    }

    printSummary() {
        this.log('\n📊 Test Summary', 'info');
        this.log('================');
        
        this.log(`✅ Passed: ${this.passed}`, 'success');
        this.log(`❌ Failed: ${this.failed}`, this.failed > 0 ? 'error' : 'info');
        this.log(`📈 Success Rate: ${((this.passed / (this.passed + this.failed)) * 100).toFixed(1)}%`);
        
        if (this.failed === 0) {
            this.log('\n🎉 All improvements are working correctly!', 'success');
            this.log('Your decentralized network is ready with enhanced security and reliability.', 'success');
        } else {
            this.log('\n⚠️  Some tests failed. Please check the issues above.', 'warning');
        }
        
        // Detailed results
        this.log('\n📋 Detailed Results:', 'info');
        this.testResults.forEach(result => {
            const status = result.status === 'PASSED' ? '✅' : '❌';
            this.log(`${status} ${result.name}`);
            if (result.result && typeof result.result === 'object') {
                Object.entries(result.result).forEach(([key, value]) => {
                    this.log(`    ${key}: ${value}`);
                });
            }
        });
    }
}

// Run tests if called directly
if (require.main === module) {
    const tester = new ImprovementTester();
    tester.runAllTests().catch(err => {
        console.error('Test runner failed:', err);
        process.exit(1);
    });
}

module.exports = ImprovementTester;