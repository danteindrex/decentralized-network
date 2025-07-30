/**
 * Mobile Adaptive Tensor Splitter
 * JavaScript/React Native equivalent of Python tensor_splitter.py
 * Dynamically splits transformer models across mobile devices for tensor parallelism
 */

import * as tf from '@tensorflow/tfjs';
import MobileDeviceCapabilityAssessor from '../device-assessment/capability_assessor.js';

class MobileAdaptiveTensorSplitter {
    constructor(deviceSpecs = {}, modelConfig = {}) {
        this.deviceSpecs = deviceSpecs;
        this.modelConfig = modelConfig;
        this.assessor = new MobileDeviceCapabilityAssessor();
        
        // Mobile-specific configurations
        this.mobileOptimizations = {
            enableQuantization: true,
            useMixedPrecision: false, // Start with full precision
            enableGradientCheckpointing: true,
            maxConcurrentOperations: 2
        };
        
        this.deviceAssignments = {};
        this.tensorShards = {};
        this.attentionStrategy = 'head_parallel'; // 'head_parallel', 'sequence_parallel', 'hybrid'
        
        console.log('🔧 Mobile Adaptive Tensor Splitter initialized');
        console.log(`📱 Managing ${Object.keys(deviceSpecs).length} mobile devices`);
    }

    async initializeSplitting() {
        console.log('🚀 Initializing mobile tensor splitting...');
        
        // Assess all devices if not already done
        for (const deviceId of Object.keys(this.deviceSpecs)) {
            if (!this.deviceSpecs[deviceId].maxAttentionHeads) {
                this.deviceSpecs[deviceId] = await this.assessor.assessDevice(deviceId);
            }
        }
        
        // Calculate optimal tensor splitting strategy
        this._calculateOptimalSplitting();
        
        console.log('✅ Mobile tensor splitting initialized');
        this._logSplittingStrategy();
    }

    _calculateOptimalSplitting() {
        console.log('🧮 Calculating optimal tensor splitting strategy for mobile devices...');
        
        // Calculate attention head capabilities
        const attentionCapabilities = this._calculateMobileAttentionCapabilities();
        
        // Calculate MLP dimension assignments
        const mlpCapabilities = this._calculateMobileMLPCapabilities();
        
        // Determine optimal sequence length handling
        const sequenceCapabilities = this._calculateMobileSequenceCapabilities();
        
        // Create device assignments
        this._createMobileDeviceAssignments(attentionCapabilities, mlpCapabilities, sequenceCapabilities);
        
        // Optimize for mobile constraints
        this._optimizeForMobileConstraints();
    }

    _calculateMobileAttentionCapabilities() {
        const capabilities = {};
        let totalHeads = 0;
        
        for (const [deviceId, specs] of Object.entries(this.deviceSpecs)) {
            const memoryScore = specs.memoryScore || 5;
            const computeScore = specs.computeScore || 5;
            
            // Mobile-specific attention head calculation
            let baseHeads;
            if (specs.deviceType === 'mobile_high') {
                baseHeads = Math.min(16, Math.floor(memoryScore * 2));
            } else if (specs.deviceType === 'mobile_mid') {
                baseHeads = Math.min(8, Math.floor(memoryScore * 1.5));
            } else if (specs.deviceType === 'mobile_low') {
                baseHeads = Math.min(4, Math.floor(memoryScore));
            } else {
                baseHeads = Math.min(2, Math.floor(memoryScore * 0.5));
            }
            
            // Adjust for compute capabilities
            const computeAdjustment = computeScore >= 7 ? 1.2 : computeScore >= 5 ? 1.0 : 0.8;
            const adjustedHeads = Math.max(1, Math.floor(baseHeads * computeAdjustment));
            
            // Mobile precision selection
            const precision = memoryScore >= 6 ? 'fp16' : 'int8';
            
            capabilities[deviceId] = {
                assignedHeads: adjustedHeads,
                headIndices: [], // Will be assigned later
                precision: precision,
                memoryPerHead: this._estimateMobileMemoryPerHead(specs, precision),
                computeCapability: computeScore,
                batteryOptimized: specs.deviceType.includes('low') || specs.deviceType.includes('minimal')
            };
            
            totalHeads += adjustedHeads;
            
            console.log(`📱 ${deviceId}: ${adjustedHeads} attention heads (${precision})`);
        }
        
        // Assign specific head indices
        this._assignMobileAttentionHeadIndices(capabilities, totalHeads);
        
        return capabilities;
    }

    _assignMobileAttentionHeadIndices(capabilities, totalHeads) {
        let currentIndex = 0;
        
        for (const [deviceId, capability] of Object.entries(capabilities)) {
            const headCount = capability.assignedHeads;
            capability.headIndices = Array.from(
                { length: headCount }, 
                (_, i) => currentIndex + i
            );
            currentIndex += headCount;
            
            console.log(`📱 ${deviceId} assigned head indices: [${capability.headIndices.join(', ')}]`);
        }
        
        console.log(`🧠 Total attention heads distributed: ${totalHeads}`);
    }

    _calculateMobileMLPCapabilities() {
        const capabilities = {};
        
        for (const [deviceId, specs] of Object.entries(this.deviceSpecs)) {
            const memoryScore = specs.memoryScore || 5;
            const availableMemoryGB = (specs.availableMemory || 2e9) / 1e9;
            
            // Mobile MLP dimension calculation
            let maxDimensions;
            if (specs.deviceType === 'mobile_high') {
                maxDimensions = Math.min(2048, Math.floor(availableMemoryGB * 300));
            } else if (specs.deviceType === 'mobile_mid') {
                maxDimensions = Math.min(1024, Math.floor(availableMemoryGB * 200));
            } else if (specs.deviceType === 'mobile_low') {
                maxDimensions = Math.min(512, Math.floor(availableMemoryGB * 100));
            } else {
                maxDimensions = Math.min(256, Math.floor(availableMemoryGB * 50));
            }
            
            // Ensure minimum viable dimensions
            maxDimensions = Math.max(128, maxDimensions);
            
            capabilities[deviceId] = {
                maxDimensions: maxDimensions,
                dimensionStart: 0, // Will be calculated during assignment
                dimensionEnd: 0,
                layerAssignments: [],
                activationFunction: 'gelu',
                quantized: specs.deviceType.includes('low') || specs.deviceType.includes('minimal')
            };
            
            console.log(`📱 ${deviceId}: MLP dimensions up to ${maxDimensions}`);
        }
        
        return capabilities;
    }

    _calculateMobileSequenceCapabilities() {
        const capabilities = {};
        
        for (const [deviceId, specs] of Object.entries(this.deviceSpecs)) {
            const memoryScore = specs.memoryScore || 5;
            
            // Mobile sequence length calculation
            let maxSequenceLength;
            if (specs.deviceType === 'mobile_high') {
                maxSequenceLength = Math.min(2048, Math.floor(memoryScore * 300));
            } else if (specs.deviceType === 'mobile_mid') {
                maxSequenceLength = Math.min(1024, Math.floor(memoryScore * 200));
            } else if (specs.deviceType === 'mobile_low') {
                maxSequenceLength = Math.min(512, Math.floor(memoryScore * 100));
            } else {
                maxSequenceLength = Math.min(256, Math.floor(memoryScore * 50));
            }
            
            capabilities[deviceId] = {
                maxSequenceLength: maxSequenceLength,
                sequenceStart: 0,
                sequenceEnd: 0,
                chunkStrategy: 'sliding_window', // 'sliding_window', 'fixed_chunks'
                overlapTokens: Math.floor(maxSequenceLength * 0.1) // 10% overlap
            };
            
            console.log(`📱 ${deviceId}: Sequence length up to ${maxSequenceLength}`);
        }
        
        return capabilities;
    }

    _createMobileDeviceAssignments(attentionCaps, mlpCaps, sequenceCaps) {
        for (const deviceId of Object.keys(this.deviceSpecs)) {
            this.deviceAssignments[deviceId] = {
                deviceId: deviceId,
                deviceType: this.deviceSpecs[deviceId].deviceType,
                
                // Attention assignments
                attentionHeads: attentionCaps[deviceId].headIndices,
                attentionPrecision: attentionCaps[deviceId].precision,
                
                // MLP assignments
                mlpDimensionRange: [
                    mlpCaps[deviceId].dimensionStart,
                    mlpCaps[deviceId].dimensionEnd
                ],
                mlpQuantized: mlpCaps[deviceId].quantized,
                
                // Sequence assignments
                sequenceRange: [
                    sequenceCaps[deviceId].sequenceStart,
                    sequenceCaps[deviceId].sequenceEnd
                ],
                maxSequenceLength: sequenceCaps[deviceId].maxSequenceLength,
                
                // Mobile-specific optimizations
                batteryOptimized: attentionCaps[deviceId].batteryOptimized,
                thermalThrottling: false,
                
                // Load balancing
                currentLoad: 0.0,
                maxLoad: this._calculateMobileMaxLoad(this.deviceSpecs[deviceId]),
                
                // Communication
                communicationLatency: 50, // ms, typical mobile network latency
                bandwidth: this._estimateMobileBandwidth(this.deviceSpecs[deviceId])
            };
        }
        
        console.log('📱 Mobile device assignments created');
    }

    _optimizeForMobileConstraints() {
        console.log('⚡ Optimizing tensor splitting for mobile constraints...');
        
        // Enable mobile-specific optimizations
        for (const [deviceId, assignment] of Object.entries(this.deviceAssignments)) {
            const specs = this.deviceSpecs[deviceId];
            
            // Battery optimization
            if (assignment.batteryOptimized) {
                assignment.attentionPrecision = 'int8';
                assignment.mlpQuantized = true;
                assignment.maxConcurrentOps = 1;
                console.log(`🔋 Battery optimization enabled for ${deviceId}`);
            }
            
            // Memory optimization
            if (specs.memoryScore < 5) {
                assignment.enableGradientCheckpointing = true;
                assignment.maxBatchSize = 1;
                console.log(`💾 Memory optimization enabled for ${deviceId}`);
            }
            
            // Thermal optimization
            if (specs.overallScore < 6) {
                assignment.thermalThrottling = true;
                assignment.computeIntensityLimit = 0.7;
                console.log(`🌡️ Thermal throttling protection enabled for ${deviceId}`);
            }
        }
    }

    async splitAttentionComputation(inputTensor, layerIndex, attentionWeights) {
        console.log(`🧠 Splitting attention computation for layer ${layerIndex} across mobile devices`);
        
        const attentionResults = {};
        const splitPromises = [];
        
        for (const [deviceId, assignment] of Object.entries(this.deviceAssignments)) {
            if (assignment.attentionHeads.length > 0) {
                const promise = this._computeMobileAttentionHeads(
                    inputTensor,
                    attentionWeights,
                    assignment.attentionHeads,
                    assignment.attentionPrecision,
                    deviceId
                );
                splitPromises.push(promise.then(result => {
                    attentionResults[deviceId] = result;
                }));
            }
        }
        
        await Promise.all(splitPromises);
        
        // Combine results from all mobile devices
        const combinedResult = await this._combineMobileAttentionResults(attentionResults);
        
        console.log('✅ Mobile attention computation completed');
        return combinedResult;
    }

    async _computeMobileAttentionHeads(inputTensor, weights, headIndices, precision, deviceId) {
        console.log(`📱 Computing attention heads [${headIndices.join(', ')}] on ${deviceId} (${precision})`);
        
        try {
            // Convert precision for mobile optimization
            let workingTensor = inputTensor;
            if (precision === 'int8') {
                // Quantize for mobile efficiency
                workingTensor = tf.div(tf.round(tf.mul(inputTensor, 127)), 127);
            }
            
            const results = [];
            
            for (const headIndex of headIndices) {
                // Extract weights for this attention head
                const headWeights = this._extractMobileAttentionHeadWeights(weights, headIndex);
                
                // Compute attention for this head
                const headResult = await this._computeMobileSingleAttentionHead(
                    workingTensor, 
                    headWeights, 
                    headIndex
                );
                
                results.push(headResult);
                
                // Yield control to prevent mobile UI blocking
                await this._yieldToMobileUI();
            }
            
            // Concatenate head results
            const concatenatedResult = tf.concat(results, -1);
            
            // Clean up intermediate tensors
            results.forEach(tensor => tensor.dispose());
            if (workingTensor !== inputTensor) {
                workingTensor.dispose();
            }
            
            console.log(`✅ Attention heads computed on ${deviceId}`);
            return concatenatedResult;
            
        } catch (error) {
            console.error(`❌ Error computing attention on ${deviceId}:`, error);
            throw error;
        }
    }

    async _computeMobileSingleAttentionHead(inputTensor, headWeights, headIndex) {
        // Implement mobile-optimized single attention head computation
        const { queryWeights, keyWeights, valueWeights } = headWeights;
        
        // Compute Q, K, V with mobile optimizations
        const queries = tf.matMul(inputTensor, queryWeights);
        const keys = tf.matMul(inputTensor, keyWeights);
        const values = tf.matMul(inputTensor, valueWeights);
        
        // Compute attention scores with scaled dot-product
        const scaleFactor = tf.scalar(1.0 / Math.sqrt(queryWeights.shape[1]));
        const scores = tf.matMul(queries, keys, false, true);
        const scaledScores = tf.mul(scores, scaleFactor);
        
        // Apply softmax
        const attentionWeights = tf.softmax(scaledScores, -1);
        
        // Apply attention to values
        const attentionOutput = tf.matMul(attentionWeights, values);
        
        // Clean up intermediate tensors
        queries.dispose();
        keys.dispose();
        values.dispose();
        scores.dispose();
        scaledScores.dispose();
        attentionWeights.dispose();
        scaleFactor.dispose();
        
        return attentionOutput;
    }

    _extractMobileAttentionHeadWeights(weights, headIndex) {
        // Extract weights for a specific attention head
        // This would depend on the model architecture
        const headSize = weights.queryWeights.shape[1] / this.modelConfig.numAttentionHeads;
        const startIdx = headIndex * headSize;
        const endIdx = (headIndex + 1) * headSize;
        
        return {
            queryWeights: weights.queryWeights.slice([0, startIdx], [-1, headSize]),
            keyWeights: weights.keyWeights.slice([0, startIdx], [-1, headSize]),
            valueWeights: weights.valueWeights.slice([0, startIdx], [-1, headSize])
        };
    }

    async _combineMobileAttentionResults(results) {
        console.log('🔄 Combining attention results from mobile devices...');
        
        const deviceIds = Object.keys(results);
        const tensors = deviceIds.map(deviceId => results[deviceId]);
        
        // Concatenate along the attention head dimension
        const combined = tf.concat(tensors, -1);
        
        // Clean up individual results
        tensors.forEach(tensor => tensor.dispose());
        
        return combined;
    }

    async splitMLPComputation(inputTensor, layerIndex, mlpWeights) {
        console.log(`⚡ Splitting MLP computation for layer ${layerIndex} across mobile devices`);
        
        const mlpResults = {};
        const splitPromises = [];
        
        for (const [deviceId, assignment] of Object.entries(this.deviceAssignments)) {
            const [dimStart, dimEnd] = assignment.mlpDimensionRange;
            if (dimEnd > dimStart) {
                const promise = this._computeMobileMLPShard(
                    inputTensor,
                    mlpWeights,
                    dimStart,
                    dimEnd,
                    assignment.mlpQuantized,
                    deviceId
                );
                splitPromises.push(promise.then(result => {
                    mlpResults[deviceId] = result;
                }));
            }
        }
        
        await Promise.all(splitPromises);
        
        // Combine MLP results
        const combinedResult = await this._combineMobileMLPResults(mlpResults);
        
        console.log('✅ Mobile MLP computation completed');
        return combinedResult;
    }

    async _computeMobileMLPShard(inputTensor, weights, dimStart, dimEnd, quantized, deviceId) {
        console.log(`📱 Computing MLP dimensions [${dimStart}:${dimEnd}] on ${deviceId}`);
        
        try {
            // Extract weight shard for this device
            const weightShard = weights.slice([0, dimStart], [-1, dimEnd - dimStart]);
            
            // Apply quantization if enabled
            let workingTensor = inputTensor;
            let workingWeights = weightShard;
            
            if (quantized) {
                workingTensor = tf.div(tf.round(tf.mul(inputTensor, 127)), 127);
                workingWeights = tf.div(tf.round(tf.mul(weightShard, 127)), 127);
            }
            
            // Compute MLP forward pass for this shard
            const result = tf.matMul(workingTensor, workingWeights);
            
            // Apply activation function (GELU for most transformers)
            const activated = this._applyMobileActivation(result, 'gelu');
            
            // Clean up intermediate tensors
            weightShard.dispose();
            result.dispose();
            if (workingTensor !== inputTensor) workingTensor.dispose();
            if (workingWeights !== weightShard) workingWeights.dispose();
            
            console.log(`✅ MLP shard computed on ${deviceId}`);
            return activated;
            
        } catch (error) {
            console.error(`❌ Error computing MLP on ${deviceId}:`, error);
            throw error;
        }
    }

    _applyMobileActivation(tensor, activationType) {
        switch (activationType) {
            case 'gelu':
                // Approximate GELU for mobile efficiency
                return tf.mul(
                    tensor,
                    tf.sigmoid(tf.mul(tensor, 1.702))
                );
            case 'relu':
                return tf.relu(tensor);
            case 'swish':
                return tf.mul(tensor, tf.sigmoid(tensor));
            default:
                return tensor;
        }
    }

    async _combineMobileMLPResults(results) {
        console.log('🔄 Combining MLP results from mobile devices...');
        
        const deviceIds = Object.keys(results).sort();
        const tensors = deviceIds.map(deviceId => results[deviceId]);
        
        // Concatenate along the feature dimension
        const combined = tf.concat(tensors, -1);
        
        // Clean up individual results
        tensors.forEach(tensor => tensor.dispose());
        
        return combined;
    }

    async rebalanceForMobileConstraints(newDeviceSpecs) {
        console.log('🔄 Rebalancing tensor splitting for mobile device changes...');
        
        const oldDeviceCount = Object.keys(this.deviceSpecs).length;
        this.deviceSpecs = { ...newDeviceSpecs };
        const newDeviceCount = Object.keys(this.deviceSpecs).length;
        
        console.log(`📱 Device count changed: ${oldDeviceCount} → ${newDeviceCount}`);
        
        // Recalculate optimal splitting
        await this.initializeSplitting();
        
        console.log('✅ Mobile tensor splitting rebalanced');
    }

    _calculateMobileMaxLoad(specs) {
        // Calculate maximum load based on mobile device capabilities
        const baseLoad = specs.overallScore / 10; // 0.1 to 1.0
        
        // Adjust for battery optimization
        if (specs.deviceType.includes('low') || specs.deviceType.includes('minimal')) {
            return baseLoad * 0.6; // Reduce load for battery life
        }
        
        return baseLoad;
    }

    _estimateMobileBandwidth(specs) {
        // Estimate mobile network bandwidth
        const bandwidthMap = {
            'wifi': 50e6, // 50 Mbps
            '5g': 100e6,  // 100 Mbps
            '4g': 20e6,   // 20 Mbps
            '3g': 2e6,    // 2 Mbps
        };
        
        return bandwidthMap[specs.networkType] || 10e6; // 10 Mbps default
    }

    _estimateMobileMemoryPerHead(specs, precision) {
        const baseMemory = 64 * 1024 * 1024; // 64MB base per head
        const precisionMultiplier = precision === 'fp16' ? 1.0 : 0.5; // int8 uses half
        
        return baseMemory * precisionMultiplier;
    }

    async _yieldToMobileUI() {
        // Yield control to prevent blocking mobile UI
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    _logSplittingStrategy() {
        console.log('📊 Mobile Tensor Splitting Strategy:');
        console.log('=====================================');
        
        for (const [deviceId, assignment] of Object.entries(this.deviceAssignments)) {
            console.log(`📱 Device: ${deviceId}`);
            console.log(`   Type: ${assignment.deviceType}`);
            console.log(`   Attention Heads: [${assignment.attentionHeads.join(', ')}]`);
            console.log(`   MLP Dimensions: [${assignment.mlpDimensionRange[0]}:${assignment.mlpDimensionRange[1]}]`);
            console.log(`   Max Sequence: ${assignment.maxSequenceLength}`);
            console.log(`   Precision: ${assignment.attentionPrecision}`);
            console.log(`   Battery Optimized: ${assignment.batteryOptimized}`);
            console.log('   ---');
        }
    }

    // Getters for external access
    getDeviceAssignments() {
        return this.deviceAssignments;
    }

    getDeviceAssignment(deviceId) {
        return this.deviceAssignments[deviceId];
    }

    getTensorShards() {
        return this.tensorShards;
    }
}

export default MobileAdaptiveTensorSplitter;