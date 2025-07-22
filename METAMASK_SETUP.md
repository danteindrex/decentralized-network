# 🦊 MetaMask Integration Setup Guide

## Overview

This guide will help you set up MetaMask integration for the Decentralized vLLM Inference Network. With MetaMask integration, users don't need to manually enter private keys - they can connect their wallets directly through the MetaMask interface.

## Prerequisites

1. **MetaMask Browser Extension** or **MetaMask Mobile App**
2. **Running private network** (Chain ID: 1337)
3. **Node.js and npm** installed

## Quick Setup

### 1. Copy MetaMask Environment Configuration

```bash
cp .env.metamask .env
```

### 2. Start Your Private Network

```bash
# Start infrastructure
docker-compose up -d ipfs geth

# Deploy contracts
npm run deploy
```

### 3. Add Network to MetaMask

**Automatic Method (Recommended):**
- Visit any of the web interfaces
- Click "Connect MetaMask"
- Approve network addition when prompted

**Manual Method:**
1. Open MetaMask
2. Click network dropdown → "Add Network"
3. Enter these details:
   - **Network Name:** Decentralized vLLM Network
   - **RPC URL:** http://localhost:8545
   - **Chain ID:** 1337
   - **Currency Symbol:** ETH

### 4. Import Test Accounts (Development Only)

⚠️ **WARNING: Only use these for development on your private network!**

**Bootstrap/Owner Account:**
- Address: `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266`
- Private Key: `0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80`

**Worker Account:**
- Address: `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`
- Private Key: `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`

**User Account:**
- Address: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`
- Private Key: `0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a`

## Usage by Node Type

### 🏠 Bootstrap Node Operators

```bash
# Start bootstrap node with MetaMask
npm run start:bootstrap:metamask

# Or use web interface
open http://localhost:8080/bootstrap-setup
```

### ⚡ Worker Node Operators

```bash
# Start worker node with MetaMask
npm run start:worker:metamask

# Or use web interface
open http://localhost:8081/worker-setup
```

### 🎨 Model Owners

```bash
# Start owner interface with MetaMask
npm run start:owner:metamask

# Or use web interface
open http://localhost:8002/owner-dashboard
```

### 👤 Regular Users

```bash
# Start Streamlit with MetaMask
npm run start:streamlit:metamask

# Or use web interface
open http://localhost:8501
```

### 📱 Mobile Users

1. **Install MetaMask Mobile App**
2. **Open MetaMask Browser**
3. **Navigate to:** `http://your-bootstrap-ip:8080/mobile`
4. **Connect wallet when prompted**
5. **Add to home screen** for app-like experience

## Features

### ✅ What Works with MetaMask

- **Automatic wallet connection** - No manual private key entry
- **Network switching** - Automatically adds/switches to your private network
- **Transaction signing** - All transactions signed through MetaMask
- **Mobile support** - Works with MetaMask mobile app
- **Fallback support** - Falls back to environment variables if MetaMask unavailable

### 🔧 Configuration Options

Edit `.env` to customize:

```bash
# Enable/disable MetaMask for different node types
BOOTSTRAP_USE_METAMASK=true
WORKER_USE_METAMASK=true
OWNER_USE_METAMASK=true
USER_USE_METAMASK=true

# Mobile MetaMask support
MOBILE_METAMASK_ENABLED=true
```

## Troubleshooting

### MetaMask Not Detected

**Problem:** "MetaMask not available" error
**Solution:**
1. Install MetaMask browser extension
2. Refresh the page
3. Check that MetaMask is unlocked

### Wrong Network

**Problem:** "Please switch to correct network"
**Solution:**
1. Click "Switch Network" button in the interface
2. Or manually switch in MetaMask to "Decentralized vLLM Network"

### Transaction Failures

**Problem:** Transactions fail or are rejected
**Solution:**
1. Check account has sufficient ETH balance
2. Verify you're on the correct network (Chain ID: 1337)
3. Try resetting MetaMask account (Settings → Advanced → Reset Account)

### Mobile Issues

**Problem:** MetaMask mobile not working
**Solution:**
1. Use MetaMask mobile browser (not external browser)
2. Or use WalletConnect (if implemented)
3. Ensure mobile device is on same network as bootstrap node

## Production Considerations

### 🚨 Security for Production

1. **Never use test private keys in production**
2. **Use your own generated accounts**
3. **Enable SSL/HTTPS for mobile access**
4. **Implement proper access controls**

### 🌐 Production Setup

```bash
# Production environment variables
ETH_NODE_URL=https://your-private-network-rpc.com
STATIC_IP=your-domain.com
MOBILE_SSL_ENABLED=true
MOBILE_DOMAIN=your-domain.com

# Disable fallback keys in production
BOOTSTRAP_FALLBACK_PRIVATE_KEY=""
WORKER_FALLBACK_PRIVATE_KEY=""
OWNER_FALLBACK_PRIVATE_KEY=""
USER_FALLBACK_PRIVATE_KEY=""
```

## Support

- **Documentation:** Check API_REFERENCE.md for technical details
- **Issues:** Report bugs on GitHub
- **Community:** Join Discord/Telegram for help

---

**🎉 Enjoy seamless wallet integration with MetaMask!**
