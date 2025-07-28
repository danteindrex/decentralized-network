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
