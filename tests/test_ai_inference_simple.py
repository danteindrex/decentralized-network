#!/usr/bin/env python3
"""
Simple AI Inference Test
Tests the current state without Flask dependencies
"""

import json
import time
import requests

# Configuration
CONFIG = {
    'bootstrap_url': 'https://bootstrap-node.onrender.com',
    'ipfs_host': '192.168.1.103',
    'ipfs_port': 5001,
    'model_cid': 'QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q'  # DeepSeek model
}

def test_services():
    """Test all services are running"""
    print("🔍 Checking Services...")
    
    # Test Bootstrap Node
    try:
        response = requests.get(f"{CONFIG['bootstrap_url']}/health", timeout=5)
        if response.status_code == 200:
            data = response.json()
            print(f"✅ Bootstrap node: {data['status']} - {data['peers']} peers")
            bootstrap_ok = True
        else:
            print("❌ Bootstrap node not responding")
            bootstrap_ok = False
    except Exception as e:
        print(f"❌ Bootstrap node error: {e}")
        bootstrap_ok = False
    
    # Test IPFS
    try:
        url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/version"
        response = requests.post(url, timeout=5)
        if response.status_code == 200:
            version = response.json()['Version']
            print(f"✅ IPFS running - Version: {version}")
            ipfs_ok = True
        else:
            print("❌ IPFS not responding")
            ipfs_ok = False
    except Exception as e:
        print(f"❌ IPFS error: {e}")
        ipfs_ok = False
    
    return bootstrap_ok and ipfs_ok

def test_network_config():
    """Test getting network configuration"""
    print("\n📡 Getting Network Configuration...")
    
    try:
        response = requests.get(f"{CONFIG['bootstrap_url']}/api/network-config")
        if response.status_code == 200:
            config = response.json()
            print(f"✅ Network ID: {config['network_id']}")
            print(f"   Chain ID: {config['chain_id']}")
            print(f"   Contract Address: {config['contract_address'] or 'Not deployed'}")
            print(f"   Model Registry: {config['model_registry_address'] or 'Not deployed'}")
            print(f"   Bootstrap Nodes: {len(config['bootstrap_nodes'])}")
            return config
        else:
            print("❌ Failed to get network config")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_worker_availability():
    """Check for available workers"""
    print("\n👷 Checking Worker Availability...")
    
    try:
        response = requests.get(f"{CONFIG['bootstrap_url']}/workers")
        if response.status_code == 200:
            data = response.json()
            print(f"📋 Workers found: {data['count']}")
            
            if data['count'] > 0:
                print("   Available workers:")
                for worker in data['workers']:
                    print(f"   - {worker.get('id', 'Unknown')} at {worker.get('endpoint', 'Unknown')}")
            else:
                print("   ⚠️  No workers currently available")
                print("   💡 Workers will auto-join when started")
            
            return data
        else:
            print("❌ Failed to query workers")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def test_inference_simulation():
    """Simulate an inference request"""
    print("\n🧪 Simulating Inference Request...")
    
    # 1. Create and upload prompt
    prompt = "Explain quantum computing in simple terms"
    prompt_data = {
        'prompt': prompt,
        'model': 'deepseek-1b',
        'user': 'test-user',
        'timestamp': int(time.time())
    }
    
    try:
        files = {'file': json.dumps(prompt_data).encode()}
        url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
        response = requests.post(url, files=files)
        prompt_cid = response.json()['Hash']
        print(f"✅ Prompt uploaded to IPFS: {prompt_cid}")
    except Exception as e:
        print(f"❌ Failed to upload prompt: {e}")
        return
    
    # 2. Try to route job through bootstrap
    job_request = {
        'jobRequirements': {
            'model': 'deepseek-1b',
            'gpu': False,
            'promptCid': prompt_cid,
            'modelCid': CONFIG['model_cid']
        }
    }
    
    try:
        response = requests.post(
            f"{CONFIG['bootstrap_url']}/jobs/route",
            json=job_request
        )
        
        if response.status_code == 200:
            worker = response.json()['worker']
            print(f"✅ Job can be routed to worker: {worker.get('id')}")
            print(f"   Worker endpoint: {worker.get('endpoint')}")
        elif response.status_code == 503:
            print("⚠️  No workers available to process job")
            print("   This is expected if no worker nodes are running")
        else:
            print(f"❌ Unexpected response: {response.status_code}")
    except Exception as e:
        print(f"❌ Error routing job: {e}")

def display_current_status():
    """Display the current system status"""
    print("\n📊 Current System Status")
    print("=" * 60)
    
    print("✅ Components Ready:")
    print("   - Bootstrap node deployed and live")
    print("   - IPFS node running")
    print("   - Smart contracts deployed (local)")
    print("   - DeepSeek-1B model registered")
    print("   - Network discovery enabled")
    
    print("\n⚠️  Components Needed:")
    print("   - Deploy contracts to public network")
    print("   - Start GPU worker nodes")
    print("   - Configure vLLM for model serving")
    print("   - Update bootstrap with contract addresses")
    
    print("\n🚀 Next Steps:")
    print("   1. Deploy contracts to testnet/mainnet")
    print("   2. Update bootstrap node configuration")
    print("   3. Start worker nodes with:")
    print("      python3 start_worker_node.py")
    print("   4. Test with Electron app:")
    print("      cd easyapps && npm start")

def main():
    print("🤖 AI Inference System Test")
    print("=" * 60)
    
    # Test services
    if not test_services():
        print("\n⚠️  Some services are not running!")
        return
    
    # Get network config
    config = test_network_config()
    
    # Check workers
    test_worker_availability()
    
    # Simulate inference
    test_inference_simulation()
    
    # Display status
    display_current_status()

if __name__ == "__main__":
    main()