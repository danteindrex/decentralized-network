/**
 * Mobile Tensor Parallelism - Main Export
 * Complete tensor parallelism system for mobile devices
 * JavaScript/React Native implementation equivalent to Python version
 */

// Core system
const MobileTensorParallelismSystem = require('./core/mobile_tensor_system.js');
const MobileTensorParallelismCoordinator = require('./core/tensor_coordinator.js');
const MobileAdaptiveTensorSplitter = require('./core/tensor_splitter.js');

// Device assessment
const MobileDeviceCapabilityAssessor = require('./device-assessment/capability_assessor.js');

// Model architecture
const MobileModelArchitectureParser = require('./model-registry/architecture_parser.js');

// Convenience function for quick setup
async function createMobileTensorSystem(config = {}) {
    const system = new MobileTensorParallelismSystem(config);
    await system.initialize();
    return system;
}

// Version info
const MOBILE_TENSOR_PARALLELISM_VERSION = '1.0.0';

console.log('📱 Mobile Tensor Parallelism modules loaded');
console.log(`📊 Version: ${MOBILE_TENSOR_PARALLELISM_VERSION}`);

module.exports = {
    MobileTensorParallelismSystem,
    MobileTensorParallelismCoordinator,
    MobileAdaptiveTensorSplitter,
    MobileDeviceCapabilityAssessor,
    MobileModelArchitectureParser,
    createMobileTensorSystem,
    MOBILE_TENSOR_PARALLELISM_VERSION
};