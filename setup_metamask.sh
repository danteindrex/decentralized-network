#!/bin/bash

# MetaMask Integration Setup Script
# This script sets up MetaMask integration for the Decentralized vLLM Network

echo "🦊 Setting up MetaMask Integration for Decentralized vLLM Network"
echo "================================================================"

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js first."
    exit 1
fi

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed. Please install npm first."
    exit 1
fi

echo "✅ Node.js and npm are available"

# Run the MetaMask integration setup
echo "🔧 Running MetaMask integration setup..."
node scripts/setup_metamask_integration.js

if [ $? -eq 0 ]; then
    echo ""
    echo "🎉 MetaMask integration setup completed successfully!"
    echo ""
    echo "📋 Next steps:"
    echo "1. Copy the environment configuration:"
    echo "   cp .env.metamask .env"
    echo ""
    echo "2. Install MetaMask browser extension or mobile app:"
    echo "   https://metamask.io/download/"
    echo ""
    echo "3. Start your network:"
    echo "   docker-compose up -d ipfs geth"
    echo "   npm run deploy"
    echo ""
    echo "4. Start services with MetaMask support:"
    echo "   npm run start:streamlit:metamask    # User interface"
    echo "   npm run mobile:metamask             # Mobile interface"
    echo ""
    echo "5. Open in browser and connect MetaMask:"
    echo "   http://localhost:8501               # Streamlit interface"
    echo "   http://localhost:8080/mobile_metamask.html  # Mobile interface"
    echo ""
    echo "📖 For detailed instructions, see: ./METAMASK_SETUP.md"
    echo ""
    echo "⚠️  Remember: Only use the provided test accounts on your private network!"
else
    echo "❌ MetaMask integration setup failed. Please check the error messages above."
    exit 1
fi