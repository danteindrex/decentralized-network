#!/bin/bash

# Decentralized Inference Streamlit Launcher
echo "🧠 Starting Decentralized Inference Tester..."

# Check if config exists
if [ ! -f "orchestrator/config.yaml" ]; then
    echo "❌ Config file not found!"
    echo "Please copy and configure orchestrator/config.template.yaml to orchestrator/config.yaml"
    exit 1
fi

# Check if IPFS is running
if ! curl -s http://localhost:5001/api/v0/version > /dev/null; then
    echo "⚠️  IPFS not detected on localhost:5001"
    echo "Please start IPFS daemon: ipfs daemon"
    echo "Continuing anyway..."
fi

# Install requirements if needed
if ! python -c "import streamlit" 2>/dev/null; then
    echo "📦 Installing Streamlit requirements..."
    pip install -r streamlit_requirements.txt
fi

# Start Streamlit
echo "🚀 Starting Streamlit app..."
echo "📱 Open your browser to: http://localhost:8501"
echo ""

streamlit run streamlit_app.py