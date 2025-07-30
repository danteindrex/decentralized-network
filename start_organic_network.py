#!/usr/bin/env python3
"""
Start Organic AI Inference Network
Demonstrates how nodes discover each other dynamically
"""

import subprocess
import time
import requests
import json

BOOTSTRAP_NODE = "https://bootstrap-node.onrender.com"

def show_network_status():
    """Show current network status using discovery"""
    print("\n🌐 Network Status (via Dynamic Discovery)")
    print("=" * 60)
    
    try:
        # Get network configuration
        resp = requests.get(f"{BOOTSTRAP_NODE}/api/network-config", timeout=10)
        config = resp.json()
        
        print(f"📡 Network: {config['network_id']}")
        print(f"⛓️  Chain ID: {config['chain_id']}")
        print(f"🔗 Bootstrap Nodes: {len(config['bootstrap_nodes'])}")
        
        # Get peer discovery info
        resp = requests.get(f"{BOOTSTRAP_NODE}/debug/discovery", timeout=5)
        discovery = resp.json() if resp.status_code == 200 else {}
        
        real_peers = discovery.get('realPeers', [])
        registered_peers = discovery.get('registeredPeers', [])
        
        print(f"🤝 Real Peers Discovered: {len(real_peers)}")
        for peer in real_peers:
            print(f"   - {peer.get('nodeType', 'unknown')} at {peer.get('endpoint', 'unknown')}")
        
        print(f"📝 Registered Peers: {len(registered_peers)}")
        for peer in registered_peers:
            print(f"   - {peer.get('nodeType', 'unknown')} at {peer.get('endpoint', 'unknown')}")
        
        # Get workers
        resp = requests.get(f"{BOOTSTRAP_NODE}/workers", timeout=5)
        workers = resp.json()
        print(f"👷 Available Workers: {workers['count']}")
        
    except Exception as e:
        print(f"❌ Error getting network status: {e}")

def register_mock_worker():
    """Register a mock worker to demonstrate discovery"""
    print("\n🤖 Registering Mock Worker for Demo...")
    
    worker_data = {
        'nodeId': 'demo-worker-dynamic',
        'nodeType': 'worker', 
        'endpoint': 'localhost:8002',
        'capabilities': {
            'gpu': False,
            'models': ['deepseek-1b'],
            'maxJobs': 5,
            'vllm': True
        },
        'version': '2.0.0'
    }
    
    try:
        resp = requests.post(
            f"{BOOTSTRAP_NODE}/peers/register",
            json=worker_data,
            timeout=10
        )
        
        if resp.status_code == 200:
            data = resp.json()
            print("✅ Worker registered successfully!")
            print(f"   📋 Received bootstrap info:")
            bootstrap_info = data.get('bootstrapInfo', {})
            print(f"      - RPC Endpoint: {bootstrap_info.get('rpcEndpoint', 'Not provided')}")
            print(f"      - Network ID: {bootstrap_info.get('networkId', 'Not provided')}")
            print(f"      - Enode: {bootstrap_info.get('enode', 'Not provided')[:50]}...")
            return True
        else:
            print(f"❌ Registration failed: {resp.text}")
            return False
    except Exception as e:
        print(f"❌ Registration error: {e}")
        return False

def demonstrate_organic_growth():
    """Demonstrate how the network grows organically"""
    print("\n🌱 Demonstrating Organic Network Growth")
    print("=" * 60)
    
    print("\n1️⃣ Initial Network State:")
    show_network_status()
    
    print("\n2️⃣ New Node Joining Network:")
    print("   - Node only needs bootstrap URL")
    print("   - All other config discovered automatically")
    if register_mock_worker():
        time.sleep(2)  # Give time for registration to propagate
        
        print("\n3️⃣ Network After Node Join:")
        show_network_status()
        
        print("\n✨ Organic Growth Benefits:")
        print("   - New nodes auto-discover existing infrastructure")
        print("   - No manual IP configuration needed")
        print("   - Load balances across all discovered workers")
        print("   - Network becomes self-sustaining")

def show_app_startup_process():
    """Show how apps start up with dynamic discovery"""
    print("\n🚀 Application Startup with Dynamic Discovery")
    print("=" * 60)
    
    apps = [
        {
            'name': 'Streamlit App',
            'command': 'streamlit run streamlit_app.py',
            'discovery': [
                '1. Contacts bootstrap node',
                '2. Gets network configuration', 
                '3. Discovers ETH/IPFS endpoints',
                '4. Loads contract addresses',
                '5. Ready for AI inference'
            ]
        },
        {
            'name': 'Electron App', 
            'command': 'cd easyapps && npm start',
            'discovery': [
                '1. Reads bootstrap URL from .env',
                '2. Auto-generates wallet if needed',
                '3. Discovers network nodes',
                '4. Configures connections automatically',
                '5. Starts with full functionality'
            ]
        },
        {
            'name': 'vLLM Worker',
            'command': 'cd orchestrator && python3 main.py',
            'discovery': [
                '1. Reads bootstrap from config.yaml',
                '2. Discovers ETH/IPFS endpoints',
                '3. Registers with network',
                '4. Starts accepting inference jobs',
                '5. Reports status to bootstrap'
            ]
        }
    ]
    
    for app in apps:
        print(f"\n📱 {app['name']}:")
        print(f"   Command: {app['command']}")
        print(f"   Discovery Process:")
        for step in app['discovery']:
            print(f"      {step}")

def main():
    print("🌐 Organic AI Inference Network")
    print("=" * 60)
    print("This network uses dynamic discovery for organic growth!")
    print("No hardcoded IPs - nodes discover each other automatically.")
    
    # Show current status
    show_network_status()
    
    # Demonstrate growth
    demonstrate_organic_growth()
    
    # Show app startup
    show_app_startup_process()
    
    print("\n" + "="*60)
    print("🎉 Network is ready for organic growth!")
    print("\n💡 To start applications:")
    print("   streamlit run streamlit_app.py    # UI for AI inference") 
    print("   cd easyapps && npm start          # Electron desktop app")
    print("   cd orchestrator && python3 main.py # vLLM worker node")
    print("\n🌱 Each new node will:")
    print("   - Discover the network automatically")
    print("   - Connect to existing infrastructure") 
    print("   - Contribute to network capacity")
    print("   - Enable natural scaling")

if __name__ == "__main__":
    main()