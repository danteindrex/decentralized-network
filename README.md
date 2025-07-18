# Decentralized vLLM Inference Network

A blockchain-coordinated, decentralized LLM inference system that enables distributed AI computation across multiple nodes using IPFS for model storage and Ethereum smart contracts for coordination.

## 🌟 Features

- **🔗 Blockchain Coordination**: Ethereum smart contracts manage jobs and payments
- **📦 Decentralized Storage**: IPFS stores models, prompts, and responses
- **⚡ High-Performance Inference**: vLLM + Ray for distributed GPU acceleration
- **🎛️ Owner Model Management**: Upload and manage model catalog
- **🔄 Dynamic Node Participation**: Nodes join/leave based on resource availability
- **💰 Economic Incentives**: Built-in payment and staking mechanisms

## 📁 Project Structure

```
decentralized_vllm_project/
├── contracts/                     # Smart contracts
│   ├── InferenceCoordinator.sol   # Job coordination
│   ├── ModelRegistry.sol          # Model management
│   └── NodeProfileRegistry.sol    # Node registration
├── orchestrator/                  # Python orchestrator
│   ├── main.py                    # Main inference engine
│   ├── owner_upload.py            # Owner model upload tool
│   ├── test_inference.py          # Testing utilities
│   ├── config.yaml                # Configuration
│   └── requirements.txt           # Python dependencies
├── scripts/                       # Deployment & management
│   ├── deploy.js                  # Contract deployment
│   └── owner_tools.js             # Owner CLI tools
├── test/                          # Smart contract tests
├── docker-compose.yml             # Multi-service setup
├── Dockerfile                     # Orchestrator container
├── OWNER_GUIDE.md                 # Owner management guide
└── README.md                      # This file
```

## 🚀 Quick Start

### Prerequisites

- **Node.js** (v16+) and **npm**
- **Python** (3.8+) and **pip**
- **Docker** and **Docker Compose**
- **Git**

### 1. Clone and Install

cd decentralized_vllm_project

# Install Node.js dependencies
npm install

# Install Python dependencies
cd orchestrator
pip install -r requirements.txt
cd ..
```

### 2. Start Infrastructure Services

```bash
# Start IPFS and Geth blockchain
docker-compose up -d ipfs geth

# Wait for services to initialize (30-60 seconds)
docker-compose logs -f geth  # Check when blockchain is ready
```

### 3. Deploy Smart Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# This creates:
# - deployment.json (contract addresses)
# - orchestrator/abis/*.json (contract ABIs)
```

### 4. Configure the System

```bash
# Update configuration with deployed addresses
# Edit orchestrator/config.yaml with values from deployment.json

# Example config update:
cat deployment.json  # Copy addresses from here

# Update orchestrator/config.yaml:
# contract_address: "0x..." (inferenceCoordinator address)
# model_registry_address: "0x..." (modelRegistry address)
# default_account: "0x..." (your account address)
# private_key: "0x..." (your private key)
```

### 5. Upload Your First Model

```bash
cd orchestrator

# Upload a small test model
python owner_upload.py \
  --model "microsoft/DialoGPT-small" \
  --model-id "dialogpt-small" \
  --name "DialoGPT Small" \
  --description "Small conversational model for testing"

# This will:
# 1. Download the model from Hugging Face
# 2. Upload it to IPFS
# 3. Register it in the smart contract
```

### 6. Start the Orchestrator

```bash
# Start the inference orchestrator
python main.py

# Or run in Docker
cd ..
docker-compose up orchestrator
```

### 7. Test the System

```bash
cd orchestrator

# Test individual components
python test_inference.py

# Test smart contracts
cd ..
npx hardhat test
```

## 🔧 Detailed Setup

### Environment Configuration

Create a `.env` file in the project root:

```bash
# Blockchain Configuration
ETH_NODE_URL=http://localhost:8545
PRIVATE_KEY=0x...  # Your private key
DEFAULT_ACCOUNT=0x...  # Your account address

# IPFS Configuration
IPFS_HOST=127.0.0.1
IPFS_PORT=5001

# vLLM Configuration
VLLM_PORT=8000
RAY_PORT=6379
```

### Manual Configuration Steps

1. **Update orchestrator/config.yaml**:
```yaml
# Copy values from deployment.json
eth_node: "http://localhost:8545"
contract_address: "0xYourInferenceCoordinatorAddress"
model_registry_address: "0xYourModelRegistryAddress"
default_account: "0xYourAccountAddress"
private_key: "0xYourPrivateKey"

# Resource limits
min_free_ram: 2147483648  # 2 GB
min_free_vram: 4294967296  # 4 GB
max_cpu: 90

# vLLM settings
gpu_memory_utilization: 0.8
max_model_len: 2048
temperature: 0.7
max_tokens: 512
```

2. **Verify IPFS Connection**:
```bash
# Check IPFS is running
curl http://localhost:5001/api/v0/version

# Test file upload
echo "Hello IPFS" | ipfs add
```

3. **Verify Blockchain Connection**:
```bash
# Check Geth is running
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545
```

## 💼 Owner Operations

### Upload and Manage Models

```bash
cd orchestrator

# Upload from Hugging Face
python owner_upload.py \
  --model "gpt2" \
  --model-id "gpt2-base" \
  --name "GPT-2 Base" \
  --description "OpenAI GPT-2 base model"

# Upload local model
python owner_upload.py \
  --model "./my_local_model" \
  --model-id "custom-model" \
  --name "My Custom Model" \
  --description "Fine-tuned custom model" \
  --skip-download

# Manage models via CLI
cd ..
npx hardhat run scripts/owner_tools.js list
npx hardhat run scripts/owner_tools.js get gpt2-base
npx hardhat run scripts/owner_tools.js update gpt2-base QmNewCID123
```

### Monitor System

```bash
# Check active models
npx hardhat run scripts/owner_tools.js list

# Monitor orchestrator logs
docker-compose logs -f orchestrator

# Check IPFS status
ipfs swarm peers
ipfs repo stat
```

## 👥 User Operations

### Submit Inference Requests

```bash
# Upload prompt to IPFS
echo "What is artificial intelligence?" > prompt.txt
PROMPT_CID=$(ipfs add -q prompt.txt)

# Submit inference request (using Hardhat console)
npx hardhat console --network localhost
> const coordinator = await ethers.getContractAt("InferenceCoordinator", "CONTRACT_ADDRESS")
> await coordinator.submitPrompt("$PROMPT_CID", "dialogpt-small")
```

### Retrieve Results

```bash
# Listen for InferenceCompleted events
# Results are automatically uploaded to IPFS
# Response CID is emitted in the event

# Download response from IPFS
ipfs cat QmResponseCID123
```

## 🧪 Testing

### Run All Tests

```bash
# Smart contract tests
npx hardhat test

# Python component tests
cd orchestrator
python test_inference.py

# Integration tests
python -m pytest tests/ -v  # If you have pytest tests
```

### Manual Testing

```bash
# Test IPFS upload
cd orchestrator
python upload_model.py --model "microsoft/DialoGPT-small"

# Test vLLM inference
python test_inference.py

# Test smart contract interaction
npx hardhat run scripts/owner_tools.js list
```

## 🐳 Docker Deployment

### Full Stack with Docker

```bash
# Start all services
docker-compose up --build

# Scale orchestrator nodes
docker-compose up --scale orchestrator=3

# Production deployment
docker-compose -f docker-compose.prod.yml up -d
```

### Individual Services

```bash
# Start only infrastructure
docker-compose up -d ipfs geth

# Start only orchestrator
docker-compose up orchestrator

# View logs
docker-compose logs -f orchestrator
```

## 🔍 Troubleshooting

### Common Issues

1. **IPFS Connection Failed**
```bash
# Check IPFS daemon
ipfs id
# Restart if needed
docker-compose restart ipfs
```

2. **Blockchain Connection Failed**
```bash
# Check Geth status
docker-compose logs geth
# Verify RPC endpoint
curl http://localhost:8545
```

3. **Model Upload Failed**
```bash
# Check disk space
df -h
# Verify model format
ls -la ./model_directory/
```

4. **vLLM Inference Failed**
```bash
# Check GPU availability
nvidia-smi
# Check memory usage
free -h
```

### Debug Commands

```bash
# Check contract deployment
npx hardhat console --network localhost
> const registry = await ethers.getContractAt("ModelRegistry", "ADDRESS")
> await registry.owner()

# Check IPFS content
ipfs ls QmModelCID123
ipfs cat QmModelCID123/config.json

# Monitor events
npx hardhat run scripts/listen_events.js
```

## 📊 Monitoring and Metrics

### System Health

```bash
# Check all services
docker-compose ps

# Monitor resource usage
docker stats

# Check blockchain sync
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}' \
  http://localhost:8545
```

### Performance Metrics

```bash
# IPFS metrics
ipfs stats repo
ipfs stats bitswap

# vLLM metrics (if running)
curl http://localhost:8000/metrics

# Blockchain metrics
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_gasPrice","params":[],"id":1}' \
  http://localhost:8545
```

## 🔒 Security Considerations

### Private Key Management

- Never commit private keys to version control
- Use environment variables or secure key management
- Consider using hardware wallets for production

### Network Security

- Use firewalls to restrict access to RPC endpoints
- Enable HTTPS for production deployments
- Regularly update dependencies

### Model Security

- Validate models before uploading
- Monitor for malicious content
- Implement access controls for sensitive models

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🆘 Support

- **Documentation**: See `OWNER_GUIDE.md` for detailed owner operations
- **Issues**: Report bugs and feature requests on GitHub
- **Community**: Join our Discord/Telegram for discussions

## 🗺️ Roadmap

- [ ] Multi-chain support (Polygon, BSC)
- [ ] Advanced model sharding
- [ ] Reputation system for nodes
- [ ] Web UI for model management
- [ ] Integration with more LLM frameworks
- [ ] Automated model optimization