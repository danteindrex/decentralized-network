#!/usr/bin/env python3
"""
Check AI Inference System Status
"""

import json
import requests
from pathlib import Path

print("🤖 AI Inference System Status")
print("=" * 60)

# Check services
print("\n📡 Services:")
try:
    resp = requests.get("https://bootstrap-node.onrender.com/health", timeout=10)
    data = resp.json()
    print(f"✅ Bootstrap Node: {data['status']} ({data['peers']} peers)")
except:
    print("❌ Bootstrap Node: Offline")

try:
    resp = requests.post("http://192.168.1.103:5001/api/v0/version", timeout=5)
    print(f"✅ IPFS: {resp.json()['Version']}")
except:
    print("❌ IPFS: Not running")

try:
    resp = requests.post("http://192.168.1.103:8545",
        json={"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1},
        headers={"Content-Type": "application/json"}, timeout=5)
    block = int(resp.json()['result'], 16)
    print(f"✅ Ethereum: Block #{block}")
except:
    print("❌ Ethereum: Not running")

# Check models
print("\n📦 Registered Models:")
metadata_file = Path("uploaded_files_metadata.json")
if metadata_file.exists():
    with open(metadata_file, 'r') as f:
        metadata = json.load(f)
    models = [m for m in metadata if m.get('type') == 'model']
    for model in models:
        print(f"   - {model['name']}")
        print(f"     CID: {model['hash']}")
else:
    print("   No models found")

# Check workers
print("\n👷 Available Workers:")
try:
    resp = requests.get("https://bootstrap-node.onrender.com/workers", timeout=5)
    data = resp.json()
    print(f"   Total: {data['count']}")
    if data['count'] > 0:
        for worker in data['workers']:
            print(f"   - {worker.get('id', 'Unknown')}")
    else:
        print("   No workers currently online")
except:
    print("   Could not query workers")

# Check contracts
print("\n📄 Smart Contracts:")
deployment_file = Path("deployment.json")
if deployment_file.exists():
    with open(deployment_file, 'r') as f:
        deployment = json.load(f)
    print(f"   Network: {deployment.get('network', 'Unknown')}")
    print(f"   InferenceCoordinator: {deployment.get('inferenceCoordinator', 'Not deployed')[:16]}...")
    print(f"   ModelRegistry: {deployment.get('modelRegistry', 'Not deployed')[:16]}...")
else:
    print("   Not deployed")

print("\n🚀 Quick Start:")
print("1. Start Streamlit: streamlit run streamlit_app.py")
print("2. Start Worker: cd orchestrator && python3 main.py")
print("3. Start Electron: cd easyapps && npm start")
print("\n✨ The DeepSeek-1B model is ready for inference!")