#!/bin/bash

# AI Compute Network - Automated Deployment Script
# Usage: ./deploy.sh [bootstrap|worker|mobile] [options]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging function
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[$(date +'%Y-%m-%d %H:%M:%S')] WARNING: $1${NC}"
}

error() {
    echo -e "${RED}[$(date +'%Y-%m-%d %H:%M:%S')] ERROR: $1${NC}"
    exit 1
}

# Check if running as root (for some operations)
check_root() {
    if [[ $EUID -eq 0 ]]; then
        warn "Running as root. Some operations may require non-root user."
    fi
}

# Detect OS
detect_os() {
    if [[ "$OSTYPE" == "linux-gnu"* ]]; then
        OS="linux"
        if command -v apt-get >/dev/null 2>&1; then
            DISTRO="debian"
        elif command -v yum >/dev/null 2>&1; then
            DISTRO="redhat"
        fi
    elif [[ "$OSTYPE" == "darwin"* ]]; then
        OS="macos"
    elif [[ "$OSTYPE" == "msys" ]] || [[ "$OSTYPE" == "cygwin" ]]; then
        OS="windows"
    else
        error "Unsupported operating system: $OSTYPE"
    fi
    
    log "Detected OS: $OS ($DISTRO)"
}

# Install dependencies based on OS
install_dependencies() {
    log "Installing dependencies..."
    
    case $OS in
        "linux")
            case $DISTRO in
                "debian")
                    sudo apt update
                    sudo apt install -y curl wget git htop
                    
                    # Install Node.js
                    if ! command -v node >/dev/null 2>&1; then
                        curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
                        sudo apt-get install -y nodejs
                    fi
                    
                    # Install Geth
                    if ! command -v geth >/dev/null 2>&1; then
                        sudo add-apt-repository -y ppa:ethereum/ethereum
                        sudo apt-get update
                        sudo apt-get install -y ethereum
                    fi
                    ;;
                "redhat")
                    sudo yum update -y
                    sudo yum install -y curl wget git htop
                    
                    # Install Node.js
                    if ! command -v node >/dev/null 2>&1; then
                        curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
                        sudo yum install -y nodejs
                    fi
                    
                    # Install Geth (manual installation)
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
                /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
            fi
            
            brew install node git ethereum
            ;;
        "windows")
            warn "Windows detected. Please install dependencies manually:"
            echo "1. Node.js: https://nodejs.org/"
            echo "2. Git: https://git-scm.com/"
            echo "3. Geth: choco install geth (requires Chocolatey)"
            read -p "Press Enter when dependencies are installed..."
            ;;
    esac
    
    log "Dependencies installed successfully"
}

# Setup bootstrap node
setup_bootstrap() {
    log "Setting up Bootstrap Node..."
    
    # Get static IP
    if [[ -z "$STATIC_IP" ]]; then
        STATIC_IP=$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "localhost")
        log "Detected static IP: $STATIC_IP"
    fi
    
    # Validate IP
    if [[ "$STATIC_IP" == "localhost" ]]; then
        warn "Could not detect public IP. Please set STATIC_IP environment variable."
        read -p "Enter your static IP address: " STATIC_IP
    fi
    
    # Setup firewall (Linux only)
    if [[ "$OS" == "linux" ]]; then
        log "Configuring firewall..."
        if command -v ufw >/dev/null 2>&1; then
            sudo ufw allow 22/tcp    # SSH
            sudo ufw allow 30303/tcp # P2P
            sudo ufw allow 8545/tcp  # RPC
            sudo ufw --force enable
        elif command -v firewall-cmd >/dev/null 2>&1; then
            sudo firewall-cmd --permanent --add-port=30303/tcp
            sudo firewall-cmd --permanent --add-port=8545/tcp
            sudo firewall-cmd --reload
        fi
    fi
    
    # Navigate to nodes directory
    cd nodes
    
    # Install npm dependencies
    npm install
    
    # Run bootstrap setup
    chmod +x setup-bootstrap.sh
    STATIC_IP=$STATIC_IP ./setup-bootstrap.sh
    
    # Create systemd service (Linux only)
    if [[ "$OS" == "linux" ]]; then
        log "Creating systemd service..."
        
        sudo tee /etc/systemd/system/ai-bootstrap.service > /dev/null <<EOF
[Unit]
Description=AI Compute Bootstrap Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
Environment=STATIC_IP=$STATIC_IP
ExecStart=$(which node) bootstrap/bootstrap-node.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-bootstrap

[Install]
WantedBy=multi-user.target
EOF
        
        sudo systemctl daemon-reload
        sudo systemctl enable ai-bootstrap
        
        log "Bootstrap node service created. Start with: sudo systemctl start ai-bootstrap"
    fi
    
    log "Bootstrap node setup complete!"
    log "Static IP: $STATIC_IP"
    log "P2P Port: 30303"
    log "RPC Port: 8545"
}

# Setup worker node
setup_worker() {
    log "Setting up Worker Node..."
    
    # Navigate to nodes directory
    cd nodes
    
    # Install npm dependencies
    npm install
    
    # Run worker setup
    chmod +x setup-worker.sh
    ./setup-worker.sh
    
    # Configure resources interactively
    if [[ "$INTERACTIVE" != "false" ]]; then
        log "Configuring resource allocation..."
        node configure-resources.js
    else
        log "Skipping interactive configuration (use --non-interactive flag)"
    fi
    
    # Create systemd service (Linux only)
    if [[ "$OS" == "linux" ]]; then
        log "Creating systemd service..."
        
        sudo tee /etc/systemd/system/ai-worker.service > /dev/null <<EOF
[Unit]
Description=AI Compute Worker Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=$(which node) worker/worker-node.js
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
        
        log "Worker node service created. Start with: sudo systemctl start ai-worker"
    fi
    
    log "Worker node setup complete!"
    log "You can adjust resources anytime with: node dynamic-adjuster.js"
}

# Setup mobile server
setup_mobile() {
    log "Setting up Mobile Server..."
    
    # Install nginx (Linux only)
    if [[ "$OS" == "linux" ]]; then
        case $DISTRO in
            "debian")
                sudo apt install -y nginx
                ;;
            "redhat")
                sudo yum install -y nginx
                ;;
        esac
        
        # Configure nginx for mobile
        sudo tee /etc/nginx/sites-available/ai-mobile > /dev/null <<EOF
server {
    listen 80;
    server_name _;
    
    location /mobile {
        alias $(pwd)/nodes/mobile;
        index mobile-client.html;
        try_files \$uri \$uri/ =404;
        
        # PWA headers
        add_header Cache-Control "public, max-age=3600";
        add_header Service-Worker-Allowed "/";
    }
    
    location /api {
        proxy_pass http://localhost:8545;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "*";
        add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
        add_header Access-Control-Allow-Headers "Content-Type";
    }
}
EOF
        
        # Enable site
        sudo ln -sf /etc/nginx/sites-available/ai-mobile /etc/nginx/sites-enabled/
        sudo nginx -t
        sudo systemctl reload nginx
        
        log "Mobile server configured with nginx"
        log "Access at: http://your-server-ip/mobile"
    else
        log "Starting simple HTTP server for mobile..."
        cd nodes
        python3 -m http.server 8080 --directory mobile &
        log "Mobile server running at: http://localhost:8080"
    fi
}

# Generate deployment summary
generate_summary() {
    log "Generating deployment summary..."
    
    cat > deployment-summary.txt <<EOF
AI Compute Network Deployment Summary
=====================================

Deployment Date: $(date)
Node Type: $NODE_TYPE
Operating System: $OS ($DISTRO)

Bootstrap Node Information:
- Static IP: $STATIC_IP
- P2P Port: 30303
- RPC Port: 8545
- Enode: Check nodes/bootstrap-info.json

Network Access:
- Mobile App: http://$STATIC_IP/mobile (if nginx configured)
- RPC Endpoint: http://$STATIC_IP:8545
- Web Adjuster: http://localhost:8081/web-adjuster.html

Management Commands:
- Start node: sudo systemctl start ai-$NODE_TYPE
- Stop node: sudo systemctl stop ai-$NODE_TYPE
- View logs: sudo journalctl -u ai-$NODE_TYPE -f
- Adjust resources: node dynamic-adjuster.js

Next Steps:
1. Start your node: sudo systemctl start ai-$NODE_TYPE
2. Monitor logs: sudo journalctl -u ai-$NODE_TYPE -f
3. For workers: Configure resources with 'node configure-resources.js'
4. Share mobile link: http://$STATIC_IP/mobile

Troubleshooting:
- Check firewall: sudo ufw status
- Test connectivity: telnet $STATIC_IP 30303
- View network status: curl http://$STATIC_IP:8545 -X POST -H "Content-Type: application/json" --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'
EOF
    
    log "Deployment summary saved to: deployment-summary.txt"
    cat deployment-summary.txt
}

# Main deployment function
main() {
    log "AI Compute Network Deployment Script"
    log "===================================="
    
    # Parse arguments
    NODE_TYPE=${1:-""}
    INTERACTIVE=${INTERACTIVE:-"true"}
    
    # Parse flags
    while [[ $# -gt 0 ]]; do
        case $1 in
            --non-interactive)
                INTERACTIVE="false"
                shift
                ;;
            --static-ip=*)
                STATIC_IP="${1#*=}"
                shift
                ;;
            -h|--help)
                echo "Usage: $0 [bootstrap|worker|mobile] [options]"
                echo ""
                echo "Options:"
                echo "  --non-interactive    Skip interactive configuration"
                echo "  --static-ip=IP       Set static IP for bootstrap node"
                echo "  -h, --help          Show this help message"
                echo ""
                echo "Examples:"
                echo "  $0 bootstrap --static-ip=192.168.1.100"
                echo "  $0 worker --non-interactive"
                echo "  $0 mobile"
                exit 0
                ;;
            *)
                if [[ -z "$NODE_TYPE" ]]; then
                    NODE_TYPE="$1"
                fi
                shift
                ;;
        esac
    done
    
    # Validate node type
    if [[ -z "$NODE_TYPE" ]]; then
        echo "Please specify node type:"
        echo "1. bootstrap - Bootstrap/Rendez-vous node (requires static IP)"
        echo "2. worker    - Worker/Compute node"
        echo "3. mobile    - Mobile server setup"
        read -p "Enter choice (1-3): " choice
        
        case $choice in
            1) NODE_TYPE="bootstrap" ;;
            2) NODE_TYPE="worker" ;;
            3) NODE_TYPE="mobile" ;;
            *) error "Invalid choice" ;;
        esac
    fi
    
    # Validate node type
    case $NODE_TYPE in
        bootstrap|worker|mobile)
            log "Deploying $NODE_TYPE node..."
            ;;
        *)
            error "Invalid node type: $NODE_TYPE. Use: bootstrap, worker, or mobile"
            ;;
    esac
    
    # Check prerequisites
    check_root
    detect_os
    install_dependencies
    
    # Deploy based on node type
    case $NODE_TYPE in
        bootstrap)
            setup_bootstrap
            ;;
        worker)
            setup_worker
            ;;
        mobile)
            setup_mobile
            ;;
    esac
    
    # Generate summary
    generate_summary
    
    log "Deployment completed successfully! 🚀"
    log "Check deployment-summary.txt for details and next steps."
}

# Run main function with all arguments
main "$@"