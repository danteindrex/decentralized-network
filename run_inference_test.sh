#!/bin/bash

echo "🚀 AI Inference End-to-End Test"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Check if services are running
echo "1️⃣ Checking services..."

# Check Ethereum
if curl -s -X POST -H "Content-Type: application/json" \
    --data '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' \
    http://192.168.1.103:8545 | grep -q "result"; then
    echo -e "${GREEN}✅ Ethereum node is running${NC}"
else
    echo -e "${RED}❌ Ethereum node is not running${NC}"
    echo "   Start with: cd /home/lambda/contracts && npx hardhat node"
    exit 1
fi

# Check IPFS
if curl -s -X POST http://192.168.1.103:5001/api/v0/version | grep -q "Version"; then
    echo -e "${GREEN}✅ IPFS is running${NC}"
else
    echo -e "${RED}❌ IPFS is not running${NC}"
    echo "   Start with: ipfs daemon"
    exit 1
fi

# Check if contracts are deployed
if [ -f "deployment.json" ]; then
    echo -e "${GREEN}✅ Contracts are deployed${NC}"
else
    echo -e "${YELLOW}⚠️  Contracts not deployed. Deploying now...${NC}"
    npm run deploy
fi

echo ""
echo "2️⃣ Starting mock worker node..."
echo "   (This will process inference jobs)"
echo ""

# Start worker in background
python3 start_test_worker.py &
WORKER_PID=$!

# Give worker time to start
sleep 3

echo ""
echo "3️⃣ Running inference test..."
echo ""

# Run the test
python3 test_ai_inference_real.py --full

# Kill the worker
echo ""
echo "Stopping worker..."
kill $WORKER_PID 2>/dev/null

echo ""
echo "✅ Test complete!"