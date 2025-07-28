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
