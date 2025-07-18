#!/bin/bash

# Worker Node Setup Script
# Run this on laptops, desktops, or any device that wants to join the network

set -e

echo "🚀 Setting up Worker/Compute Node..."

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }

# Detect platform
PLATFORM=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)

echo "🔧 Detected platform: $PLATFORM ($ARCH)"

# Check if geth is available (not required for light clients)
if command -v geth >/dev/null 2>&1; then
    echo "✅ Geth found - can run as full node"
    NODE_TYPE="full"
else
    echo "⚠️  Geth not found - will run as light client"
    NODE_TYPE="light"
    
    # Install geth for the platform
    echo "📦 Installing Geth..."
    case $PLATFORM in
        "linux")
            if command -v apt-get >/dev/null 2>&1; then
                sudo apt-get update && sudo apt-get install -y ethereum
            elif command -v yum >/dev/null 2>&1; then
                sudo yum install -y ethereum
            else
                echo "❌ Please install Geth manually: https://geth.ethereum.org/downloads/"
                exit 1
            fi
            ;;
        "darwin")
            if command -v brew >/dev/null 2>&1; then
                brew install ethereum
            else
                echo "❌ Please install Homebrew and run: brew install ethereum"
                exit 1
            fi
            ;;
        *)
            echo "❌ Unsupported platform. Please install Geth manually."
            exit 1
            ;;
    esac
fi

# Check system resources
TOTAL_RAM=$(free -m 2>/dev/null | awk 'NR==2{printf "%.0f", $2/1024}' || echo "unknown")
CPU_CORES=$(nproc 2>/dev/null || sysctl -n hw.ncpu 2>/dev/null || echo "unknown")

echo "💻 System Info:"
echo "   RAM: ${TOTAL_RAM}GB"
echo "   CPU Cores: $CPU_CORES"

# Recommend node type based on resources
if [[ "$TOTAL_RAM" != "unknown" ]] && [[ $TOTAL_RAM -lt 4 ]]; then
    echo "💡 Recommendation: Light client (limited RAM)"
    NODE_TYPE="light"
elif [[ "$TOTAL_RAM" != "unknown" ]] && [[ $TOTAL_RAM -ge 8 ]]; then
    echo "💡 Recommendation: Full node with mining (sufficient RAM)"
    NODE_TYPE="full"
fi

# Create directories
mkdir -p data
mkdir -p logs

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Install Python dependencies for AI compute (if full node)
if [[ "$NODE_TYPE" == "full" ]] && command -v python3 >/dev/null 2>&1; then
    echo "🐍 Installing Python dependencies for AI compute..."
    cd orchestrator
    pip3 install -r requirements.txt 2>/dev/null || echo "⚠️  Could not install Python deps - AI compute may not work"
    cd ..
fi

echo "✅ Worker node setup complete!"
echo ""
echo "🚀 To start the worker node:"
echo "   NODE_TYPE=$NODE_TYPE node nodes/worker/worker-node.js"
echo ""
echo "📝 Node will automatically:"
echo "   - Connect to bootstrap nodes"
echo "   - Sync with the network"
if [[ "$NODE_TYPE" == "full" ]]; then
    echo "   - Start mining (if resources allow)"
    echo "   - Run AI compute tasks"
else
    echo "   - Run as light client"
    echo "   - Forward AI tasks to nearby workers"
fi