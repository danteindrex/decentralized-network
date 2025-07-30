#!/usr/bin/env python3
"""
Enable Dynamic Network Discovery
Remove hardcoded values and use bootstrap node discovery
"""

import json
import os
import yaml
from pathlib import Path

def update_streamlit_config():
    """Update Streamlit to use dynamic discovery"""
    print("📝 Updating Streamlit for dynamic discovery...")
    
    # Create environment with bootstrap node only
    env_content = """# Dynamic AI Inference Network Configuration
# Uses bootstrap node for automatic discovery
BOOTSTRAP_URL=https://bootstrap-node.onrender.com
ETH_NODE=  # Will be discovered automatically
IPFS_HOST=  # Will be discovered automatically
IPFS_PORT=  # Will be discovered automatically
CONTRACT_ADDRESS=  # Will be discovered from deployment.json
"""
    
    with open(".env", "w") as f:
        f.write(env_content)
    
    print("✅ Updated .env for dynamic discovery")

def update_orchestrator_config():
    """Update orchestrator to use dynamic discovery"""
    print("📝 Updating orchestrator for dynamic discovery...")
    
    config_path = Path("orchestrator/config.yaml")
    if not config_path.exists():
        print("❌ orchestrator/config.yaml not found")
        return
    
    with open(config_path, 'r') as f:
        config = yaml.safe_load(f)
    
    # Clear hardcoded bootstrap nodes - use discovery
    config['network']['bootstrap_nodes'] = [
        'https://bootstrap-node.onrender.com'  # Primary discovery entry point
    ]
    
    # Enable dynamic discovery features
    config['network']['enable_discovery'] = True
    config['network']['discovery_interval'] = 30
    config['network']['auto_connect'] = True
    
    # Remove hardcoded IPs - will be discovered
    config['eth_node'] = 'auto-discover'  # Special value for auto-discovery
    config['ipfs_host'] = 'auto-discover'
    config['ipfs_port'] = 'auto-discover'
    
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False)
    
    print("✅ Updated orchestrator config for dynamic discovery")

def update_electron_config():
    """Update Electron app for dynamic discovery"""
    print("📝 Updating Electron app for dynamic discovery...")
    
    # Update .env to only have bootstrap node
    electron_env = Path("easyapps/.env")
    env_content = """# Dynamic AI Inference Network Configuration
BOOTSTRAP_URL=https://bootstrap-node.onrender.com
DOCKER_BOOTSTRAP_URL=https://bootstrap-node.onrender.com
# All other values will be auto-discovered
"""
    
    with open(electron_env, "w") as f:
        f.write(env_content)
    
    print("✅ Updated Electron .env for dynamic discovery")

def create_dynamic_discovery_test():
    """Create a test script for dynamic discovery"""
    print("📝 Creating dynamic discovery test...")
    
    test_script = """#!/usr/bin/env python3
\"\"\"
Test Dynamic Network Discovery
Shows how nodes discover each other automatically
\"\"\"

import requests
import json

BOOTSTRAP_NODE = "https://bootstrap-node.onrender.com"

def test_network_discovery():
    print("🔍 Testing Dynamic Network Discovery")
    print("=" * 60)
    
    # 1. Get network configuration from bootstrap
    print("\\n1️⃣ Discovering network configuration...")
    try:
        resp = requests.get(f"{BOOTSTRAP_NODE}/api/network-config")
        config = resp.json()
        print(f"   ✅ Network ID: {config['network_id']}")
        print(f"   📡 Bootstrap nodes found: {len(config['bootstrap_nodes'])}")
        for node in config['bootstrap_nodes']:
            print(f"      - {node['url']}")
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # 2. Discover real peers
    print("\\n2️⃣ Discovering real network peers...")
    try:
        resp = requests.get(f"{BOOTSTRAP_NODE}/debug/discovery")
        discovery = resp.json()
        
        real_peers = discovery.get('realPeers', [])
        registered_peers = discovery.get('registeredPeers', [])
        
        print(f"   🤝 Real peers discovered: {len(real_peers)}")
        for peer in real_peers:
            print(f"      - {peer.get('nodeType', 'unknown')} at {peer.get('endpoint', 'unknown')} (via {peer.get('discoveryMethod', 'unknown')})")
        
        print(f"   📝 Registered peers: {len(registered_peers)}")
        for peer in registered_peers:
            print(f"      - {peer.get('nodeType', 'unknown')} at {peer.get('endpoint', 'unknown')}")
            
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    # 3. Test worker discovery
    print("\\n3️⃣ Discovering available workers...")
    try:
        resp = requests.get(f"{BOOTSTRAP_NODE}/workers")
        workers = resp.json()
        print(f"   👷 Workers available: {workers['count']}")
        
        for worker in workers['workers']:
            print(f"      - {worker.get('id', 'unknown')} ({worker.get('capabilities', {})})")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\\n💡 Dynamic Discovery Benefits:")
    print("   - No hardcoded IP addresses")
    print("   - Automatic peer discovery")
    print("   - Network grows organically")
    print("   - Self-healing connections")
    print("   - Load balancing across discovered nodes")

if __name__ == "__main__":
    test_network_discovery()
"""
    
    with open("test_dynamic_discovery.py", "w") as f:
        f.write(test_script)
    
    print("✅ Created test_dynamic_discovery.py")

def create_network_bootstrap_guide():
    """Create guide for bootstrapping new networks"""
    print("📝 Creating network bootstrap guide...")
    
    guide = """# Dynamic Network Discovery Guide

## How It Works

The AI inference network uses dynamic discovery to eliminate hardcoded values and enable organic growth:

### 1. Bootstrap Discovery
- Nodes start with only ONE bootstrap node URL
- Bootstrap node provides network configuration
- No hardcoded IP addresses or ports needed

### 2. Peer Discovery Methods
- **Real Peer Discovery**: Monitor blockchain connections
- **Registration**: Nodes register with bootstrap
- **Local Scanning**: Development mode discovery
- **Cross-Reference**: Verify registered peers

### 3. Automatic Configuration
- ETH node URLs discovered from peers
- IPFS endpoints found automatically  
- Contract addresses loaded from deployment
- Worker capabilities auto-detected

## Starting a New Network

### 1. Deploy Bootstrap Node
```bash
# Set your static IP
export STATIC_IP=your.public.ip
node nodes/bootstrap/bootstrap-node.js
```

### 2. Start Worker Nodes
```bash
# Workers discover network automatically
cd orchestrator
python3 main.py
```

### 3. Connect Applications
```bash
# Streamlit app
streamlit run streamlit_app.py

# Electron app  
cd easyapps && npm start
```

## Network Growth

- New nodes only need bootstrap URL
- Peers discover each other automatically
- Network becomes self-sustaining
- Load balances across discovered nodes
- Handles node failures gracefully

## Configuration Files

All apps now use minimal configuration:

- **Bootstrap URL only**: https://bootstrap-node.onrender.com
- **Auto-discovery**: Everything else discovered dynamically
- **No hardcoded IPs**: Network grows organically
"""
    
    with open("NETWORK_DISCOVERY.md", "w") as f:
        f.write(guide)
    
    print("✅ Created NETWORK_DISCOVERY.md")

def main():
    print("🌐 Enabling Dynamic Network Discovery")
    print("=" * 60)
    
    # Update configurations
    update_streamlit_config()
    update_orchestrator_config()
    update_electron_config()
    
    # Create test and documentation
    create_dynamic_discovery_test()
    create_network_bootstrap_guide()
    
    print("\\n✅ Dynamic discovery enabled!")
    print("\\n🚀 Benefits:")
    print("   - No hardcoded IP addresses")
    print("   - Automatic peer discovery") 
    print("   - Organic network growth")
    print("   - Self-healing connections")
    print("\\n🧪 Test with:")
    print("   python3 test_dynamic_discovery.py")

if __name__ == "__main__":
    main()