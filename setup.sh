#!/bin/bash

# Decentralized vLLM Inference Network - Setup Script
# This script automates the initial setup process

set -e  # Exit on any error

echo "🚀 Setting up Decentralized vLLM Inference Network..."
echo "=================================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check prerequisites
echo "🔍 Checking prerequisites..."

# Check Node.js
if command -v node &> /dev/null; then
    NODE_VERSION=$(node --version)
    print_status "Node.js found: $NODE_VERSION"
else
    print_error "Node.js not found. Please install Node.js 16+ from https://nodejs.org/"
    exit 1
fi

# Check npm
if command -v npm &> /dev/null; then
    NPM_VERSION=$(npm --version)
    print_status "npm found: $NPM_VERSION"
else
    print_error "npm not found. Please install npm"
    exit 1
fi

# Check Python
if command -v python3 &> /dev/null; then
    PYTHON_VERSION=$(python3 --version)
    print_status "Python found: $PYTHON_VERSION"
else
    print_error "Python 3 not found. Please install Python 3.8+"
    exit 1
fi

# Check pip
if command -v pip3 &> /dev/null; then
    PIP_VERSION=$(pip3 --version)
    print_status "pip found: $PIP_VERSION"
else
    print_error "pip3 not found. Please install pip3"
    exit 1
fi

# Check Docker
if command -v docker &> /dev/null; then
    DOCKER_VERSION=$(docker --version)
    print_status "Docker found: $DOCKER_VERSION"
else
    print_error "Docker not found. Please install Docker from https://docs.docker.com/get-docker/"
    exit 1
fi

# Check Docker Compose
if command -v docker-compose &> /dev/null; then
    COMPOSE_VERSION=$(docker-compose --version)
    print_status "Docker Compose found: $COMPOSE_VERSION"
else
    print_error "Docker Compose not found. Please install Docker Compose"
    exit 1
fi

echo ""
echo "📦 Installing dependencies..."

# Install Node.js dependencies
print_info "Installing Node.js dependencies..."
npm install
print_status "Node.js dependencies installed"

# Install Python dependencies
print_info "Installing Python dependencies..."
cd orchestrator
pip3 install -r requirements.txt
cd ..
print_status "Python dependencies installed"

echo ""
echo "🐳 Starting infrastructure services..."

# Start IPFS and Geth
print_info "Starting IPFS and Geth blockchain..."
docker-compose up -d ipfs geth

# Wait for services to start
print_info "Waiting for services to initialize..."
sleep 10

# Check if services are running
if docker-compose ps | grep -q "ipfs.*Up"; then
    print_status "IPFS is running"
else
    print_warning "IPFS may not be running properly"
fi

if docker-compose ps | grep -q "geth.*Up"; then
    print_status "Geth blockchain is running"
else
    print_warning "Geth may not be running properly"
fi

echo ""
echo "🔨 Compiling and deploying smart contracts..."

# Compile contracts
print_info "Compiling smart contracts..."
npx hardhat compile
print_status "Smart contracts compiled"

# Deploy contracts
print_info "Deploying smart contracts to local network..."
npx hardhat run scripts/deploy.js --network localhost
print_status "Smart contracts deployed"

echo ""
echo "⚙️ Configuration setup..."

# Check if deployment.json exists
if [ -f "deployment.json" ]; then
    print_status "Deployment file created"
    
    # Extract addresses from deployment.json
    INFERENCE_COORDINATOR=$(grep -o '"inferenceCoordinator": "[^"]*"' deployment.json | cut -d'"' -f4)
    MODEL_REGISTRY=$(grep -o '"modelRegistry": "[^"]*"' deployment.json | cut -d'"' -f4)
    DEPLOYER=$(grep -o '"deployer": "[^"]*"' deployment.json | cut -d'"' -f4)
    
    print_info "Contract addresses:"
    echo "  InferenceCoordinator: $INFERENCE_COORDINATOR"
    echo "  ModelRegistry: $MODEL_REGISTRY"
    echo "  Deployer (Owner): $DEPLOYER"
    
    print_warning "Please update orchestrator/config.yaml with these addresses and your private key"
else
    print_error "Deployment file not found. Contract deployment may have failed."
fi

echo ""
echo "🧪 Running tests..."

# Run smart contract tests
print_info "Running smart contract tests..."
if npx hardhat test; then
    print_status "Smart contract tests passed"
else
    print_warning "Some smart contract tests failed"
fi

# Run Python tests
print_info "Running Python component tests..."
cd orchestrator
if python3 test_inference.py; then
    print_status "Python component tests passed"
else
    print_warning "Some Python tests failed (this is normal if IPFS/blockchain aren't fully ready)"
fi
cd ..

echo ""
echo "🎉 Setup completed!"
echo "=================="
echo ""
echo "🔧 Automatically configuring addresses..."

# Auto-update configuration with deployed addresses
if command -v python3 &> /dev/null; then
    print_info "Running automatic configuration update..."
    if python3 scripts/update_config.py; then
        print_status "Configuration updated automatically"
    else
        print_warning "Automatic configuration failed, manual setup required"
    fi
else
    print_warning "Python3 not found, skipping automatic configuration"
fi

echo ""
echo "📋 Next steps:"
echo "1. Set your wallet credentials (choose one option):"
echo "   Option A - Environment variables (recommended):"
echo "     export DEFAULT_ACCOUNT=0xYourAddress"
echo "     export PRIVATE_KEY=0xYourPrivateKey"
echo ""
echo "   Option B - Update orchestrator/config.yaml manually"
echo "2. Upload your first model:"
echo "   cd orchestrator"
echo "   python owner_upload.py --model 'microsoft/DialoGPT-small' --model-id 'dialogpt-small' --name 'DialoGPT Small' --description 'Test model'"
echo ""
echo "3. Start the orchestrator:"
echo "   python main.py"
echo ""
echo "4. Or run everything with Docker:"
echo "   docker-compose up"
echo ""
echo "📖 For detailed instructions, see README.md and OWNER_GUIDE.md"
echo ""
echo "🔧 Useful commands:"
echo "  - Check services: docker-compose ps"
echo "  - View logs: docker-compose logs -f [service]"
echo "  - Stop services: docker-compose down"
echo "  - Manage models: npx hardhat run scripts/owner_tools.js [command]"
echo ""

# Check if everything is ready
echo "🔍 System status:"
if docker-compose ps | grep -q "ipfs.*Up" && docker-compose ps | grep -q "geth.*Up"; then
    print_status "Infrastructure services are running"
    
    if [ -f "deployment.json" ] && [ -f "orchestrator/abis/ModelRegistry.json" ]; then
        print_status "Smart contracts are deployed"
        echo ""
        print_info "Your decentralized vLLM inference network is ready! 🎊"
    else
        print_warning "Smart contracts may not be properly deployed"
    fi
else
    print_warning "Some infrastructure services may not be running properly"
    echo "Try running: docker-compose up -d ipfs geth"
fi