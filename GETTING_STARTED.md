# Getting Started - Decentralized vLLM Inference Network

This guide will help you set up and run the decentralized vLLM inference network in just a few minutes.

## 🚀 One-Command Setup

For the fastest setup, run our automated setup script:

```bash
./setup.sh
```

This script will:
- ✅ Check all prerequisites
- ✅ Install dependencies
- ✅ Start infrastructure services
- ✅ Deploy smart contracts
- ✅ Run tests
- ✅ Provide next steps

## 📋 Manual Setup (Step by Step)

If you prefer to set up manually or the automated script fails:

### 1. Prerequisites Check

Make sure you have:
- Node.js 16+ and npm
- Python 3.8+ and pip
- Docker and Docker Compose
- Git

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Install Python dependencies
cd orchestrator
pip install -r requirements.txt
cd ..
```

### 3. Start Infrastructure

```bash
# Start IPFS and blockchain
docker-compose up -d ipfs geth

# Wait 30 seconds for services to initialize
sleep 30
```

### 4. Deploy Smart Contracts

```bash
# Compile contracts
npx hardhat compile

# Deploy to local network
npx hardhat run scripts/deploy.js --network localhost
```

### 5. Configure System

```bash
# Auto-update config with deployed addresses
python scripts/update_config.py

# Or manually edit orchestrator/config.yaml
# Update contract addresses and add your private key
```

### 6. Upload First Model

```bash
cd orchestrator

# Upload a test model
python owner_upload.py \
  --model "microsoft/DialoGPT-small" \
  --model-id "dialogpt-small" \
  --name "DialoGPT Small" \
  --description "Small conversational model"
```

### 7. Start Orchestrator

```bash
# Start the inference engine
python main.py

# Or run with Docker
cd ..
docker-compose up orchestrator
```

## 🧪 Quick Test

Test that everything is working:

```bash
# Test components
cd orchestrator
python test_inference.py

# Test smart contracts
cd ..
npx hardhat test

# List available models
npx hardhat run scripts/owner_tools.js list
```

## 💡 First Inference Request

Once everything is running, submit your first inference request:

```bash
# Upload a prompt to IPFS
echo "What is artificial intelligence?" > prompt.txt
PROMPT_CID=$(ipfs add -q prompt.txt)

# Submit inference request
npx hardhat console --network localhost
> const coordinator = await ethers.getContractAt("InferenceCoordinator", "YOUR_CONTRACT_ADDRESS")
> await coordinator.submitPrompt(PROMPT_CID, "dialogpt-small")
```

## 🔧 Common Issues & Solutions

### Issue: "IPFS connection failed"
```bash
# Check IPFS status
docker-compose ps ipfs
docker-compose logs ipfs

# Restart IPFS
docker-compose restart ipfs
```

### Issue: "Blockchain connection failed"
```bash
# Check Geth status
docker-compose ps geth
docker-compose logs geth

# Restart Geth
docker-compose restart geth
```

### Issue: "Contract deployment failed"
```bash
# Check if Geth is ready
curl -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
  http://localhost:8545

# Redeploy contracts
npx hardhat run scripts/deploy.js --network localhost
```

### Issue: "Model upload failed"
```bash
# Check IPFS connection
ipfs id

# Check disk space
df -h

# Try with a smaller model
python owner_upload.py --model "microsoft/DialoGPT-small" --model-id "test"
```

## 📚 Next Steps

Once you have the basic system running:

1. **Read the Owner Guide**: See `OWNER_GUIDE.md` for detailed model management
2. **Explore the API**: Check smart contract interfaces and events
3. **Scale the System**: Add more orchestrator nodes with `docker-compose up --scale orchestrator=3`
4. **Monitor Performance**: Use the monitoring commands in the main README
5. **Customize Configuration**: Adjust resource limits and inference parameters

## 🆘 Getting Help

If you encounter issues:

1. **Check the logs**: `docker-compose logs -f [service]`
2. **Verify prerequisites**: Run `./setup.sh` again
3. **Read the full README**: More detailed troubleshooting in `README.md`
4. **Check the issues**: Look for similar problems in the GitHub issues

## 🎯 What You've Built

Congratulations! You now have:

- ✅ A decentralized AI inference network
- ✅ IPFS-based model storage
- ✅ Blockchain job coordination
- ✅ Distributed GPU processing with vLLM
- ✅ Owner-controlled model catalog
- ✅ Economic incentive system

Your network can now:
- Accept inference requests from users
- Automatically distribute work across nodes
- Store results on IPFS
- Handle payments and coordination via smart contracts
- Scale dynamically based on demand

Welcome to the future of decentralized AI! 🚀