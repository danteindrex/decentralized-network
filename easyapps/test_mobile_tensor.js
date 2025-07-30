/**
 * Simple Mobile Tensor Parallelism Test
 * Node.js compatible test runner
 */

import * as tf from '@tensorflow/tfjs-node';

class SimpleMobileTensorTest {
    constructor() {
        this.testResults = [];
    }

    async runTests() {
        console.log('🧪 Starting Mobile Tensor Parallelism Tests...');
        console.log('=================================================');
        
        try {
            await this.testTensorFlowSetup();
            await this.testDeviceCapabilityMock();
            await this.testArchitectureParsing();
            await this.testTensorOperations();
            
            this.printResults();
            
        } catch (error) {
            console.error('❌ Test suite failed:', error);
        }
    }

    async testTensorFlowSetup() {
        console.log('\n🧠 Testing TensorFlow.js Setup...');
        
        try {
            await tf.ready();
            console.log(`✅ TensorFlow.js ready - Backend: ${tf.getBackend()}`);
            console.log(`📊 Version: ${tf.version.tfjs}`);
            
            // Test basic tensor operations
            const a = tf.tensor2d([[1, 2], [3, 4]]);
            const b = tf.tensor2d([[5, 6], [7, 8]]);
            const result = tf.matMul(a, b);
            
            const data = await result.data();
            console.log(`✅ Matrix multiplication test: [${Array.from(data).join(', ')}]`);
            
            // Cleanup
            a.dispose();
            b.dispose();
            result.dispose();
            
            this.recordTest('TensorFlow Setup', true, 'TensorFlow.js initialized successfully');
            
        } catch (error) {
            console.error('❌ TensorFlow setup failed:', error);
            this.recordTest('TensorFlow Setup', false, error.message);
        }
    }

    async testDeviceCapabilityMock() {
        console.log('\n📱 Testing Device Capability Assessment (Mock)...');
        
        try {
            // Mock device specifications
            const deviceSpecs = {
                deviceId: 'test_mobile_device',
                deviceType: 'mobile_high',
                memoryScore: 8.5,
                computeScore: 7.2,
                networkScore: 8.0,
                overallScore: 7.9,
                maxAttentionHeads: 8,
                recommendedPrecision: 'fp16'
            };
            
            console.log(`✅ Device Type: ${deviceSpecs.deviceType}`);
            console.log(`🧠 Memory Score: ${deviceSpecs.memoryScore}`);
            console.log(`⚡ Compute Score: ${deviceSpecs.computeScore}`);
            console.log(`🎯 Max Attention Heads: ${deviceSpecs.maxAttentionHeads}`);
            
            this.recordTest('Device Assessment', true, deviceSpecs);
            
        } catch (error) {
            console.error('❌ Device assessment failed:', error);
            this.recordTest('Device Assessment', false, error.message);
        }
    }

    async testArchitectureParsing() {
        console.log('\n🏗️ Testing Model Architecture Parsing...');
        
        try {
            // Mock model architectures
            const testModels = [
                {
                    name: 'TinyLlama',
                    architecture: 'llama',
                    numLayers: 6,
                    hiddenSize: 512,
                    numAttentionHeads: 8,
                    vocabSize: 16384
                },
                {
                    name: 'MobileGPT',
                    architecture: 'gpt',
                    numLayers: 4,
                    hiddenSize: 256,
                    numAttentionHeads: 4,
                    vocabSize: 8192
                }
            ];
            
            for (const model of testModels) {
                console.log(`🔍 Parsing ${model.name}...`);
                
                // Mock parsing logic
                const parsedArchitecture = {
                    type: model.architecture,
                    numLayers: Math.min(model.numLayers, 12),
                    hiddenSize: Math.min(model.hiddenSize, 1024),
                    numAttentionHeads: Math.min(model.numAttentionHeads, 16),
                    mobileOptimized: true,
                    tensorParallelism: {
                        attentionHeadParallel: model.numAttentionHeads >= 4,
                        mlpParallel: model.hiddenSize >= 256,
                        sequenceParallel: true
                    }
                };
                
                console.log(`✅ ${model.name}: ${parsedArchitecture.numLayers} layers, ${parsedArchitecture.numAttentionHeads} heads`);
            }
            
            this.recordTest('Architecture Parsing', true, `Parsed ${testModels.length} models`);
            
        } catch (error) {
            console.error('❌ Architecture parsing failed:', error);
            this.recordTest('Architecture Parsing', false, error.message);
        }
    }

    async testTensorOperations() {
        console.log('\n⚡ Testing Tensor Operations for Mobile Parallelism...');
        
        try {
            // Test attention computation simulation
            console.log('🧠 Testing attention computation...');
            
            const batchSize = 1;
            const seqLen = 32;
            const hiddenSize = 256;
            const numHeads = 8;
            const headDim = hiddenSize / numHeads;
            
            // Create input tensor
            const input = tf.randomNormal([batchSize, seqLen, hiddenSize]);
            
            // Simulate query, key, value projections
            const wq = tf.randomNormal([hiddenSize, hiddenSize]);
            const wk = tf.randomNormal([hiddenSize, hiddenSize]);
            const wv = tf.randomNormal([hiddenSize, hiddenSize]);
            
            // Compute Q, K, V using matMul for 3D tensors
            const q = tf.matMul(input, wq);
            const k = tf.matMul(input, wk);
            const v = tf.matMul(input, wv);
            
            // Reshape for multi-head attention
            const qReshaped = tf.reshape(q, [batchSize, seqLen, numHeads, headDim]);
            const kReshaped = tf.reshape(k, [batchSize, seqLen, numHeads, headDim]);
            const vReshaped = tf.reshape(v, [batchSize, seqLen, numHeads, headDim]);
            
            console.log(`✅ Attention tensors created: Q${qReshaped.shape}, K${kReshaped.shape}, V${vReshaped.shape}`);
            
            // Test MLP computation simulation
            console.log('🔧 Testing MLP computation...');
            
            const intermediateSize = hiddenSize * 2;
            const w1 = tf.randomNormal([hiddenSize, intermediateSize]);
            const w2 = tf.randomNormal([intermediateSize, hiddenSize]);
            
            const mlpIntermediate = tf.matMul(input, w1);
            // Use ReLU instead of GELU for compatibility
            const mlpActivation = tf.relu(mlpIntermediate);
            const mlpOutput = tf.matMul(mlpActivation, w2);
            
            console.log(`✅ MLP computation completed: ${mlpOutput.shape}`);
            
            // Memory usage check
            const memInfo = tf.memory();
            console.log(`📊 Memory usage: ${(memInfo.numBytes / 1024 / 1024).toFixed(1)} MB, ${memInfo.numTensors} tensors`);
            
            // Cleanup all tensors
            input.dispose();
            wq.dispose(); wk.dispose(); wv.dispose();
            q.dispose(); k.dispose(); v.dispose();
            qReshaped.dispose(); kReshaped.dispose(); vReshaped.dispose();
            w1.dispose(); w2.dispose();
            mlpIntermediate.dispose(); mlpActivation.dispose(); mlpOutput.dispose();
            
            console.log('✅ Tensor cleanup completed');
            
            this.recordTest('Tensor Operations', true, 'Attention and MLP operations successful');
            
        } catch (error) {
            console.error('❌ Tensor operations failed:', error);
            this.recordTest('Tensor Operations', false, error.message);
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
        console.log('\n📊 Mobile Tensor Parallelism Test Results');
        console.log('=========================================');
        
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
        
        console.log('\n🎉 Mobile Tensor Parallelism Test Suite Complete!');
        
        // Final memory check
        const finalMem = tf.memory();
        console.log(`🧹 Final memory state: ${finalMem.numTensors} tensors, ${(finalMem.numBytes / 1024).toFixed(1)} KB`);
    }
}

// Run tests
const tester = new SimpleMobileTensorTest();
tester.runTests().catch(console.error);