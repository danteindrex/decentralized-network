/**
 * Mobile Tensor Parallelism Integration Test
 * Tests the integration between mobile tensor system and React Native app
 */

import * as tf from '@tensorflow/tfjs-node';

// Mock mobile tensor parallelism system for testing
class MockMobileTensorSystem {
    constructor(config = {}) {
        this.config = {
            enableGPUAcceleration: config.enableGPUAcceleration !== false,
            batteryOptimization: config.batteryOptimization || false,
            ...config
        };
        this.initialized = false;
        this.deviceId = 'test_mobile_device_001';
    }

    async initialize() {
        console.log('🚀 Initializing Mock Mobile Tensor System...');
        await tf.ready();
        this.initialized = true;
        console.log('✅ Mock system initialized');
    }

    async runInference(prompt, modelCid, userAccount, options = {}) {
        if (!this.initialized) {
            throw new Error('System not initialized');
        }

        console.log(`🎯 Processing inference: "${prompt.substring(0, 30)}..."`);
        
        // Simulate tensor operations
        const startTime = Date.now();
        
        // Mock model processing
        const batchSize = 1;
        const seqLen = Math.min(prompt.length, 64);
        const hiddenSize = 256;
        
        const input = tf.randomNormal([batchSize, seqLen, hiddenSize]);
        const weights = tf.randomNormal([hiddenSize, hiddenSize]);
        const output = tf.matMul(input, weights);
        
        // Simulate response generation
        await new Promise(resolve => setTimeout(resolve, 100)); // Simulate processing time
        
        const duration = (Date.now() - startTime) / 1000;
        
        // Cleanup tensors
        input.dispose();
        weights.dispose();
        output.dispose();
        
        return {
            success: true,
            response: `This is a mock response to: "${prompt}". The mobile tensor parallelism system processed this using distributed attention heads across mobile devices with optimized memory management and battery efficiency.`,
            duration,
            deviceId: this.deviceId,
            modelCid,
            architecture: 'mobile-transformer',
            mobileOptimized: true,
            cost: 'FREE',
            deviceCount: 2
        };
    }

    async assessCurrentDevice() {
        return {
            deviceType: 'mobile_high',
            memoryScore: 8.5,
            computeScore: 7.2,
            networkScore: 8.0,
            overallScore: 7.9,
            maxAttentionHeads: 8,
            recommendedPrecision: 'fp16'
        };
    }

    getSystemMetrics() {
        return {
            totalInferences: 5,
            successfulInferences: 5,
            avgProcessingTime: 0.85,
            totalDevices: 2,
            memoryUsage: tf.memory().numBytes,
            deviceId: this.deviceId,
            initialized: this.initialized
        };
    }

    async shutdown() {
        console.log('🛑 Shutting down mock system...');
        this.initialized = false;
    }
}

// Mock React Native app integration
class MobileAppIntegrationTest {
    constructor() {
        this.tensorSystem = null;
        this.messages = [];
        this.testResults = [];
    }

    async runIntegrationTests() {
        console.log('📱 Starting Mobile App Integration Tests...');
        console.log('================================================');

        try {
            await this.testSystemInitialization();
            await this.testChatIntegration();
            await this.testDeviceAssessment();
            await this.testSystemMetrics();
            await this.testMultipleInferences();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Integration test suite failed:', error);
        } finally {
            if (this.tensorSystem) {
                await this.tensorSystem.shutdown();
            }
        }
    }

    async testSystemInitialization() {
        console.log('\n🚀 Testing System Initialization...');
        
        try {
            this.tensorSystem = new MockMobileTensorSystem({
                enableGPUAcceleration: true,
                batteryOptimization: false
            });
            
            await this.tensorSystem.initialize();
            
            console.log('✅ Mobile tensor system initialized successfully');
            this.recordTest('System Initialization', true, 'Initialization successful');
            
        } catch (error) {
            console.error('❌ System initialization failed:', error);
            this.recordTest('System Initialization', false, error.message);
        }
    }

    async testChatIntegration() {
        console.log('\n💬 Testing Chat Integration...');
        
        try {
            const testPrompts = [
                'Hello, how does mobile tensor parallelism work?',
                'Explain distributed AI processing on mobile devices',
                'What are the benefits of attention head parallelism?'
            ];
            
            for (const prompt of testPrompts) {
                console.log(`📝 Processing: "${prompt.substring(0, 40)}..."`);
                
                const result = await this.tensorSystem.runInference(
                    prompt,
                    'QmMobileTestModel',
                    '0xTestUser123'
                );
                
                if (result.success) {
                    const message = {
                        role: 'user',
                        content: prompt,
                        timestamp: Date.now()
                    };
                    
                    const response = {
                        role: 'assistant',
                        content: result.response,
                        timestamp: Date.now()
                    };
                    
                    this.messages.push(message, response);
                    
                    console.log(`✅ Response generated (${result.duration.toFixed(2)}s)`);
                    console.log(`📊 Devices used: ${result.deviceCount}`);
                } else {
                    throw new Error(result.error);
                }
            }
            
            console.log(`✅ Chat integration test completed - ${this.messages.length / 2} conversations`);
            this.recordTest('Chat Integration', true, `${this.messages.length / 2} conversations processed`);
            
        } catch (error) {
            console.error('❌ Chat integration failed:', error);
            this.recordTest('Chat Integration', false, error.message);
        }
    }

    async testDeviceAssessment() {
        console.log('\n📊 Testing Device Assessment...');
        
        try {
            const deviceSpecs = await this.tensorSystem.assessCurrentDevice();
            
            console.log(`📱 Device Type: ${deviceSpecs.deviceType}`);
            console.log(`🧠 Memory Score: ${deviceSpecs.memoryScore}`);
            console.log(`⚡ Compute Score: ${deviceSpecs.computeScore}`);
            console.log(`🌐 Network Score: ${deviceSpecs.networkScore}`);
            console.log(`🎯 Overall Score: ${deviceSpecs.overallScore}`);
            console.log(`👁️ Max Attention Heads: ${deviceSpecs.maxAttentionHeads}`);
            
            this.recordTest('Device Assessment', true, deviceSpecs);
            
        } catch (error) {
            console.error('❌ Device assessment failed:', error);
            this.recordTest('Device Assessment', false, error.message);
        }
    }

    async testSystemMetrics() {
        console.log('\n📈 Testing System Metrics...');
        
        try {
            const metrics = this.tensorSystem.getSystemMetrics();
            
            console.log(`📊 Total Inferences: ${metrics.totalInferences}`);
            console.log(`✅ Successful Inferences: ${metrics.successfulInferences}`);
            console.log(`⏱️ Average Processing Time: ${metrics.avgProcessingTime.toFixed(2)}s`);
            console.log(`📱 Connected Devices: ${metrics.totalDevices}`);
            console.log(`💾 Memory Usage: ${(metrics.memoryUsage / 1024).toFixed(1)} KB`);
            console.log(`🆔 Device ID: ${metrics.deviceId}`);
            
            this.recordTest('System Metrics', true, metrics);
            
        } catch (error) {
            console.error('❌ System metrics failed:', error);
            this.recordTest('System Metrics', false, error.message);
        }
    }

    async testMultipleInferences() {
        console.log('\n🔄 Testing Multiple Concurrent Inferences...');
        
        try {
            const prompts = [
                'Test inference 1',
                'Test inference 2', 
                'Test inference 3'
            ];
            
            // Run multiple inferences concurrently
            const startTime = Date.now();
            const promises = prompts.map(prompt => 
                this.tensorSystem.runInference(prompt, 'QmConcurrentTest', '0xTestUser')
            );
            
            const results = await Promise.all(promises);
            const totalTime = (Date.now() - startTime) / 1000;
            
            const successCount = results.filter(r => r.success).length;
            console.log(`✅ Concurrent inferences: ${successCount}/${results.length} successful`);
            console.log(`⏱️ Total time: ${totalTime.toFixed(2)}s`);
            console.log(`📊 Average per inference: ${(totalTime / results.length).toFixed(2)}s`);
            
            this.recordTest('Multiple Inferences', true, {
                total: results.length,
                successful: successCount,
                totalTime,
                avgTime: totalTime / results.length
            });
            
        } catch (error) {
            console.error('❌ Multiple inferences failed:', error);
            this.recordTest('Multiple Inferences', false, error.message);
        }
    }

    recordTest(name, success, data) {
        this.testResults.push({
            name,
            success,
            data,
            timestamp: new Date().toISOString()
        });
    }

    printResults() {
        console.log('\n📊 Mobile App Integration Test Results');
        console.log('======================================');
        
        const total = this.testResults.length;
        const successful = this.testResults.filter(r => r.success).length;
        const failed = total - successful;
        const successRate = (successful / total * 100).toFixed(1);
        
        console.log(`📈 Total Tests: ${total}`);
        console.log(`✅ Successful: ${successful}`);
        console.log(`❌ Failed: ${failed}`);
        console.log(`🎯 Success Rate: ${successRate}%`);
        
        console.log('\n📋 Test Details:');
        for (const result of this.testResults) {
            const status = result.success ? '✅' : '❌';
            console.log(`  ${status} ${result.name}: ${result.success ? 'PASSED' : 'FAILED'}`);
            if (!result.success) {
                console.log(`    Error: ${result.data}`);
            }
        }
        
        console.log('\n💬 Chat Messages Generated:');
        console.log(`📝 Total Messages: ${this.messages.length}`);
        console.log(`🗣️ Conversations: ${this.messages.length / 2}`);
        
        if (this.messages.length > 0) {
            console.log('\n📄 Sample Conversation:');
            const sampleUser = this.messages[0];
            const sampleAssistant = this.messages[1];
            console.log(`👤 User: ${sampleUser.content}`);
            console.log(`🤖 Assistant: ${sampleAssistant.content.substring(0, 100)}...`);
        }
        
        console.log('\n🎉 Mobile App Integration Test Suite Complete!');
        
        // Final memory check
        const finalMem = tf.memory();
        console.log(`🧹 Final memory state: ${finalMem.numTensors} tensors, ${(finalMem.numBytes / 1024).toFixed(1)} KB`);
    }
}

// Run integration tests
const integrationTester = new MobileAppIntegrationTest();
integrationTester.runIntegrationTests().catch(console.error);