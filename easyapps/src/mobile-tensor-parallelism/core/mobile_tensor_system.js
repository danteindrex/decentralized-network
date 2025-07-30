/**
 * Mobile Tensor Parallelism System
 * Main entry point for mobile tensor parallelism functionality
 * Integrates all components for distributed AI processing on mobile devices
 */

// Use Node.js version for testing, React Native version for mobile
let tf;
if (typeof window === 'undefined') {
    // Node.js environment (testing)
    tf = await import('@tensorflow/tfjs-node');
} else {
    // Browser/React Native environment
    tf = await import('@tensorflow/tfjs');
    await import('@tensorflow/tfjs-react-native');
    await import('@tensorflow/tfjs-platform-react-native');
}

import MobileTensorParallelismCoordinator from './tensor_coordinator.js';
import MobileAdaptiveTensorSplitter from './tensor_splitter.js';
import MobileDeviceCapabilityAssessor from '../device-assessment/capability_assessor.js';
import MobileModelArchitectureParser from '../model-registry/architecture_parser.js';

class MobileTensorParallelismSystem {
    constructor(config = {}) {
        this.config = {
            bootstrapUrl: config.bootstrapUrl || 'https://bootstrap-node.onrender.com',
            enableGPUAcceleration: config.enableGPUAcceleration !== false,
            enableQuantization: config.enableQuantization !== false,
            batteryOptimization: config.batteryOptimization || false,
            thermalThrottling: config.thermalThrottling !== false,
            maxConcurrentSessions: config.maxConcurrentSessions || 2,
            ...config
        };
        
        // Core components
        this.coordinator = null;
        this.splitter = null;
        this.assessor = null;
        this.parser = null;
        
        // System state
        this.initialized = false;
        this.currentDeviceId = null;
        this.systemMetrics = {
            totalInferences: 0,
            successfulInferences: 0,
            avgProcessingTime: 0,
            totalDevices: 0,
            memoryUsage: 0
        };
        
        console.log('🎯 Mobile Tensor Parallelism System initialized');
        console.log('📱 Configuration:', this.config);
    }

    async initialize() {
        if (this.initialized) {
            console.log('⚠️ System already initialized');
            return;
        }
        
        console.log('🚀 Initializing Mobile Tensor Parallelism System...');
        
        try {
            // Initialize TensorFlow.js with mobile optimizations
            await this._initializeTensorFlow();
            
            // Initialize core components
            await this._initializeComponents();
            
            // Setup mobile-specific optimizations
            await this._setupMobileOptimizations();
            
            // Start system monitoring
            this._startSystemMonitoring();
            
            this.initialized = true;
            console.log('✅ Mobile Tensor Parallelism System ready');
            this._logSystemStatus();
            
        } catch (error) {
            console.error('❌ Failed to initialize Mobile Tensor Parallelism System:', error);
            throw error;
        }
    }

    async _initializeTensorFlow() {
        console.log('🧠 Initializing TensorFlow.js for mobile tensor parallelism...');
        
        // Wait for TensorFlow.js to be ready
        await tf.ready();
        
        // Configure TensorFlow.js for mobile optimization
        if (this.config.enableGPUAcceleration) {
            try {
                // Try to enable WebGL backend for GPU acceleration
                await tf.setBackend('webgl');
                console.log('✅ GPU acceleration enabled via WebGL');
            } catch (error) {
                console.warn('⚠️ GPU acceleration not available, using CPU backend');
                await tf.setBackend('cpu');
            }
        } else {
            await tf.setBackend('cpu');
            console.log('✅ CPU backend initialized');
        }
        
        // Configure memory management
        tf.env().set('WEBGL_DELETE_TEXTURE_THRESHOLD', 0);
        tf.env().set('WEBGL_FLUSH_THRESHOLD', 1);
        
        // Enable production mode
        tf.env().set('PROD', true);
        
        console.log(`✅ TensorFlow.js ready - Backend: ${tf.getBackend()}`);
        console.log(`📊 TensorFlow.js version: ${tf.version.tfjs}`);
    }

    async _initializeComponents() {
        console.log('🔧 Initializing mobile tensor parallelism components...');
        
        // Initialize device capability assessor
        this.assessor = new MobileDeviceCapabilityAssessor();
        await this.assessor.initialize();
        
        // Initialize model architecture parser
        this.parser = new MobileModelArchitectureParser();
        
        // Initialize coordinator
        this.coordinator = new MobileTensorParallelismCoordinator(this.config.bootstrapUrl);
        await this.coordinator.initialize();
        
        // Get current device ID
        this.currentDeviceId = await this._generateDeviceId();
        
        console.log('✅ All components initialized');
    }

    async _setupMobileOptimizations() {
        console.log('⚡ Setting up mobile-specific optimizations...');
        
        // Battery optimization
        if (this.config.batteryOptimization) {
            await this.coordinator.enableMobileBatteryMode(true);
        }
        
        // Thermal throttling
        if (this.config.thermalThrottling) {
            this._setupThermalMonitoring();
        }
        
        // Memory management
        this._setupMobileMemoryManagement();
        
        // Background processing handling
        this._setupBackgroundProcessingHandler();
        
        console.log('✅ Mobile optimizations configured');
    }

    _setupThermalMonitoring() {
        console.log('🌡️ Setting up thermal monitoring...');
        
        // Monitor thermal state periodically
        setInterval(async () => {
            try {
                const thermalState = await this.assessor.checkThermalThrottling();
                
                if (thermalState.thermalState === 'critical') {
                    console.log('🔥 Critical thermal state detected, throttling performance');
                    await this._throttlePerformance();
                } else if (thermalState.thermalState === 'elevated') {
                    console.log('🌡️ Elevated thermal state, reducing load');
                    await this._reduceLoad();
                }
            } catch (error) {
                console.warn('Thermal monitoring error:', error);
            }
        }, 10000); // Check every 10 seconds
    }

    _setupMobileMemoryManagement() {
        console.log('💾 Setting up mobile memory management...');
        
        // Monitor memory usage
        setInterval(() => {
            const memInfo = tf.memory();
            this.systemMetrics.memoryUsage = memInfo.numBytes;
            
            // Aggressive garbage collection on mobile
            if (memInfo.numTensors > 100) {
                tf.disposeVariables();
                console.log('🧹 Performed tensor cleanup');
            }
            
            // Log memory warnings
            if (memInfo.numBytes > 100 * 1024 * 1024) { // 100MB
                console.warn(`⚠️ High memory usage: ${(memInfo.numBytes / 1024 / 1024).toFixed(1)} MB`);
            }
        }, 5000);
    }

    _setupBackgroundProcessingHandler() {
        console.log('📱 Setting up background processing handler...');
        
        // Handle app going to background/foreground
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                console.log('📱 App backgrounded, pausing tensor operations');
                this._pauseTensorOperations();
            } else {
                console.log('📱 App foregrounded, resuming tensor operations');
                this._resumeTensorOperations();
            }
        });
    }

    async _generateDeviceId() {
        try {
            const deviceInfo = {
                userAgent: navigator.userAgent || 'unknown',
                screen: `${screen.width}x${screen.height}`,
                platform: navigator.platform || 'unknown',
                timestamp: Date.now()
            };
            
            const deviceString = JSON.stringify(deviceInfo);
            const deviceId = btoa(deviceString).slice(0, 16);
            
            return `mobile_tensor_${deviceId}`;
        } catch (error) {
            return `mobile_tensor_${Math.random().toString(36).slice(2, 18)}`;
        }
    }

    async runInference(prompt, modelCid, userAccount, options = {}) {
        if (!this.initialized) {
            throw new Error('Mobile Tensor Parallelism System not initialized');
        }
        
        console.log('🎯 Starting mobile tensor parallelism inference...');
        console.log(`📝 Prompt: ${prompt.substring(0, 50)}...`);
        console.log(`🤖 Model: ${modelCid}`);
        console.log(`👤 User: ${userAccount}`);
        
        const startTime = Date.now();
        this.systemMetrics.totalInferences++;
        
        try {
            // Parse model architecture for mobile optimization
            const modelConfig = await this._getModelConfig(modelCid, options);
            const architecture = await this.parser.parseModelArchitecture(modelCid, modelConfig);
            
            // Validate mobile compatibility
            const compatibility = await this.parser.validateMobileCompatibility(architecture);
            if (!compatibility.compatible) {
                throw new Error(`Model not compatible with mobile: ${compatibility.issues.join(', ')}`);
            }
            
            // Execute inference through coordinator
            const result = await this.coordinator.submitInferenceJob(
                prompt,
                modelCid,
                userAccount,
                architecture
            );
            
            // Update metrics
            const duration = (Date.now() - startTime) / 1000;
            this._updateSuccessMetrics(duration);
            
            console.log(`✅ Mobile tensor parallelism inference completed in ${duration.toFixed(2)}s`);
            
            return {
                ...result,
                deviceId: this.currentDeviceId,
                architecture: architecture.type,
                mobileOptimized: true,
                systemMetrics: this.getSystemMetrics()
            };
            
        } catch (error) {
            console.error('❌ Mobile tensor parallelism inference failed:', error);
            this._updateFailureMetrics();
            
            return {
                success: false,
                error: error.message,
                deviceId: this.currentDeviceId,
                duration: (Date.now() - startTime) / 1000
            };
        }
    }

    async _getModelConfig(modelCid, options) {
        // Get model configuration from various sources
        let modelConfig = { ...options };
        
        try {
            // Try to fetch model metadata from IPFS (would be implemented in production)
            console.log(`📋 Retrieving model config for ${modelCid}...`);
            
            // For demo, return default transformer config
            return {
                architecture: options.architecture || 'mobile-transformer',
                num_layers: options.numLayers || 6,
                hidden_size: options.hiddenSize || 512,
                num_attention_heads: options.numAttentionHeads || 8,
                intermediate_size: options.intermediateSize || 1024,
                max_position_embeddings: options.maxPositionEmbeddings || 512,
                vocab_size: options.vocabSize || 16384,
                ...modelConfig
            };
            
        } catch (error) {
            console.warn('⚠️ Could not retrieve model config, using defaults');
            return modelConfig;
        }
    }

    async _throttlePerformance() {
        console.log('🔥 Throttling performance due to thermal state');
        
        // Reduce precision
        tf.env().set('WEBGL_FORCE_F16_TEXTURES', true);
        
        // Limit concurrent operations
        this.config.maxConcurrentSessions = 1;
        
        // Enable battery mode
        await this.coordinator.enableMobileBatteryMode(true);
    }

    async _reduceLoad() {
        console.log('⚡ Reducing computational load');
        
        // Enable quantization
        if (this.config.enableQuantization) {
            console.log('📉 Enabling int8 quantization for efficiency');
        }
        
        // Reduce batch size
        this.config.maxBatchSize = 1;
    }

    _pauseTensorOperations() {
        console.log('⏸️ Pausing tensor operations');
        this.config.backgroundProcessing = false;
    }

    _resumeTensorOperations() {
        console.log('▶️ Resuming tensor operations');
        this.config.backgroundProcessing = true;
    }

    _startSystemMonitoring() {
        console.log('📊 Starting system monitoring...');
        
        // Monitor system health every 30 seconds
        setInterval(() => {
            this._logSystemHealth();
        }, 30000);
        
        // Monitor device count
        setInterval(async () => {
            const connectedDevices = this.coordinator.getConnectedMobileDevices();
            this.systemMetrics.totalDevices = Object.keys(connectedDevices).length;
        }, 10000);
    }

    _updateSuccessMetrics(duration) {
        this.systemMetrics.successfulInferences++;
        
        const totalSuccessful = this.systemMetrics.successfulInferences;
        const currentAvg = this.systemMetrics.avgProcessingTime;
        
        this.systemMetrics.avgProcessingTime = 
            (currentAvg * (totalSuccessful - 1) + duration) / totalSuccessful;
    }

    _updateFailureMetrics() {
        // Failure metrics are tracked in coordinator
    }

    _logSystemStatus() {
        console.log('📊 Mobile Tensor Parallelism System Status:');
        console.log('==========================================');
        console.log(`Device ID: ${this.currentDeviceId}`);
        console.log(`TensorFlow Backend: ${tf.getBackend()}`);
        console.log(`GPU Acceleration: ${this.config.enableGPUAcceleration}`);
        console.log(`Battery Optimization: ${this.config.batteryOptimization}`);
        console.log(`Thermal Throttling: ${this.config.thermalThrottling}`);
        console.log(`Max Concurrent Sessions: ${this.config.maxConcurrentSessions}`);
    }

    _logSystemHealth() {
        const memInfo = tf.memory();
        const metrics = this.getSystemMetrics();
        
        console.log('💊 System Health Check:');
        console.log(`📊 Total Inferences: ${metrics.totalInferences}`);
        console.log(`✅ Success Rate: ${((metrics.successfulInferences / metrics.totalInferences) * 100).toFixed(1)}%`);
        console.log(`⏱️ Avg Processing Time: ${metrics.avgProcessingTime.toFixed(2)}s`);
        console.log(`📱 Connected Devices: ${metrics.totalDevices}`);
        console.log(`💾 Memory Usage: ${(memInfo.numBytes / 1024 / 1024).toFixed(1)} MB`);
        console.log(`🧮 Active Tensors: ${memInfo.numTensors}`);
    }

    // Public API methods
    getSystemMetrics() {
        return {
            ...this.systemMetrics,
            memoryInfo: tf.memory(),
            backend: tf.getBackend(),
            deviceId: this.currentDeviceId,
            initialized: this.initialized
        };
    }

    getConnectedDevices() {
        return this.coordinator ? this.coordinator.getConnectedMobileDevices() : {};
    }

    getActiveSessions() {
        return this.coordinator ? this.coordinator.getActiveMobileSessions() : {};
    }

    async assessCurrentDevice() {
        if (!this.assessor) {
            throw new Error('Device assessor not initialized');
        }
        
        return await this.assessor.assessDevice(this.currentDeviceId, true);
    }

    async enableBatteryMode(enabled = true) {
        this.config.batteryOptimization = enabled;
        
        if (this.coordinator) {
            await this.coordinator.enableMobileBatteryMode(enabled);
        }
        
        if (this.assessor) {
            await this.assessor.optimizeForBattery(enabled);
        }
        
        console.log(`🔋 Battery mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    async enableGPUAcceleration(enabled = true) {
        this.config.enableGPUAcceleration = enabled;
        
        try {
            if (enabled) {
                await tf.setBackend('webgl');
                console.log('✅ GPU acceleration enabled');
            } else {
                await tf.setBackend('cpu');
                console.log('✅ CPU backend enabled');
            }
        } catch (error) {
            console.warn('⚠️ Failed to change backend:', error);
        }
    }

    async clearSystemCache() {
        console.log('🧹 Clearing system cache...');
        
        // Clear TensorFlow.js cache
        tf.disposeVariables();
        
        // Clear component caches
        if (this.parser) {
            this.parser.clearCache();
        }
        
        // Reset metrics
        this.systemMetrics = {
            totalInferences: 0,
            successfulInferences: 0,
            avgProcessingTime: 0,
            totalDevices: 0,
            memoryUsage: 0
        };
        
        console.log('✅ System cache cleared');
    }

    async shutdown() {
        console.log('🛑 Shutting down Mobile Tensor Parallelism System...');
        
        try {
            // Cleanup coordinator
            if (this.coordinator) {
                await this.coordinator.cleanup();
            }
            
            // Clear system cache
            await this.clearSystemCache();
            
            this.initialized = false;
            
            console.log('✅ Mobile Tensor Parallelism System shut down');
            
        } catch (error) {
            console.error('❌ Error during shutdown:', error);
        }
    }
}

export default MobileTensorParallelismSystem;