# 📚 API Reference - Decentralized vLLM Inference Network

Complete API documentation for smart contracts, REST endpoints, and client libraries.

## 📋 Table of Contents

1. [Smart Contract APIs](#smart-contract-apis)
2. [REST API Endpoints](#rest-api-endpoints)
3. [WebSocket API](#websocket-api)
4. [Python Client Library](#python-client-library)
5. [JavaScript SDK](#javascript-sdk)
6. [Mobile API](#mobile-api)

---

## 🔗 Smart Contract APIs

### InferenceCoordinator Contract

**Address:** Retrieved from `deployment.json` after deployment

#### Functions

##### `submitPrompt(string promptCID, string modelId) → uint256`
Submit an inference request using a registered model ID.

**Parameters:**
- `promptCID`: IPFS hash of the prompt text
- `modelId`: Registered model identifier

**Returns:** Job ID for tracking

**Example:**
```solidity
uint256 jobId = coordinator.submitPrompt("QmPromptHash123", "gpt-3.5-turbo");
```

##### `submitPromptWithCID(string promptCID, string modelCID) → uint256`
Submit an inference request with direct model CID (backward compatibility).

**Parameters:**
- `promptCID`: IPFS hash of the prompt text
- `modelCID`: IPFS hash of the model

**Returns:** Job ID for tracking

##### `submitResponse(uint256 jobId, string responseCID)`
Submit inference response (called by worker nodes).

**Parameters:**
- `jobId`: Job identifier
- `responseCID`: IPFS hash of the response

#### Events

##### `InferenceRequested`
```solidity
event InferenceRequested(
    uint256 indexed jobId,
    address indexed controller,
    string promptCID,
    string modelId,
    string modelCID
);
```

##### `InferenceCompleted`
```solidity
event InferenceCompleted(
    uint256 indexed jobId,
    address indexed worker,
    string responseCID
);
```

### ModelRegistry Contract

#### Functions

##### `registerModel(string modelId, string modelCID, string name, string description)`
Register a new AI model (owner only).

##### `updateModel(string modelId, string newModelCID)`
Update model CID (owner only).

##### `getModel(string modelId) → ModelInfo`
Get model information.

**Returns:**
```solidity
struct ModelInfo {
    string modelCID;
    string name;
    string description;
    uint256 timestamp;
    bool isActive;
}
```

##### `getAllModels() → string[]`
Get all registered model IDs.

##### `getActiveModels() → string[]`
Get only active model IDs.

### NodeProfileRegistry Contract

#### Functions

##### `registerNode(uint256 maxRAM, uint256 maxVRAM, uint256 maxCPUPercent)`
Register node resource capabilities.

##### `deregisterNode()`
Remove node from registry.

---

## 🌐 REST API Endpoints

### Base URL
- **Development:** `http://localhost:8001`
- **Production:** `https://api.your-domain.com`

### Authentication
Most endpoints require API key authentication:
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     -H "Content-Type: application/json" \
     https://api.your-domain.com/endpoint
```

### Node Management

#### `GET /api/status`
Get node status and health information.

**Response:**
```json
{
  "status": "healthy",
  "uptime": 3600,
  "version": "1.0.0",
  "network": {
    "peers": 5,
    "blockNumber": 12345
  },
  "resources": {
    "cpu": 45.2,
    "memory": 67.8,
    "gpu": 23.1
  }
}
```

#### `GET /api/peers`
List connected peers.

**Response:**
```json
{
  "peers": [
    {
      "id": "peer1",
      "address": "192.168.1.100:30303",
      "connected": true,
      "lastSeen": "2024-01-01T12:00:00Z"
    }
  ]
}
```

#### `GET /api/resources`
Get current resource allocation and usage.

**Response:**
```json
{
  "allocation": {
    "cpu": 10,
    "memory": 15,
    "gpu": 10,
    "storage": 5
  },
  "usage": {
    "cpu": 8.5,
    "memory": 12.3,
    "gpu": 7.2,
    "storage": 3.1
  },
  "limits": {
    "cpu": 90,
    "memory": 80,
    "gpu": 90,
    "storage": 70
  }
}
```

#### `POST /api/resources`
Update resource allocation.

**Request:**
```json
{
  "cpu": 15,
  "memory": 20,
  "gpu": 15,
  "storage": 8
}
```

### Task Management

#### `POST /api/tasks/submit`
Submit new AI inference task.

**Request:**
```json
{
  "prompt": "What is artificial intelligence?",
  "modelId": "gpt-3.5-turbo",
  "maxTokens": 100,
  "temperature": 0.7
}
```

**Response:**
```json
{
  "taskId": "task_123",
  "jobId": 456,
  "status": "submitted",
  "estimatedTime": 30,
  "promptCID": "QmPromptHash123"
}
```

#### `GET /api/tasks/{taskId}`
Get task details and status.

**Response:**
```json
{
  "taskId": "task_123",
  "jobId": 456,
  "status": "completed",
  "prompt": "What is artificial intelligence?",
  "response": "Artificial intelligence (AI) refers to...",
  "timing": {
    "submitted": "2024-01-01T12:00:00Z",
    "started": "2024-01-01T12:00:05Z",
    "completed": "2024-01-01T12:00:35Z",
    "totalTime": 35.2
  },
  "worker": "0x1234567890abcdef",
  "responseCID": "QmResponseHash456"
}
```

#### `GET /api/tasks`
List recent tasks.

**Query Parameters:**
- `limit`: Number of tasks to return (default: 10)
- `status`: Filter by status (pending, running, completed, failed)
- `since`: ISO timestamp for filtering

### Model Management

#### `GET /api/models`
List available models.

**Response:**
```json
{
  "models": [
    {
      "id": "gpt-3.5-turbo",
      "name": "GPT-3.5 Turbo",
      "description": "Fast and efficient language model",
      "cid": "QmModelHash789",
      "active": true,
      "timestamp": "2024-01-01T10:00:00Z"
    }
  ]
}
```

#### `POST /api/models/upload`
Upload new model (owner only).

**Request (multipart/form-data):**
```
modelId: "custom-model"
name: "My Custom Model"
description: "Fine-tuned model for specific tasks"
file: [model files]
```

---

## 🔌 WebSocket API

### Connection
```javascript
const ws = new WebSocket('ws://localhost:8546');
```

### Message Format
```json
{
  "type": "event_type",
  "data": { ... },
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Event Types

#### `task_submitted`
```json
{
  "type": "task_submitted",
  "data": {
    "taskId": "task_123",
    "jobId": 456,
    "prompt": "What is AI?",
    "modelId": "gpt-3.5-turbo"
  }
}
```

#### `task_completed`
```json
{
  "type": "task_completed",
  "data": {
    "taskId": "task_123",
    "jobId": 456,
    "response": "AI is...",
    "worker": "0x1234567890abcdef",
    "timing": {
      "totalTime": 35.2
    }
  }
}
```

#### `resource_updated`
```json
{
  "type": "resource_updated",
  "data": {
    "cpu": 15,
    "memory": 20,
    "gpu": 15,
    "storage": 8
  }
}
```

---

## 🐍 Python Client Library

### Installation
```bash
pip install decentralized-vllm-client
```

### Basic Usage

```python
from decentralized_vllm import Client

# Initialize client
client = Client(
    eth_node_url="http://localhost:8545",
    contract_address="0x...",
    private_key="0x...",
    ipfs_host="127.0.0.1",
    ipfs_port=5001
)

# Submit inference task
task = client.submit_task(
    prompt="What is artificial intelligence?",
    model_id="gpt-3.5-turbo",
    max_tokens=100
)

# Wait for completion
result = client.wait_for_completion(task.id, timeout=300)
print(f"Response: {result.response}")
print(f"Time taken: {result.timing.total_time}s")

# List available models
models = client.list_models()
for model in models:
    print(f"{model.id}: {model.name}")
```

### Advanced Usage

```python
# Upload custom model
model_id = client.upload_model(
    model_path="./my_model",
    model_id="custom-model",
    name="My Custom Model",
    description="Fine-tuned for specific tasks"
)

# Monitor tasks in real-time
def on_task_completed(task):
    print(f"Task {task.id} completed: {task.response}")

client.on('task_completed', on_task_completed)
client.start_monitoring()

# Batch processing
tasks = []
prompts = ["Question 1", "Question 2", "Question 3"]

for prompt in prompts:
    task = client.submit_task(prompt, "gpt-3.5-turbo")
    tasks.append(task)

# Wait for all tasks
results = client.wait_for_all(tasks, timeout=600)
```

---

## 📱 JavaScript SDK

### Installation
```bash
npm install decentralized-vllm-sdk
```

### Browser Usage

```javascript
import { AIComputeClient } from 'decentralized-vllm-sdk';

// Initialize client
const client = new AIComputeClient({
  ethNodeUrl: 'http://localhost:8545',
  contractAddress: '0x...',
  privateKey: '0x...',
  ipfsHost: '127.0.0.1',
  ipfsPort: 5001
});

// Submit task
const task = await client.submitTask({
  prompt: 'What is artificial intelligence?',
  modelId: 'gpt-3.5-turbo',
  maxTokens: 100
});

// Monitor progress
client.on('taskProgress', (progress) => {
  console.log(`Progress: ${progress.percentage}%`);
});

// Get result
const result = await client.waitForCompletion(task.id);
console.log('Response:', result.response);
```

### Node.js Usage

```javascript
const { AIComputeClient } = require('decentralized-vllm-sdk');

async function main() {
  const client = new AIComputeClient({
    ethNodeUrl: process.env.ETH_NODE_URL,
    contractAddress: process.env.CONTRACT_ADDRESS,
    privateKey: process.env.PRIVATE_KEY
  });

  // Submit multiple tasks
  const tasks = await Promise.all([
    client.submitTask({ prompt: 'Question 1', modelId: 'gpt-3.5-turbo' }),
    client.submitTask({ prompt: 'Question 2', modelId: 'gpt-3.5-turbo' }),
    client.submitTask({ prompt: 'Question 3', modelId: 'gpt-3.5-turbo' })
  ]);

  // Wait for all results
  const results = await Promise.all(
    tasks.map(task => client.waitForCompletion(task.id))
  );

  results.forEach((result, index) => {
    console.log(`Result ${index + 1}: ${result.response}`);
  });
}

main().catch(console.error);
```

---

## 📱 Mobile API

### Progressive Web App

The mobile client uses a simplified API optimized for mobile devices:

```javascript
// Initialize mobile client
const mobileClient = new MobileAIClient({
  bootstrapNode: 'ws://bootstrap-node:30303'
});

// Connect to network
await mobileClient.connect();

// Submit task (simplified)
const task = await mobileClient.submitTask('What is AI?');

// Monitor earnings
mobileClient.on('earningsUpdate', (earnings) => {
  console.log(`Total earnings: ${earnings.total} tokens`);
});

// Get network status
const status = await mobileClient.getNetworkStatus();
console.log(`Connected peers: ${status.peers}`);
```

### WebRTC P2P Communication

```javascript
// Direct peer-to-peer connection
const p2pClient = new P2PClient();

// Connect to nearby worker
const worker = await p2pClient.findNearestWorker();
await p2pClient.connect(worker);

// Submit task directly
const result = await p2pClient.submitTask({
  prompt: 'Hello world',
  modelId: 'small-model'
});
```

---

## 🔧 Error Handling

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `E001` | Bootstrap node unreachable | Check network connectivity |
| `E002` | Insufficient resources | Increase resource allocation |
| `E003` | Model not found | Verify model ID or upload model |
| `E004` | Task timeout | Increase timeout or check workers |
| `E005` | Invalid prompt | Check prompt format and size |

### Error Response Format

```json
{
  "error": {
    "code": "E003",
    "message": "Model not found",
    "details": "Model 'invalid-model' is not registered",
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

---

## 📊 Rate Limits

| Endpoint | Limit | Window |
|----------|-------|--------|
| `/api/tasks/submit` | 100 requests | 1 hour |
| `/api/models` | 1000 requests | 1 hour |
| `/api/status` | 10000 requests | 1 hour |
| WebSocket connections | 10 concurrent | Per IP |

---

## 🔐 Authentication

### API Key Authentication
```bash
curl -H "Authorization: Bearer YOUR_API_KEY" \
     https://api.your-domain.com/api/tasks
```

### Wallet Signature Authentication
```javascript
// Sign request with wallet
const signature = await wallet.signMessage(requestData);
const response = await fetch('/api/tasks', {
  headers: {
    'Authorization': `Signature ${signature}`,
    'X-Wallet-Address': wallet.address
  }
});
```

---

This API reference covers all major interfaces for interacting with the decentralized vLLM inference network. For more detailed examples and tutorials, see the setup guide and documentation.