#!/bin/bash

# Local Worker Node Setup Script
# For the existing Python-based AI inference system

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }
header() { echo -e "${BLUE}$1${NC}"; }

header "🧠 AI Compute Network - Local Worker Setup"
header "============================================"

# Check if we're in the right directory
if [[ ! -f "orchestrator/main.py" ]]; then
    error "Please run this script from the contracts directory"
fi

# Check Python environment
if [[ ! -d "venv" ]]; then
    warn "Virtual environment not found. Creating one..."
    python3 -m venv venv
fi

log "Activating virtual environment..."
source venv/bin/activate

# Check if dependencies are installed
log "Checking Python dependencies..."
if ! python3 -c "import torch, vllm, web3" 2>/dev/null; then
    warn "Dependencies not fully installed. Installing..."
    pip install -r orchestrator/requirements.txt
fi

# Check if blockchain is running
log "Checking blockchain connection..."
if curl -s --connect-timeout 5 http://localhost:8545 >/dev/null; then
    log "✅ Blockchain node is running"
else
    warn "⚠️  Blockchain node not running. Starting it..."
    
    # Start blockchain in background
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose up -d geth ipfs
        log "Started blockchain and IPFS with Docker"
        
        # Wait for services to be ready
        log "Waiting for services to start..."
        sleep 10
        
        # Deploy contracts if needed
        if [[ ! -f "deployment.json" ]]; then
            log "Deploying smart contracts..."
            npx hardhat run scripts/deploy.js --network localhost
        fi
    else
        error "Docker Compose not found. Please install Docker or start blockchain manually."
    fi
fi

# Check if contracts are deployed
if [[ ! -f "deployment.json" ]]; then
    log "Deploying smart contracts..."
    npx hardhat run scripts/deploy.js --network localhost
fi

# Get bootstrap IP
BOOTSTRAP_IP="${BOOTSTRAP_IP:-localhost}"
if [[ "$BOOTSTRAP_IP" == "localhost" ]]; then
    echo ""
    echo "Enter bootstrap node IP address (or press Enter for localhost):"
    read -p "Bootstrap IP [localhost]: " input_ip
    BOOTSTRAP_IP="${input_ip:-localhost}"
fi

log "Bootstrap IP: $BOOTSTRAP_IP"

# Configure worker settings
log "Configuring worker node..."

# Create worker configuration
cat > worker-config.json << EOF
{
  "bootstrap_ip": "$BOOTSTRAP_IP",
  "eth_node_url": "http://$BOOTSTRAP_IP:8545",
  "ipfs_host": "$BOOTSTRAP_IP",
  "ipfs_port": 5001,
  "worker_type": "compute",
  "resources": {
    "cpu_contribution": 10,
    "ram_contribution": 15,
    "gpu_contribution": 10,
    "storage_contribution": 5
  },
  "created_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Resource configuration
echo ""
echo "Choose your resource contribution level:"
echo "1. Conservative (5% CPU, 10% RAM, 5% GPU, 2% Storage)"
echo "2. Balanced (10% CPU, 15% RAM, 10% GPU, 5% Storage) [Recommended]"
echo "3. Generous (20% CPU, 30% RAM, 25% GPU, 10% Storage)"
echo "4. Custom configuration"

read -p "Enter choice (1-4) [2]: " choice
choice=${choice:-2}

case $choice in
    1)
        CPU=5; RAM=10; GPU=5; STORAGE=2
        PRESET="conservative"
        ;;
    2)
        CPU=10; RAM=15; GPU=10; STORAGE=5
        PRESET="balanced"
        ;;
    3)
        CPU=20; RAM=30; GPU=25; STORAGE=10
        PRESET="generous"
        ;;
    4)
        echo "Enter custom resource allocation percentages:"
        read -p "CPU contribution (1-50%) [10]: " CPU
        read -p "RAM contribution (1-50%) [15]: " RAM
        read -p "GPU contribution (1-50%) [10]: " GPU
        read -p "Storage contribution (1-20%) [5]: " STORAGE
        CPU=${CPU:-10}; RAM=${RAM:-15}; GPU=${GPU:-10}; STORAGE=${STORAGE:-5}
        PRESET="custom"
        ;;
    *)
        warn "Invalid choice, using balanced preset"
        CPU=10; RAM=15; GPU=10; STORAGE=5
        PRESET="balanced"
        ;;
esac

# Update configuration with chosen resources
python3 -c "
import json
with open('worker-config.json', 'r') as f:
    config = json.load(f)
config['resources'] = {
    'cpu_contribution': $CPU,
    'ram_contribution': $RAM,
    'gpu_contribution': $GPU,
    'storage_contribution': $STORAGE
}
config['preset'] = '$PRESET'
with open('worker-config.json', 'w') as f:
    json.dump(config, f, indent=2)
"

log "Applied $PRESET preset (CPU: ${CPU}%, RAM: ${RAM}%, GPU: ${GPU}%, Storage: ${STORAGE}%)"

# Create startup script
log "Creating startup script..."
cat > start-worker-node.sh << 'EOF'
#!/bin/bash

# AI Worker Node Startup Script
cd "$(dirname "$0")"

echo "🚀 Starting AI Compute Worker Node..."
echo "======================================"

# Activate virtual environment
if [[ -d "venv" ]]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
fi

# Show configuration
if [[ -f "worker-config.json" ]]; then
    echo "📊 Resource allocation:"
    python3 -c "
import json
try:
    with open('worker-config.json', 'r') as f:
        config = json.load(f)
    resources = config.get('resources', {})
    print(f'   CPU: {resources.get(\"cpu_contribution\", \"N/A\")}%')
    print(f'   RAM: {resources.get(\"ram_contribution\", \"N/A\")}%')
    print(f'   GPU: {resources.get(\"gpu_contribution\", \"N/A\")}%')
    print(f'   Storage: {resources.get(\"storage_contribution\", \"N/A\")}%')
    print(f'   Bootstrap: {config.get(\"bootstrap_ip\", \"localhost\")}')
except:
    print('   Configuration not found')
"
fi

echo ""
echo "💡 Monitor with: htop (system resources)"
echo "🔗 Check blockchain: curl http://localhost:8545"
echo "📊 View logs in real-time"
echo ""

# Start the worker node
echo "🎯 Starting worker node..."
python3 orchestrator/main.py
EOF

chmod +x start-worker-node.sh

# Create systemd service (optional)
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo ""
    read -p "Create system service for auto-start? (y/N): " create_service
    
    if [[ "$create_service" =~ ^[Yy]$ ]]; then
        log "Creating systemd service..."
        
        sudo tee /etc/systemd/system/ai-worker-node.service > /dev/null <<EOF
[Unit]
Description=AI Compute Worker Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/start-worker-node.sh
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-worker-node

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable ai-worker-node
        
        log "✅ System service created!"
        log "Control with:"
        log "  sudo systemctl start ai-worker-node    # Start"
        log "  sudo systemctl stop ai-worker-node     # Stop"
        log "  sudo systemctl status ai-worker-node   # Status"
        log "  sudo journalctl -u ai-worker-node -f   # Logs"
    fi
fi

# Test connection
log "Testing connections..."

# Test blockchain
if curl -s --connect-timeout 5 http://$BOOTSTRAP_IP:8545 >/dev/null; then
    log "✅ Blockchain connection: OK"
else
    warn "⚠️  Blockchain connection: FAILED"
fi

# Test IPFS
if curl -s --connect-timeout 5 http://$BOOTSTRAP_IP:5001/api/v0/id >/dev/null; then
    log "✅ IPFS connection: OK"
else
    warn "⚠️  IPFS connection: FAILED"
fi

# Installation complete
header ""
header "✅ Worker Node Setup Complete!"
header "=============================="

echo ""
log "📋 Configuration Summary:"
log "  Bootstrap IP: $BOOTSTRAP_IP"
log "  Resource preset: $PRESET"
log "  CPU contribution: ${CPU}%"
log "  RAM contribution: ${RAM}%"
log "  GPU contribution: ${GPU}%"
log "  Storage contribution: ${STORAGE}%"

echo ""
log "🚀 Start your worker node:"
log "  ./start-worker-node.sh"

if [[ "$create_service" =~ ^[Yy]$ ]]; then
    log "  OR: sudo systemctl start ai-worker-node"
fi

echo ""
log "📊 Monitor your node:"
log "  htop                              # System resources"
log "  ./start-worker-node.sh            # View logs"

echo ""
log "🔧 Useful commands:"
log "  curl http://$BOOTSTRAP_IP:8545 -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"eth_blockNumber\",\"params\":[],\"id\":1}'"
log "  python3 orchestrator/simple_test.py  # Run tests"

echo ""
read -p "Start the worker node now? (y/N): " start_now

if [[ "$start_now" =~ ^[Yy]$ ]]; then
    log "🚀 Starting worker node..."
    ./start-worker-node.sh
else
    log "Worker node ready! Start with: ./start-worker-node.sh"
fi