#!/bin/bash

# AI Compute Worker Node - One-Click Installer
# Usage: curl -sSL https://your-domain.com/install-worker.sh | bash

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[INFO] $1${NC}"; }
warn() { echo -e "${YELLOW}[WARN] $1${NC}"; }
error() { echo -e "${RED}[ERROR] $1${NC}"; exit 1; }

# Configuration
REPO_URL="https://github.com/your-org/ai-compute-network.git"
BOOTSTRAP_IP="${BOOTSTRAP_IP:-}"

log "🧠 AI Compute Network - Worker Node Installer"
log "=============================================="

# Detect OS
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    OS="linux"
    if command -v apt-get >/dev/null 2>&1; then
        DISTRO="debian"
    elif command -v yum >/dev/null 2>&1; then
        DISTRO="redhat"
    fi
elif [[ "$OSTYPE" == "darwin"* ]]; then
    OS="macos"
else
    error "Unsupported OS: $OSTYPE"
fi

log "Detected: $OS ($DISTRO)"

# Get bootstrap IP if not provided
if [[ -z "$BOOTSTRAP_IP" ]]; then
    echo ""
    echo "Please enter your bootstrap node IP address:"
    echo "(This was provided when you set up your bootstrap node)"
    read -p "Bootstrap IP: " BOOTSTRAP_IP
    
    if [[ -z "$BOOTSTRAP_IP" ]]; then
        error "Bootstrap IP is required"
    fi
fi

log "Bootstrap IP: $BOOTSTRAP_IP"

# Install dependencies
log "Installing dependencies..."

case $OS in
    "linux")
        case $DISTRO in
            "debian")
                sudo apt update
                sudo apt install -y curl wget git
                
                # Node.js
                if ! command -v node >/dev/null 2>&1; then
                    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                fi
                
                # Geth
                if ! command -v geth >/dev/null 2>&1; then
                    sudo add-apt-repository -y ppa:ethereum/ethereum
                    sudo apt-get update
                    sudo apt-get install -y ethereum
                fi
                ;;
            "redhat")
                sudo yum update -y
                sudo yum install -y curl wget git
                
                # Node.js
                if ! command -v node >/dev/null 2>&1; then
                    curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                    sudo yum install -y nodejs
                fi
                
                # Geth (manual install)
                if ! command -v geth >/dev/null 2>&1; then
                    wget https://gethstore.blob.core.windows.net/builds/geth-linux-amd64-1.13.5-916d6a44.tar.gz
                    tar -xzf geth-linux-amd64-1.13.5-916d6a44.tar.gz
                    sudo cp geth-linux-amd64-1.13.5-916d6a44/geth /usr/local/bin/
                    rm -rf geth-linux-amd64-1.13.5-916d6a44*
                fi
                ;;
        esac
        ;;
    "macos")
        # Install Homebrew if not present
        if ! command -v brew >/dev/null 2>&1; then
            log "Installing Homebrew..."
            /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
        fi
        
        brew install node git ethereum
        ;;
esac

# Clone project
log "Downloading AI Compute Network..."
if [[ -d "ai-compute-network" ]]; then
    rm -rf ai-compute-network
fi

git clone $REPO_URL
cd ai-compute-network/nodes

# Install npm dependencies
log "Installing Node.js dependencies..."
npm install

# Setup worker node
log "Setting up worker node..."
chmod +x setup-worker.sh
./setup-worker.sh

# Update bootstrap info
log "Configuring bootstrap connection..."
cat > bootstrap-info.json << EOF
{
  "enode": "enode://placeholder@$BOOTSTRAP_IP:30303",
  "staticIP": "$BOOTSTRAP_IP",
  "port": 30303,
  "rpcPort": 8545,
  "wsPort": 8546,
  "chainId": 1337,
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# Configure resources
log "Configuring resource allocation..."
echo ""
echo "Choose your contribution level:"
echo "1. Conservative (5% CPU, 10% RAM, 2% Storage)"
echo "2. Balanced (10% CPU, 15% RAM, 5% Storage) [Recommended]"
echo "3. Generous (20% CPU, 30% RAM, 10% Storage)"
echo "4. Custom configuration"

read -p "Enter choice (1-4) [2]: " choice
choice=${choice:-2}

case $choice in
    1)
        PRESET="conservative"
        ;;
    2)
        PRESET="balanced"
        ;;
    3)
        PRESET="generous"
        ;;
    4)
        log "Starting interactive configuration..."
        node configure-resources.js
        PRESET="custom"
        ;;
    *)
        warn "Invalid choice, using balanced preset"
        PRESET="balanced"
        ;;
esac

if [[ "$PRESET" != "custom" ]]; then
    # Apply preset automatically
    cat > user-resource-config.json << EOF
{
  "preset": "$PRESET",
  "storageContribution": $(case $PRESET in conservative) echo 2;; balanced) echo 5;; generous) echo 10;; esac),
  "cpuContribution": $(case $PRESET in conservative) echo 5;; balanced) echo 10;; generous) echo 20;; esac),
  "gpuContribution": $(case $PRESET in conservative) echo 5;; balanced) echo 10;; generous) echo 25;; esac),
  "ramContribution": $(case $PRESET in conservative) echo 10;; balanced) echo 15;; generous) echo 30;; esac),
  "appliedAt": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF
    log "Applied $PRESET preset"
fi

# Create startup script
log "Creating startup script..."
cat > start-worker.sh << 'EOF'
#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 Starting AI Compute Worker Node..."
echo "📊 Resource allocation:"
if [[ -f "user-resource-config.json" ]]; then
    node -e "
    const config = require('./user-resource-config.json');
    console.log('   CPU:', config.cpuContribution + '%');
    console.log('   RAM:', config.ramContribution + '%');
    console.log('   Storage:', config.storageContribution + '%');
    console.log('   GPU:', config.gpuContribution + '%');
    "
fi
echo ""
echo "💡 Adjust resources anytime with: node dynamic-adjuster.js"
echo "🌐 Web interface: npm run web-adjust"
echo ""
node worker/worker-node.js
EOF

chmod +x start-worker.sh

# Create systemd service (Linux only)
if [[ "$OS" == "linux" ]]; then
    log "Creating system service..."
    
    sudo tee /etc/systemd/system/ai-worker.service > /dev/null <<EOF
[Unit]
Description=AI Compute Worker Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(pwd)/start-worker.sh
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-worker

[Install]
WantedBy=multi-user.target
EOF
    
    sudo systemctl daemon-reload
    sudo systemctl enable ai-worker
    
    log "Service created. Control with:"
    log "  sudo systemctl start ai-worker    # Start"
    log "  sudo systemctl stop ai-worker     # Stop"
    log "  sudo systemctl status ai-worker   # Status"
    log "  sudo journalctl -u ai-worker -f   # Logs"
fi

# Test connection to bootstrap
log "Testing connection to bootstrap node..."
if curl -s --connect-timeout 5 http://$BOOTSTRAP_IP:8545 >/dev/null; then
    log "✅ Bootstrap node is reachable"
else
    warn "⚠️  Could not reach bootstrap node at $BOOTSTRAP_IP:8545"
    warn "Make sure the bootstrap node is running and accessible"
fi

# Installation complete
log ""
log "✅ Installation completed successfully!"
log ""
log "📋 Summary:"
log "==========="
log "Installation directory: $(pwd)"
log "Bootstrap node: $BOOTSTRAP_IP"
log "Resource preset: $PRESET"
log ""
log "🚀 Start your worker node:"
if [[ "$OS" == "linux" ]]; then
    log "  sudo systemctl start ai-worker"
    log "  OR"
fi
log "  ./start-worker.sh"
log ""
log "🎛️  Adjust resources:"
log "  node dynamic-adjuster.js          # CLI interface"
log "  npm run web-adjust                # Web interface"
log ""
log "📊 Monitor performance:"
log "  htop                              # System resources"
if [[ "$OS" == "linux" ]]; then
    log "  sudo journalctl -u ai-worker -f   # Node logs"
fi
log ""
log "🔗 Network status:"
log "  curl http://$BOOTSTRAP_IP:8545 -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"net_peerCount\",\"params\":[],\"id\":1}'"
log ""
log "📱 Mobile app: http://$BOOTSTRAP_IP/mobile"
log ""

# Ask if user wants to start now
echo ""
read -p "Start the worker node now? (y/N): " start_now

if [[ "$start_now" =~ ^[Yy]$ ]]; then
    log "Starting worker node..."
    if [[ "$OS" == "linux" ]] && systemctl is-enabled ai-worker >/dev/null 2>&1; then
        sudo systemctl start ai-worker
        log "Worker node started as system service"
        log "View logs: sudo journalctl -u ai-worker -f"
    else
        log "Starting in foreground mode..."
        log "Press Ctrl+C to stop"
        ./start-worker.sh
    fi
else
    log "Worker node ready to start!"
    if [[ "$OS" == "linux" ]]; then
        log "Start with: sudo systemctl start ai-worker"
    else
        log "Start with: ./start-worker.sh"
    fi
fi