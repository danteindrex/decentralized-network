# 🚀 Complete Setup Guide - Decentralized vLLM Inference Network

This comprehensive guide covers all setup scenarios from development to production deployment.

## 📋 Table of Contents

1. [Quick Start (5 minutes)](#quick-start)
2. [Development Setup](#development-setup)
3. [Production Deployment](#production-deployment)
4. [Mobile Setup](#mobile-setup)
5. [Troubleshooting](#troubleshooting)

---

## 🚀 Quick Start

### One-Command Setup (Recommended)

```bash
git clone <your-repo>
cd decentralized-vllm-inference
./setup-secure.sh
```

This automated script will:
- ✅ Check prerequisites (Node.js, Python, Docker)
- ✅ Install all dependencies
- ✅ Start infrastructure services (IPFS, Geth)
- ✅ Deploy smart contracts
- ✅ Run tests and verify setup
- ✅ Provide next steps

### Manual Quick Start

If the automated script fails:

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

# 5. Test the system
npx hardhat test
cd orchestrator && python test_inference.py
```

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js 18+** and npm
- **Python 3.8+** and pip
- **Docker** and Docker Compose
- **Git**

### Step-by-Step Development Setup

#### 1. Environment Setup

```bash
# Clone repository
git clone <your-repo>
cd decentralized-vllm-inference

# Copy environment template
cp .env.example .env

# Edit .env with your settings (optional for development)
# The defaults work for local development
```

#### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd orchestrator
pip install -r requirements.txt
cd ..

# Install Streamlit dependencies (optional)
pip install -r streamlit_requirements.txt
```

#### 3. Start Infrastructure Services

```bash
# Start IPFS and Ethereum blockchain
docker-compose up -d ipfs geth

# Wait for services to initialize (30 seconds)
sleep 30

# Verify services are running
docker-compose ps
```

#### 4. Deploy Smart Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost

# Auto-update configuration
python scripts/update_config.py
```

#### 5. Upload Test Model

```bash
cd orchestrator

# Upload a small test model
python owner_upload.py \
  --model "microsoft/DialoGPT-small" \
  --model-id "dialogpt-small" \
  --name "DialoGPT Small" \
  --description "Small conversational model for testing"
```

#### 6. Start Development Services

```bash
# Start orchestrator
cd orchestrator
python main.py

# In another terminal, start Streamlit UI (optional)
streamlit run streamlit_app.py

# In another terminal, start mobile server (optional)
cd nodes/mobile
python mobile_server.py
```

### Development Workflow

```bash
# Run tests
npm test                    # Smart contract tests
cd orchestrator && python test_inference.py  # Python tests

# View logs
docker-compose logs -f geth      # Blockchain logs
docker-compose logs -f ipfs      # IPFS logs

# Reset development environment
npm run clean                    # Clean and restart everything
```

---

## 🌐 Production Deployment

### Architecture Options

#### Option 1: Single Server Deployment

```bash
# For small teams or testing
docker-compose --profile full up -d
```

#### Option 2: Distributed Deployment

```bash
# Bootstrap Node (Network coordinator)
docker-compose --profile bootstrap up -d

# Worker Nodes (Compute providers)
docker-compose --profile worker up -d

# Model Owner (AI model manager)
docker-compose --profile owner up -d

# User Interface (Web access)
docker-compose --profile user up -d
```

#### Option 3: Kubernetes Deployment

```bash
# Deploy to Kubernetes cluster
kubectl apply -f k8s/
kubectl scale deployment worker-node --replicas=10
```

### Production Configuration

#### 1. Environment Variables

Create production `.env` file:

```bash
# Production blockchain (use external node)
ETH_NODE_URL=https://mainnet.infura.io/v3/YOUR_PROJECT_ID

# Production IPFS (use external node)
IPFS_HOST=ipfs.infura.io
IPFS_PORT=5001
IPFS_PROTOCOL=https

# Your production wallet
DEFAULT_ACCOUNT=0xYourProductionAddress
PRIVATE_KEY=0xYourProductionPrivateKey

# Production settings
NODE_ENV=production
LOG_LEVEL=info
```

#### 2. Security Configuration

```bash
# Setup firewall
sudo ufw allow 22/tcp      # SSH
sudo ufw allow 80/tcp      # HTTP
sudo ufw allow 443/tcp     # HTTPS
sudo ufw allow 30303/tcp   # P2P
sudo ufw enable

# Setup SSL certificates
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# Configure nginx reverse proxy
sudo cp nginx.conf /etc/nginx/sites-available/ai-compute
sudo ln -s /etc/nginx/sites-available/ai-compute /etc/nginx/sites-enabled/
sudo systemctl reload nginx
```

#### 3. Monitoring Setup

```bash
# Setup log rotation
sudo cp logrotate.conf /etc/logrotate.d/ai-compute

# Setup monitoring
docker-compose -f docker-compose.monitoring.yml up -d

# Access monitoring dashboard
# http://your-domain.com:3000 (Grafana)
# http://your-domain.com:9090 (Prometheus)
```

### Scaling Production

#### Horizontal Scaling

```bash
# Scale worker nodes
docker-compose up --scale worker-node=5

# Add more bootstrap nodes
./deploy-bootstrap.sh us-west-2
./deploy-bootstrap.sh eu-west-1
./deploy-bootstrap.sh ap-southeast-1
```

#### Load Balancing

```bash
# Setup nginx load balancer
upstream ai_workers {
    server worker1.your-domain.com:8000;
    server worker2.your-domain.com:8000;
    server worker3.your-domain.com:8000;
}

# Configure in nginx.conf
proxy_pass http://ai_workers;
```

---

## 📱 Mobile Setup

### For Mobile Users (Easiest)

Mobile users have the simplest setup - no installation required!

1. **Find a bootstrap node** (ask in community for IP addresses)
2. **Visit**: `http://bootstrap-ip:8080/mobile` in your phone browser
3. **Add to home screen** when prompted
4. **Start earning** immediately!

### For Bootstrap Node Operators

```bash
# Enable mobile server
docker-compose up -d mobile-server

# Generate QR codes for easy sharing
npm run mobile:qr

# Share these URLs:
echo "Mobile App: http://your-ip:8080/mobile"
echo "Setup Guide: http://your-ip:8080/setup"
echo "QR Code: http://your-ip:8080/qr"
```

### Mobile Features

- 🚀 **One-tap setup** - No registration or downloads
- 💰 **Automatic earning** - Passive income from participation
- 📱 **Native app experience** - Works offline, push notifications
- 🔒 **Secure wallet** - Private keys stored locally
- 👥 **Referral program** - Earn from friends' participation

---

## 🔧 Troubleshooting

### Common Issues

#### 1. "IPFS connection failed"

```bash
# Check IPFS status
docker-compose ps ipfs
docker-compose logs ipfs

# Restart IPFS
docker-compose restart ipfs

# Test IPFS connection
curl http://localhost:5001/api/v0/version
```

#### 2. "Blockchain connection failed"

```bash
# Check Geth status
docker-compose ps geth
docker-compose logs geth

# Test blockchain connection
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# Restart Geth
docker-compose restart geth
```

#### 3. "Contract deployment failed"

```bash
# Check if blockchain is ready
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' \
  http://localhost:8545

# Redeploy contracts
npx hardhat run scripts/deploy.js --network localhost

# Update configuration
python scripts/update_config.py
```

#### 4. "Model upload failed"

```bash
# Check IPFS connection
ipfs id

# Check disk space
df -h

# Try with smaller model
cd orchestrator
python owner_upload.py --model "microsoft/DialoGPT-small" --model-id "test"
```

#### 5. "Orchestrator startup failed"

```bash
# Check configuration
cat orchestrator/config.yaml

# Verify contract addresses
cat deployment.json

# Check Python dependencies
cd orchestrator
pip install -r requirements.txt

# Run with debug logging
python main.py --debug
```

### Performance Issues

#### High CPU Usage

```bash
# Check resource allocation
cd nodes
node dynamic-adjuster.js

# Reduce CPU contribution
# Select option 2 (Decrease CPU contribution)
```

#### High Memory Usage

```bash
# Check memory usage
free -h

# Reduce RAM contribution
cd nodes
node dynamic-adjuster.js

# Clear model cache
rm -rf model_cache/*
```

#### Slow Inference

```bash
# Check GPU availability
nvidia-smi

# Optimize vLLM settings
# Edit orchestrator/config.yaml:
# vllm:
#   gpu_memory_utilization: 0.9
#   max_model_len: 1024
```

### Network Issues

#### No Peers Connected

```bash
# Check bootstrap nodes
cd nodes
node discover-bootstrap.js

# Manually add peers
# Edit .env:
# BOOTSTRAP_NODE=active-node.duckdns.org:30303
```

#### Mining Not Working

```bash
# Check mining status
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}' \
  http://localhost:8545

# Start mining manually
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"miner_start","params":[1],"id":1}' \
  http://localhost:8545
```

### Getting Help

1. **Check logs**: `docker-compose logs -f [service]`
2. **Run diagnostics**: `./setup.sh --check`
3. **Community support**: Discord/Telegram channels
4. **GitHub issues**: Report bugs and get help
5. **Documentation**: Check API reference and guides

---

## 📚 Next Steps

Once your system is running:

1. **Read the Owner Guide**: Learn advanced model management
2. **Explore the API**: Integrate with your applications
3. **Join the Community**: Connect with other users
4. **Contribute**: Help improve the project
5. **Scale Up**: Add more nodes and users

## 🎯 Success Checklist

- [ ] Infrastructure services running (IPFS, Geth)
- [ ] Smart contracts deployed
- [ ] Configuration updated
- [ ] Test model uploaded
- [ ] Orchestrator running
- [ ] Tests passing
- [ ] Mobile app accessible (if enabled)
- [ ] Monitoring configured (production)

Congratulations! Your decentralized vLLM inference network is now operational! 🎉