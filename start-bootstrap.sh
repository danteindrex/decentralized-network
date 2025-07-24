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
