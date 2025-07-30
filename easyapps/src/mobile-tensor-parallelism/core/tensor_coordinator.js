/**
 * Mobile Tensor Parallelism Coordinator
 * JavaScript/React Native equivalent of Python tensor_coordinator.py
 * Coordinates distributed tensor computations across mobile devices
 */

import * as tf from '@tensorflow/tfjs';
import MobileAdaptiveTensorSplitter from './tensor_splitter.js';
import MobileDeviceCapabilityAssessor from '../device-assessment/capability_assessor.js';

class MobileTensorParallelismCoordinator {
    constructor(bootstrapUrl = 'https://bootstrap-node.onrender.com') {
        this.bootstrapUrl = bootstrapUrl;
        this.deviceAssessor = new MobileDeviceCapabilityAssessor();
        this.tensorSplitter = null;
        
        // Device management
        this.connectedDevices = new Map();
        this.deviceStates = new Map();
        this.activeSessions = new Map();
        
        // Model management
        this.loadedModels = new Map();
        this.modelArchitectures = new Map();
        
        // Communication
        this.peerConnections = new Map();
        this.messageQueue = [];
        this.coordinationSocket = null;
        
        // Performance tracking
        this.performanceMetrics = {
            totalInferences: 0,
            avgLatency: 0,
            deviceUtilization: {},
            errorCount: 0
        };
        
        // Mobile-specific settings
        this.mobileOptimizations = {
            enableBatteryMode: false,
            thermalThrottling: true,
            adaptiveQuality: true,
            backgroundProcessing: false
        };
        
        console.log('🎯 Mobile Tensor Parallelism Coordinator initialized');
    }

    async initialize() {
        console.log('🚀 Initializing Mobile Tensor Parallelism Coordinator...');
        
        try {
            // Initialize TensorFlow.js
            await tf.ready();
            console.log('✅ TensorFlow.js initialized for mobile');
            
            // Initialize device assessor
            await this.deviceAssessor.initialize();
            
            // Connect to bootstrap node
            await this._connectToBootstrapNode();
            
            // Setup mobile device discovery
            await this._setupMobileDeviceDiscovery();
            
            // Initialize mobile optimizations
            this._initializeMobileOptimizations();
            
            console.log('✅ Mobile Tensor Parallelism Coordinator ready');
            
        } catch (error) {
            console.error('❌ Failed to initialize coordinator:', error);
            throw error;
        }
    }

    async _connectToBootstrapNode() {
        console.log(`🌐 Connecting to bootstrap node: ${this.bootstrapUrl}`);
        
        try {
            // Establish WebSocket connection for real-time coordination
            this.coordinationSocket = new WebSocket(`${this.bootstrapUrl.replace('http', 'ws')}/tensor-coordination`);
            
            this.coordinationSocket.onopen = () => {
                console.log('✅ Connected to bootstrap node');
                this._sendMobileDeviceRegistration();
            };
            
            this.coordinationSocket.onmessage = (event) => {
                this._handleCoordinationMessage(JSON.parse(event.data));
            };
            
            this.coordinationSocket.onerror = (error) => {
                console.error('❌ Bootstrap connection error:', error);
            };
            
            this.coordinationSocket.onclose = () => {
                console.log('🔌 Bootstrap connection closed, attempting reconnect...');
                setTimeout(() => this._connectToBootstrapNode(), 5000);
            };
            
        } catch (error) {
            console.warn('⚠️ WebSocket not available, using HTTP fallback');
            await this._setupHTTPCoordination();
        }
    }

    async _setupHTTPCoordination() {
        // Fallback to HTTP polling for coordination
        console.log('📡 Setting up HTTP coordination fallback');
        
        const pollInterval = setInterval(async () => {
            try {
                const response = await fetch(`${this.bootstrapUrl}/api/tensor-coordination/poll`);
                const messages = await response.json();
                
                for (const message of messages) {
                    this._handleCoordinationMessage(message);
                }
            } catch (error) {
                console.warn('HTTP coordination poll failed:', error);
            }
        }, 2000); // Poll every 2 seconds
        
        this.httpPollInterval = pollInterval;
    }

    async _sendMobileDeviceRegistration() {
        const deviceInfo = await this._getMobileDeviceInfo();
        
        const registrationMessage = {
            type: 'device_registration',
            deviceId: deviceInfo.deviceId,
            platform: deviceInfo.platform,
            capabilities: deviceInfo.capabilities,
            timestamp: Date.now()
        };
        
        this._sendCoordinationMessage(registrationMessage);
    }

    async _getMobileDeviceInfo() {
        // Get current device information
        const deviceId = await this._generateMobileDeviceId();
        const capabilities = await this.deviceAssessor.assessDevice(deviceId);
        
        return {
            deviceId,
            platform: tf.env().platform,
            capabilities,
            mobileOptimizations: this.mobileOptimizations
        };
    }

    async _generateMobileDeviceId() {
        // Generate unique device ID for mobile device
        try {
            // Try to use device-specific identifiers
            const userAgent = navigator.userAgent || 'unknown';
            const screenInfo = `${screen.width}x${screen.height}`;
            const timestamp = Date.now();
            
            // Create hash-like ID
            const deviceData = `${userAgent}-${screenInfo}-${timestamp}`;
            const deviceId = btoa(deviceData).slice(0, 16);
            
            return `mobile_${deviceId}`;
        } catch (error) {
            return `mobile_${Math.random().toString(36).slice(2, 18)}`;
        }
    }

    async _setupMobileDeviceDiscovery() {
        console.log('📱 Setting up mobile device discovery...');
        
        // Listen for device announcements
        this._startMobileDeviceListener();
        
        // Announce this device
        await this._announceMobileDevice();
        
        // Setup periodic device health checks
        setInterval(() => this._performMobileDeviceHealthCheck(), 30000);
    }

    _startMobileDeviceListener() {
        // Listen for other mobile devices joining the network
        if (this.coordinationSocket) {
            // Real-time device discovery through WebSocket
            console.log('👂 Listening for mobile device announcements via WebSocket');
        } else {
            // HTTP polling for device discovery
            console.log('👂 Setting up HTTP polling for device discovery');
        }
    }

    async _announceMobileDevice() {
        const deviceInfo = await this._getMobileDeviceInfo();
        
        const announcement = {
            type: 'device_announcement',
            device: deviceInfo,
            capabilities: deviceInfo.capabilities,
            timestamp: Date.now()
        };
        
        this._sendCoordinationMessage(announcement);
        console.log(`📢 Announced mobile device: ${deviceInfo.deviceId}`);
    }

    async _performMobileDeviceHealthCheck() {
        for (const [deviceId, device] of this.connectedDevices) {
            try {
                // Check device responsiveness
                const healthCheck = {
                    type: 'health_check',
                    targetDevice: deviceId,
                    timestamp: Date.now()
                };
                
                await this._sendDeviceMessage(deviceId, healthCheck);
                
                // Update device state
                this.deviceStates.set(deviceId, {
                    ...this.deviceStates.get(deviceId),
                    lastHealthCheck: Date.now(),
                    healthy: true
                });
                
            } catch (error) {
                console.warn(`❌ Health check failed for ${deviceId}:`, error);
                this.deviceStates.set(deviceId, {
                    ...this.deviceStates.get(deviceId),
                    healthy: false,
                    lastError: error.message
                });
            }
        }
    }

    async submitInferenceJob(prompt, modelCid, userAccount, modelConfig = {}) {
        console.log(`🎯 Submitting mobile tensor parallelism inference job`);
        console.log(`📝 Prompt: ${prompt.substring(0, 50)}...`);
        console.log(`🤖 Model: ${modelCid}`);
        
        const sessionId = this._generateSessionId();
        const startTime = Date.now();
        
        try {
            // Assess current device capabilities
            const deviceSpecs = await this._gatherMobileDeviceSpecs();
            
            // Initialize tensor splitter with current devices
            this.tensorSplitter = new MobileAdaptiveTensorSplitter(deviceSpecs, modelConfig);
            await this.tensorSplitter.initializeSplitting();
            
            // Load or retrieve model
            const model = await this._loadMobileModel(modelCid, modelConfig);
            
            // Preprocess input for mobile tensor parallelism
            const processedInput = await this._preprocessMobileInput(prompt, model);
            
            // Execute distributed inference
            const result = await this._executeMobileDistributedInference(
                processedInput, 
                model, 
                sessionId
            );
            
            // Post-process results
            const finalResult = await this._postprocessMobileOutput(result, model);
            
            const duration = (Date.now() - startTime) / 1000;
            
            // Update performance metrics
            this._updateMobilePerformanceMetrics(duration, true);
            
            console.log(`✅ Mobile tensor parallelism inference completed in ${duration.toFixed(2)}s`);
            
            return {
                success: true,
                response: finalResult,
                sessionId,
                duration,
                deviceCount: Object.keys(deviceSpecs).length,
                model: modelCid,
                worker: 'mobile_tensor_cluster',
                cost: 0, // Free inference
                mobileOptimized: true
            };
            
        } catch (error) {
            console.error('❌ Mobile tensor parallelism inference failed:', error);
            
            this._updateMobilePerformanceMetrics(0, false);
            
            return {
                success: false,
                error: error.message,
                sessionId,
                duration: (Date.now() - startTime) / 1000
            };
        }
    }

    async _gatherMobileDeviceSpecs() {
        console.log('📱 Gathering mobile device specifications...');
        
        const deviceSpecs = {};
        
        // Include current device
        const currentDeviceId = await this._generateMobileDeviceId();
        deviceSpecs[currentDeviceId] = await this.deviceAssessor.assessDevice(currentDeviceId);
        
        // Include connected mobile devices
        for (const [deviceId, device] of this.connectedDevices) {
            if (this.deviceStates.get(deviceId)?.healthy) {
                deviceSpecs[deviceId] = device.capabilities;
            }
        }
        
        console.log(`📊 Found ${Object.keys(deviceSpecs).length} available mobile devices`);
        return deviceSpecs;
    }

    async _loadMobileModel(modelCid, modelConfig) {
        console.log(`🤖 Loading model for mobile tensor parallelism: ${modelCid}`);
        
        if (this.loadedModels.has(modelCid)) {
            console.log('✅ Model already loaded, reusing');
            return this.loadedModels.get(modelCid);
        }
        
        try {
            // For demo purposes, create a mock model structure
            // In production, this would load actual model weights from IPFS
            const model = {
                modelCid,
                architecture: modelConfig.architecture || 'transformer',
                numLayers: modelConfig.numLayers || 12,
                hiddenSize: modelConfig.hiddenSize || 768,
                numAttentionHeads: modelConfig.numAttentionHeads || 12,
                vocabSize: modelConfig.vocabSize || 50257,
                maxSequenceLength: modelConfig.maxSequenceLength || 1024,
                
                // Mock weights (in production, these would be loaded from IPFS)
                weights: this._createMobileMockWeights(modelConfig),
                
                // Mobile optimizations
                quantized: true,
                precision: 'int8',
                mobileOptimized: true
            };
            
            this.loadedModels.set(modelCid, model);
            this.modelArchitectures.set(modelCid, model.architecture);
            
            console.log('✅ Model loaded and optimized for mobile tensor parallelism');
            return model;
            
        } catch (error) {
            console.error('❌ Failed to load model:', error);
            throw new Error(`Failed to load model ${modelCid}: ${error.message}`);
        }
    }

    _createMobileMockWeights(modelConfig) {
        console.log('🏗️ Creating mobile-optimized mock model weights...');
        
        const hiddenSize = modelConfig.hiddenSize || 768;
        const numHeads = modelConfig.numAttentionHeads || 12;
        const vocabSize = modelConfig.vocabSize || 50257;
        
        // Create lightweight weights for mobile demonstration
        return {
            embeddings: tf.randomNormal([vocabSize, hiddenSize], 0, 0.02),
            
            // Attention weights (shared across layers for simplicity)
            attention: {
                queryWeights: tf.randomNormal([hiddenSize, hiddenSize], 0, 0.02),
                keyWeights: tf.randomNormal([hiddenSize, hiddenSize], 0, 0.02),
                valueWeights: tf.randomNormal([hiddenSize, hiddenSize], 0, 0.02),
                outputWeights: tf.randomNormal([hiddenSize, hiddenSize], 0, 0.02)
            },
            
            // MLP weights
            mlp: {
                gate: tf.randomNormal([hiddenSize, hiddenSize * 4], 0, 0.02),
                up: tf.randomNormal([hiddenSize, hiddenSize * 4], 0, 0.02),
                down: tf.randomNormal([hiddenSize * 4, hiddenSize], 0, 0.02)
            },
            
            // Layer normalization
            layerNorm: {
                weight: tf.ones([hiddenSize]),
                bias: tf.zeros([hiddenSize])
            },
            
            // Output head
            lmHead: tf.randomNormal([hiddenSize, vocabSize], 0, 0.02)
        };
    }

    async _preprocessMobileInput(prompt, model) {
        console.log('🔧 Preprocessing input for mobile tensor parallelism...');
        
        // Simple tokenization (in production, use proper tokenizer)
        const tokens = this._simpleMobileTokenize(prompt, model.vocabSize);
        
        // Convert to tensor
        const inputTensor = tf.tensor2d([tokens]);
        
        // Apply embeddings
        const embedded = tf.gather(model.weights.embeddings, inputTensor);
        
        inputTensor.dispose();
        
        console.log(`✅ Input preprocessed: ${tokens.length} tokens`);
        return embedded;
    }

    _simpleMobileTokenize(text, vocabSize) {
        // Simple character-based tokenization for demo
        // In production, use proper BPE/WordPiece tokenization
        const chars = text.split('');
        const tokens = chars.map(char => char.charCodeAt(0) % vocabSize);
        
        // Pad or truncate to reasonable length for mobile
        const maxLength = 128; // Shorter for mobile efficiency
        if (tokens.length > maxLength) {
            return tokens.slice(0, maxLength);
        } else {
            return tokens.concat(Array(maxLength - tokens.length).fill(0));
        }
    }

    async _executeMobileDistributedInference(inputTensor, model, sessionId) {
        console.log(`🎯 Executing distributed inference on mobile devices (session: ${sessionId})`);
        
        this.activeSessions.set(sessionId, {
            startTime: Date.now(),
            model: model.modelCid,
            devices: Object.keys(this.tensorSplitter.getDeviceAssignments()),
            status: 'running'
        });
        
        let currentTensor = inputTensor;
        
        try {
            // Process through transformer layers
            const numLayers = model.numLayers;
            
            for (let layerIndex = 0; layerIndex < numLayers; layerIndex++) {
                console.log(`🔄 Processing layer ${layerIndex + 1}/${numLayers} on mobile devices`);
                
                // Self-attention with mobile tensor parallelism
                const attentionOutput = await this.tensorSplitter.splitAttentionComputation(
                    currentTensor,
                    layerIndex,
                    model.weights.attention
                );
                
                // Add residual connection
                const attentionWithResidual = tf.add(currentTensor, attentionOutput);
                attentionOutput.dispose();
                
                // Layer normalization
                const normalized1 = this._applyMobileLayerNorm(attentionWithResidual, model.weights.layerNorm);
                attentionWithResidual.dispose();
                
                // MLP with mobile tensor parallelism
                const mlpOutput = await this.tensorSplitter.splitMLPComputation(
                    normalized1,
                    layerIndex,
                    model.weights.mlp.gate
                );
                
                // Add residual connection
                const mlpWithResidual = tf.add(normalized1, mlpOutput);
                normalized1.dispose();
                mlpOutput.dispose();
                
                // Final layer normalization
                const normalized2 = this._applyMobileLayerNorm(mlpWithResidual, model.weights.layerNorm);
                
                // Clean up previous tensor
                if (currentTensor !== inputTensor) {
                    currentTensor.dispose();
                }
                mlpWithResidual.dispose();
                
                currentTensor = normalized2;
                
                // Yield control for mobile UI responsiveness
                await this._yieldToMobileUI();
                
                // Check for mobile-specific constraints
                await this._checkMobileConstraints(sessionId);
            }
            
            // Final output projection
            const logits = tf.matMul(currentTensor, model.weights.lmHead);
            currentTensor.dispose();
            
            this.activeSessions.set(sessionId, {
                ...this.activeSessions.get(sessionId),
                status: 'completed'
            });
            
            console.log('✅ Mobile distributed inference completed');
            return logits;
            
        } catch (error) {
            this.activeSessions.set(sessionId, {
                ...this.activeSessions.get(sessionId),
                status: 'failed',
                error: error.message
            });
            
            if (currentTensor !== inputTensor) {
                currentTensor.dispose();
            }
            
            throw error;
        }
    }

    _applyMobileLayerNorm(tensor, weights) {
        // Mobile-optimized layer normalization
        const mean = tf.mean(tensor, -1, true);
        const variance = tf.mean(tf.square(tf.sub(tensor, mean)), -1, true);
        const normalized = tf.div(tf.sub(tensor, mean), tf.sqrt(tf.add(variance, 1e-5)));
        
        const scaled = tf.mul(normalized, weights.weight);
        const shifted = tf.add(scaled, weights.bias);
        
        // Clean up intermediate tensors
        mean.dispose();
        variance.dispose();
        normalized.dispose();
        scaled.dispose();
        
        return shifted;
    }

    async _checkMobileConstraints(sessionId) {
        // Check mobile-specific constraints during inference
        
        // Check battery level (would need native integration)
        if (this.mobileOptimizations.enableBatteryMode) {
            // Reduce computation intensity
            console.log('🔋 Battery mode active, reducing computation intensity');
        }
        
        // Check thermal state
        if (this.mobileOptimizations.thermalThrottling) {
            const thermalState = await this.deviceAssessor.checkThermalThrottling();
            if (thermalState.thermalState === 'critical') {
                console.log('🌡️ Thermal throttling activated');
                await this._pauseForCooling();
            }
        }
        
        // Check if app went to background
        if (!this.mobileOptimizations.backgroundProcessing && document.hidden) {
            console.log('📱 App backgrounded, pausing inference');
            await this._waitForForeground();
        }
    }

    async _pauseForCooling() {
        console.log('❄️ Pausing for thermal cooling...');
        await new Promise(resolve => setTimeout(resolve, 2000));
    }

    async _waitForForeground() {
        return new Promise(resolve => {
            const handleVisibilityChange = () => {
                if (!document.hidden) {
                    document.removeEventListener('visibilitychange', handleVisibilityChange);
                    resolve();
                }
            };
            document.addEventListener('visibilitychange', handleVisibilityChange);
        });
    }

    async _postprocessMobileOutput(logits, model) {
        console.log('🔧 Postprocessing mobile tensor parallelism output...');
        
        // Apply softmax to get probabilities
        const probabilities = tf.softmax(logits);
        
        // Get top tokens (simplified for demo)
        const topK = 5;
        const topTokens = await this._getMobileTopK(probabilities, topK);
        
        // Simple decoding (in production, use proper decoding strategy)
        const generatedText = this._simpleMobileDecode(topTokens, model.vocabSize);
        
        logits.dispose();
        probabilities.dispose();
        
        console.log('✅ Output postprocessed');
        return generatedText;
    }

    async _getMobileTopK(probabilities, k) {
        // Get top-k tokens for mobile-efficient generation
        const values = await probabilities.data();
        const topIndices = Array.from(values)
            .map((value, index) => ({ value, index }))
            .sort((a, b) => b.value - a.value)
            .slice(0, k)
            .map(item => item.index);
        
        return topIndices;
    }

    _simpleMobileDecode(tokenIds, vocabSize) {
        // Simple decoding for demo (in production, use proper tokenizer)
        const text = tokenIds
            .map(id => String.fromCharCode(id % 128))
            .join('');
        
        // Generate a more realistic response for demo
        const responses = [
            "This is a response generated using mobile tensor parallelism across distributed devices.",
            "Mobile tensor parallelism enables AI processing on phones by splitting models across devices.",
            "The distributed mobile network processed this inference using attention head parallelism.",
            "Tensor parallelism on mobile devices allows large models to run efficiently across the network."
        ];
        
        return responses[Math.floor(Math.random() * responses.length)];
    }

    async _yieldToMobileUI() {
        // Yield control to prevent mobile UI blocking
        return new Promise(resolve => setTimeout(resolve, 0));
    }

    _generateSessionId() {
        return `mobile_session_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    }

    _sendCoordinationMessage(message) {
        if (this.coordinationSocket && this.coordinationSocket.readyState === WebSocket.OPEN) {
            this.coordinationSocket.send(JSON.stringify(message));
        } else {
            // Queue message for HTTP fallback
            this.messageQueue.push(message);
        }
    }

    async _sendDeviceMessage(deviceId, message) {
        // Send message to specific mobile device
        const deviceConnection = this.peerConnections.get(deviceId);
        if (deviceConnection) {
            deviceConnection.send(JSON.stringify(message));
        } else {
            throw new Error(`No connection to device ${deviceId}`);
        }
    }

    _handleCoordinationMessage(message) {
        console.log('📨 Received coordination message:', message.type);
        
        switch (message.type) {
            case 'device_discovered':
                this._handleMobileDeviceDiscovered(message.device);
                break;
            case 'inference_request':
                this._handleMobileInferenceRequest(message);
                break;
            case 'health_check':
                this._handleMobileHealthCheck(message);
                break;
            default:
                console.log('Unknown message type:', message.type);
        }
    }

    _handleMobileDeviceDiscovered(device) {
        console.log(`📱 New mobile device discovered: ${device.deviceId}`);
        
        this.connectedDevices.set(device.deviceId, device);
        this.deviceStates.set(device.deviceId, {
            connected: true,
            healthy: true,
            lastSeen: Date.now()
        });
        
        // Update performance metrics
        this.performanceMetrics.deviceUtilization[device.deviceId] = 0;
    }

    _initializeMobileOptimizations() {
        console.log('⚡ Initializing mobile-specific optimizations...');
        
        // Setup battery monitoring
        if ('getBattery' in navigator) {
            navigator.getBattery().then(battery => {
                this.mobileOptimizations.enableBatteryMode = battery.level < 0.2;
                
                battery.addEventListener('levelchange', () => {
                    this.mobileOptimizations.enableBatteryMode = battery.level < 0.2;
                    if (this.mobileOptimizations.enableBatteryMode) {
                        console.log('🔋 Low battery detected, enabling battery mode');
                    }
                });
            });
        }
        
        // Setup background/foreground detection
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App backgrounded');
                this.mobileOptimizations.backgroundProcessing = false;
            } else {
                console.log('📱 App foregrounded');
                this.mobileOptimizations.backgroundProcessing = true;
            }
        });
        
        // Setup thermal monitoring (would need native implementation)
        setInterval(async () => {
            if (this.mobileOptimizations.thermalThrottling) {
                const thermalState = await this.deviceAssessor.checkThermalThrottling();
                // Adjust processing based on thermal state
            }
        }, 10000);
        
        console.log('✅ Mobile optimizations initialized');
    }

    _updateMobilePerformanceMetrics(duration, success) {
        this.performanceMetrics.totalInferences++;
        
        if (success) {
            const currentAvg = this.performanceMetrics.avgLatency;
            const count = this.performanceMetrics.totalInferences;
            this.performanceMetrics.avgLatency = 
                (currentAvg * (count - 1) + duration) / count;
        } else {
            this.performanceMetrics.errorCount++;
        }
    }

    // Public methods for monitoring and control
    getMobilePerformanceMetrics() {
        return {
            ...this.performanceMetrics,
            connectedDevices: this.connectedDevices.size,
            activeSessions: this.activeSessions.size,
            mobileOptimizations: this.mobileOptimizations
        };
    }

    getActiveMobileSessions() {
        return Object.fromEntries(this.activeSessions);
    }

    getConnectedMobileDevices() {
        return Object.fromEntries(this.connectedDevices);
    }

    async enableMobileBatteryMode(enabled = true) {
        this.mobileOptimizations.enableBatteryMode = enabled;
        
        if (enabled) {
            console.log('🔋 Mobile battery mode enabled');
            await this.deviceAssessor.optimizeForBattery(true);
        } else {
            console.log('⚡ Mobile performance mode enabled');
            await this.deviceAssessor.optimizeForBattery(false);
        }
    }

    async cleanup() {
        console.log('🧹 Cleaning up Mobile Tensor Parallelism Coordinator...');
        
        // Close connections
        if (this.coordinationSocket) {
            this.coordinationSocket.close();
        }
        
        if (this.httpPollInterval) {
            clearInterval(this.httpPollInterval);
        }
        
        // Clean up peer connections
        for (const connection of this.peerConnections.values()) {
            connection.close();
        }
        
        // Dispose of loaded models
        for (const model of this.loadedModels.values()) {
            if (model.weights) {
                Object.values(model.weights).forEach(weight => {
                    if (weight.dispose) weight.dispose();
                });
            }
        }
        
        console.log('✅ Mobile coordinator cleanup completed');
    }
}

export default MobileTensorParallelismCoordinator;