🚀 Complete System Startup Guide
Step 1: Initial Setup (One-time)
# 1. Install prerequisites
# - Node.js 18+
# - Python 3.8+
# - Docker & Docker Compose
# - Git

# 2. Clone and setup
git clone <your-repo>
cd contracts

# 3. Run automated setup
chmod +x setup.sh
./setup.sh

Copy

Insert

This will:

Install all dependencies
Start IPFS and Geth blockchain
Compile and deploy smart contracts
Run tests to verify everything works
Step 2: Start Infrastructure Services
# Start blockchain and IPFS
npm run start:dev
# OR
docker-compose up -d ipfs geth

# Verify services are running
docker-compose ps

Copy

Insert

Step 3: Start the Node Network
You have multiple options depending on your role:

Option A: Start Bootstrap Node (Network Founder)
# Setup dynamic DNS first (e.g., alice.duckdns.org)
# Configure router port forwarding (30303)

# Start bootstrap node
STATIC_IP=alice.duckdns.org ./start-network.sh bootstrap

Copy

Insert

Option B: Start Worker Node (Compute Provider)
# Auto-detect and start appropriate node type
./start-network.sh worker

# OR use the deployment script
./deploy.sh worker

# OR use one-line installer
./install-worker.sh

Copy

Insert

Option C: Start Mobile Server (For Phone Users)
# Start mobile PWA server
./start-network.sh mobile
# Mobile users can then visit: http://your-ip:8080/mobile

Copy

Insert

Step 4: Configure Resources (Workers)
cd nodes

# Interactive configuration
node configure-resources.js

# Real-time adjustment (while running)
node dynamic-adjuster.js

# Web interface
npm run web-adjust  # Opens http://localhost:8081/web-adjuster.html

Copy

Insert

Step 5: Upload AI Models (Optional)
cd orchestrator

# Upload your first model
python owner_upload.py --model 'microsoft/DialoGPT-small' --model-id 'dialogpt-small' --name 'DialoGPT Small'

# Start orchestrator
python main.py

Copy

Insert

🎯 Quick Start Commands
For Network Pioneers (First Person)
# 1. Setup everything
./setup.sh

# 2. Start infrastructure
npm run start:dev

# 3. Start bootstrap node
STATIC_IP=your-name.duckdns.org ./start-network.sh bootstrap

# 4. Share with friends
echo "Join my network: your-name.duckdns.org:30303"

Copy

Insert

For Network Joiners (Everyone Else)
# 1. One-line join
curl -sSL https://raw.githubusercontent.com/your-org/ai-compute-network/main/install-worker.sh | BOOTSTRAP_NODE=alice.duckdns.org bash

# 2. OR manual join
git clone <repo>
cd contracts
./deploy.sh worker

Copy

Insert

For Mobile Users
# Just visit any bootstrap node's mobile app
# http://alice.duckdns.org/mobile
# Add to home screen when prompted

Copy

Insert

📊 System Status Verification
# Check infrastructure
docker-compose ps

# Check blockchain
curl http://localhost:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Check node network
cd nodes
node discover-bootstrap.js

# Monitor resources
node dynamic-adjuster.js

Copy

Insert

🔧 Management Commands
# Start/stop infrastructure
npm run start        # Start all services
npm run stop         # Stop all services
npm run logs         # View logs

# Node management
./start-network.sh [bootstrap|worker|mobile|auto]

# Resource adjustment
cd nodes
node dynamic-adjuster.js    # CLI
npm run web-adjust          # Web UI

# Model management
npm run models:list         # List models
npm run models:upload       # Upload new model

Copy

Insert

🎯 Recommended Startup Sequence
Infrastructure First: ./setup.sh → npm run start:dev
Bootstrap Node: STATIC_IP=your-domain ./start-network.sh bootstrap
Worker Nodes: ./start-network.sh worker (on other devices)
Mobile Access: Visit http://your-bootstrap-ip/mobile
Resource Tuning: node dynamic-adjuster.js
The system is designed to be modular - you can start with just the infrastructure and bootstrap node, then add workers and mobile clients as the network grows organically.