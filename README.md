# 🧠 Decentralized vLLM Inference Network

A truly decentralized AI inference network that enables distributed LLM computation across community-owned nodes using blockchain coordination and IPFS storage.

## ✨ Key Features

- **🌐 Fully Decentralized**: No central servers, pure peer-to-peer architecture
- **🔗 Blockchain Coordination**: Smart contracts manage jobs, payments, and governance
- **📦 IPFS Storage**: Distributed storage for AI models and inference data
- **⚡ High-Performance**: vLLM + Ray for GPU-accelerated inference
- **📱 Mobile-First**: Progressive Web App for easy participation
- **💰 Economic Incentives**: Earn tokens by contributing compute resources
- **🎛️ Dynamic Resources**: Real-time resource allocation adjustment

## 🚀 Quick Start

### One-Command Setup (Recommended)

```bash
git clone <your-repo>
cd decentralized-vllm-inference
./setup.sh
```

This automated script will:
- ✅ Check prerequisites and install dependencies
- ✅ Start infrastructure services (IPFS, Ethereum)
- ✅ Deploy smart contracts
- ✅ Run tests and configure the system
- ✅ Provide next steps for your role

### Choose Your Role

#### 🏠 Bootstrap Node (Network Founder)
```bash
# Start as network coordinator
npm run start:bootstrap

# Share with friends
echo "Join my network: your-ip:30303"
```

#### ⚡ Worker Node (Compute Provider)
```bash
# Join existing network
npm run start:worker

# Adjust resources in real-time
cd nodes && node dynamic-adjuster.js
```

#### 🎨 Model Owner (AI Model Provider)
```bash
# Start model management services
npm run start:owner

# Upload your first model
cd orchestrator
python owner_upload.py --model "microsoft/DialoGPT-small" --model-id "test-model"
```

#### 👤 User (AI Service Consumer)
```bash
# Start user interface
npm run start:user

# Access web interface: http://localhost:8501
```

#### 📱 Mobile User (Easiest!)
Just visit any bootstrap node's mobile app:
```
http://bootstrap-ip:8080/mobile
```
Add to home screen when prompted. No installation required!

## 📁 Project Structure

```
decentralized-vllm-inference/
├── contracts/                  # Smart contracts (Solidity)
│   ├── InferenceCoordinator.sol
│   ├── ModelRegistry.sol
│   └── NodeProfileRegistry.sol
├── orchestrator/               # Python inference engine
│   ├── main.py
│   ├── owner_upload.py
│   └── config.template.yaml
├── nodes/                      # Node implementations
│   ├── bootstrap/              # Network coordinators
│   ├── worker/                 # Compute providers
│   └── mobile/                 # Mobile PWA
├── scripts/                    # Deployment & management
│   ├── deploy.js
│   └── update_config.py
├── test/                       # Test suites
├── docker-compose.yml          # Multi-service deployment
├── docker-compose.unified.yml  # Unified multi-stage deployment
├── Dockerfile.unified          # Multi-stage Dockerfile for all nodes
└── setup.sh                   # Automated setup script
```

## 🛠️ Development Setup

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.8+** and pip
- **Docker** and Docker Compose
- **Git**

### Manual Setup
```bash
# 1. Install dependencies
npm install
cd orchestrator && pip install -r requirements.txt && cd ..

# 2. Start infrastructure
docker-compose up -d ipfs geth

# 3. Deploy contracts
npx hardhat compile
npx hardhat run scripts/deploy.js --network localhost

# 4. Configure system
python scripts/update_config.py

# 5. Test everything
npm test
cd orchestrator && python test_inference.py
```

## 🐳 Docker Deployment

### 🎯 Unified Dockerfile (Recommended)

The project includes a **unified multi-stage Dockerfile** that can build **all node types** from a single file:

```bash
# All-in-one deployment (everything in one container)
docker-compose -f docker-compose.unified.yml --profile all-in-one up -d

# Distributed deployment (separate containers per service)
docker-compose -f docker-compose.unified.yml --profile full up -d

# Specific node types only
docker-compose -f docker-compose.unified.yml --profile bootstrap up -d
docker-compose -f docker-compose.unified.yml --profile worker up -d --scale worker-node=3
docker-compose -f docker-compose.unified.yml --profile owner up -d
docker-compose -f docker-compose.unified.yml --profile user up -d
```

### 🏗️ Build Specific Node Types

```bash
# Build individual node types
docker build -f Dockerfile.unified --target bootstrap -t ai-bootstrap .
docker build -f Dockerfile.unified --target worker -t ai-worker .
docker build -f Dockerfile.unified --target owner -t ai-owner .
docker build -f Dockerfile.unified --target orchestrator -t ai-orchestrator .
docker build -f Dockerfile.unified --target streamlit -t ai-streamlit .
docker build -f Dockerfile.unified --target all-in-one -t ai-all-in-one .

# Run specific node type
docker run -p 30303:30303 -p 8080:8080 ai-bootstrap
docker run -p 8000:8000 -p 8001:8001 ai-worker
docker run -p 8002:8002 ai-owner
```

### 📋 Available Node Types

| Node Type | Purpose | Ports | Target Stage | Use Case |
|-----------|---------|-------|--------------|----------|
| **Bootstrap** | Network coordinator | 30303, 8080 | `bootstrap` | Network entry point |
| **Worker** | Compute provider | 8000, 8001 | `worker` | AI task processing |
| **Owner** | Model manager | 8002 | `owner` | Upload/manage models |
| **Orchestrator** | Inference engine | 8000, 8546 | `orchestrator` | Main AI processing |
| **Streamlit** | Web interface | 8501 | `streamlit` | User web interface |
| **Mobile** | PWA server | 8081 | `mobile` | Mobile app hosting |
| **All-in-One** | Everything | All ports | `all-in-one` | Single-machine setup |

### 🚀 Quick Start Options

**Option 1: Easiest (All-in-One)**
```bash
docker-compose -f docker-compose.unified.yml --profile all-in-one up -d
# Everything runs in one container - perfect for testing
```

**Option 2: Distributed (Recommended)**
```bash
docker-compose -f docker-compose.unified.yml --profile full up -d
# Each service in separate containers - better for production
```

**Option 3: Custom Combination**
```bash
# Bootstrap + Worker + Owner
docker-compose -f docker-compose.unified.yml \
  --profile bootstrap --profile worker --profile owner up -d

# Just worker nodes (connect to existing network)
docker-compose -f docker-compose.unified.yml \
  --profile worker up -d --scale worker-node=5
```

### 🔧 Legacy Docker Compose (Original)

```bash
# Single command (all services)
docker-compose --profile full up -d

# Role-specific deployment
docker-compose --profile bootstrap up -d
docker-compose --profile worker up -d --scale worker-node=3
docker-compose --profile owner up -d
docker-compose --profile user up -d
```

### 💡 Docker Benefits

**Unified Dockerfile Advantages:**
- **Single source of truth** - One Dockerfile for all node types
- **Shared base layers** - Efficient caching and smaller images
- **Consistent environment** - Same dependencies across all nodes
- **Easy maintenance** - Update once, affects all node types

**Multi-Stage Build Process:**
1. **Base stage** - Common dependencies (Node.js, Python)
2. **Production-base** - Project files and configuration
3. **Specialized stages** - Node-specific dependencies and setup
4. **Target selection** - Build only what you need

## 📊 Resource Management

### Dynamic Adjustment (While Running)
```bash
cd nodes
node dynamic-adjuster.js

# Options:
# 1. Increase/decrease CPU contribution
# 2. Adjust RAM allocation
# 3. Configure GPU usage
# 4. Apply presets (conservative/balanced/generous)
# 5. View current usage
```

### Web Interface
```bash
npm run web-adjust
# Opens: http://localhost:8081/web-adjuster.html
```

### Presets Available
| Preset | CPU | RAM | GPU | Storage | Best For |
|--------|-----|-----|-----|---------|----------|
| Conservative | 5% | 10% | 5% | 2% | Cautious users |
| Balanced | 10% | 15% | 10% | 5% | Most users |
| Generous | 20% | 30% | 25% | 10% | Dedicated nodes |
| Mobile | 5% | 5% | 0% | 1% | Phones/tablets |

## 🧪 Testing

### Run All Tests
```bash
npm test                    # Smart contract tests
cd orchestrator && python test_inference.py  # Python tests
```

### Test Inference
```bash
# Simple test
python test_inference_simple.py "What is AI?" QmModelCIDHere

# Web interface test
streamlit run streamlit_app.py
# Visit: http://localhost:8501
```

## 📚 Documentation

- **[Setup Guide](SETUP_GUIDE.md)** - Complete setup instructions for all scenarios
- **[API Reference](API_REFERENCE.md)** - Smart contracts, REST APIs, and SDKs
- **[Owner Guide](OWNER_GUIDE.md)** - Model management and advanced operations

## 🔧 Configuration

### Environment Variables
```bash
# Copy template and customize
cp .env.example .env

# Key settings:
ETH_NODE_URL=http://localhost:8545
PRIVATE_KEY=0xYourPrivateKey
DEFAULT_ACCOUNT=0xYourAddress
IPFS_HOST=127.0.0.1
```

### Orchestrator Config
```bash
# Copy template
cp orchestrator/config.template.yaml orchestrator/config.yaml

# Auto-update with deployed addresses
python scripts/update_config.py
```

## 🌐 Network Participation

### For Network Pioneers
1. **Setup bootstrap node** with static IP/domain
2. **Configure port forwarding** (30303)
3. **Share network details** with community
4. **Monitor network growth**

### For Participants
1. **Find active bootstrap nodes** (community channels)
2. **Join as worker node** (`npm run start:worker`)
3. **Contribute resources** and earn tokens
4. **Invite friends** for network growth

### For Mobile Users
1. **Visit bootstrap node** mobile app
2. **Add to home screen** (PWA installation)
3. **Start earning immediately** (no setup required)
4. **Share referral link** for bonus earnings

## 🔍 Monitoring & Management

### Check System Status
```bash
# Service status
docker-compose ps

# Network connectivity
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Resource usage
cd nodes && node dynamic-adjuster.js
```

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f worker-node

# Unified deployment logs
docker-compose -f docker-compose.unified.yml logs -f
```

### Management Commands
```bash
# List models
npm run models:list

# Upload model
npm run models:upload

# Clean everything
npm run clean
```

## 🚨 Troubleshooting

### Common Issues

**"IPFS connection failed"**
```bash
docker-compose restart ipfs
curl http://localhost:5001/api/v0/version
```

**"Blockchain connection failed"**
```bash
docker-compose restart geth
curl http://localhost:8545
```

**"Contract deployment failed"**
```bash
npx hardhat run scripts/deploy.js --network localhost
python scripts/update_config.py
```

**"Low performance"**
```bash
cd nodes && node dynamic-adjuster.js
# Increase resource allocation
```

**"Docker build issues"**
```bash
# Clean Docker cache
docker system prune -a

# Rebuild with no cache
docker-compose -f docker-compose.unified.yml build --no-cache
```

## 🤝 Contributing

1. **Fork the repository**
2. **Create feature branch** (`git checkout -b feature/amazing-feature`)
3. **Make changes** and add tests
4. **Run test suite** (`npm test`)
5. **Submit pull request**

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🆘 Support

- **Documentation**: Complete guides in `/docs`
- **Issues**: [GitHub Issues](https://github.com/your-org/decentralized-vllm-inference/issues)
- **Community**: [Discord](https://discord.gg/your-server) | [Telegram](https://t.me/your-group)
- **Email**: support@your-domain.com

## 🗺️ Roadmap

- [ ] **Multi-chain support** (Polygon, BSC, Arbitrum)
- [ ] **Advanced model sharding** for large models
- [ ] **Reputation system** for node quality
- [ ] **Web UI** for non-technical users
- [ ] **Mobile native apps** (iOS/Android)
- [ ] **Enterprise features** and SLA support

---

**🎉 Ready to join the decentralized AI revolution?**

Start with `./setup.sh` and become part of the community-owned AI infrastructure!

[![GitHub stars](https://img.shields.io/github/stars/your-org/decentralized-vllm-inference?style=social)](https://github.com/your-org/decentralized-vllm-inference)
[![Discord](https://img.shields.io/discord/your-discord-id?label=Discord&logo=discord)](https://discord.gg/your-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)