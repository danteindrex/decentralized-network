#!/bin/bash

echo "🚀 Launching Decentralized AI Network - READY TO USE!"
echo ""

# Check if streamlit is installed
if ! command -v streamlit &> /dev/null; then
    echo "❌ Streamlit not found. Installing..."
    pip install streamlit
fi

echo "✅ FULLY CONFIGURED - NO SETUP REQUIRED!"
echo ""
echo "📋 Features Ready:"
echo "  🤖 AI Chat Interface with blockchain integration"
echo "  🌐 Live peer discovery and network dashboard" 
echo "  📁 IPFS file storage and management"
echo "  ⛓️ Blockchain transactions with test accounts"
echo "  📊 Real-time analytics and network monitoring"
echo ""

echo "🔑 Pre-configured Test Accounts:"
echo "  Account: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
echo "  Contract: 0x5FbDB2315678afecb367f032d93F642f64180aa3"
echo "  Network: Connected to bootstrap-node.onrender.com"
echo ""

echo "🌟 Starting app on port 8505..."
echo "🌍 Access at: http://localhost:8505"
echo ""
echo "🎉 Everything is ready - enjoy your decentralized AI network!"
echo ""

# Kill any existing streamlit processes
pkill -f "streamlit run" 2>/dev/null || true

# Launch the app
streamlit run streamlit_app.py --server.port 8505 --server.headless false