/**
 * Mobile Tensor Parallelism Testing
 * Comprehensive test suite for mobile tensor parallelism system
 */

import MobileTensorParallelismSystem from '../core/mobile_tensor_system.js';
import MobileDeviceCapabilityAssessor from '../device-assessment/capability_assessor.js';
import MobileModelArchitectureParser from '../model-registry/architecture_parser.js';

class MobileTensorParallelismTester {
    constructor() {
        this.testResults = [];
        this.system = null;
        this.testDevices = [
            { id: 'iphone_15_pro', type: 'mobile_high' },
            { id: 'android_flagship', type: 'mobile_mid' },
            { id: 'budget_phone', type: 'mobile_low' }
        ];
    }

    async runAllTests() {
        console.log('🧪 Starting Mobile Tensor Parallelism Test Suite...');
        console.log('================================================');
        
        try {
            await this.testDeviceCapabilityAssessment();
            await this.testModelArchitectureParsing();
            await this.testTensorSplitting();
            await this.testDistributedInference();
            await this.testMobileOptimizations();
            await this.testRealModelSimulation();
            
            this._printTestSummary();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    async testDeviceCapabilityAssessment() {
        console.log('\n📱 Testing Device Capability Assessment...');
        
        const assessor = new MobileDeviceCapabilityAssessor();
        await assessor.initialize();
        
        for (const device of this.testDevices) {
            try {
                console.log(`\n🔍 Assessing device: ${device.id}`);
                
                const specs = await assessor.assessDevice(device.id);
                
                console.log(`✅ Device Type: ${specs.deviceType}`);
                console.log(`🧠 Memory Score: ${specs.memoryScore.toFixed(2)}`);
                console.log(`⚡ Compute Score: ${specs.computeScore.toFixed(2)}`);
                console.log(`🌐 Network Score: ${specs.networkScore.toFixed(2)}`);
                console.log(`📊 Overall Score: ${specs.overallScore.toFixed(2)}`);
                console.log(`🎯 Max Attention Heads: ${specs.maxAttentionHeads}`);
                console.log(`⚙️ Recommended Precision: ${specs.recommendedPrecision}`);
                
                this._recordTestResult('Device Assessment', device.id, true, specs);
                
            } catch (error) {
                console.error(`❌ Device assessment failed for ${device.id}:`, error);
                this._recordTestResult('Device Assessment', device.id, false, error.message);
            }
        }
    }

    async testModelArchitectureParsing() {
        console.log('\n🏗️ Testing Model Architecture Parsing...');
        
        const parser = new MobileModelArchitectureParser();
        
        const testModels = [
            {
                cid: 'QmTestLlama',
                metadata: {
                    architecture: 'llama',
                    num_hidden_layers: 12,
                    hidden_size: 768,
                    num_attention_heads: 12,
                    vocab_size: 32000
                }
            },
            {
                cid: 'QmTestGPT',
                metadata: {
                    architecture: 'gpt',
                    n_layer: 6,
                    n_embd: 512,
                    n_head: 8,
                    vocab_size: 16384
                }
            },
            {
                cid: 'QmTestMobile',
                metadata: {
                    architecture: 'mobile-transformer',
                    num_layers: 4,
                    hidden_size: 256,
                    num_attention_heads: 4,
                    vocab_size: 8192
                }
            }
        ];
        
        for (const model of testModels) {
            try {
                console.log(`\n🔍 Parsing model: ${model.cid} (${model.metadata.architecture})`);
                
                const architecture = await parser.parseModelArchitecture(model.cid, model.metadata);
                
                console.log(`✅ Architecture Type: ${architecture.type}`);
                console.log(`🏗️ Layers: ${architecture.numLayers}`);
                console.log(`🧠 Hidden Size: ${architecture.hiddenSize}`);
                console.log(`👁️ Attention Heads: ${architecture.numAttentionHeads}`);
                console.log(`📱 Mobile Optimized: ${architecture.mobileOptimized}`);
                
                // Test compatibility
                const compatibility = await parser.validateMobileCompatibility(architecture);
                console.log(`✅ Mobile Compatible: ${compatibility.compatible}`);
                if (compatibility.warnings.length > 0) {
                    console.log(`⚠️ Warnings: ${compatibility.warnings.join(', ')}`);
                }
                
                this._recordTestResult('Architecture Parsing', model.cid, true, architecture);
                
            } catch (error) {
                console.error(`❌ Architecture parsing failed for ${model.cid}:`, error);
                this._recordTestResult('Architecture Parsing', model.cid, false, error.message);
            }
        }
    }

    async testTensorSplitting() {
        console.log('\n⚡ Testing Tensor Splitting...');
        
        // Create mock device specifications
        const deviceSpecs = {
            'mobile_device_1': {
                deviceType: 'mobile_high',
                memoryScore: 8.5,
                computeScore: 7.2,
                networkScore: 8.0,
                overallScore: 7.9,
                maxAttentionHeads: 8,
                recommendedPrecision: 'fp16'
            },
            'mobile_device_2': {
                deviceType: 'mobile_mid',
                memoryScore: 6.0,
                computeScore: 5.5,
                networkScore: 7.0,
                overallScore: 6.2,
                maxAttentionHeads: 4,
                recommendedPrecision: 'int8'
            }
        };
        
        const modelConfig = {
            numLayers: 6,
            hiddenSize: 512,
            numAttentionHeads: 8,
            intermediateSize: 1024
        };
        
        try {
            const splitter = new (await import('../core/tensor_splitter.js')).default(deviceSpecs, modelConfig);
            await splitter.initializeSplitting();
            
            const assignments = splitter.getDeviceAssignments();
            
            console.log('✅ Tensor splitting initialized successfully');
            console.log(`📊 Device assignments created for ${Object.keys(assignments).length} devices`);
            
            for (const [deviceId, assignment] of Object.entries(assignments)) {
                console.log(`📱 ${deviceId}:`);
                console.log(`   Attention Heads: [${assignment.attentionHeads.join(', ')}]`);
                console.log(`   MLP Range: [${assignment.mlpDimensionRange[0]}:${assignment.mlpDimensionRange[1]}]`);
                console.log(`   Precision: ${assignment.attentionPrecision}`);
                console.log(`   Battery Optimized: ${assignment.batteryOptimized}`);
            }
            
            this._recordTestResult('Tensor Splitting', 'Multi-device', true, assignments);
            
        } catch (error) {
            console.error('❌ Tensor splitting test failed:', error);
            this._recordTestResult('Tensor Splitting', 'Multi-device', false, error.message);
        }
    }

    async testDistributedInference() {
        console.log('\n🎯 Testing Distributed Inference...');
        
        try {
            // Initialize the complete system
            this.system = new MobileTensorParallelismSystem({
                bootstrapUrl: 'https://bootstrap-node.onrender.com',
                enableGPUAcceleration: true,
                batteryOptimization: false,
                thermalThrottling: true
            });
            
            await this.system.initialize();
            
            // Test inference
            const testPrompt = 'Explain how mobile tensor parallelism works';
            const testModelCid = 'QmMobileTestModel';
            const testUser = '0x1234567890abcdef';
            
            console.log(`🚀 Running inference test...`);
            console.log(`📝 Prompt: ${testPrompt}`);
            
            const result = await this.system.runInference(testPrompt, testModelCid, testUser);
            
            if (result.success) {
                console.log('✅ Distributed inference completed successfully');
                console.log(`⏱️ Duration: ${result.duration.toFixed(2)}s`);
                console.log(`📱 Device Count: ${result.deviceCount}`);
                console.log(`🤖 Response: ${result.response.substring(0, 100)}...`);
                console.log(`💰 Cost: ${result.cost} (FREE)`);
                
                this._recordTestResult('Distributed Inference', 'Full System', true, result);
            } else {
                console.error('❌ Distributed inference failed:', result.error);
                this._recordTestResult('Distributed Inference', 'Full System', false, result.error);
            }
            
        } catch (error) {
            console.error('❌ Distributed inference test failed:', error);
            this._recordTestResult('Distributed Inference', 'Full System', false, error.message);
        }
    }

    async testMobileOptimizations() {
        console.log('\n📱 Testing Mobile-Specific Optimizations...');
        
        if (!this.system) {
            console.log('⚠️ Skipping mobile optimizations test (system not initialized)');
            return;
        }
        
        try {
            // Test battery mode
            console.log('🔋 Testing battery optimization...');
            await this.system.enableBatteryMode(true);
            
            const batteryMetrics = this.system.getSystemMetrics();
            console.log('✅ Battery mode enabled successfully');
            
            // Test GPU acceleration toggle
            console.log('⚡ Testing GPU acceleration...');
            await this.system.enableGPUAcceleration(true);
            console.log('✅ GPU acceleration configured');
            
            // Test device assessment
            console.log('📊 Testing current device assessment...');
            const deviceSpecs = await this.system.assessCurrentDevice();
            console.log(`✅ Current device: ${deviceSpecs.deviceType}`);
            console.log(`🧠 Memory Score: ${deviceSpecs.memoryScore.toFixed(2)}`);
            
            this._recordTestResult('Mobile Optimizations', 'All Features', true, {
                batteryMode: true,
                gpuAcceleration: true,
                deviceAssessment: deviceSpecs
            });
            
        } catch (error) {
            console.error('❌ Mobile optimizations test failed:', error);
            this._recordTestResult('Mobile Optimizations', 'All Features', false, error.message);
        }
    }

    async testRealModelSimulation() {
        console.log('\n🤖 Testing Real Model Simulation...');
        
        if (!this.system) {
            console.log('⚠️ Skipping real model simulation (system not initialized)');
            return;
        }
        
        // Test with different model configurations
        const modelConfigs = [
            {
                name: 'TinyTransformer',
                architecture: 'mobile-transformer',
                numLayers: 2,
                hiddenSize: 128,
                numAttentionHeads: 2,
                vocabSize: 1000
            },
            {
                name: 'SmallLlama',
                architecture: 'llama',
                numLayers: 4,
                hiddenSize: 256,
                numAttentionHeads: 4,
                vocabSize: 8192
            }
        ];
        
        for (const config of modelConfigs) {
            try {
                console.log(`\n🧪 Testing ${config.name}...`);
                
                const result = await this.system.runInference(
                    `Test inference with ${config.name}`,
                    `Qm${config.name}TestCID`,
                    '0xTestUser',
                    config
                );
                
                if (result.success) {
                    console.log(`✅ ${config.name} inference successful`);
                    console.log(`⏱️ Duration: ${result.duration.toFixed(2)}s`);
                    console.log(`🏗️ Architecture: ${result.architecture}`);
                    
                    this._recordTestResult('Real Model Simulation', config.name, true, result);
                } else {
                    console.error(`❌ ${config.name} inference failed:`, result.error);
                    this._recordTestResult('Real Model Simulation', config.name, false, result.error);
                }
                
            } catch (error) {
                console.error(`❌ ${config.name} test failed:`, error);
                this._recordTestResult('Real Model Simulation', config.name, false, error.message);
            }
        }
    }

    _recordTestResult(category, testName, success, data) {
        this.testResults.push({
            category,
            testName,
            success,
            data,
            timestamp: new Date().toISOString()
        });
    }

    _printTestSummary() {
        console.log('\n📊 Mobile Tensor Parallelism Test Summary');
        console.log('=========================================');
        
        const totalTests = this.testResults.length;
        const successfulTests = this.testResults.filter(r => r.success).length;
        const failedTests = totalTests - successfulTests;
        const successRate = (successfulTests / totalTests * 100).toFixed(1);
        
        console.log(`📈 Total Tests: ${totalTests}`);
        console.log(`✅ Successful: ${successfulTests}`);
        console.log(`❌ Failed: ${failedTests}`);
        console.log(`🎯 Success Rate: ${successRate}%`);
        
        // Group by category
        const categories = {};
        for (const result of this.testResults) {
            if (!categories[result.category]) {
                categories[result.category] = { total: 0, successful: 0 };
            }
            categories[result.category].total++;
            if (result.success) {
                categories[result.category].successful++;
            }
        }
        
        console.log('\n📋 Results by Category:');
        for (const [category, stats] of Object.entries(categories)) {
            const categoryRate = (stats.successful / stats.total * 100).toFixed(1);
            console.log(`  ${category}: ${stats.successful}/${stats.total} (${categoryRate}%)`);
        }
        
        // List failures
        const failures = this.testResults.filter(r => !r.success);
        if (failures.length > 0) {
            console.log('\n❌ Failed Tests:');
            for (const failure of failures) {
                console.log(`  ${failure.category} - ${failure.testName}: ${failure.data}`);
            }
        }
        
        console.log('\n🎉 Mobile Tensor Parallelism Test Suite Complete!');
    }

    async cleanup() {
        if (this.system) {
            await this.system.shutdown();
        }
    }
}

// Export for use in other modules
export default MobileTensorParallelismTester;

// Auto-run tests if this file is executed directly
if (typeof window !== 'undefined' && window.location) {
    // Running in browser - can be triggered manually
    console.log('🧪 Mobile Tensor Parallelism Tester loaded');
    console.log('💡 Run tests with: new MobileTensorParallelismTester().runAllTests()');
} else {
    // Running in Node.js - auto-run tests
    const tester = new MobileTensorParallelismTester();
    tester.runAllTests().then(() => {
        tester.cleanup();
    }).catch(error => {
        console.error('Test suite failed:', error);
        tester.cleanup();
    });
}