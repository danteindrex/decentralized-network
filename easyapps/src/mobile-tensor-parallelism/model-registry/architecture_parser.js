/**
 * Mobile Model Architecture Parser
 * JavaScript/React Native equivalent of Python architecture_parser.py
 * Parses and optimizes model architectures for mobile tensor parallelism
 */

import * as tf from '@tensorflow/tfjs';

class MobileModelArchitectureParser {
    constructor() {
        this.supportedArchitectures = [
            'llama',
            'gpt',
            'mistral',
            'bert',
            'roberta',
            'mobile-transformer'
        ];
        
        this.parsedModels = new Map();
        this.architectureCache = new Map();
        
        // Mobile-specific architecture optimizations
        this.mobileOptimizations = {
            maxLayersForMobile: 12,
            maxHiddenSizeForMobile: 1024,
            maxAttentionHeadsForMobile: 16,
            enableLayerFusion: true,
            useQuantization: true
        };
        
        console.log('🏗️ Mobile Model Architecture Parser initialized');
    }

    async parseModelArchitecture(modelCid, modelMetadata = {}) {
        console.log(`🔍 Parsing model architecture for mobile: ${modelCid}`);
        
        if (this.parsedModels.has(modelCid)) {
            console.log('✅ Architecture already parsed, returning cached version');
            return this.parsedModels.get(modelCid);
        }
        
        try {
            // Determine architecture type
            const architectureType = this._detectMobileArchitectureType(modelMetadata);
            
            // Parse architecture-specific details
            const parsedArchitecture = await this._parseSpecificMobileArchitecture(
                architectureType, 
                modelMetadata
            );
            
            // Apply mobile optimizations
            const optimizedArchitecture = this._applyMobileOptimizations(parsedArchitecture);
            
            // Cache the parsed architecture
            this.parsedModels.set(modelCid, optimizedArchitecture);
            
            console.log(`✅ Mobile architecture parsed: ${architectureType}`);
            this._logMobileArchitectureDetails(optimizedArchitecture);
            
            return optimizedArchitecture;
            
        } catch (error) {
            console.error(`❌ Failed to parse mobile architecture for ${modelCid}:`, error);
            throw error;
        }
    }

    _detectMobileArchitectureType(metadata) {
        console.log('🔍 Detecting model architecture type for mobile deployment...');
        
        // Check explicit architecture specification
        if (metadata.architecture) {
            const arch = metadata.architecture.toLowerCase();
            if (this.supportedArchitectures.includes(arch)) {
                return arch;
            }
        }
        
        // Detect from model name or config
        if (metadata.name || metadata.model_name) {
            const name = (metadata.name || metadata.model_name).toLowerCase();
            
            if (name.includes('llama')) return 'llama';
            if (name.includes('gpt')) return 'gpt';
            if (name.includes('mistral')) return 'mistral';
            if (name.includes('bert')) return 'bert';
            if (name.includes('roberta')) return 'roberta';
        }
        
        // Detect from configuration parameters
        if (metadata.num_attention_heads && metadata.hidden_size) {
            // Likely a transformer-based model
            return 'mobile-transformer';
        }
        
        console.log('⚠️ Unknown architecture, defaulting to mobile-transformer');
        return 'mobile-transformer';
    }

    async _parseSpecificMobileArchitecture(architectureType, metadata) {
        console.log(`🏗️ Parsing ${architectureType} architecture for mobile...`);
        
        switch (architectureType) {
            case 'llama':
                return this._parseMobileLlamaArchitecture(metadata);
            case 'gpt':
                return this._parseMobileGPTArchitecture(metadata);
            case 'mistral':
                return this._parseMobileMistralArchitecture(metadata);
            case 'bert':
                return this._parseMobileBERTArchitecture(metadata);
            case 'roberta':
                return this._parseMobileRoBERTaArchitecture(metadata);
            case 'mobile-transformer':
                return this._parseMobileTransformerArchitecture(metadata);
            default:
                throw new Error(`Unsupported architecture: ${architectureType}`);
        }
    }

    _parseMobileLlamaArchitecture(metadata) {
        console.log('🦙 Parsing LLaMA architecture for mobile tensor parallelism...');
        
        return {
            type: 'llama',
            mobileOptimized: true,
            
            // Core architecture parameters
            numLayers: Math.min(metadata.num_hidden_layers || 12, this.mobileOptimizations.maxLayersForMobile),
            hiddenSize: Math.min(metadata.hidden_size || 768, this.mobileOptimizations.maxHiddenSizeForMobile),
            intermediateSize: Math.min(metadata.intermediate_size || 3072, this.mobileOptimizations.maxHiddenSizeForMobile * 3),
            numAttentionHeads: Math.min(metadata.num_attention_heads || 12, this.mobileOptimizations.maxAttentionHeadsForMobile),
            numKeyValueHeads: Math.min(metadata.num_key_value_heads || metadata.num_attention_heads || 12, this.mobileOptimizations.maxAttentionHeadsForMobile),
            
            // Attention parameters
            headDim: (metadata.hidden_size || 768) / (metadata.num_attention_heads || 12),
            maxPositionEmbeddings: Math.min(metadata.max_position_embeddings || 1024, 1024), // Limit for mobile
            ropeTheta: metadata.rope_theta || 10000.0,
            
            // Vocabulary
            vocabSize: metadata.vocab_size || 32000,
            padTokenId: metadata.pad_token_id || 0,
            bosTokenId: metadata.bos_token_id || 1,
            eosTokenId: metadata.eos_token_id || 2,
            
            // Normalization
            rmsNormEps: metadata.rms_norm_eps || 1e-6,
            
            // Mobile-specific optimizations
            activationFunction: 'silu', // SwiGLU activation
            attentionBias: false,
            tieWordEmbeddings: metadata.tie_word_embeddings || false,
            
            // Tensor parallelism configuration
            tensorParallelism: {
                attentionHeadParallel: true,
                mlpParallel: true,
                layerParallel: false, // Not efficient for mobile
                sequenceParallel: true
            },
            
            // Mobile constraints
            mobileConstraints: {
                maxMemoryPerDevice: 2 * 1024 * 1024 * 1024, // 2GB
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8'
            }
        };
    }

    _parseMobileGPTArchitecture(metadata) {
        console.log('🤖 Parsing GPT architecture for mobile tensor parallelism...');
        
        return {
            type: 'gpt',
            mobileOptimized: true,
            
            // Core architecture parameters
            numLayers: Math.min(metadata.n_layer || metadata.num_layers || 12, this.mobileOptimizations.maxLayersForMobile),
            hiddenSize: Math.min(metadata.n_embd || metadata.hidden_size || 768, this.mobileOptimizations.maxHiddenSizeForMobile),
            numAttentionHeads: Math.min(metadata.n_head || metadata.num_attention_heads || 12, this.mobileOptimizations.maxAttentionHeadsForMobile),
            
            // Attention parameters
            headDim: (metadata.n_embd || metadata.hidden_size || 768) / (metadata.n_head || metadata.num_attention_heads || 12),
            maxPositionEmbeddings: Math.min(metadata.n_positions || metadata.max_position_embeddings || 1024, 1024),
            
            // Vocabulary
            vocabSize: metadata.vocab_size || 50257,
            
            // Architecture specifics
            activationFunction: metadata.activation_function || 'gelu',
            layerNormEps: metadata.layer_norm_epsilon || 1e-5,
            initializer_range: metadata.initializer_range || 0.02,
            
            // Mobile optimizations
            scaleDotProduct: true,
            useCache: true,
            
            // Tensor parallelism configuration
            tensorParallelism: {
                attentionHeadParallel: true,
                mlpParallel: true,
                layerParallel: false,
                sequenceParallel: true
            },
            
            // Mobile constraints
            mobileConstraints: {
                maxMemoryPerDevice: 2 * 1024 * 1024 * 1024,
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8'
            }
        };
    }

    _parseMobileMistralArchitecture(metadata) {
        console.log('🌪️ Parsing Mistral architecture for mobile tensor parallelism...');
        
        return {
            type: 'mistral',
            mobileOptimized: true,
            
            // Core architecture parameters
            numLayers: Math.min(metadata.num_hidden_layers || 12, this.mobileOptimizations.maxLayersForMobile),
            hiddenSize: Math.min(metadata.hidden_size || 768, this.mobileOptimizations.maxHiddenSizeForMobile),
            intermediateSize: Math.min(metadata.intermediate_size || 3072, this.mobileOptimizations.maxHiddenSizeForMobile * 3),
            numAttentionHeads: Math.min(metadata.num_attention_heads || 12, this.mobileOptimizations.maxAttentionHeadsForMobile),
            numKeyValueHeads: Math.min(metadata.num_key_value_heads || 4, 8), // Mistral uses grouped-query attention
            
            // Attention parameters
            headDim: (metadata.hidden_size || 768) / (metadata.num_attention_heads || 12),
            maxPositionEmbeddings: Math.min(metadata.max_position_embeddings || 1024, 1024),
            
            // Sliding window attention (Mistral-specific)
            slidingWindow: Math.min(metadata.sliding_window || 512, 512), // Reduced for mobile
            
            // Vocabulary
            vocabSize: metadata.vocab_size || 32000,
            
            // Normalization
            rmsNormEps: metadata.rms_norm_eps || 1e-6,
            
            // Architecture specifics
            activationFunction: 'silu',
            ropeTheta: metadata.rope_theta || 10000.0,
            
            // Tensor parallelism configuration
            tensorParallelism: {
                attentionHeadParallel: true,
                mlpParallel: true,
                layerParallel: false,
                sequenceParallel: true,
                groupedQueryAttention: true // Mistral-specific
            },
            
            // Mobile constraints
            mobileConstraints: {
                maxMemoryPerDevice: 2 * 1024 * 1024 * 1024,
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8',
                slidingWindowOptimization: true
            }
        };
    }

    _parseMobileBERTArchitecture(metadata) {
        console.log('🔍 Parsing BERT architecture for mobile tensor parallelism...');
        
        return {
            type: 'bert',
            mobileOptimized: true,
            
            // Core architecture parameters
            numLayers: Math.min(metadata.num_hidden_layers || 12, this.mobileOptimizations.maxLayersForMobile),
            hiddenSize: Math.min(metadata.hidden_size || 768, this.mobileOptimizations.maxHiddenSizeForMobile),
            intermediateSize: Math.min(metadata.intermediate_size || 3072, this.mobileOptimizations.maxHiddenSizeForMobile * 3),
            numAttentionHeads: Math.min(metadata.num_attention_heads || 12, this.mobileOptimizations.maxAttentionHeadsForMobile),
            
            // Attention parameters
            headDim: (metadata.hidden_size || 768) / (metadata.num_attention_heads || 12),
            maxPositionEmbeddings: Math.min(metadata.max_position_embeddings || 512, 512),
            
            // Vocabulary
            vocabSize: metadata.vocab_size || 30522,
            
            // BERT-specific parameters
            typeVocabSize: metadata.type_vocab_size || 2,
            layerNormEps: metadata.layer_norm_eps || 1e-12,
            hiddenDropoutProb: metadata.hidden_dropout_prob || 0.1,
            attentionProbsDropoutProb: metadata.attention_probs_dropout_prob || 0.1,
            
            // Architecture specifics
            activationFunction: metadata.hidden_act || 'gelu',
            initializerRange: metadata.initializer_range || 0.02,
            
            // Mobile optimizations (disable dropout for inference)
            hiddenDropoutProb: 0.0,
            attentionProbsDropoutProb: 0.0,
            
            // Tensor parallelism configuration
            tensorParallelism: {
                attentionHeadParallel: true,
                mlpParallel: true,
                layerParallel: false,
                sequenceParallel: false // BERT typically processes shorter sequences
            },
            
            // Mobile constraints
            mobileConstraints: {
                maxMemoryPerDevice: 1.5 * 1024 * 1024 * 1024, // 1.5GB (BERT is smaller)
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8'
            }
        };
    }

    _parseMobileRoBERTaArchitecture(metadata) {
        console.log('🤖 Parsing RoBERTa architecture for mobile tensor parallelism...');
        
        // RoBERTa is similar to BERT but with some differences
        const bertArchitecture = this._parseMobileBERTArchitecture(metadata);
        
        return {
            ...bertArchitecture,
            type: 'roberta',
            
            // RoBERTa-specific differences
            typeVocabSize: 1, // RoBERTa doesn't use token type embeddings
            
            // Vocabulary (RoBERTa typically has different vocab)
            vocabSize: metadata.vocab_size || 50265,
            
            // Mobile constraints (same as BERT)
            mobileConstraints: {
                maxMemoryPerDevice: 1.5 * 1024 * 1024 * 1024,
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8'
            }
        };
    }

    _parseMobileTransformerArchitecture(metadata) {
        console.log('🔧 Parsing generic transformer architecture for mobile tensor parallelism...');
        
        return {
            type: 'mobile-transformer',
            mobileOptimized: true,
            
            // Core architecture parameters (with mobile-friendly defaults)
            numLayers: Math.min(metadata.num_layers || metadata.num_hidden_layers || 6, 6), // Smaller for mobile
            hiddenSize: Math.min(metadata.hidden_size || 512, 512),
            intermediateSize: Math.min(metadata.intermediate_size || 1024, 1024),
            numAttentionHeads: Math.min(metadata.num_attention_heads || 8, 8),
            
            // Attention parameters
            headDim: (metadata.hidden_size || 512) / (metadata.num_attention_heads || 8),
            maxPositionEmbeddings: Math.min(metadata.max_position_embeddings || 512, 512),
            
            // Vocabulary
            vocabSize: metadata.vocab_size || 16384, // Smaller vocab for mobile
            
            // Mobile-optimized parameters
            activationFunction: 'gelu',
            layerNormEps: metadata.layer_norm_eps || 1e-5,
            dropoutRate: 0.0, // Disable dropout for inference
            
            // Tensor parallelism configuration
            tensorParallelism: {
                attentionHeadParallel: true,
                mlpParallel: true,
                layerParallel: false,
                sequenceParallel: true
            },
            
            // Mobile constraints
            mobileConstraints: {
                maxMemoryPerDevice: 1 * 1024 * 1024 * 1024, // 1GB
                minBatteryLevel: 0.3,
                enableQuantization: true,
                preferredPrecision: 'int8'
            }
        };
    }

    _applyMobileOptimizations(architecture) {
        console.log('⚡ Applying mobile-specific optimizations to architecture...');
        
        const optimized = { ...architecture };
        
        // Layer count optimization
        if (optimized.numLayers > this.mobileOptimizations.maxLayersForMobile) {
            console.log(`📉 Reducing layers from ${optimized.numLayers} to ${this.mobileOptimizations.maxLayersForMobile} for mobile`);
            optimized.numLayers = this.mobileOptimizations.maxLayersForMobile;
        }
        
        // Hidden size optimization
        if (optimized.hiddenSize > this.mobileOptimizations.maxHiddenSizeForMobile) {
            console.log(`📉 Reducing hidden size from ${optimized.hiddenSize} to ${this.mobileOptimizations.maxHiddenSizeForMobile} for mobile`);
            optimized.hiddenSize = this.mobileOptimizations.maxHiddenSizeForMobile;
            optimized.headDim = optimized.hiddenSize / optimized.numAttentionHeads;
        }
        
        // Attention heads optimization
        if (optimized.numAttentionHeads > this.mobileOptimizations.maxAttentionHeadsForMobile) {
            console.log(`📉 Reducing attention heads from ${optimized.numAttentionHeads} to ${this.mobileOptimizations.maxAttentionHeadsForMobile} for mobile`);
            optimized.numAttentionHeads = this.mobileOptimizations.maxAttentionHeadsForMobile;
            optimized.headDim = optimized.hiddenSize / optimized.numAttentionHeads;
        }
        
        // Enable mobile-specific features
        optimized.mobileFeatures = {
            quantizationEnabled: this.mobileOptimizations.useQuantization,
            layerFusionEnabled: this.mobileOptimizations.enableLayerFusion,
            dynamicBatching: true,
            adaptiveSequenceLength: true,
            batteryOptimization: true,
            thermalThrottling: true
        };
        
        // Calculate tensor parallelism requirements
        optimized.tensorParallelismRequirements = this._calculateMobileTensorParallelismRequirements(optimized);
        
        console.log('✅ Mobile optimizations applied');
        return optimized;
    }

    _calculateMobileTensorParallelismRequirements(architecture) {
        const requirements = {
            minDevices: 1,
            optimalDevices: 2,
            maxDevices: 4, // Limit for mobile coordination overhead
            
            // Memory requirements per device
            memoryPerDevice: {
                attention: this._calculateMobileAttentionMemory(architecture),
                mlp: this._calculateMobileMLPMemory(architecture),
                embeddings: this._calculateMobileEmbeddingMemory(architecture),
                total: 0
            },
            
            // Parallelism strategy
            parallelismStrategy: {
                attentionHeadParallel: architecture.numAttentionHeads >= 4,
                mlpParallel: architecture.intermediateSize >= 1024,
                sequenceParallel: architecture.maxPositionEmbeddings >= 512,
                layerParallel: false // Not efficient for mobile
            },
            
            // Communication requirements
            communicationOverhead: {
                attentionSync: architecture.numAttentionHeads * architecture.headDim * 4, // bytes
                mlpSync: architecture.intermediateSize * 4, // bytes
                layerSync: architecture.hiddenSize * 4, // bytes
                totalPerLayer: 0
            }
        };
        
        // Calculate totals
        requirements.memoryPerDevice.total = 
            requirements.memoryPerDevice.attention +
            requirements.memoryPerDevice.mlp +
            requirements.memoryPerDevice.embeddings;
            
        requirements.communicationOverhead.totalPerLayer =
            requirements.communicationOverhead.attentionSync +
            requirements.communicationOverhead.mlpSync +
            requirements.communicationOverhead.layerSync;
        
        return requirements;
    }

    _calculateMobileAttentionMemory(architecture) {
        // Calculate memory needed for attention weights and activations
        const headSize = architecture.headDim;
        const numHeads = architecture.numAttentionHeads;
        const hiddenSize = architecture.hiddenSize;
        
        // Query, Key, Value projections + output projection
        const attentionWeights = 4 * hiddenSize * hiddenSize * 4; // 4 bytes per float
        
        // Attention activations (per sequence)
        const maxSeqLen = architecture.maxPositionEmbeddings;
        const attentionActivations = numHeads * maxSeqLen * maxSeqLen * 4;
        
        return attentionWeights + attentionActivations;
    }

    _calculateMobileMLPMemory(architecture) {
        // Calculate memory needed for MLP weights and activations
        const hiddenSize = architecture.hiddenSize;
        const intermediateSize = architecture.intermediateSize;
        
        // Gate, Up, Down projections
        const mlpWeights = (hiddenSize * intermediateSize * 2 + intermediateSize * hiddenSize) * 4;
        
        // MLP activations
        const maxSeqLen = architecture.maxPositionEmbeddings;
        const mlpActivations = maxSeqLen * intermediateSize * 4;
        
        return mlpWeights + mlpActivations;
    }

    _calculateMobileEmbeddingMemory(architecture) {
        // Calculate memory needed for embeddings
        const vocabSize = architecture.vocabSize;
        const hiddenSize = architecture.hiddenSize;
        
        // Token embeddings + position embeddings
        const tokenEmbeddings = vocabSize * hiddenSize * 4;
        const positionEmbeddings = architecture.maxPositionEmbeddings * hiddenSize * 4;
        
        return tokenEmbeddings + positionEmbeddings;
    }

    _logMobileArchitectureDetails(architecture) {
        console.log('📊 Mobile Architecture Details:');
        console.log('==============================');
        console.log(`Type: ${architecture.type}`);
        console.log(`Layers: ${architecture.numLayers}`);
        console.log(`Hidden Size: ${architecture.hiddenSize}`);
        console.log(`Attention Heads: ${architecture.numAttentionHeads}`);
        console.log(`Head Dimension: ${architecture.headDim}`);
        console.log(`Max Sequence Length: ${architecture.maxPositionEmbeddings}`);
        console.log(`Vocab Size: ${architecture.vocabSize}`);
        console.log(`Mobile Optimized: ${architecture.mobileOptimized}`);
        
        if (architecture.tensorParallelismRequirements) {
            const req = architecture.tensorParallelismRequirements;
            console.log(`Optimal Devices: ${req.optimalDevices}`);
            console.log(`Memory per Device: ${(req.memoryPerDevice.total / 1024 / 1024).toFixed(1)} MB`);
        }
    }

    // Public methods for external access
    getSupportedArchitectures() {
        return [...this.supportedArchitectures];
    }

    getParsedModel(modelCid) {
        return this.parsedModels.get(modelCid);
    }

    getAllParsedModels() {
        return Object.fromEntries(this.parsedModels);
    }

    async validateMobileCompatibility(architecture) {
        console.log('✅ Validating mobile compatibility...');
        
        const issues = [];
        const warnings = [];
        
        // Check memory requirements
        if (architecture.tensorParallelismRequirements) {
            const memoryMB = architecture.tensorParallelismRequirements.memoryPerDevice.total / 1024 / 1024;
            if (memoryMB > 2048) {
                issues.push(`Memory requirement too high: ${memoryMB.toFixed(1)} MB > 2048 MB`);
            } else if (memoryMB > 1024) {
                warnings.push(`High memory usage: ${memoryMB.toFixed(1)} MB`);
            }
        }
        
        // Check layer count
        if (architecture.numLayers > 12) {
            issues.push(`Too many layers: ${architecture.numLayers} > 12`);
        }
        
        // Check attention heads
        if (architecture.numAttentionHeads > 16) {
            issues.push(`Too many attention heads: ${architecture.numAttentionHeads} > 16`);
        }
        
        // Check sequence length
        if (architecture.maxPositionEmbeddings > 1024) {
            warnings.push(`Long sequences may impact mobile performance: ${architecture.maxPositionEmbeddings}`);
        }
        
        const compatible = issues.length === 0;
        
        console.log(`✅ Compatibility check: ${compatible ? 'COMPATIBLE' : 'INCOMPATIBLE'}`);
        if (issues.length > 0) {
            console.log('❌ Issues:', issues);
        }
        if (warnings.length > 0) {
            console.log('⚠️ Warnings:', warnings);
        }
        
        return {
            compatible,
            issues,
            warnings
        };
    }

    clearCache() {
        this.parsedModels.clear();
        this.architectureCache.clear();
        console.log('🧹 Architecture parser cache cleared');
    }
}

export default MobileModelArchitectureParser;