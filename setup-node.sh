#!/bin/bash

# Node Setup Script for Decentralized AI Inference Network
# Usage: ./setup-node.sh [node-type]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_header() {
    echo -e "${BLUE}$1${NC}"
}

# Show usage
show_usage() {
    echo "Usage: $0 [node-type]"
    echo ""
    echo "Node types:"
    echo "  bootstrap  - Start network coordinator node"
    echo "  worker     - Start AI compute worker node"
    echo "  owner      - Start model owner/manager node"
    echo "  user       - Start user interface node"
    echo "  full       - Start complete network (all nodes)"
    echo ""
    echo "Examples:"
    echo "  $0 worker     # Start a worker node"
    echo "  $0 full       # Start complete network"
    echo "  $0            # Interactive setup"
}

# Check prerequisites
check_prerequisites() {
    print_header "🔍 Checking Prerequisites..."
    
    # Check Docker
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker first."
        exit 1
    fi
    
    # Check Docker Compose
    if ! command -v docker-compose &> /dev/null; then
        print_error "Docker Compose is not installed. Please install Docker Compose first."
        exit 1
    fi
    
    # Check if Docker is running
    if ! docker info &> /dev/null; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    print_status "All prerequisites met ✅"
}

# Interactive node selection
select_node_type() {
    print_header "🚀 Decentralized AI Inference Network - Node Setup"
    echo ""
    echo "Select the type of node you want to run:"
    echo ""
    echo "1) Bootstrap Node  - Network coordinator (start here for new networks)"
    echo "2) Worker Node     - AI compute provider (earn tokens for inference)"
    echo "3) Model Owner     - Upload and manage AI models (earn royalties)"
    echo "4) User Interface  - Submit inference requests (pay for services)"
    echo "5) Full Network    - All nodes together (for testing/development)"
    echo ""
    
    while true; do
        read -p "Enter your choice (1-5): " choice
        case $choice in
            1) NODE_TYPE="bootstrap"; break;;
            2) NODE_TYPE="worker"; break;;
            3) NODE_TYPE="owner"; break;;
            4) NODE_TYPE="user"; break;;
            5) NODE_TYPE="full"; break;;
            *) print_error "Invalid choice. Please enter 1-5.";;
        esac
    done
}

# Setup environment file
setup_environment() {
    print_header "⚙️  Setting up environment for $NODE_TYPE node..."
    
    case $NODE_TYPE in
        "bootstrap")
            if [ -f ".env.bootstrap" ]; then
                cp .env.bootstrap .env
                print_status "Copied bootstrap environment configuration"
            else
                print_warning "Bootstrap environment file not found, using defaults"
            fi
            ;;
        "worker")
            if [ -f ".env.worker" ]; then
                cp .env.worker .env
                print_status "Copied worker environment configuration"
            else
                print_warning "Worker environment file not found, using defaults"
            fi
            ;;
        "owner")
            if [ -f ".env.owner" ]; then
                cp .env.owner .env
                print_status "Copied owner environment configuration"
            else
                print_warning "Owner environment file not found, using defaults"
            fi
            ;;
        "user")
            if [ -f ".env.user" ]; then
                cp .env.user .env
                print_status "Copied user environment configuration"
            else
                print_warning "User environment file not found, using defaults"
            fi
            ;;
        "full")
            if [ -f ".env.example" ]; then
                cp .env.example .env
                print_status "Copied example environment configuration"
            else
                print_warning "Example environment file not found, using defaults"
            fi
            ;;
    esac
}

# Configure wallet (optional)
configure_wallet() {
    print_header "💳 Wallet Configuration"
    echo ""
    echo "Do you want to configure your wallet now? (recommended for production)"
    echo "You can skip this for testing with default accounts."
    echo ""
    
    read -p "Configure wallet? (y/N): " configure
    
    if [[ $configure =~ ^[Yy]$ ]]; then
        echo ""
        echo "⚠️  SECURITY WARNING: Never share your private key!"
        echo "For production, use a dedicated wallet for each node type."
        echo ""
        
        read -p "Enter your private key (or press Enter to skip): " private_key
        read -p "Enter your wallet address (or press Enter to skip): " wallet_address
        
        if [ ! -z "$private_key" ] && [ ! -z "$wallet_address" ]; then
            # Update .env file based on node type
            case $NODE_TYPE in
                "bootstrap")
                    sed -i "s/BOOTSTRAP_PRIVATE_KEY=.*/BOOTSTRAP_PRIVATE_KEY=$private_key/" .env
                    sed -i "s/BOOTSTRAP_ACCOUNT=.*/BOOTSTRAP_ACCOUNT=$wallet_address/" .env
                    ;;
                "worker")
                    sed -i "s/WORKER_PRIVATE_KEY=.*/WORKER_PRIVATE_KEY=$private_key/" .env
                    sed -i "s/WORKER_ACCOUNT=.*/WORKER_ACCOUNT=$wallet_address/" .env
                    ;;
                "owner")
                    sed -i "s/OWNER_PRIVATE_KEY=.*/OWNER_PRIVATE_KEY=$private_key/" .env
                    sed -i "s/OWNER_ACCOUNT=.*/OWNER_ACCOUNT=$wallet_address/" .env
                    ;;
                "user")
                    sed -i "s/USER_PRIVATE_KEY=.*/USER_PRIVATE_KEY=$private_key/" .env
                    sed -i "s/USER_ACCOUNT=.*/USER_ACCOUNT=$wallet_address/" .env
                    ;;
            esac
            print_status "Wallet configuration updated"
        fi
    fi
}

# Configure resources for worker node
configure_worker_resources() {
    if [ "$NODE_TYPE" = "worker" ]; then
        print_header "🔧 Worker Node Resource Configuration"
        echo ""
        echo "Configure how much of your system resources to contribute:"
        echo "(Leave empty to use defaults)"
        echo ""
        
        read -p "CPU cores to contribute (default: 10): " cpu_contrib
        read -p "RAM in GB to contribute (default: 15): " ram_contrib
        read -p "GPU memory in GB (default: 10): " gpu_contrib
        read -p "Storage in GB (default: 5): " storage_contrib
        
        # Update .env with resource configuration
        [ ! -z "$cpu_contrib" ] && sed -i "s/CPU_CONTRIBUTION=.*/CPU_CONTRIBUTION=$cpu_contrib/" .env
        [ ! -z "$ram_contrib" ] && sed -i "s/RAM_CONTRIBUTION=.*/RAM_CONTRIBUTION=$ram_contrib/" .env
        [ ! -z "$gpu_contrib" ] && sed -i "s/GPU_CONTRIBUTION=.*/GPU_CONTRIBUTION=$gpu_contrib/" .env
        [ ! -z "$storage_contrib" ] && sed -i "s/STORAGE_CONTRIBUTION=.*/STORAGE_CONTRIBUTION=$storage_contrib/" .env
        
        print_status "Worker resource configuration updated"
    fi
}

# Start the node
start_node() {
    print_header "🚀 Starting $NODE_TYPE node..."
    
    # Pull latest images
    print_status "Pulling latest Docker images..."
    docker-compose --profile $NODE_TYPE pull
    
    # Start the services
    print_status "Starting services..."
    docker-compose --profile $NODE_TYPE up -d
    
    # Wait a moment for services to start
    sleep 5
    
    # Check status
    print_status "Checking service status..."
    docker-compose ps
}

# Show connection info
show_connection_info() {
    print_header "🌐 Connection Information"
    echo ""
    
    case $NODE_TYPE in
        "bootstrap")
            echo "Bootstrap Node Services:"
            echo "  • P2P Bootstrap: localhost:30303"
            echo "  • Mobile PWA: http://localhost:8080"
            echo "  • Status: docker-compose logs bootstrap-node"
            ;;
        "worker")
            echo "Worker Node Services:"
            echo "  • vLLM Inference: http://localhost:8000"
            echo "  • Health Check: http://localhost:8000/health"
            echo "  • Status: docker-compose logs worker-node"
            ;;
        "owner")
            echo "Model Owner Services:"
            echo "  • Management API: http://localhost:8002"
            echo "  • Status: docker-compose logs model-owner"
            ;;
        "user")
            echo "User Interface Services:"
            echo "  • Streamlit Web App: http://localhost:8501"
            echo "  • Status: docker-compose logs streamlit"
            ;;
        "full")
            echo "Full Network Services:"
            echo "  • Streamlit Web App: http://localhost:8501"
            echo "  • Mobile PWA: http://localhost:8080"
            echo "  • vLLM Inference: http://localhost:8000"
            echo "  • Owner Management: http://localhost:8002"
            echo "  • Ethereum RPC: http://localhost:8545"
            echo "  • IPFS Gateway: http://localhost:8080"
            ;;
    esac
    
    echo ""
    echo "Useful Commands:"
    echo "  • View logs: docker-compose logs -f [service-name]"
    echo "  • Stop node: docker-compose down"
    echo "  • Restart node: docker-compose restart"
    echo "  • Update node: docker-compose pull && docker-compose up -d"
}

# Main execution
main() {
    # Parse command line argument
    if [ $# -eq 1 ]; then
        case $1 in
            "bootstrap"|"worker"|"owner"|"user"|"full")
                NODE_TYPE=$1
                ;;
            "-h"|"--help")
                show_usage
                exit 0
                ;;
            *)
                print_error "Invalid node type: $1"
                show_usage
                exit 1
                ;;
        esac
    elif [ $# -eq 0 ]; then
        select_node_type
    else
        print_error "Too many arguments"
        show_usage
        exit 1
    fi
    
    # Run setup steps
    check_prerequisites
    setup_environment
    configure_wallet
    configure_worker_resources
    start_node
    show_connection_info
    
    print_header "✅ Node setup complete!"
    echo ""
    print_status "Your $NODE_TYPE node is now running."
    print_status "Check the logs with: docker-compose logs -f"
    print_status "Stop the node with: docker-compose down"
}

# Run main function
main "$@"