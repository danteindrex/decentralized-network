#!/usr/bin/env python3
"""
Test network connection and peer discovery
"""

import requests
import time

def test_bootstrap_connection():
    """Test connection to bootstrap node"""
    print("🧪 Testing bootstrap node connection...")
    
    try:
        response = requests.get('https://bootstrap-node.onrender.com/health', timeout=5)
        if response.status_code == 200:
            print("✅ Bootstrap node is online!")
            print(f"   Response: {response.text[:100]}...")
            return True
        else:
            print(f"⚠️ Bootstrap node responded with status: {response.status_code}")
            return False
    except requests.exceptions.Timeout:
        print("⚠️ Bootstrap node connection timed out")
        return False
    except Exception as e:
        print(f"❌ Bootstrap node connection failed: {e}")
        return False

def test_peer_list():
    """Test getting peer list from bootstrap"""
    print("\n🧪 Testing peer list retrieval...")
    
    try:
        response = requests.get('https://bootstrap-node.onrender.com/peers', timeout=5)
        if response.status_code == 200:
            peers_data = response.json()
            peer_count = len(peers_data.get('peers', []))
            print(f"✅ Found {peer_count} peers in network")
            return peer_count
        else:
            print(f"⚠️ Peers endpoint responded with status: {response.status_code}")
            return 0
    except Exception as e:
        print(f"❌ Failed to get peer list: {e}")
        return 0

def main():
    print("🌐 Network Discovery Test\n")
    
    # Test bootstrap connection
    bootstrap_online = test_bootstrap_connection()
    
    # Test peer discovery
    peer_count = test_peer_list()
    
    print(f"\n📊 Results:")
    print(f"   Bootstrap Node: {'Online' if bootstrap_online else 'Offline'}")
    print(f"   Network Peers: {peer_count}")
    
    if bootstrap_online:
        print("\n🎉 Network is accessible! Peer discovery will work.")
        print("🚀 You can now launch the Streamlit app with peer discovery.")
    else:
        print("\n⚠️ Network not accessible. App will run in offline mode.")
        print("🔧 Check your internet connection or try again later.")
    
    return bootstrap_online

if __name__ == "__main__":
    main()