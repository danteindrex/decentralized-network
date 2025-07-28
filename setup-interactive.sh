#!/bin/bash

# Decentralized AI Inference Network - Node Setup Script
# Allows setting up different node types individually

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }
header() { echo -e "${BLUE}$1${NC}"; }
success() { echo -e "${GREEN}$1${NC}"; }

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/node-setup.conf"

# Load or create configuration
load_config() {
    if [[ -f "$CONFIG_FILE" ]]; then
        source "$CONFIG_FILE"
    else
        # Default configuration
        NETWORK_NAME="AI-Inference-Network"
        CHAIN_ID="1337"
        BOOTSTRAP_IP="localhost"
        BASE_PORT="8545"
        IPFS_PORT="5001"
        P2P_PORT="30303"
    fi
}

# Save configuration
save_config() {
    cat > "$CONFIG_FILE" << EOF
# Node Setup Configuration
NETWORK_NAME="$NETWORK_NAME"
CHAIN_ID="$CHAIN_ID"
BOOTSTRAP_IP="$BOOTSTRAP_IP"
BASE_PORT="$BASE_PORT"
IPFS_PORT="$IPFS_PORT"
P2P_PORT="$P2P_PORT"
LAST_UPDATED="$(date)"
EOF
}

# Check prerequisites
check_prerequisites() {
    log "Checking prerequisites..."
    
    # Check if we're in the right directory
    if [[ ! -f "orchestrator/main.py" ]]; then
        error "Please run this script from the contracts directory"
    fi
    
    # Check Python
    if ! command -v python3 >/dev/null 2>&1; then
        error "Python3 is required but not installed"
    fi
    
    # Check Node.js
    if ! command -v node >/dev/null 2>&1; then
        warn "Node.js not found. Some features may not work."
    fi
    
    # Check Docker (optional)
    if ! command -v docker >/dev/null 2>&1; then
        warn "Docker not found. Will use local setup."
        USE_DOCKER=false
    else
        USE_DOCKER=true
    fi
    
    success "✅ Prerequisites checked"
}

# Show main menu
show_menu() {
    clear
    header "🌐 Decentralized AI Inference Network"
    header "====================================="
    echo ""
    echo -e "${CYAN}Choose the type of node to set up:${NC}"
    echo ""
    echo "1. 🌟 Bootstrap Node    - Network coordinator and founder"
    echo "2. 💪 Worker Node       - AI compute provider (earn tokens)"
    echo "3. 🧠 Model Owner Node  - Upload and manage AI models"
    echo "4. 👤 User Interface    - Submit inference requests"
    echo "5. 🔧 Infrastructure    - Blockchain + IPFS only"
    echo "6. 📊 Full Network      - All nodes together (testing)"
    echo ""
    echo "7. ⚙️  Configure Network Settings"
    echo "8. 📋 Show Node Status"
    echo "9. 🛑 Stop All Nodes"
    echo "0. ❌ Exit"
    echo ""
    
    if [[ -f "$CONFIG_FILE" ]]; then
        echo -e "${YELLOW}Current Network: $NETWORK_NAME (Bootstrap: $BOOTSTRAP_IP)${NC}"
        echo ""
    fi
}

# Configure network settings
configure_network() {
    header "⚙️  Network Configuration"
    header "========================"
    echo ""
    
    echo "Current settings:"
    echo "  Network Name: $NETWORK_NAME"
    echo "  Chain ID: $CHAIN_ID"
    echo "  Bootstrap IP: $BOOTSTRAP_IP"
    echo "  Base Port: $BASE_PORT"
    echo ""
    
    read -p "Network Name [$NETWORK_NAME]: " input
    NETWORK_NAME="${input:-$NETWORK_NAME}"
    
    read -p "Chain ID [$CHAIN_ID]: " input
    CHAIN_ID="${input:-$CHAIN_ID}"
    
    read -p "Bootstrap IP [$BOOTSTRAP_IP]: " input
    BOOTSTRAP_IP="${input:-$BOOTSTRAP_IP}"
    
    read -p "Base Port [$BASE_PORT]: " input
    BASE_PORT="${input:-$BASE_PORT}"
    
    save_config
    success "✅ Network configuration saved"
    read -p "Press Enter to continue..."
}

# Setup Bootstrap Node
setup_bootstrap() {
    header "🌟 Setting up Bootstrap Node"
    header "============================"
    echo ""
    
    log "Bootstrap nodes coordinate the network and provide infrastructure"
    echo ""
    
    # Get network settings
    read -p "External IP address (for other nodes to connect) [$BOOTSTRAP_IP]: " input
    BOOTSTRAP_IP="${input:-$BOOTSTRAP_IP}"
    
    read -p "Enable mobile PWA interface? (y/N): " enable_mobile
    
    log "Setting up environment..."
    
    # Create bootstrap environment
    cat > .env.bootstrap << EOF
# Bootstrap Node Configuration
NODE_TYPE=bootstrap
NETWORK_NAME=$NETWORK_NAME
CHAIN_ID=$CHAIN_ID

# Network settings
BOOTSTRAP_IP=$BOOTSTRAP_IP
STATIC_IP=$BOOTSTRAP_IP
P2P_PORT=$P2P_PORT

# Blockchain
ETH_NODE_URL=http://localhost:$BASE_PORT
BOOTSTRAP_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
BOOTSTRAP_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# IPFS
IPFS_HOST=127.0.0.1
IPFS_PORT=$IPFS_PORT

# Services
ENABLE_MOBILE=${enable_mobile:-n}
EOF
    
    # Create startup script
    cat > start-bootstrap.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🌟 Starting Bootstrap Node..."
echo "============================="

# Load configuration
if [[ -f ".env.bootstrap" ]]; then
    source .env.bootstrap
    echo "📋 Network: $NETWORK_NAME"
    echo "🌐 Bootstrap IP: $BOOTSTRAP_IP"
    echo "⛓️  Chain ID: $CHAIN_ID"
    echo ""
fi

# Start infrastructure
echo "🚀 Starting blockchain and IPFS..."
if command -v docker-compose >/dev/null 2>&1; then
    docker-compose up -d geth ipfs
    
    echo "⏳ Waiting for services to start..."
    sleep 15
    
    # Deploy contracts
    if [[ ! -f "deployment.json" ]]; then
        echo "📄 Deploying smart contracts..."
        npx hardhat run scripts/deploy.js --network localhost
    fi
    
    echo "✅ Infrastructure ready!"
    echo ""
    echo "🔗 Blockchain RPC: http://$BOOTSTRAP_IP:8545"
    echo "📁 IPFS Gateway: http://$BOOTSTRAP_IP:8080"
    
    if [[ "$ENABLE_MOBILE" =~ ^[Yy]$ ]]; then
        echo "📱 Mobile PWA: http://$BOOTSTRAP_IP:8080/mobile"
    fi
    
    echo ""
    echo "📋 For other nodes to connect, use Bootstrap IP: $BOOTSTRAP_IP"
    echo ""
    echo "Press Ctrl+C to stop..."
    
    # Keep running
    docker-compose logs -f geth ipfs
else
    echo "❌ Docker not available. Please install Docker first."
    exit 1
fi
EOF
    
    chmod +x start-bootstrap.sh
    save_config
    
    success "✅ Bootstrap node configured!"
    echo ""
    echo "🚀 Start with: ./start-bootstrap.sh"
    echo "🔗 Other nodes can connect to: $BOOTSTRAP_IP"
    echo ""
    read -p "Start bootstrap node now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-bootstrap.sh
    fi
}

# Setup Worker Node
setup_worker() {
    header "💪 Setting up Worker Node"
    header "========================="
    echo ""
    
    log "Worker nodes provide AI compute resources and earn tokens"
    echo ""
    
    # Get bootstrap connection
    read -p "Bootstrap node IP [$BOOTSTRAP_IP]: " input
    BOOTSTRAP_IP="${input:-$BOOTSTRAP_IP}"
    
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
        1) CPU=5; RAM=10; GPU=5; STORAGE=2; PRESET="conservative" ;;
        2) CPU=10; RAM=15; GPU=10; STORAGE=5; PRESET="balanced" ;;
        3) CPU=20; RAM=30; GPU=25; STORAGE=10; PRESET="generous" ;;
        4)
            echo "Enter custom resource allocation percentages:"
            read -p "CPU contribution (1-50%) [10]: " CPU
            read -p "RAM contribution (1-50%) [15]: " RAM
            read -p "GPU contribution (1-50%) [10]: " GPU
            read -p "Storage contribution (1-20%) [5]: " STORAGE
            CPU=${CPU:-10}; RAM=${RAM:-15}; GPU=${GPU:-10}; STORAGE=${STORAGE:-5}
            PRESET="custom"
            ;;
        *) CPU=10; RAM=15; GPU=10; STORAGE=5; PRESET="balanced" ;;
    esac
    
    log "Setting up environment..."
    
    # Create worker environment
    cat > .env.worker << EOF
# Worker Node Configuration
NODE_TYPE=worker
NETWORK_NAME=$NETWORK_NAME

# Bootstrap connection
BOOTSTRAP_NODE=$BOOTSTRAP_IP:$P2P_PORT
ETH_NODE_URL=http://$BOOTSTRAP_IP:$BASE_PORT
IPFS_HOST=$BOOTSTRAP_IP
IPFS_PORT=$IPFS_PORT

# Worker wallet (generate new one for production!)
WORKER_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d
WORKER_ACCOUNT=0x70997970C51812dc3A010C7d01b50e0d17dc79C8

# Resource allocation
CPU_CONTRIBUTION=$CPU
RAM_CONTRIBUTION=$RAM
GPU_CONTRIBUTION=$GPU
STORAGE_CONTRIBUTION=$STORAGE
PRESET=$PRESET
EOF
    
    # Create startup script
    cat > start-worker.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "💪 Starting Worker Node..."
echo "=========================="

# Load configuration
if [[ -f ".env.worker" ]]; then
    source .env.worker
    echo "📋 Network: $NETWORK_NAME"
    echo "🔗 Bootstrap: $BOOTSTRAP_NODE"
    echo "📊 Resource preset: $PRESET"
    echo "   CPU: ${CPU_CONTRIBUTION}%"
    echo "   RAM: ${RAM_CONTRIBUTION}%"
    echo "   GPU: ${GPU_CONTRIBUTION}%"
    echo "   Storage: ${STORAGE_CONTRIBUTION}%"
    echo ""
fi

# Activate virtual environment
if [[ -d "venv" ]]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
else
    echo "⚠️  Virtual environment not found. Creating..."
    python3 -m venv venv
    source venv/bin/activate
    pip install -r orchestrator/requirements.txt
fi

# Test connections
echo "🔍 Testing connections..."
if curl -s --connect-timeout 5 http://$BOOTSTRAP_IP:$BASE_PORT >/dev/null; then
    echo "✅ Blockchain connection: OK"
else
    echo "❌ Blockchain connection: FAILED"
    echo "Make sure bootstrap node is running at $BOOTSTRAP_IP"
    exit 1
fi

echo ""
echo "🎯 Starting AI worker node..."
echo "💡 Monitor with: htop (system resources)"
echo "📊 View logs in real-time below"
echo ""

# Start worker
python3 orchestrator/main.py
EOF
    
    chmod +x start-worker.sh
    
    success "✅ Worker node configured!"
    echo ""
    echo "🚀 Start with: ./start-worker.sh"
    echo "📊 Resource contribution: $PRESET ($CPU% CPU, $RAM% RAM, $GPU% GPU, $STORAGE% Storage)"
    echo ""
    read -p "Start worker node now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-worker.sh
    fi
}

# Setup Model Owner Node
setup_owner() {
    header "🧠 Setting up Model Owner Node"
    header "=============================="
    echo ""
    
    log "Model owner nodes upload and manage AI models, earning royalties"
    echo ""
    
    read -p "Bootstrap node IP [$BOOTSTRAP_IP]: " input
    BOOTSTRAP_IP="${input:-$BOOTSTRAP_IP}"
    
    read -p "Models directory path [./models]: " models_dir
    models_dir="${models_dir:-./models}"
    
    log "Setting up environment..."
    
    # Create models directory
    mkdir -p "$models_dir"
    
    # Create owner environment
    cat > .env.owner << EOF
# Model Owner Configuration
NODE_TYPE=owner
NETWORK_NAME=$NETWORK_NAME

# Bootstrap connection
ETH_NODE_URL=http://$BOOTSTRAP_IP:$BASE_PORT
IPFS_HOST=$BOOTSTRAP_IP
IPFS_PORT=$IPFS_PORT

# Owner wallet (should have ETH for gas fees!)
OWNER_PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
OWNER_ACCOUNT=0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266

# Model settings
MODELS_DIR=$models_dir
MAX_MODEL_SIZE=10GB
EOF
    
    # Create startup script
    cat > start-owner.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🧠 Starting Model Owner Node..."
echo "==============================="

# Load configuration
if [[ -f ".env.owner" ]]; then
    source .env.owner
    echo "📋 Network: $NETWORK_NAME"
    echo "🔗 Bootstrap: $ETH_NODE_URL"
    echo "📁 Models directory: $MODELS_DIR"
    echo ""
fi

# Activate virtual environment
if [[ -d "venv" ]]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
fi

# Test connection
echo "🔍 Testing blockchain connection..."
if curl -s --connect-timeout 5 $ETH_NODE_URL >/dev/null; then
    echo "✅ Blockchain connection: OK"
else
    echo "❌ Blockchain connection: FAILED"
    exit 1
fi

echo ""
echo "🚀 Starting model owner API server..."
echo "🌐 Web interface will be available at: http://localhost:8002"
echo "📁 Upload models via web interface or API"
echo ""

# Start owner API
python3 scripts/owner_api.py
EOF
    
    chmod +x start-owner.sh
    
    success "✅ Model owner node configured!"
    echo ""
    echo "🚀 Start with: ./start-owner.sh"
    echo "🌐 Web interface: http://localhost:8002"
    echo "📁 Models directory: $models_dir"
    echo ""
    read -p "Start model owner node now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-owner.sh
    fi
}

# Setup User Interface
setup_user() {
    header "👤 Setting up User Interface"
    header "============================"
    echo ""
    
    log "User interface for submitting inference requests and viewing results"
    echo ""
    
    read -p "Bootstrap node IP [$BOOTSTRAP_IP]: " input
    BOOTSTRAP_IP="${input:-$BOOTSTRAP_IP}"
    
    log "Setting up environment..."
    
    # Create user environment
    cat > .env.user << EOF
# User Interface Configuration
NODE_TYPE=user
NETWORK_NAME=$NETWORK_NAME

# Bootstrap connection
ETH_NODE_URL=http://$BOOTSTRAP_IP:$BASE_PORT
IPFS_HOST=$BOOTSTRAP_IP
IPFS_PORT=$IPFS_PORT

# User wallet (needs ETH to pay for inference)
USER_PRIVATE_KEY=0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a
USER_ACCOUNT=0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC
EOF
    
    # Create startup script
    cat > start-user.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "👤 Starting User Interface..."
echo "============================="

# Load configuration
if [[ -f ".env.user" ]]; then
    source .env.user
    echo "📋 Network: $NETWORK_NAME"
    echo "🔗 Bootstrap: $ETH_NODE_URL"
    echo ""
fi

# Activate virtual environment
if [[ -d "venv" ]]; then
    source venv/bin/activate
    echo "✅ Virtual environment activated"
fi

# Install streamlit if needed
if ! python3 -c "import streamlit" 2>/dev/null; then
    echo "📦 Installing Streamlit..."
    pip install streamlit
fi

# Test connection
echo "🔍 Testing blockchain connection..."
if curl -s --connect-timeout 5 $ETH_NODE_URL >/dev/null; then
    echo "✅ Blockchain connection: OK"
else
    echo "❌ Blockchain connection: FAILED"
    exit 1
fi

echo ""
echo "🚀 Starting user interface..."
echo "🌐 Web interface will be available at: http://localhost:8501"
echo "💰 Make sure your wallet has ETH to pay for inference"
echo ""

# Start Streamlit app
streamlit run streamlit_app.py --server.port 8501
EOF
    
    chmod +x start-user.sh
    
    success "✅ User interface configured!"
    echo ""
    echo "🚀 Start with: ./start-user.sh"
    echo "🌐 Web interface: http://localhost:8501"
    echo ""
    read -p "Start user interface now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-user.sh
    fi
}

# Setup Infrastructure Only
setup_infrastructure() {
    header "🔧 Setting up Infrastructure"
    header "============================"
    echo ""
    
    log "Setting up blockchain and IPFS infrastructure only"
    echo ""
    
    # Create startup script
    cat > start-infrastructure.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "🔧 Starting Infrastructure..."
echo "============================="

if command -v docker-compose >/dev/null 2>&1; then
    echo "🚀 Starting blockchain and IPFS..."
    docker-compose up -d geth ipfs
    
    echo "⏳ Waiting for services..."
    sleep 15
    
    # Deploy contracts
    if [[ ! -f "deployment.json" ]]; then
        echo "📄 Deploying smart contracts..."
        npx hardhat run scripts/deploy.js --network localhost
    fi
    
    echo ""
    echo "✅ Infrastructure ready!"
    echo "🔗 Blockchain RPC: http://localhost:8545"
    echo "📁 IPFS Gateway: http://localhost:8080"
    echo "📄 Smart contracts deployed"
    echo ""
    echo "Press Ctrl+C to stop..."
    
    # Show logs
    docker-compose logs -f geth ipfs
else
    echo "❌ Docker not available. Please install Docker first."
    exit 1
fi
EOF
    
    chmod +x start-infrastructure.sh
    
    success "✅ Infrastructure configured!"
    echo ""
    echo "🚀 Start with: ./start-infrastructure.sh"
    echo ""
    read -p "Start infrastructure now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-infrastructure.sh
    fi
}

# Setup Full Network
setup_full() {
    header "📊 Setting up Full Network"
    header "=========================="
    echo ""
    
    warn "This will start ALL node types together (for testing only)"
    echo ""
    read -p "Continue? (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        return
    fi
    
    log "Setting up full network..."
    
    # Create full network startup script
    cat > start-full-network.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"

echo "📊 Starting Full Network..."
echo "=========================="

if command -v docker-compose >/dev/null 2>&1; then
    echo "🚀 Starting all services..."
    docker-compose --profile full up -d
    
    echo "⏳ Waiting for services..."
    sleep 30
    
    echo ""
    echo "✅ Full network started!"
    echo "🌐 Services available:"
    echo "  • Blockchain RPC: http://localhost:8545"
    echo "  • IPFS Gateway: http://localhost:8080"
    echo "  • User Interface: http://localhost:8501"
    echo "  • Model Owner API: http://localhost:8002"
    echo "  • Worker Node: Running in background"
    echo ""
    echo "📊 Monitor with: docker-compose ps"
    echo "🛑 Stop with: docker-compose down"
    echo ""
    
    # Show status
    docker-compose ps
else
    echo "❌ Docker not available. Please install Docker first."
    exit 1
fi
EOF
    
    chmod +x start-full-network.sh
    
    success "✅ Full network configured!"
    echo ""
    echo "🚀 Start with: ./start-full-network.sh"
    echo ""
    read -p "Start full network now? (y/N): " start_now
    
    if [[ "$start_now" =~ ^[Yy]$ ]]; then
        ./start-full-network.sh
    fi
}

# Show node status
show_status() {
    header "📋 Node Status"
    header "=============="
    echo ""
    
    # Check running processes
    echo "🔍 Checking running services..."
    echo ""
    
    # Docker services
    if command -v docker-compose >/dev/null 2>&1; then
        echo "Docker services:"
        docker-compose ps 2>/dev/null || echo "  No Docker services running"
        echo ""
    fi
    
    # Check ports
    echo "Port status:"
    for port in 8545 5001 8080 8501 8002; do
        if netstat -tuln 2>/dev/null | grep -q ":$port "; then
            echo "  ✅ Port $port: In use"
        else
            echo "  ❌ Port $port: Available"
        fi
    done
    echo ""
    
    # Check configuration
    if [[ -f "$CONFIG_FILE" ]]; then
        echo "Network configuration:"
        echo "  Network: $NETWORK_NAME"
        echo "  Bootstrap IP: $BOOTSTRAP_IP"
        echo "  Chain ID: $CHAIN_ID"
    else
        echo "⚠️  No network configuration found"
    fi
    
    echo ""
    read -p "Press Enter to continue..."
}

# Stop all nodes
stop_all() {
    header "🛑 Stopping All Nodes"
    header "===================="
    echo ""
    
    warn "This will stop all running services"
    read -p "Continue? (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        return
    fi
    
    log "Stopping services..."
    
    # Stop Docker services
    if command -v docker-compose >/dev/null 2>&1; then
        docker-compose down 2>/dev/null || true
        log "Docker services stopped"
    fi
    
    # Kill Python processes
    pkill -f "python3 orchestrator/main.py" 2>/dev/null || true
    pkill -f "python3 scripts/owner_api.py" 2>/dev/null || true
    pkill -f "streamlit run" 2>/dev/null || true
    
    success "✅ All services stopped"
    read -p "Press Enter to continue..."
}

# Main execution
main() {
    load_config
    check_prerequisites
    
    while true; do
        show_menu
        read -p "Enter your choice (0-9): " choice
        
        case $choice in
            1) setup_bootstrap ;;
            2) setup_worker ;;
            3) setup_owner ;;
            4) setup_user ;;
            5) setup_infrastructure ;;
            6) setup_full ;;
            7) configure_network ;;
            8) show_status ;;
            9) stop_all ;;
            0) 
                echo ""
                success "👋 Thanks for using the AI Inference Network!"
                exit 0
                ;;
            *)
                warn "Invalid choice. Please try again."
                sleep 2
                ;;
        esac
    done
}

# Run main function
main "$@"