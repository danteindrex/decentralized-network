# Dynamic Network Discovery Guide

## How It Works

The AI inference network uses dynamic discovery to eliminate hardcoded values and enable organic growth:

### 1. Bootstrap Discovery
- Nodes start with only ONE bootstrap node URL
- Bootstrap node provides network configuration
- No hardcoded IP addresses or ports needed

### 2. Peer Discovery Methods
- **Real Peer Discovery**: Monitor blockchain connections
- **Registration**: Nodes register with bootstrap
- **Local Scanning**: Development mode discovery
- **Cross-Reference**: Verify registered peers

### 3. Automatic Configuration
- ETH node URLs discovered from peers
- IPFS endpoints found automatically  
- Contract addresses loaded from deployment
- Worker capabilities auto-detected

## Starting a New Network

### 1. Deploy Bootstrap Node
```bash
# Set your static IP
export STATIC_IP=your.public.ip
node nodes/bootstrap/bootstrap-node.js
```

### 2. Start Worker Nodes
```bash
# Workers discover network automatically
cd orchestrator
python3 main.py
```

### 3. Connect Applications
```bash
# Streamlit app
streamlit run streamlit_app.py

# Electron app  
cd easyapps && npm start
```

## Network Growth

- New nodes only need bootstrap URL
- Peers discover each other automatically
- Network becomes self-sustaining
- Load balances across discovered nodes
- Handles node failures gracefully

## Configuration Files

All apps now use minimal configuration:

- **Bootstrap URL only**: https://bootstrap-node.onrender.com
- **Auto-discovery**: Everything else discovered dynamically
- **No hardcoded IPs**: Network grows organically
