# Node Setup Guide

This guide explains how to set up different types of nodes in the decentralized AI inference network.

## 🏗️ Node Types Overview

### 1. **Bootstrap Node** 🌟
- **Role**: Network coordinator and founder
- **Purpose**: Manages network discovery, coordinates workers, serves mobile PWA
- **Requirements**: Moderate resources, stable internet connection
- **Earnings**: Network fees and coordination rewards

### 2. **Worker Node** 💪
- **Role**: Compute provider for AI inference
- **Purpose**: Processes inference jobs, runs AI models
- **Requirements**: GPU/CPU resources, good bandwidth
- **Earnings**: Payment per inference job completed

### 3. **Model Owner Node** 🧠
- **Role**: AI model provider and manager
- **Purpose**: Uploads models, manages model registry
- **Requirements**: Storage space, model files
- **Earnings**: Royalties when models are used

### 4. **User Interface Node** 👤
- **Role**: End-user access point
- **Purpose**: Submit inference requests, view results
- **Requirements**: Minimal resources
- **Costs**: Pays for inference services

---

## 🚀 Quick Start Options

### Option 1: Full Network (All Nodes)
```bash
# Start complete network with all node types
docker-compose --profile full up -d
```

### Option 2: Individual Node Types
```bash
# Bootstrap node only
docker-compose --profile bootstrap up -d

# Worker node only  
docker-compose --profile worker up -d

# Model owner node only
docker-compose --profile owner up -d

# User interface only
docker-compose --profile user up -d
```

---

## 📋 Detailed Setup Instructions

### 1. Bootstrap Node Setup

**Purpose**: Start and coordinate the network

```bash
# 1. Copy bootstrap environment
cp .env.bootstrap .env

# 2. Edit configuration (optional)
nano .env

# 3. Start bootstrap node
docker-compose --profile bootstrap up -d

# 4. Check status
docker-compose logs bootstrap-node
```

**Bootstrap Node Features:**
- ✅ Network coordination
- ✅ Mobile PWA server (port 8080)
- ✅ P2P bootstrap (port 30303)
- ✅ Worker discovery and management

### 2. Worker Node Setup

**Purpose**: Provide compute resources for AI inference

```bash
# 1. Copy worker environment
cp .env.worker .env

# 2. Configure resources (edit .env)
CPU_CONTRIBUTION=10        # CPU cores to contribute
RAM_CONTRIBUTION=15        # GB of RAM to contribute  
GPU_CONTRIBUTION=10        # GPU memory in GB
STORAGE_CONTRIBUTION=5     # GB of storage

# 3. Set your wallet
WORKER_PRIVATE_KEY=your_private_key_here
WORKER_ACCOUNT=your_wallet_address_here

# 4. Start worker node
docker-compose --profile worker up -d

# 5. Check worker status
docker-compose logs worker-node
```

**Worker Node Features:**
- ✅ AI model inference (vLLM)
- ✅ MCP tool integration
- ✅ Automatic job processing
- ✅ Resource monitoring
- ✅ Payment collection

### 3. Model Owner Node Setup

**Purpose**: Upload and manage AI models

```bash
# 1. Copy owner environment
cp .env.owner .env

# 2. Set your wallet (should have ETH for gas)
OWNER_PRIVATE_KEY=your_private_key_here
OWNER_ACCOUNT=your_wallet_address_here

# 3. Start owner node
docker-compose --profile owner up -d

# 4. Access owner interface
open http://localhost:8002
```

**Model Owner Features:**
- ✅ Model upload to IPFS
- ✅ Model registration on blockchain
- ✅ Royalty management
- ✅ Model performance analytics

### 4. User Interface Setup

**Purpose**: Submit inference requests and view results

```bash
# 1. Copy user environment
cp .env.user .env

# 2. Set your wallet (needs ETH to pay for inference)
USER_PRIVATE_KEY=your_private_key_here
USER_ACCOUNT=your_wallet_address_here

# 3. Start user interface
docker-compose --profile user up -d

# 4. Access web interface
open http://localhost:8501
```

**User Interface Features:**
- ✅ Streamlit web app
- ✅ Submit inference jobs
- ✅ View job results
- ✅ Wallet integration
- ✅ Payment handling

---

## 🔧 Advanced Configurations

### Multiple Worker Nodes
```bash
# Scale worker nodes
WORKER_REPLICAS=3 docker-compose --profile worker up -d --scale worker-node=3
```

### Custom Network Configuration
```bash
# Use external blockchain
ETH_NODE_URL=https://your-ethereum-node.com

# Use external IPFS
IPFS_HOST=your-ipfs-node.com
IPFS_PORT=5001

# Custom bootstrap node
BOOTSTRAP_NODE=your-bootstrap-node.com:30303
```

### Resource Limits
```yaml
# Add to docker-compose.override.yml
services:
  worker-node:
    deploy:
      resources:
        limits:
          cpus: '4.0'
          memory: 16G
        reservations:
          cpus: '2.0'
          memory: 8G
```

---

## 🌐 Network Topology

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Bootstrap Node │────│  Ethereum Node │────│   IPFS Node     │
│   (Coordinator) │    │   (Blockchain)  │    │   (Storage)     │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ├───────────────────────┼───────────────────────┤
         │                       │                       │
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  Worker Node 1  │    │  Worker Node 2  │    │  Worker Node N  │
│  (AI Compute)   │    │  (AI Compute)   │    │  (AI Compute)   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   User Nodes    │
                    │ (Web Interface) │
                    └─────────────────┘
```

---

## 💰 Economic Model

### Worker Node Earnings
- **Base Rate**: 0.01 ETH per inference job
- **Performance Bonus**: Up to 50% extra for fast completion
- **Staking Rewards**: Additional rewards for staked tokens

### Model Owner Earnings  
- **Usage Royalty**: 10% of inference fees
- **Popular Model Bonus**: Extra rewards for frequently used models
- **Quality Incentive**: Higher rates for high-quality models

### Bootstrap Node Earnings
- **Network Fee**: 1% of all transactions
- **Coordination Reward**: Fixed reward per epoch
- **Discovery Fee**: Small fee for worker registration

---

## 🔍 Monitoring & Management

### Check Node Status
```bash
# View all services
docker-compose ps

# Check specific node logs
docker-compose logs -f worker-node
docker-compose logs -f bootstrap-node

# Monitor resources
docker stats
```

### Health Checks
```bash
# Test blockchain connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# Test IPFS connection
curl http://localhost:5001/api/v0/id

# Test worker inference
curl http://localhost:8000/health
```

### Troubleshooting
```bash
# Restart specific service
docker-compose restart worker-node

# View detailed logs
docker-compose logs --tail=100 worker-node

# Reset data (WARNING: loses all data)
docker-compose down -v
docker-compose up -d
```

---

## 🛡️ Security Considerations

### Wallet Security
- Use hardware wallets for production
- Keep private keys secure and backed up
- Use separate wallets for different node types

### Network Security
- Use VPN for sensitive operations
- Keep Docker images updated
- Monitor for unusual activity

### Resource Protection
- Set appropriate resource limits
- Monitor system performance
- Use firewall rules for exposed ports

---

## 📞 Support & Community

- **Documentation**: Check README.md and API_REFERENCE.md
- **Issues**: Report bugs via GitHub issues
- **Community**: Join our Discord/Telegram
- **Updates**: Follow releases for new features

---

*Happy node running! 🚀*