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
