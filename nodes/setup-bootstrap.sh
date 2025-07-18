#!/bin/bash

# Bootstrap Node Setup Script
# Run this on your server with static IP

set -e

echo "🚀 Setting up Bootstrap/Rendez-vous Node..."

# Check if running as root or with sudo
if [[ $EUID -eq 0 ]]; then
   echo "⚠️  This script should not be run as root for security reasons"
   exit 1
fi

# Check for required tools
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed. Aborting." >&2; exit 1; }
command -v geth >/dev/null 2>&1 || { echo "❌ Geth is required but not installed. Aborting." >&2; exit 1; }

# Get static IP
echo "📍 Detecting your static IP..."
STATIC_IP=${STATIC_IP:-$(curl -s ifconfig.me || curl -s ipinfo.io/ip || echo "localhost")}
echo "🌐 Using IP: $STATIC_IP"

# Check if port 30303 is open
echo "🔍 Checking if port 30303 is accessible..."
if command -v nc >/dev/null 2>&1; then
    if ! nc -z -v -w5 $STATIC_IP 30303 2>/dev/null; then
        echo "⚠️  Port 30303 may not be open. Please ensure:"
        echo "   - Firewall allows port 30303"
        echo "   - Router forwards port 30303 to this machine"
        echo "   - Cloud provider security groups allow port 30303"
    fi
fi

# Create directories
mkdir -p data/bootstrap
mkdir -p logs

# Install dependencies
echo "📦 Installing Node.js dependencies..."
npm install

# Set environment variables
export STATIC_IP=$STATIC_IP

echo "✅ Bootstrap node setup complete!"
echo ""
echo "🚀 To start the bootstrap node:"
echo "   STATIC_IP=$STATIC_IP node nodes/bootstrap/bootstrap-node.js"
echo ""
echo "📝 Important:"
echo "   - Keep this node running 24/7"
echo "   - Share the enode URL with worker nodes"
echo "   - Monitor logs in ./logs/"
echo ""
echo "🔗 Your enode will be saved to nodes/bootstrap-info.json"