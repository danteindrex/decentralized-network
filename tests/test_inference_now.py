#!/usr/bin/env python3
"""
Test AI Inference Right Now
Simple script to test the current state of AI inference
"""

import os
import json
import requests
import time

# Configuration
IPFS_HOST = "192.168.1.103"
IPFS_PORT = 5001
ETH_NODE = "http://192.168.1.103:8545"

def test_services():
    """Test if services are running"""
    print("🔍 Checking Services...")
    
    # Test IPFS
    try:
        url = f"http://{IPFS_HOST}:{IPFS_PORT}/api/v0/version"
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
    
    # Test Ethereum
    try:
        response = requests.post(ETH_NODE, 
            json={"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1},
            headers={"Content-Type": "application/json"})
        if response.status_code == 200:
            block = int(response.json()['result'], 16)
            print(f"✅ Ethereum running - Block: {block}")
            eth_ok = True
        else:
            print("❌ Ethereum not responding")
            eth_ok = False
    except Exception as e:
        print(f"❌ Ethereum error: {e}")
        eth_ok = False
    
    return ipfs_ok and eth_ok

def upload_model_metadata():
    """Upload a simple model metadata to IPFS"""
    print("\n📤 Uploading Model Metadata...")
    
    # Check if we have the DeepSeek model
    model_path = "/home/lambda/contracts/models/deepseek-1b/config.json"
    if os.path.exists(model_path):
        print("✅ Found DeepSeek-1B model config")
        with open(model_path, 'r') as f:
            model_config = json.load(f)
    else:
        # Create mock model metadata
        model_config = {
            "name": "mock-llm",
            "type": "text-generation",
            "version": "1.0",
            "description": "Mock LLM for testing"
        }
    
    # Upload to IPFS
    url = f"http://{IPFS_HOST}:{IPFS_PORT}/api/v0/add"
    files = {'file': json.dumps(model_config, indent=2).encode()}
    
    try:
        response = requests.post(url, files=files)
        if response.status_code == 200:
            cid = response.json()['Hash']
            print(f"✅ Model metadata uploaded - CID: {cid}")
            return cid
        else:
            print(f"❌ Upload failed: {response.text}")
            return None
    except Exception as e:
        print(f"❌ Error: {e}")
        return None

def simulate_inference_flow():
    """Simulate the complete inference flow"""
    print("\n🧪 Simulating AI Inference Flow...")
    
    # 1. Upload prompt
    prompt = "What is the meaning of life?"
    prompt_data = {
        "prompt": prompt,
        "timestamp": int(time.time()),
        "user": "test-user"
    }
    
    url = f"http://{IPFS_HOST}:{IPFS_PORT}/api/v0/add"
    files = {'file': json.dumps(prompt_data).encode()}
    
    try:
        response = requests.post(url, files=files)
        prompt_cid = response.json()['Hash']
        print(f"✅ Prompt uploaded - CID: {prompt_cid}")
    except:
        print("❌ Failed to upload prompt")
        return
    
    # 2. Simulate worker processing
    print("⏳ Simulating worker processing...")
    time.sleep(2)  # Simulate processing time
    
    # 3. Create and upload response
    response_data = {
        "prompt_cid": prompt_cid,
        "response": "The meaning of life, according to Douglas Adams, is 42. But philosophically, it's about finding purpose, creating connections, and contributing to something greater than ourselves.",
        "model": "mock-llm-v1",
        "worker": "worker-001",
        "processing_time": 2.1,
        "timestamp": int(time.time())
    }
    
    files = {'file': json.dumps(response_data, indent=2).encode()}
    response = requests.post(url, files=files)
    response_cid = response.json()['Hash']
    print(f"✅ Response uploaded - CID: {response_cid}")
    
    # 4. Retrieve and display response
    cat_url = f"http://{IPFS_HOST}:{IPFS_PORT}/api/v0/cat?arg={response_cid}"
    response = requests.post(cat_url)
    result = json.loads(response.text)
    
    print("\n📋 Inference Result:")
    print("=" * 60)
    print(f"Prompt: {prompt}")
    print(f"Response: {result['response']}")
    print(f"Model: {result['model']}")
    print(f"Worker: {result['worker']}")
    print(f"Time: {result['processing_time']}s")
    print("=" * 60)

def test_with_streamlit():
    """Instructions for testing with Streamlit"""
    print("\n🚀 To Test with Real UI:")
    print("=" * 60)
    print("1. Start Streamlit app:")
    print("   streamlit run streamlit_app.py")
    print("")
    print("2. Or use the IPFS model storage app:")
    print("   cd ipfs/model-storage")
    print("   streamlit run streamlit_app.py")
    print("")
    print("3. The app will:")
    print("   - Let you select/upload models")
    print("   - Submit inference jobs")
    print("   - Monitor job completion")
    print("   - Display results")
    print("=" * 60)

def main():
    print("🤖 AI Inference Test - Current State")
    print("=" * 60)
    
    # Check services
    if not test_services():
        print("\n⚠️  Required services not running!")
        print("Start them with:")
        print("  - IPFS: ipfs daemon")
        print("  - Ethereum: cd /home/lambda/contracts && npx hardhat node")
        return
    
    # Upload model
    model_cid = upload_model_metadata()
    if model_cid:
        print(f"\n📝 Use this model CID for testing: {model_cid}")
    
    # Simulate inference
    simulate_inference_flow()
    
    # Instructions
    test_with_streamlit()
    
    print("\n✅ Basic infrastructure is working!")
    print("\n⚠️  Note: For real inference, you need:")
    print("  1. Smart contracts deployed")
    print("  2. Worker nodes running")
    print("  3. Models uploaded to IPFS")
    print("  4. ETH for gas fees")

if __name__ == "__main__":
    main()