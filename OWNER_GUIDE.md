# Owner Guide: Managing Models in the Decentralized vLLM Network

This guide explains how the network owner can upload and manage models for the decentralized inference system.

## Overview

As the owner of the decentralized vLLM network, you have exclusive rights to:
- Upload models to IPFS
- Register models in the smart contract registry
- Update model versions
- Deactivate models
- Manage the model catalog

## Quick Start

### 1. Deploy Contracts

```bash
# Deploy all contracts
npx hardhat run scripts/deploy.js --network localhost

# This creates:
# - deployment.json (contract addresses)
# - orchestrator/abis/*.json (contract ABIs)
```

### 2. Upload and Register a Model

```bash
cd orchestrator

# Upload a Hugging Face model
python owner_upload.py \
  --model "microsoft/DialoGPT-small" \
  --model-id "dialogpt-small" \
  --name "DialoGPT Small" \
  --description "Microsoft DialoGPT small conversational model"

# Upload a local model directory
python owner_upload.py \
  --model "./my_local_model" \
  --model-id "my-custom-model" \
  --name "My Custom Model" \
  --description "Custom fine-tuned model" \
  --skip-download
```

### 3. Manage Models via CLI

```bash
# List all active models
npx hardhat run scripts/owner_tools.js list

# Get details of a specific model
npx hardhat run scripts/owner_tools.js get dialogpt-small

# Update a model's IPFS CID
npx hardhat run scripts/owner_tools.js update dialogpt-small QmNewModelHash456

# Deactivate a model
npx hardhat run scripts/owner_tools.js deactivate dialogpt-small
```

## Detailed Workflows

### Model Upload Process

1. **Download/Prepare Model**
   - Downloads from Hugging Face Hub
   - Validates model format (config.json, weights, tokenizer)
   - Saves to temporary directory

2. **Upload to IPFS**
   - Uploads entire model directory recursively
   - Pins content to local IPFS node
   - Returns model CID

3. **Register on Blockchain**
   - Calls `ModelRegistry.registerModel()`
   - Associates model ID with IPFS CID
   - Emits `ModelRegistered` event

### Model Management

#### Register New Model
```javascript
// Via owner tools
npx hardhat run scripts/owner_tools.js register \
  "gpt-2-small" \
  "QmModelCIDHash123" \
  "GPT-2 Small" \
  "OpenAI GPT-2 small model"
```

#### Update Existing Model
```javascript
// Update model CID (new version)
npx hardhat run scripts/owner_tools.js update \
  "gpt-2-small" \
  "QmNewModelCIDHash456"
```

#### List Models
```javascript
// List all active models
npx hardhat run scripts/owner_tools.js list
```

## Configuration

### Update Config File

After deployment, update `orchestrator/config.yaml`:

```yaml
# Contract addresses (from deployment.json)
contract_address: "0xYourInferenceCoordinatorAddress"
model_registry_address: "0xYourModelRegistryAddress"

# Owner credentials
default_account: "0xYourOwnerAddress"
private_key: "0xYourPrivateKey"
```

### IPFS Configuration

Ensure IPFS is running:
```bash
# Start IPFS daemon
ipfs daemon

# Check connection
ipfs swarm peers
```

## Smart Contract Interface

### ModelRegistry Contract

```solidity
// Register a new model
function registerModel(
    string calldata modelId,
    string calldata modelCID,
    string calldata name,
    string calldata description
) external onlyOwner

// Update model CID
function updateModel(
    string calldata modelId,
    string calldata newModelCID
) external onlyOwner

// Deactivate model
function deactivateModel(string calldata modelId) external onlyOwner

// Get model info
function getModel(string calldata modelId) external view returns (ModelInfo memory)

// List active models
function getActiveModels() external view returns (string[] memory)
```

### Events

```solidity
event ModelRegistered(string indexed modelId, string modelCID, string name, address indexed owner);
event ModelUpdated(string indexed modelId, string newModelCID, address indexed owner);
event ModelDeactivated(string indexed modelId, address indexed owner);
```

## User Interaction

Once models are registered, users can request inference using model IDs:

```javascript
// Users submit prompts with model ID (not CID)
await inferenceCoordinator.submitPrompt(promptCID, "dialogpt-small");

// The contract automatically resolves model ID to current CID
```

## Security Considerations

### Owner Responsibilities

1. **Model Validation**: Ensure uploaded models are safe and functional
2. **Version Control**: Keep track of model versions and updates
3. **Access Control**: Protect private keys and owner account
4. **IPFS Pinning**: Ensure models remain available on IPFS

### Best Practices

1. **Test Models**: Validate models work before registering
2. **Backup CIDs**: Keep records of all model CIDs
3. **Gradual Rollout**: Test new models with limited users first
4. **Monitor Usage**: Track which models are being used

## Troubleshooting

### Common Issues

1. **IPFS Connection Failed**
   ```bash
   # Check IPFS status
   ipfs id
   
   # Restart IPFS
   ipfs daemon
   ```

2. **Blockchain Connection Failed**
   ```bash
   # Check if local node is running
   curl -X POST -H "Content-Type: application/json" \
     --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
     http://localhost:8545
   ```

3. **Model Upload Failed**
   - Check model format (config.json, weights files)
   - Verify IPFS has enough storage space
   - Ensure model directory is accessible

4. **Transaction Failed**
   - Check gas limits and prices
   - Verify account has sufficient ETH
   - Ensure you're using the owner account

### Debug Commands

```bash
# Check contract owner
npx hardhat console --network localhost
> const registry = await ethers.getContractAt("ModelRegistry", "CONTRACT_ADDRESS")
> await registry.owner()

# Check model status
> await registry.getModel("model-id")

# Check IPFS content
ipfs cat QmModelCIDHash123/config.json
```

## Advanced Usage

### Batch Model Upload

```python
# Upload multiple models
models = [
    ("gpt2-small", "gpt2", "GPT-2 Small", "Small GPT-2 model"),
    ("gpt2-medium", "gpt2-medium", "GPT-2 Medium", "Medium GPT-2 model"),
]

for model_id, hf_name, name, desc in models:
    subprocess.run([
        "python", "owner_upload.py",
        "--model", hf_name,
        "--model-id", model_id,
        "--name", name,
        "--description", desc
    ])
```

### Model Versioning

```bash
# Register v1
python owner_upload.py --model "my-model-v1" --model-id "my-model" --name "My Model v1"

# Update to v2 (same model ID, new CID)
python owner_upload.py --model "my-model-v2" --model-id "my-model" --name "My Model v2" --skip-blockchain
npx hardhat run scripts/owner_tools.js update my-model QmNewCIDv2
```

This system gives you complete control over the model catalog while maintaining decentralization through IPFS storage and blockchain coordination.