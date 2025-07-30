#!/bin/bash

# AI Compute Network Launcher
# Simple script to start the appropriate node type

set -e

echo "🧠 AI Compute Network Launcher"
echo "================================"

# Check if we're in the right directory
if [[ ! -f "genesis.json" ]]; then
    echo "❌ Please run this script from the project root directory"
    exit 1
fi

# Function to detect node type
detect_node_type() {
    echo "🔍 Detecting optimal node type for this system..."
    
    # Check for static IP (simple heuristic)
    if [[ -n "$STATIC_IP" ]] || [[ "$1" == "bootstrap" ]]; then
        echo "bootstrap"
        return
    fi
    
    # Check system resources
    if command -v free >/dev/null 2>&1; then
        TOTAL_RAM=$(free -m | awk 'NR==2{printf "%.0f", $2/1024}')
    else
        TOTAL_RAM=4 # Default assumption
    fi
    
    if [[ $TOTAL_RAM -ge 4 ]]; then
        echo "worker"
    else
        echo "light"
    fi
}

# Function to start bootstrap node
start_bootstrap() {
    echo "🚀 Starting Bootstrap Node..."
    
    if [[ -z "$STATIC_IP" ]]; then
        echo "❌ STATIC_IP environment variable required for bootstrap node"
        echo "   Example: STATIC_IP=192.168.1.100 ./start-network.sh bootstrap"
        exit 1
    fi
    
    cd nodes
    
    # Run setup if not done
    if [[ ! -d "data/bootstrap" ]]; then
        echo "📦 Running first-time setup..."
        ./setup-bootstrap.sh
    fi
    
    # Start bootstrap node
    STATIC_IP=$STATIC_IP node bootstrap/bootstrap-node.js
}

# Function to start worker node
start_worker() {
    echo "🚀 Starting Worker Node..."
    
    cd nodes
    
    # Run setup if not done
    if [[ ! -d "data" ]]; then
        echo "📦 Running first-time setup..."
        ./setup-worker.sh
    fi
    
    # Start worker node
    node worker/worker-node.js
}

# Function to start mobile server
start_mobile() {
    echo "📱 Starting Mobile Server..."
    echo "🌐 Mobile clients can connect at: http://localhost:8080/mobile-client.html"
    
    cd nodes/mobile
    python3 -m http.server 8080
}

# Main logic
case "${1:-auto}" in
    "bootstrap")
        start_bootstrap
        ;;
    "worker")
        start_worker
        ;;
    "mobile")
        start_mobile
        ;;
    "auto")
        NODE_TYPE=$(detect_node_type)
        echo "💡 Detected node type: $NODE_TYPE"
        
        case $NODE_TYPE in
            "bootstrap")
                start_bootstrap
                ;;
            "worker"|"light")
                start_worker
                ;;
        esac
        ;;
    *)
        echo "Usage: $0 [bootstrap|worker|mobile|auto]"
        echo ""
        echo "Node Types:"
        echo "  bootstrap  - Bootstrap/Rendez-vous node (requires STATIC_IP)"
        echo "  worker     - Worker/Compute node (desktop/laptop)"
        echo "  mobile     - Mobile server (for phone clients)"
        echo "  auto       - Auto-detect best node type (default)"
        echo ""
        echo "Examples:"
        echo "  STATIC_IP=192.168.1.100 $0 bootstrap"
        echo "  $0 worker"
        echo "  $0 mobile"
        echo "  $0 auto"
        exit 1
        ;;
esac