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
