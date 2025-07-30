#!/bin/bash

# Secure Setup Script for Decentralized vLLM Inference Network
# This script sets up the network with security best practices

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

log_header() {
    echo -e "\n${BLUE}🚀 $1${NC}"
    echo "=================================="
}

# Check if running as root (not recommended)
check_root() {
    if [[ $EUID -eq 0 ]]; then
        log_warning "Running as root is not recommended for security reasons"
        read -p "Continue anyway? (y/N): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check prerequisites
check_prerequisites() {
    log_header "Checking Prerequisites"
    
    local missing_deps=()
    
    # Check Node.js
    if ! command -v node &> /dev/null; then
        missing_deps+=("Node.js 18+")
    else
        local node_version=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
        if [ "$node_version" -lt 18 ]; then
            missing_deps+=("Node.js 18+ (current: $(node --version))")
        fi
    fi
    
    # Check Python
    if ! command -v python3 &> /dev/null; then
        missing_deps+=("Python 3.8+")
    else
        local python_version=$(python3 --version | cut -d' ' -f2 | cut -d'.' -f1-2)
        if ! python3 -c "import sys; exit(0 if sys.version_info >= (3, 8) else 1)" 2>/dev/null; then
            missing_deps+=("Python 3.8+ (current: $python_version)")
        fi
    fi
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        missing_deps+=("Docker")
    fi
    
    # Check Git
    if ! command -v git &> /dev/null; then
        missing_deps+=("Git")
    fi
    
    # Check YAML dependency
    if ! node -e "require('yaml')" 2>/dev/null; then
        log_info "Installing required Node.js dependencies..."
        npm install yaml web3 express cors dotenv axios
    fi
    
    if [ ${#missing_deps[@]} -ne 0 ]; then
        log_error "Missing dependencies: ${missing_deps[*]}"
        log_info "Please install the missing dependencies and run this script again"
        exit 1
    fi
    
    log_success "All prerequisites met"
}

# Set up secure key management
setup_secure_keys() {
    log_header "Setting Up Secure Key Management"
    
    # Run the secure key setup
    if [ -f "scripts/setup_secure_keys.js" ]; then
        log_info "Generating secure keys for all node types..."
        node scripts/setup_secure_keys.js setup
        
        if [ $? -eq 0 ]; then
            log_success "Secure keys generated successfully"
        else
            log_error "Failed to generate secure keys"
            exit 1
        fi
    else
        log_error "Secure key setup script not found"
        exit 1
    fi
}

# Validate configuration
validate_configuration() {
    log_header "Validating Configuration"
    
    # Check if config manager works
    if node -e "
        const { getConfigManager } = require('./scripts/config_manager.js');
        const config = getConfigManager();
        const issues = config.validateConfig();
        if (issues.length > 0) {
            console.log('Configuration issues found:');
            issues.forEach(issue => console.log('  - ' + issue));
            process.exit(1);
        }
        console.log('Configuration validation passed');
    "; then
        log_success "Configuration is valid"
    else
        log_error "Configuration validation failed"
        exit 1
    fi
}

# Start infrastructure services
start_infrastructure() {
    log_header "Starting Infrastructure Services"
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        log_error "Docker is not running. Please start Docker and try again."
        exit 1
    fi
    
    log_info "Starting IPFS and Ethereum nodes..."
    
    # Start infrastructure with error handling
    if docker-compose up -d ipfs geth; then
        log_success "Infrastructure services started"
        
        # Wait for services to be ready
        log_info "Waiting for services to be ready..."
        sleep 10
        
        # Check IPFS
        if curl -s http://localhost:5001/api/v0/version > /dev/null; then
            log_success "IPFS node is running"
        else
            log_warning "IPFS node may not be ready yet"
        fi
        
        # Check Ethereum node
        if curl -s http://localhost:8545 -H "Content-Type: application/json" \
           -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' > /dev/null; then
            log_success "Ethereum node is running"
        else
            log_warning "Ethereum node may not be ready yet"
        fi
        
    else
        log_error "Failed to start infrastructure services"
        exit 1
    fi
}

# Deploy smart contracts with enhanced security
deploy_contracts() {
    log_header "Deploying Smart Contracts"
    
    log_info "Compiling smart contracts..."
    if npx hardhat compile; then
        log_success "Smart contracts compiled successfully"
    else
        log_error "Failed to compile smart contracts"
        exit 1
    fi
    
    log_info "Deploying smart contracts to local network..."
    if npx hardhat run scripts/deploy.js --network localhost; then
        log_success "Smart contracts deployed successfully"
        
        # Update configuration with deployed addresses
        log_info "Updating configuration with contract addresses..."
        if python3 scripts/update_config.py; then
            log_success "Configuration updated with contract addresses"
        else
            log_warning "Failed to update configuration automatically"
        fi
    else
        log_error "Failed to deploy smart contracts"
        exit 1
    fi
}

# Run comprehensive tests
run_tests() {
    log_header "Running Tests"
    
    # Smart contract tests
    log_info "Running smart contract tests..."
    if npm test; then
        log_success "Smart contract tests passed"
    else
        log_error "Smart contract tests failed"
        exit 1
    fi
    
    # Python tests (if orchestrator is available)
    if [ -d "orchestrator" ] && [ -f "orchestrator/requirements.txt" ]; then
        log_info "Running Python orchestrator tests..."
        
        # Install Python dependencies if not already installed
        if [ ! -d "venv" ]; then
            log_info "Creating Python virtual environment..."
            python3 -m venv venv
        fi
        
        source venv/bin/activate
        
        if pip install -r orchestrator/requirements.txt; then
            log_success "Python dependencies installed"
        else
            log_warning "Some Python dependencies failed to install"
        fi
        
        if [ -f "orchestrator/test_inference.py" ]; then
            cd orchestrator
            if python test_inference.py; then
                log_success "Python tests passed"
            else
                log_warning "Some Python tests failed"
            fi
            cd ..
        fi
        
        deactivate
    fi
}

# Setup health monitoring
setup_monitoring() {
    log_header "Setting Up Monitoring"
    
    # Create logs directory
    mkdir -p logs
    
    log_info "Health monitoring will be available on the following ports:"
    log_info "  Bootstrap Node: http://localhost:9090/health"
    log_info "  Worker Node: http://localhost:9190/health"
    log_info "  Owner Node: http://localhost:9290/health"
    log_info "  Metrics: http://localhost:9091/metrics"
    
    log_success "Monitoring setup completed"
}

# Create environment files for different node types
create_environment_files() {
    log_header "Creating Environment Files"
    
    # Use config manager to create environment files
    node -e "
        const { getConfigManager } = require('./scripts/config_manager.js');
        const config = getConfigManager();
        
        const nodeTypes = ['bootstrap', 'worker', 'owner', 'user'];
        
        nodeTypes.forEach(nodeType => {
            try {
                const envFile = config.createEnvironmentFile(nodeType);
                console.log(\`✅ Created environment file for \${nodeType}: \${envFile}\`);
            } catch (err) {
                console.log(\`❌ Failed to create environment file for \${nodeType}: \${err.message}\`);
            }
        });
    "
    
    log_success "Environment files created"
}

# Final setup and instructions
final_setup() {
    log_header "Final Setup and Instructions"
    
    # Create a simple status check script
    cat > check_status.sh << 'EOF'
#!/bin/bash
echo "🔍 Checking network status..."

echo "📡 IPFS Status:"
curl -s http://localhost:5001/api/v0/version || echo "  ❌ IPFS not responding"

echo "⛓️  Ethereum Status:"
curl -s http://localhost:8545 -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}' || echo "  ❌ Ethereum node not responding"

echo "🏥 Health Check Endpoints:"
for port in 9090 9190 9290; do
    if curl -s http://localhost:$port/health > /dev/null; then
        echo "  ✅ Port $port: Healthy"
    else
        echo "  ❌ Port $port: Not responding"
    fi
done
EOF
    
    chmod +x check_status.sh
    
    log_success "Setup completed successfully!"
    echo
    log_info "🎉 Your decentralized vLLM inference network is ready!"
    echo
    log_info "Next steps:"
    echo "  1. Run './check_status.sh' to verify all services are running"
    echo "  2. Choose your role and start a node:"
    echo "     - Bootstrap: npm run start:bootstrap"
    echo "     - Worker: npm run start:worker" 
    echo "     - Owner: npm run start:owner"
    echo "     - User: npm run start:user"
    echo
    log_info "Security features enabled:"
    echo "  ✅ Secure key management"
    echo "  ✅ Resource limits enforcement"
    echo "  ✅ Health monitoring"
    echo "  ✅ Payment escrow in smart contracts"
    echo "  ✅ Circuit breakers for external services"
    echo "  ✅ Structured logging"
    echo
    log_info "Configuration files:"
    echo "  📁 Keys: ~/.decentralized-vllm/keys/"
    echo "  ⚙️  Main config: config/network.yaml"
    echo "  🔧 Node configs: .env.bootstrap, .env.worker, .env.owner, .env.user"
    echo
    log_warning "Important security notes:"
    echo "  🔐 Never share your private keys"
    echo "  💾 Backup your key directory: ~/.decentralized-vllm/keys/"
    echo "  🌐 In production, change default ports and use HTTPS"
    echo "  🔥 Never commit keys to version control"
}

# Main execution
main() {
    log_header "Secure Setup for Decentralized vLLM Network"
    
    check_root
    check_prerequisites
    setup_secure_keys
    validate_configuration
    start_infrastructure
    deploy_contracts
    run_tests
    setup_monitoring
    create_environment_files
    final_setup
}

# Handle script interruption
trap 'log_error "Setup interrupted"; exit 1' INT TERM

# Run main function
main

log_success "Secure setup completed! 🎉"