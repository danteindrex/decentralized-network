#!/usr/bin/env python3
"""
Test Dynamic Network Discovery
Shows how nodes discover each other automatically
"""

import requests
import json

BOOTSTRAP_NODE = "https://bootstrap-node.onrender.com"

def test_network_discovery():
    print("🔍 Testing Dynamic Network Discovery")
    print("=" * 60)
    
    # 1. Get network configuration from bootstrap
    print("\n1️⃣ Discovering network configuration...")
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
    print("\n2️⃣ Discovering real network peers...")
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
    print("\n3️⃣ Discovering available workers...")
    try:
        resp = requests.get(f"{BOOTSTRAP_NODE}/workers")
        workers = resp.json()
        print(f"   👷 Workers available: {workers['count']}")
        
        for worker in workers['workers']:
            print(f"      - {worker.get('id', 'unknown')} ({worker.get('capabilities', {})})")
    except Exception as e:
        print(f"   ❌ Error: {e}")
    
    print("\n💡 Dynamic Discovery Benefits:")
    print("   - No hardcoded IP addresses")
    print("   - Automatic peer discovery")
    print("   - Network grows organically")
    print("   - Self-healing connections")
    print("   - Load balancing across discovered nodes")

if __name__ == "__main__":
    test_network_discovery()
