# Blockchain-Based IPFS Model Storage

A comprehensive system for storing, managing, and retrieving AI models using IPFS chunking with blockchain verification and integrity checking.

## 🌟 Features

- **Chunked Storage**: Large models are split into manageable chunks for efficient distribution
- **Blockchain Registry**: Model metadata and chunk information stored on-chain for verification
- **IPFS Integration**: Decentralized storage using IPFS for actual model data
- **Integrity Verification**: SHA-256 hash verification for each chunk
- **Automatic Fallback**: Falls back to regular IPFS if blockchain storage is unavailable
- **CLI Interface**: Easy-to-use command-line tools for model management
- **Python Integration**: Seamless integration with Python-based AI inference systems

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌───────���─────────┐
│   AI Model      │    │  Chunked Data   │    │  IPFS Network   │
│   (Large File)  │───▶│  + Manifest     │───▶│  (Distributed)  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │   Blockchain    │
                       │   Registry      │
                       │ (Verification)  │
                       └─────────────────┘
```

## 📦 Components

### 1. Smart Contract (`ChunkedModelRegistry.sol`)
- Stores model metadata and chunk information on-chain
- Provides verification and integrity checking
- Manages model lifecycle (register, update, deactivate)

### 2. Model Storage Manager (`ModelStorageManager.js`)
- Handles chunking, uploading, and retrieval of models
- Integrates with IPFS and blockchain
- Provides integrity verification

### 3. CLI Tool (`cli.js`)
- Command-line interface for model operations
- Supports store, retrieve, list, verify, and info commands

### 4. Python Integration (`model_storage_integration.py`)
- Python wrapper for the Node.js storage system
- Seamless integration with AI inference pipelines

## 🚀 Quick Start

### Prerequisites

1. **IPFS Daemon**: Running on localhost:5001
```bash
ipfs daemon
```

2. **Ethereum Node**: Running on localhost:8545 (or configure custom endpoint)

3. **Node.js Dependencies**:
```bash
cd /home/lambda/contracts/ipfs/model-storage
npm install
```

4. **Smart Contract**: Deploy `ChunkedModelRegistry.sol` and note the address

### Configuration

1. Copy the configuration template:
```bash
cp config.template.json config.json
```

2. Edit `config.json` with your settings:
```json
{
  "ipfs": {
    "host": "localhost",
    "port": 5001,
    "protocol": "http"
  },
  "blockchain": {
    "rpcUrl": "http://localhost:8545",
    "privateKey": "YOUR_PRIVATE_KEY",
    "contractAddress": "YOUR_CONTRACT_ADDRESS"
  }
}
```

3. Or use environment variables:
```bash
export PRIVATE_KEY="your_private_key"
export CONTRACT_ADDRESS="your_contract_address"
export ETH_NODE_URL="http://localhost:8545"
```

## 📋 Usage

### CLI Commands

#### Store a Model
```bash
node cli.js store /path/to/model my-model-v1 \
  --name "My AI Model v1" \
  --description "A fine-tuned language model"
```

#### List All Models
```bash
node cli.js list
```

#### Retrieve a Model
```bash
node cli.js retrieve my-model-v1 ./downloaded-model.tar.gz --extract
```

#### Verify Model Integrity
```bash
node cli.js verify my-model-v1
```

#### Get Model Information
```bash
node cli.js info my-model-v1 --chunks
```

### Python Integration

```python
from model_storage_integration import setup_model_storage

# Setup
config = {
    'ipfs_host': 'localhost',
    'ipfs_port': 5001,
    'eth_node': 'http://localhost:8545',
    'private_key': 'your_private_key',
    'chunked_model_registry_address': 'contract_address'
}

storage = setup_model_storage(config)

# Store a model
result = storage.store_model(
    '/path/to/model',
    'my-model-v1',
    name='My Model',
    description='A test model'
)

# List models
models = storage.list_models()

# Retrieve a model
storage.retrieve_model('my-model-v1', './output-model.tar.gz')
```

### JavaScript API

```javascript
const { ModelStorageManager } = require('./ModelStorageManager');

const storage = new ModelStorageManager(ipfsConfig, blockchainConfig);

// Store a model
const result = await storage.storeModel(
  '/path/to/model',
  'my-model-v1',
  'My Model',
  'A test model'
);

// Retrieve a model
await storage.retrieveModel('my-model-v1', './output.tar.gz');
```

## 🔧 Integration with AI Inference

The system integrates seamlessly with the AI inference orchestrator:

1. **Model Storage**: Models are chunked and stored with blockchain verification
2. **Job Processing**: When inference jobs arrive, models are retrieved using the integrated system
3. **Automatic Fallback**: If blockchain storage fails, falls back to regular IPFS
4. **Integrity Checking**: All chunks are verified before model loading

### Orchestrator Integration

The Python orchestrator automatically uses blockchain storage when available:

```python
# In handle_job_async function
await fetch_model_from_blockchain_storage(model_cid, './model')
```

This function:
- Checks if the model exists in the blockchain registry
- Downloads and verifies all chunks
- Reassembles the model with integrity checking
- Falls back to regular IPFS if needed

## 📊 Benefits

### For Model Providers
- **Integrity Assurance**: Cryptographic verification of model authenticity
- **Efficient Distribution**: Chunked storage reduces bandwidth requirements
- **Decentralized Storage**: No single point of failure
- **Version Management**: Track model versions and updates

### For Inference Nodes
- **Reliable Downloads**: Automatic retry and verification
- **Partial Downloads**: Only download missing chunks
- **Integrity Verification**: Ensure model hasn't been corrupted
- **Automatic Fallback**: Graceful degradation if services are unavailable

### For the Network
- **Reduced Bandwidth**: Deduplication of identical chunks
- **Improved Reliability**: Distributed storage across IPFS network
- **Transparency**: On-chain verification of model integrity
- **Scalability**: Efficient handling of large models

## 🔍 Verification Process

1. **Upload Verification**:
   - Each chunk is hashed with SHA-256
   - Chunk metadata stored on blockchain
   - Manifest uploaded to IPFS

2. **Download Verification**:
   - Chunks downloaded from IPFS
   - SHA-256 hash verified against blockchain
   - Model reassembled only if all chunks are valid

3. **Integrity Checking**:
   - Periodic verification of stored models
   - Detection of corrupted or missing chunks
   - Automatic re-upload of invalid chunks

## 🛠️ Troubleshooting

### Common Issues

1. **IPFS Connection Failed**:
   ```bash
   # Start IPFS daemon
   ipfs daemon
   ```

2. **Blockchain Connection Failed**:
   - Check Ethereum node is running
   - Verify RPC URL in configuration
   - Ensure private key has sufficient gas

3. **Model Not Found**:
   - Verify model ID is correct
   - Check if model is active in registry
   - Ensure contract address is correct

4. **Chunk Verification Failed**:
   - Check IPFS connectivity
   - Verify chunk CIDs are accessible
   - Re-upload model if corruption detected

### Debug Mode

Enable verbose logging:
```bash
export DEBUG=1
node cli.js store /path/to/model test-model
```

## 📈 Performance Considerations

- **Chunk Size**: Default 1MB chunks balance efficiency and overhead
- **Parallel Downloads**: Multiple chunks downloaded simultaneously
- **Caching**: Local caching of frequently accessed models
- **Network Optimization**: Automatic selection of fastest IPFS nodes

## 🔮 Future Enhancements

- **Model Compression**: Automatic compression before chunking
- **Delta Updates**: Only upload changed chunks for model updates
- **Access Control**: Permission-based model access
- **Analytics**: Usage tracking and performance metrics
- **Multi-Chain Support**: Support for multiple blockchain networks

## 📄 License

MIT License - see LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📞 Support

For issues and questions:
- Create an issue in the repository
- Check the troubleshooting section
- Review the example code

---

**Note**: This system is designed for production use but ensure proper testing in your environment before deploying to mainnet.