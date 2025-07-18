# 🧠 AI Compute Network Nodes

Simple setup for your **AI-compute private network** with only **two node roles**:

## 🎯 Node Types

### 1️⃣ Bootstrap/Rendez-vous Node
- **Exactly 1** (or 2 for redundancy)
- **Must have static IP + port 30303 open**
- **Runs a pruned full node** (no mining)
- **Job**: Give every new device a first peer

### 2️⃣ Worker/Compute Nodes  
- **All the rest** (laptops, desktops, phones)
- **No static IP required**
- **Runs either**:
  - A **pruned full node + miner** (CPU/GPU tasks) **or**
  - A **light client** (phones) that signs jobs and talks JSON-RPC to nearby workers
- **Job**: Run AI tasks, seal blocks, keep chain alive

---

## 🚀 Quick Start

### Bootstrap Node (Server)
```bash
# 1. Setup (run once)
chmod +x setup-bootstrap.sh
STATIC_IP=your.server.ip ./setup-bootstrap.sh

# 2. Start bootstrap node
STATIC_IP=your.server.ip node bootstrap/bootstrap-node.js
```

### Worker Node (Desktop/Laptop)
```bash
# 1. Setup (run once)
chmod +x setup-worker.sh
./setup-worker.sh

# 2. Configure resources (optional)
node configure-resources.js

# 3. Start worker node
node worker/worker-node.js

# 4. Adjust resources while running (in another terminal)
node dynamic-adjuster.js
# OR use web interface:
npm run web-adjust  # Opens http://localhost:8081/web-adjuster.html
```

### Mobile Node (Phone) 📱
**Easiest way**: Open browser → `https://your-bootstrap-ip:8080/mobile`

See [mobile/mobile-setup.md](mobile/mobile-setup.md) for detailed instructions.

---

## 📋 Requirements

### Bootstrap Node:
- **Linux/macOS server** with static IP
- **Port 30303** open (firewall + router)
- **Node.js 16+** and **Geth**
- **2GB+ RAM**, **10GB+ storage**

### Worker Node:
- **Any device** (Windows/macOS/Linux)
- **Node.js 16+** (Geth auto-installed)
- **4GB+ RAM** for full node, **1GB+** for light client

### Mobile Node:
- **Any smartphone** (iOS 12+ / Android 8+)
- **Modern browser** (Chrome, Safari, Firefox)
- **100MB free space**

---

## 🔧 Configuration

### Resource Contribution Setup
```bash
# Configure how much of your resources to contribute
node configure-resources.js

# Available presets:
# - conservative: 2% storage, 5% CPU, 10% RAM
# - balanced: 5% storage, 10% CPU, 15% RAM  
# - generous: 10% storage, 20% CPU, 30% RAM
# - mobile: 1% storage, 5% CPU, 5% RAM
```

### Environment Variables
```bash
# Bootstrap node
export STATIC_IP=your.server.ip
export BOOTSTRAP_PORT=30303

# Worker node  
export NODE_TYPE=auto        # auto, full, light
export BOOTSTRAP_NODES=enode://...
export ENABLE_MINING=true
export ENABLE_AI_COMPUTE=true

# Resource contribution (optional - use configure-resources.js instead)
export STORAGE_CONTRIBUTION=5    # 5% of total storage
export CPU_CONTRIBUTION=10       # 10% of CPU cores
export GPU_CONTRIBUTION=10       # 10% of GPU memory
export RAM_CONTRIBUTION=15       # 15% of RAM
```

### Dynamic Resource Adjustment
```bash
# Real-time adjustment while node is running
node dynamic-adjuster.js

# Web-based adjustment interface
npm run web-adjust  # Opens http://localhost:8081/web-adjuster.html

# Quick adjustments:
# 1. Increase CPU contribution
# 2. Decrease CPU contribution  
# 3. Apply presets (conservative/balanced/generous)
# 4. View current usage
# 5. Custom percentages
```

### Auto-Detection
- **Node type**: Automatically detected based on system resources
- **Capabilities**: CPU cores, RAM, GPU availability, storage space
- **Resource allocation**: Configurable percentage-based contribution
- **Real-time adjustment**: Change allocations while node is running
- **Network**: Finds bootstrap nodes automatically

---

## 📊 Monitoring

### Status Check
```bash
# Check if nodes are running
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Check mining status
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}'
```

### Logs
```bash
# View logs
tail -f logs/node.log

# Mobile logs (browser console)
window.mobileNode.logs
```

---

## 🛠️ Troubleshooting

### Bootstrap Node Issues:
- **Port 30303 blocked**: Check firewall and router settings
- **Static IP not accessible**: Verify cloud provider security groups
- **Genesis init failed**: Check genesis.json file exists

### Worker Node Issues:
- **Can't connect to bootstrap**: Check bootstrap node is running
- **Mining not working**: Verify account is unlocked
- **AI compute failed**: Check Python dependencies installed

### Mobile Issues:
- **Won't connect**: Try refreshing page or clearing browser cache
- **No earnings**: Ensure stable internet connection
- **Battery drain**: Enable power saving mode in settings

---

## 🔗 Network Architecture

```
Bootstrap Node (Static IP)
    ↓
Worker Nodes (Dynamic IPs)
    ↓
Mobile Clients (Light)
```

### Peer Discovery:
1. **New nodes** connect to bootstrap first
2. **Bootstrap** provides list of active peers  
3. **Nodes** form mesh network via libp2p
4. **Mobile clients** connect via WebRTC

### Task Flow:
1. **AI task** submitted to network
2. **Smart contract** assigns to available worker
3. **Worker** processes task and submits result
4. **Mobile clients** sign and validate
5. **Rewards** distributed automatically

---

## 📱 Mobile Deep Dive

### Progressive Web App Features:
- **Offline support** via service worker
- **Push notifications** for earnings
- **Background sync** when possible
- **Add to home screen** for native feel

### Light Client Capabilities:
- **Sign transactions** for AI tasks
- **Validate results** from workers
- **Earn tokens** for participation
- **Minimal battery usage**

### WebRTC P2P:
- **Direct connection** to nearby workers
- **No central server** required
- **NAT traversal** automatic
- **Encrypted communication**

---

## 🎯 Next Steps

1. **Start bootstrap node** on your server
2. **Connect worker nodes** from laptops/desktops  
3. **Share mobile link** with users
4. **Monitor network** via dashboard
5. **Scale up** by adding more workers

**Questions?** Check the troubleshooting section or open an issue!