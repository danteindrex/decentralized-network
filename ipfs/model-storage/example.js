const { ModelStorageManager } = require('./ModelStorageManager');
const fs = require('fs');
const path = require('path');

// Configuration
const config = {
  ipfs: {
    host: 'localhost',
    port: 5001,
    protocol: 'http'
  },
  blockchain: {
    rpcUrl: 'http://localhost:8545',
    privateKey: process.env.PRIVATE_KEY, // Set your private key in environment
    contractAddress: process.env.CONTRACT_ADDRESS // Set your contract address
  }
};

async function demonstrateModelStorage() {
  console.log('🚀 Blockchain Model Storage Demo\n');

  try {
    // Initialize the storage manager
    const storage = new ModelStorageManager(config.ipfs, config.blockchain);

    // Create a sample model file for demonstration
    const sampleModelPath = './sample_model.txt';
    const sampleModelContent = `
# Sample AI Model
This is a sample model file for demonstration purposes.
Model Type: Text Classification
Version: 1.0
Parameters: 1.2B
Training Data: Custom dataset
Accuracy: 95.2%

# Model Architecture
- Transformer-based
- 12 layers
- 768 hidden dimensions
- 12 attention heads

# Usage Instructions
1. Load the model using your preferred framework
2. Preprocess input text
3. Run inference
4. Post-process results

# Model Weights (simulated)
${Array(1000).fill('0.123456789').join('\n')}
`;

    // Create sample model file
    fs.writeFileSync(sampleModelPath, sampleModelContent);
    console.log(`📝 Created sample model file: ${sampleModelPath}`);

    // Example 1: Store a model
    console.log('\n📦 Example 1: Storing a model');
    console.log('================================');
    
    const storeResult = await storage.storeModel(
      sampleModelPath,
      'sample-text-classifier-v1',
      'Sample Text Classifier',
      'A demonstration text classification model with 1.2B parameters'
    );

    console.log('\n✅ Storage Result:');
    console.log(`Model ID: ${storeResult.modelId}`);
    console.log(`Manifest CID: ${storeResult.manifestCID}`);
    console.log(`Chunks: ${storeResult.chunkCount}`);
    console.log(`Total Size: ${(storeResult.totalSize / 1024).toFixed(2)} KB`);
    if (storeResult.transactionHash) {
      console.log(`Transaction: ${storeResult.transactionHash}`);
    }

    // Example 2: List all models
    if (storage.contract) {
      console.log('\n📋 Example 2: Listing all models');
      console.log('=================================');
      
      const models = await storage.listModels();
      console.log(`Found ${models.length} models:`);
      
      models.forEach((model, index) => {
        console.log(`\n${index + 1}. ${model.name}`);
        console.log(`   ID: ${model.modelId}`);
        console.log(`   Size: ${(parseInt(model.totalSize) / 1024).toFixed(2)} KB`);
        console.log(`   Chunks: ${model.chunkCount}`);
        console.log(`   Uploaded: ${model.timestamp}`);
      });
    }

    // Example 3: Retrieve a model
    console.log('\n📥 Example 3: Retrieving a model');
    console.log('=================================');
    
    const outputPath = './retrieved_model.txt';
    const retrieveResult = await storage.retrieveModel(
      'sample-text-classifier-v1',
      outputPath
    );

    console.log('\n✅ Retrieval Result:');
    console.log(`Model ID: ${retrieveResult.modelId}`);
    console.log(`Output Path: ${retrieveResult.outputPath}`);
    console.log(`Total Size: ${(retrieveResult.totalSize / 1024).toFixed(2)} KB`);
    console.log(`Chunks: ${retrieveResult.chunkCount}`);

    // Verify the retrieved file matches the original
    const originalContent = fs.readFileSync(sampleModelPath, 'utf8');
    const retrievedContent = fs.readFileSync(outputPath, 'utf8');
    const isIdentical = originalContent === retrievedContent;
    
    console.log(`File integrity: ${isIdentical ? '✅ PASSED' : '❌ FAILED'}`);

    // Example 4: Verify model integrity
    if (storage.contract) {
      console.log('\n🔍 Example 4: Verifying model integrity');
      console.log('======================================');
      
      const verifyResult = await storage.verifyModel('sample-text-classifier-v1');
      
      console.log('\n✅ Verification Result:');
      console.log(`Model ID: ${verifyResult.modelId}`);
      console.log(`Overall Valid: ${verifyResult.isValid ? '✅ YES' : '❌ NO'}`);
      console.log(`Valid Chunks: ${verifyResult.validChunks}/${verifyResult.totalChunks}`);
      
      if (!verifyResult.isValid) {
        console.log('\n❌ Failed chunks:');
        verifyResult.chunkResults
          .filter(r => !r.isValid)
          .forEach(r => {
            console.log(`   Chunk ${r.chunkIndex}: ${r.error || 'Hash mismatch'}`);
          });
      }
    }

    // Cleanup
    console.log('\n🧹 Cleaning up demo files...');
    if (fs.existsSync(sampleModelPath)) fs.unlinkSync(sampleModelPath);
    if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);

    console.log('\n🎉 Demo completed successfully!');

  } catch (error) {
    console.error(`\n❌ Demo failed: ${error.message}`);
    
    if (error.message.includes('connection')) {
      console.log('\n💡 Troubleshooting tips:');
      console.log('1. Make sure IPFS daemon is running: ipfs daemon');
      console.log('2. Check if Ethereum node is accessible');
      console.log('3. Verify contract address and private key are set');
    }
  }
}

// Run the demonstration
if (require.main === module) {
  demonstrateModelStorage().catch(console.error);
}

module.exports = { demonstrateModelStorage };