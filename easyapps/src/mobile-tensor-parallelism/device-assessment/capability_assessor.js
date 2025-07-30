/**
 * Mobile Device Capability Assessor
 * JavaScript/React Native equivalent of Python capability_assessor.py
 * Assesses mobile device capabilities for tensor parallelism
 */

import { Platform, Dimensions, PixelRatio } from 'react-native';
import DeviceInfo from 'react-native-device-info';
import * as tf from '@tensorflow/tfjs';
import '@tensorflow/tfjs-react-native';
import '@tensorflow/tfjs-platform-react-native';

class MobileDeviceCapabilityAssessor {
    constructor() {
        this.deviceSpecs = new Map();
        this.benchmarkCache = new Map();
        this.initialized = false;
    }

    async initialize() {
        if (this.initialized) return;
        
        console.log('🔧 Initializing TensorFlow.js for mobile tensor parallelism...');
        
        // Initialize TensorFlow.js
        await tf.ready();
        
        // Enable production mode for better performance
        tf.env().set('PROD', true);
        
        this.initialized = true;
        console.log('✅ Mobile tensor parallelism initialized');
    }

    async assessDevice(deviceId, forceRefresh = false) {
        await this.initialize();
        
        if (!forceRefresh && this.deviceSpecs.has(deviceId)) {
            return this.deviceSpecs.get(deviceId);
        }

        console.log(`📱 Assessing mobile device capabilities: ${deviceId}`);
        
        const specs = await this._gatherMobileHardwareSpecs(deviceId);
        await this._runMobilePerformanceBenchmarks(specs);
        
        this.deviceSpecs.set(deviceId, specs);
        
        console.log(`✅ Device assessment complete for ${deviceId}`);
        console.log(`📊 Device Type: ${specs.deviceType}`);
        console.log(`🧠 Memory Score: ${specs.memoryScore.toFixed(2)}`);
        console.log(`⚡ Compute Score: ${specs.computeScore.toFixed(2)}`);
        
        return specs;
    }

    async _gatherMobileHardwareSpecs(deviceId) {
        const specs = {
            deviceId,
            timestamp: new Date().toISOString(),
            platform: Platform.OS,
            
            // Basic device info
            brand: await DeviceInfo.getBrand(),
            model: await DeviceInfo.getModel(),
            systemVersion: await DeviceInfo.getSystemVersion(),
            
            // Screen specifications
            screenData: Dimensions.get('screen'),
            pixelRatio: PixelRatio.get(),
            
            // Memory specifications
            totalMemory: await this._getTotalMemory(),
            availableMemory: await this._getAvailableMemory(),
            
            // CPU specifications
            cpuCount: await this._getCPUCount(),
            cpuArchitecture: await DeviceInfo.supportedABIs(),
            
            // GPU capabilities (if available)
            gpuInfo: await this._getGPUInfo(),
            
            // Network capabilities
            networkType: await this._getNetworkType(),
            
            // TensorFlow.js backend info
            tfBackend: tf.getBackend(),
            tfVersion: tf.version.tfjs,
            
            // Performance scores (to be calculated)
            memoryScore: 0,
            computeScore: 0,
            networkScore: 0,
            overallScore: 0,
            deviceType: 'unknown',
            
            // Tensor parallelism capabilities
            maxAttentionHeads: 0,
            maxMLPDimensions: 0,
            recommendedPrecision: 'int8',
            maxSequenceLength: 0,
            supportedOperations: []
        };

        return specs;
    }

    async _getTotalMemory() {
        try {
            if (Platform.OS === 'android') {
                // Android memory detection
                const totalMemory = await DeviceInfo.getTotalMemory();
                return totalMemory || 4 * 1024 * 1024 * 1024; // Default 4GB
            } else {
                // iOS memory estimation based on device model
                const model = await DeviceInfo.getModel();
                return this._estimateIOSMemory(model);
            }
        } catch (error) {
            console.warn('Could not determine total memory, using default');
            return 4 * 1024 * 1024 * 1024; // 4GB default
        }
    }

    async _getAvailableMemory() {
        try {
            if (Platform.OS === 'android') {
                const availableMemory = await DeviceInfo.getFreeDiskStorage();
                return Math.min(availableMemory, await this._getTotalMemory() * 0.7);
            } else {
                // iOS memory estimation
                const totalMemory = await this._getTotalMemory();
                return totalMemory * 0.6; // Conservative estimate
            }
        } catch (error) {
            console.warn('Could not determine available memory');
            return 2 * 1024 * 1024 * 1024; // 2GB default
        }
    }

    async _getCPUCount() {
        try {
            // Try to get CPU count from device info
            const deviceName = await DeviceInfo.getDeviceName();
            
            // Common mobile CPU configurations
            if (deviceName.includes('iPhone')) {
                return this._estimateIOSCores(deviceName);
            } else if (Platform.OS === 'android') {
                return this._estimateAndroidCores();
            }
            
            return 4; // Default assumption
        } catch (error) {
            return 4; // Default fallback
        }
    }

    _estimateIOSMemory(model) {
        const memoryMap = {
            'iPhone 15': 8 * 1024 * 1024 * 1024,
            'iPhone 14': 6 * 1024 * 1024 * 1024,
            'iPhone 13': 4 * 1024 * 1024 * 1024,
            'iPhone 12': 4 * 1024 * 1024 * 1024,
            'iPad Pro': 16 * 1024 * 1024 * 1024,
            'iPad Air': 8 * 1024 * 1024 * 1024,
        };
        
        for (const [device, memory] of Object.entries(memoryMap)) {
            if (model.includes(device)) {
                return memory;
            }
        }
        
        return 4 * 1024 * 1024 * 1024; // 4GB default
    }

    _estimateIOSCores(deviceName) {
        if (deviceName.includes('iPhone 15') || deviceName.includes('iPhone 14')) {
            return 6; // A16/A17 Bionic
        } else if (deviceName.includes('iPhone 13') || deviceName.includes('iPhone 12')) {
            return 6; // A15/A14 Bionic
        } else if (deviceName.includes('iPad Pro')) {
            return 8; // M1/M2 chip
        }
        return 4; // Default
    }

    _estimateAndroidCores() {
        // Use performance.hardwareConcurrency if available
        if (typeof performance !== 'undefined' && performance.hardwareConcurrency) {
            return performance.hardwareConcurrency;
        }
        
        // Default Android estimation
        return 8; // Most modern Android devices have 8 cores
    }

    async _getGPUInfo() {
        try {
            // Check if WebGL is available for GPU acceleration
            const gpuInfo = {
                available: false,
                vendor: 'unknown',
                renderer: 'unknown',
                webglSupport: false,
                computeShaderSupport: false
            };

            // Check WebGL support
            if (typeof WebGLRenderingContext !== 'undefined') {
                gpuInfo.webglSupport = true;
                
                // Try to get GPU info through WebGL
                const canvas = document.createElement('canvas');
                const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
                
                if (gl) {
                    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
                    if (debugInfo) {
                        gpuInfo.vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
                        gpuInfo.renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
                        gpuInfo.available = true;
                    }
                }
            }

            return gpuInfo;
        } catch (error) {
            return {
                available: false,
                vendor: 'unknown',
                renderer: 'unknown',
                webglSupport: false,
                computeShaderSupport: false
            };
        }
    }

    async _getNetworkType() {
        try {
            // In React Native, we'd use @react-native-community/netinfo
            // For now, return a default
            return 'wifi'; // Assume WiFi for better performance
        } catch (error) {
            return 'unknown';
        }
    }

    async _runMobilePerformanceBenchmarks(specs) {
        console.log('🧪 Running mobile performance benchmarks...');
        
        // Memory benchmark
        specs.memoryScore = this._calculateMemoryScore(specs);
        
        // Compute benchmark using TensorFlow.js
        specs.computeScore = await this._runComputeBenchmark();
        
        // Network benchmark
        specs.networkScore = this._calculateNetworkScore(specs);
        
        // Overall score
        specs.overallScore = (specs.memoryScore + specs.computeScore + specs.networkScore) / 3;
        
        // Determine device type and capabilities
        this._determineMobileDeviceCapabilities(specs);
        
        console.log('✅ Mobile benchmarks complete');
    }

    _calculateMemoryScore(specs) {
        const totalMemoryGB = specs.totalMemory / (1024 * 1024 * 1024);
        const availableMemoryGB = specs.availableMemory / (1024 * 1024 * 1024);
        
        // Score based on available memory
        const memoryScore = Math.min(10, (availableMemoryGB / 2) * 10);
        
        console.log(`📊 Memory Score: ${memoryScore.toFixed(2)} (${availableMemoryGB.toFixed(1)}GB available)`);
        return memoryScore;
    }

    async _runComputeBenchmark() {
        try {
            console.log('⚡ Running TensorFlow.js compute benchmark...');
            
            const startTime = performance.now();
            
            // Create test tensors for mobile-appropriate computation
            const a = tf.randomNormal([512, 512]);
            const b = tf.randomNormal([512, 512]);
            
            // Perform matrix multiplication benchmark
            const result = tf.matMul(a, b);
            await result.data(); // Wait for computation to complete
            
            const endTime = performance.now();
            const duration = endTime - startTime;
            
            // Clean up tensors
            a.dispose();
            b.dispose();
            result.dispose();
            
            // Calculate score based on performance (lower duration = higher score)
            const computeScore = Math.max(1, Math.min(10, 5000 / duration));
            
            console.log(`⚡ Compute Score: ${computeScore.toFixed(2)} (${duration.toFixed(1)}ms for 512x512 matmul)`);
            return computeScore;
            
        } catch (error) {
            console.warn('Compute benchmark failed:', error);
            return 3; // Default low score
        }
    }

    _calculateNetworkScore(specs) {
        // Basic network scoring based on type
        const networkScores = {
            'wifi': 9,
            '5g': 8,
            '4g': 6,
            '3g': 3,
            'unknown': 5
        };
        
        const score = networkScores[specs.networkType] || 5;
        console.log(`🌐 Network Score: ${score} (${specs.networkType})`);
        return score;
    }

    _determineMobileDeviceCapabilities(specs) {
        const memoryGB = specs.availableMemory / (1024 * 1024 * 1024);
        const overallScore = specs.overallScore;
        
        // Determine device type based on capabilities
        if (overallScore >= 8 && memoryGB >= 6) {
            specs.deviceType = 'mobile_high';
            specs.maxAttentionHeads = 16;
            specs.maxMLPDimensions = 2048;
            specs.recommendedPrecision = 'fp16';
            specs.maxSequenceLength = 2048;
        } else if (overallScore >= 6 && memoryGB >= 4) {
            specs.deviceType = 'mobile_mid';
            specs.maxAttentionHeads = 8;
            specs.maxMLPDimensions = 1024;
            specs.recommendedPrecision = 'fp16';
            specs.maxSequenceLength = 1024;
        } else if (overallScore >= 4 && memoryGB >= 2) {
            specs.deviceType = 'mobile_low';
            specs.maxAttentionHeads = 4;
            specs.maxMLPDimensions = 512;
            specs.recommendedPrecision = 'int8';
            specs.maxSequenceLength = 512;
        } else {
            specs.deviceType = 'mobile_minimal';
            specs.maxAttentionHeads = 2;
            specs.maxMLPDimensions = 256;
            specs.recommendedPrecision = 'int8';
            specs.maxSequenceLength = 256;
        }
        
        // Supported operations based on device capabilities
        specs.supportedOperations = [
            'attention_computation',
            'mlp_forward',
            'layer_norm',
            'embedding_lookup'
        ];
        
        if (specs.gpuInfo.available) {
            specs.supportedOperations.push('gpu_acceleration');
        }
        
        if (specs.computeScore >= 7) {
            specs.supportedOperations.push('fast_matmul');
        }
        
        console.log(`📱 Device Type: ${specs.deviceType}`);
        console.log(`🧠 Max Attention Heads: ${specs.maxAttentionHeads}`);
        console.log(`⚡ Max MLP Dimensions: ${specs.maxMLPDimensions}`);
        console.log(`🎯 Recommended Precision: ${specs.recommendedPrecision}`);
    }

    getDeviceSpecs(deviceId) {
        return this.deviceSpecs.get(deviceId);
    }

    getAllDeviceSpecs() {
        return Object.fromEntries(this.deviceSpecs);
    }

    async updateDeviceStatus(deviceId, status) {
        const specs = this.deviceSpecs.get(deviceId);
        if (specs) {
            specs.status = status;
            specs.lastUpdate = new Date().toISOString();
        }
    }

    // Mobile-specific utility methods
    async estimateBatteryImpact(workload) {
        // Estimate battery consumption based on workload
        const baseConsumption = 100; // mW base
        const computeMultiplier = workload.computeIntensity || 1;
        const durationMinutes = workload.estimatedDuration || 5;
        
        return baseConsumption * computeMultiplier * durationMinutes;
    }

    async checkThermalThrottling() {
        // Check if device is likely to throttle due to heat
        // This would need native implementation for real thermal data
        return {
            thermalState: 'normal', // 'normal', 'elevated', 'critical'
            recommendedAction: 'continue'
        };
    }

    async optimizeForBattery(enabled = true) {
        if (enabled) {
            // Reduce precision, limit concurrent operations
            tf.env().set('WEBGL_CPU_FORWARD', true);
            tf.env().set('WEBGL_PACK', false);
        } else {
            // Enable full performance
            tf.env().set('WEBGL_CPU_FORWARD', false);
            tf.env().set('WEBGL_PACK', true);
        }
    }
}

export default MobileDeviceCapabilityAssessor;