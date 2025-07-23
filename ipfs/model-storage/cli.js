#!/usr/bin/env node

const { ModelStorageManager } = require('./ModelStorageManager');
const fs = require('fs');
const path = require('path');
const { program } = require('commander');

// Load configuration from environment or config file
function loadConfig() {
  const configPath = process.env.CONFIG_PATH || './config.json';
  let config = {
    ipfs: {
      host: 'localhost',
      port: 5001,
      protocol: 'http'
    },
    blockchain: {
      rpcUrl: process.env.ETH_NODE_URL || 'http://localhost:8545',
      privateKey: process.env.PRIVATE_KEY,
      contractAddress: process.env.CONTRACT_ADDRESS
    }
  };

  // Try to load from config file
  if (fs.existsSync(configPath)) {
    try {
      const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      config = { ...config, ...fileConfig };
    } catch (error) {
      console.warn(`Warning: Could not load config from ${configPath}: ${error.message}`);
    }
  }

  return config;
}

// Initialize storage manager
async function initStorage() {
  const config = loadConfig();
  return new ModelStorageManager(config.ipfs, config.blockchain);
}

// Command: Store a model
async function storeModel(modelPath, modelId, options) {
  try {
    const storage = await initStorage();
    
    console.log(`📦 Storing model: ${modelId}`);
    console.log(`📁 Source: ${modelPath}`);
    
    const result = await storage.storeModel(
      modelPath,
      modelId,
      options.name || modelId,
      options.description || 'Model stored via CLI'
    );

    console.log('\n✅ Model stored successfully!');
    console.log(`🆔 Model ID: ${result.modelId}`);
    console.log(`📋 Manifest CID: ${result.manifestCID}`);
    console.log(`📦 Chunks: ${result.chunkCount}`);
    console.log(`📏 Size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    
    if (result.transactionHash) {
      console.log(`⛓️ Transaction: ${result.transactionHash}`);
    }

    // Save result to file if requested
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
      console.log(`💾 Result saved to: ${options.output}`);
    }

  } catch (error) {
    console.error(`❌ Error storing model: ${error.message}`);
    process.exit(1);
  }
}

// Command: Retrieve a model
async function retrieveModel(modelId, outputPath, options) {
  try {
    const storage = await initStorage();
    
    console.log(`📥 Retrieving model: ${modelId}`);
    console.log(`📁 Output: ${outputPath}`);
    
    const result = await storage.retrieveModel(modelId, outputPath);

    console.log('\n✅ Model retrieved successfully!');
    console.log(`🆔 Model ID: ${result.modelId}`);
    console.log(`📁 Output: ${result.outputPath}`);
    console.log(`📏 Size: ${(result.totalSize / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📦 Chunks: ${result.chunkCount}`);

    // Extract if it's an archive and extract flag is set
    if (options.extract && path.extname(outputPath) === '.gz') {
      const extractDir = path.join(path.dirname(outputPath), path.basename(outputPath, '.tar.gz'));
      console.log(`📂 Extracting to: ${extractDir}`);
      
      const tar = require('tar');
      await tar.extract({
        file: outputPath,
        cwd: path.dirname(outputPath)
      });
      
      console.log(`✅ Extracted to: ${extractDir}`);
    }

  } catch (error) {
    console.error(`❌ Error retrieving model: ${error.message}`);
    process.exit(1);
  }
}

// Command: List models
async function listModels(options) {
  try {
    const storage = await initStorage();
    
    console.log('📋 Fetching model list...');
    const models = await storage.listModels();

    if (models.length === 0) {
      console.log('No models found.');
      return;
    }

    console.log(`\n📚 Found ${models.length} models:\n`);

    models.forEach((model, index) => {
      console.log(`${index + 1}. 📦 ${model.name}`);
      console.log(`   🆔 ID: ${model.modelId}`);
      console.log(`   📋 Manifest: ${model.manifestCID}`);
      console.log(`   📏 Size: ${(parseInt(model.totalSize) / 1024 / 1024).toFixed(2)} MB`);
      console.log(`   📦 Chunks: ${model.chunkCount}`);
      console.log(`   📅 Uploaded: ${new Date(model.timestamp).toLocaleString()}`);
      if (model.description) {
        console.log(`   📝 Description: ${model.description}`);
      }
      console.log('');
    });

    // Save to file if requested
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(models, null, 2));
      console.log(`💾 Model list saved to: ${options.output}`);
    }

  } catch (error) {
    console.error(`❌ Error listing models: ${error.message}`);
    process.exit(1);
  }
}

// Command: Verify model integrity
async function verifyModel(modelId, options) {
  try {
    const storage = await initStorage();
    
    console.log(`🔍 Verifying model: ${modelId}`);
    const result = await storage.verifyModel(modelId);

    console.log('\n📊 Verification Results:');
    console.log(`🆔 Model ID: ${result.modelId}`);
    console.log(`✅ Overall Status: ${result.isValid ? 'VALID' : 'INVALID'}`);
    console.log(`📦 Total Chunks: ${result.totalChunks}`);
    console.log(`✅ Valid Chunks: ${result.validChunks}`);
    console.log(`❌ Invalid Chunks: ${result.totalChunks - result.validChunks}`);

    if (!result.isValid) {
      console.log('\n❌ Failed chunks:');
      result.chunkResults
        .filter(r => !r.isValid)
        .forEach(r => {
          console.log(`   Chunk ${r.chunkIndex}: ${r.error || 'Hash mismatch'}`);
          if (r.expectedHash && r.actualHash) {
            console.log(`     Expected: ${r.expectedHash}`);
            console.log(`     Actual: ${r.actualHash}`);
          }
        });
    }

    // Save detailed results if requested
    if (options.output) {
      fs.writeFileSync(options.output, JSON.stringify(result, null, 2));
      console.log(`💾 Detailed results saved to: ${options.output}`);
    }

  } catch (error) {
    console.error(`❌ Error verifying model: ${error.message}`);
    process.exit(1);
  }
}

// Command: Show model info
async function showModelInfo(modelId, options) {
  try {
    const storage = await initStorage();
    
    if (!storage.contract) {
      throw new Error('Blockchain connection required to show model info');
    }

    console.log(`📋 Fetching info for model: ${modelId}`);
    const modelInfo = await storage.contract.getModel(modelId);
    
    console.log('\n📊 Model Information:');
    console.log(`🆔 Model ID: ${modelId}`);
    console.log(`📦 Name: ${modelInfo.name}`);
    console.log(`📝 Description: ${modelInfo.description}`);
    console.log(`📋 Manifest CID: ${modelInfo.manifestCID}`);
    console.log(`📏 Total Size: ${(parseInt(modelInfo.totalSize) / 1024 / 1024).toFixed(2)} MB`);
    console.log(`📦 Chunk Count: ${modelInfo.chunkCount.toString()}`);
    console.log(`📅 Timestamp: ${new Date(Number(modelInfo.timestamp) * 1000).toLocaleString()}`);
    console.log(`✅ Active: ${modelInfo.isActive ? 'Yes' : 'No'}`);

    // Get chunk details if requested
    if (options.chunks) {
      console.log('\n📦 Chunk Details:');
      const chunkInfo = await storage.contract.getAllModelChunks(modelId);
      const { cids, hashes, sizes } = chunkInfo;

      for (let i = 0; i < cids.length; i++) {
        console.log(`\n   Chunk ${i}:`);
        console.log(`     CID: ${cids[i]}`);
        console.log(`     Hash: ${hashes[i]}`);
        console.log(`     Size: ${sizes[i].toString()} bytes`);
      }
    }

    // Save info to file if requested
    if (options.output) {
      const info = {
        modelId,
        ...modelInfo,
        totalSize: modelInfo.totalSize.toString(),
        chunkCount: modelInfo.chunkCount.toString(),
        timestamp: Number(modelInfo.timestamp) * 1000
      };
      
      if (options.chunks) {
        const chunkInfo = await storage.contract.getAllModelChunks(modelId);
        info.chunks = chunkInfo;
      }
      
      fs.writeFileSync(options.output, JSON.stringify(info, null, 2));
      console.log(`💾 Model info saved to: ${options.output}`);
    }

  } catch (error) {
    console.error(`❌ Error getting model info: ${error.message}`);
    process.exit(1);
  }
}

// Setup CLI commands
program
  .name('model-storage')
  .description('Blockchain-based IPFS model storage CLI')
  .version('1.0.0');

program
  .command('store')
  .description('Store a model file or directory')
  .argument('<model-path>', 'Path to model file or directory')
  .argument('<model-id>', 'Unique identifier for the model')
  .option('-n, --name <name>', 'Human-readable model name')
  .option('-d, --description <desc>', 'Model description')
  .option('-o, --output <file>', 'Save result to JSON file')
  .action(storeModel);

program
  .command('retrieve')
  .description('Retrieve a model from storage')
  .argument('<model-id>', 'Model identifier')
  .argument('<output-path>', 'Where to save the retrieved model')
  .option('-x, --extract', 'Extract archive after download')
  .action(retrieveModel);

program
  .command('list')
  .description('List all stored models')
  .option('-o, --output <file>', 'Save list to JSON file')
  .action(listModels);

program
  .command('verify')
  .description('Verify model integrity')
  .argument('<model-id>', 'Model identifier')
  .option('-o, --output <file>', 'Save verification results to JSON file')
  .action(verifyModel);

program
  .command('info')
  .description('Show detailed model information')
  .argument('<model-id>', 'Model identifier')
  .option('-c, --chunks', 'Include chunk details')
  .option('-o, --output <file>', 'Save info to JSON file')
  .action(showModelInfo);

program
  .command('config')
  .description('Show current configuration')
  .action(() => {
    const config = loadConfig();
    console.log('📋 Current Configuration:');
    console.log(JSON.stringify(config, null, 2));
  });

// Parse command line arguments
program.parse();

module.exports = {
  storeModel,
  retrieveModel,
  listModels,
  verifyModel,
  showModelInfo,
  loadConfig
};