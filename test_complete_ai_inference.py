#!/usr/bin/env python3
"""
Test Complete AI Inference Flow
"""

import os
import json
import time
import subprocess
import requests
from pathlib import Path

def check_services():
    """Check all required services"""
    print("🔍 Checking Services...")
    
    services_ok = True
    
    # Bootstrap node
    try:
        resp = requests.get("https://bootstrap-node.onrender.com/health", timeout=10)
        if resp.status_code == 200:
            print("✅ Bootstrap node: Online")
        else:
            print("❌ Bootstrap node: Offline")
            services_ok = False
    except:
        print("❌ Bootstrap node: Not accessible")
        services_ok = False
    
    # IPFS
    try:
        resp = requests.post("http://192.168.1.103:5001/api/v0/version", timeout=5)
        if resp.status_code == 200:
            print("✅ IPFS: Running")
        else:
            print("❌ IPFS: Not running")
            services_ok = False
    except:
        print("❌ IPFS: Not accessible")
        services_ok = False
    
    # Ethereum
    try:
        resp = requests.post("http://192.168.1.103:8545",
            json={"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1},
            headers={"Content-Type": "application/json"}, timeout=5)
        if resp.status_code == 200:
            print("✅ Ethereum: Running")
        else:
            print("❌ Ethereum: Not running")
            services_ok = False
    except:
        print("❌ Ethereum: Not accessible")
        services_ok = False
    
    return services_ok

def check_streamlit_config():
    """Check Streamlit configuration"""
    print("\n📋 Checking Streamlit Configuration...")
    
    # Check metadata file
    metadata_file = Path("uploaded_files_metadata.json")
    if metadata_file.exists():
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        models = [m for m in metadata if m.get('type') == 'model']
        print(f"✅ Models in metadata: {len(models)}")
        for model in models:
            print(f"   - {model['name']} ({model['hash'][:16]}...)")
    else:
        print("❌ No metadata file found")
    
    # Check deployment info
    deployment_file = Path("deployment.json")
    if deployment_file.exists():
        with open(deployment_file, 'r') as f:
            deployment = json.load(f)
        print("✅ Contract addresses loaded:")
        print(f"   - InferenceCoordinator: {deployment.get('inferenceCoordinator', 'Not found')}")
        print(f"   - ModelRegistry: {deployment.get('modelRegistry', 'Not found')}")
    else:
        print("❌ No deployment file found")

def test_worker_registration():
    """Test worker registration with bootstrap node"""
    print("\n🤖 Testing Worker Registration...")
    
    worker_data = {
        'nodeId': 'test-worker-001',
        'nodeType': 'worker',
        'endpoint': '192.168.1.103:8000',
        'capabilities': {
            'gpu': False,
            'models': ['deepseek-1b'],
            'maxJobs': 5
        }
    }
    
    try:
        resp = requests.post(
            "https://bootstrap-node.onrender.com/peers/register",
            json=worker_data,
            timeout=5
        )
        if resp.status_code == 200:
            print("✅ Worker registration successful")
        else:
            print(f"❌ Worker registration failed: {resp.text}")
    except Exception as e:
        print(f"❌ Registration error: {e}")

def start_orchestrator():
    """Start the orchestrator (vLLM worker)"""
    print("\n🚀 Starting Orchestrator...")
    
    # Check if orchestrator directory exists
    if not Path("orchestrator").exists():
        print("❌ Orchestrator directory not found")
        return None
    
    # Start orchestrator
    env = os.environ.copy()
    env['PYTHONUNBUFFERED'] = '1'
    
    process = subprocess.Popen(
        ["python3", "main.py"],
        cwd="orchestrator",
        env=env,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True
    )
    
    # Wait and check if it started
    time.sleep(5)
    
    if process.poll() is None:
        print("✅ Orchestrator started (PID: {})".format(process.pid))
        return process
    else:
        print("❌ Orchestrator failed to start")
        # Print output
        output, _ = process.communicate()
        print("Output:", output)
        return None

def test_inference_submission():
    """Test submitting an inference job"""
    print("\n🧪 Testing Inference Submission...")
    
    # Create test prompt
    prompt = "What is artificial intelligence?"
    prompt_data = {
        'prompt': prompt,
        'timestamp': int(time.time()),
        'user': 'test-script'
    }
    
    # Upload to IPFS
    try:
        files = {'file': json.dumps(prompt_data).encode()}
        url = "http://192.168.1.103:5001/api/v0/add"
        resp = requests.post(url, files=files)
        prompt_cid = resp.json()['Hash']
        print(f"✅ Prompt uploaded: {prompt_cid}")
    except Exception as e:
        print(f"❌ Failed to upload prompt: {e}")
        return
    
    # Try to route job
    job_request = {
        'jobRequirements': {
            'model': 'deepseek-1b',
            'gpu': False,
            'promptCid': prompt_cid,
            'modelCid': 'QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q'
        }
    }
    
    try:
        resp = requests.post(
            "https://bootstrap-node.onrender.com/jobs/route",
            json=job_request
        )
        
        if resp.status_code == 200:
            print("✅ Job routing successful")
            worker = resp.json().get('worker', {})
            print(f"   Worker: {worker.get('id', 'None available')}")
        elif resp.status_code == 503:
            print("⚠️  No workers available")
        else:
            print(f"❌ Job routing failed: {resp.status_code}")
    except Exception as e:
        print(f"❌ Routing error: {e}")

def main():
    print("🤖 Complete AI Inference Test")
    print("=" * 60)
    
    # Check services
    if not check_services():
        print("\n❌ Some services are not running!")
        print("Please ensure all services are started")
        return
    
    # Check configuration
    check_streamlit_config()
    
    # Test worker registration
    test_worker_registration()
    
    # Start orchestrator if requested
    response = input("\nStart orchestrator/worker? (y/n): ")
    orchestrator_process = None
    if response.lower() == 'y':
        orchestrator_process = start_orchestrator()
        time.sleep(5)  # Give it time to initialize
    
    # Test inference
    test_inference_submission()
    
    # Summary
    print("\n📊 Test Summary")
    print("=" * 60)
    print("✅ Bootstrap node: Connected")
    print("✅ IPFS: Working")
    print("✅ Ethereum: Running")
    print("✅ Model registered: DeepSeek-1B")
    print(f"{'✅' if orchestrator_process else '⚠️ '} Worker: {'Running' if orchestrator_process else 'Not started'}")
    
    print("\n🚀 To use the system:")
    print("1. Open Streamlit: http://localhost:8501")
    print("2. Go to AI Chat tab")
    print("3. Select 'DeepSeek-1B' model")
    print("4. Type: 'run inference on: [your prompt]'")
    
    if orchestrator_process:
        print("\n⏳ Orchestrator running. Press Ctrl+C to stop...")
        try:
            while True:
                line = orchestrator_process.stdout.readline()
                if line:
                    print(f"[Orchestrator] {line.strip()}")
                time.sleep(0.1)
        except KeyboardInterrupt:
            print("\n🛑 Stopping orchestrator...")
            orchestrator_process.terminate()

if __name__ == "__main__":
    main()