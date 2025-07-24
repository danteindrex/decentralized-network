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
if curl -s --connect-timeout 5 $ETH_NODE_URL >/dev/null; then
    echo "✅ Blockchain connection: OK"
else
    echo "❌ Blockchain connection: FAILED"
    echo "Make sure bootstrap node is running at $ETH_NODE_URL"
    exit 1
fi

echo ""
echo "🎯 Starting AI worker node..."
echo "💡 Monitor with: htop (system resources)"
echo "📊 View logs in real-time below"
echo ""

# Start worker
python3 orchestrator/main.py
