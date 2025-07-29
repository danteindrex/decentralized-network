#!/bin/bash

# Run Electron App with Bootstrap Configuration
echo "🚀 Starting Electron App with Bootstrap Configuration"
echo ""

# Check if IPFS is running
if curl -s -o /dev/null -w "%{http_code}" http://192.168.1.103:5001/api/v0/version | grep -q "200"; then
    echo "✅ IPFS is running"
else
    echo "❌ IPFS is not running. Please start it with: ipfs daemon"
    exit 1
fi

# Check if Ethereum node is running
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://192.168.1.103:8545 | grep -q "result"; then
    echo "✅ Ethereum node is running"
else
    echo "❌ Ethereum node is not running. Please start it"
    exit 1
fi

# Set environment variables for the app
export ETH_NODE=http://192.168.1.103:8545
export IPFS_HOST=192.168.1.103
export IPFS_PORT=5001
export BOOTSTRAP_NODE=http://192.168.1.103:8080

# Create initial config if it doesn't exist
CONFIG_DIR="$HOME/.config/ai-network-node"
CONFIG_FILE="$CONFIG_DIR/network_config.json"

if [ ! -d "$CONFIG_DIR" ]; then
    mkdir -p "$CONFIG_DIR"
fi

if [ ! -f "$CONFIG_FILE" ]; then
    echo "📝 Creating initial configuration..."
    cat > "$CONFIG_FILE" <<EOF
{
  "eth_node": "http://192.168.1.103:8545",
  "ipfs_host": "192.168.1.103",
  "ipfs_port": 5001,
  "contract_address": "",
  "model_registry_address": "",
  "default_account": "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  "private_key": "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80",
  "network_id": "AI-Inference-Network",
  "bootstrap_nodes": [
    {
      "url": "http://192.168.1.103:8545",
      "ipfs": "192.168.1.103:5001"
    }
  ]
}
EOF
    echo "✅ Configuration created at: $CONFIG_FILE"
fi

echo ""
echo "🎯 Starting Electron App..."
echo ""

# Run the app
npm start