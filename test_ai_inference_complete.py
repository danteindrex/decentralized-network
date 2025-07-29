#!/usr/bin/env python3
"""
Complete AI Inference Test
Simulates the full flow with bootstrap node and mock workers
"""

import os
import json
import time
import requests
import threading
from flask import Flask, request, jsonify

# Configuration
CONFIG = {
    'bootstrap_url': 'https://bootstrap-node.onrender.com',
    'ipfs_host': '192.168.1.103',
    'ipfs_port': 5001,
    'model_cid': 'QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q'  # DeepSeek model
}

class MockWorker:
    """Mock worker that processes inference jobs"""
    def __init__(self, worker_id, port):
        self.worker_id = worker_id
        self.port = port
        self.app = Flask(__name__)
        self.jobs = {}
        self.setup_routes()
        
    def setup_routes(self):
        @self.app.route('/health', methods=['GET'])
        def health():
            return jsonify({'status': 'healthy', 'worker_id': self.worker_id})
        
        @self.app.route('/inference', methods=['POST'])
        def handle_inference():
            data = request.json
            job_id = data.get('job_id', f"job_{int(time.time())}")
            
            # Process in background
            threading.Thread(
                target=self.process_job,
                args=(job_id, data)
            ).start()
            
            return jsonify({
                'status': 'accepted',
                'job_id': job_id
            })
        
        @self.app.route('/job/<job_id>', methods=['GET'])
        def get_job_status(job_id):
            return jsonify(self.jobs.get(job_id, {'status': 'not_found'}))
    
    def process_job(self, job_id, data):
        """Simulate processing an inference job"""
        print(f"[{self.worker_id}] Processing job {job_id}")
        
        self.jobs[job_id] = {'status': 'processing'}
        
        # Simulate processing time
        time.sleep(2)
        
        # Generate mock response
        response_text = f"Mock response from {self.worker_id} for job {job_id}"
        
        # Upload response to IPFS
        response_data = {
            'job_id': job_id,
            'response': response_text,
            'worker_id': self.worker_id,
            'timestamp': int(time.time())
        }
        
        try:
            files = {'file': json.dumps(response_data).encode()}
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
            response = requests.post(url, files=files)
            response_cid = response.json()['Hash']
            
            self.jobs[job_id] = {
                'status': 'completed',
                'response_cid': response_cid
            }
            print(f"[{self.worker_id}] Job {job_id} completed: {response_cid}")
        except Exception as e:
            self.jobs[job_id] = {
                'status': 'failed',
                'error': str(e)
            }
    
    def register_with_bootstrap(self):
        """Register with bootstrap node"""
        try:
            data = {
                'nodeId': self.worker_id,
                'nodeType': 'worker',
                'endpoint': f"localhost:{self.port}",
                'capabilities': {
                    'gpu': False,
                    'models': ['deepseek-1b', 'mock-llm'],
                    'maxJobs': 5
                }
            }
            
            response = requests.post(
                f"{CONFIG['bootstrap_url']}/peers/register",
                json=data
            )
            
            if response.status_code == 200:
                print(f"[{self.worker_id}] Registered with bootstrap node")
                return True
            else:
                print(f"[{self.worker_id}] Failed to register: {response.text}")
                return False
        except Exception as e:
            print(f"[{self.worker_id}] Registration error: {e}")
            return False
    
    def start(self):
        """Start the worker"""
        if self.register_with_bootstrap():
            print(f"[{self.worker_id}] Starting on port {self.port}")
            self.app.run(host='0.0.0.0', port=self.port, debug=False)

def test_inference_flow():
    """Test the complete inference flow"""
    print("\n🧪 Testing AI Inference Flow")
    print("=" * 60)
    
    # 1. Check bootstrap node
    print("\n1️⃣ Checking bootstrap node...")
    try:
        response = requests.get(f"{CONFIG['bootstrap_url']}/health")
        if response.status_code == 200:
            data = response.json()
            print(f"   ✅ Bootstrap node healthy - {data['peers']} peers connected")
        else:
            print("   ❌ Bootstrap node not responding")
            return
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return
    
    # 2. Upload a test prompt to IPFS
    print("\n2️⃣ Uploading test prompt to IPFS...")
    prompt = "What is the meaning of life, the universe, and everything?"
    prompt_data = {
        'prompt': prompt,
        'user': 'test-user',
        'timestamp': int(time.time())
    }
    
    try:
        files = {'file': json.dumps(prompt_data).encode()}
        url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
        response = requests.post(url, files=files)
        prompt_cid = response.json()['Hash']
        print(f"   ✅ Prompt uploaded: {prompt_cid}")
    except Exception as e:
        print(f"   ❌ Failed to upload prompt: {e}")
        return
    
    # 3. Query bootstrap node for available workers
    print("\n3️⃣ Querying for available workers...")
    try:
        response = requests.get(f"{CONFIG['bootstrap_url']}/workers")
        workers = response.json()
        print(f"   📋 Found {workers['count']} workers")
        if workers['count'] == 0:
            print("   ⚠️  No workers available - inference would fail")
        else:
            for worker in workers['workers']:
                print(f"      - {worker.get('id', 'Unknown')} at {worker.get('endpoint', 'Unknown')}")
    except Exception as e:
        print(f"   ❌ Error querying workers: {e}")
    
    # 4. Simulate job routing
    print("\n4️⃣ Simulating job routing...")
    job_id = f"test_job_{int(time.time())}"
    job_request = {
        'jobRequirements': {
            'model': 'deepseek-1b',
            'gpu': False
        }
    }
    
    try:
        response = requests.post(
            f"{CONFIG['bootstrap_url']}/jobs/route",
            json=job_request
        )
        if response.status_code == 200:
            worker = response.json()['worker']
            print(f"   ✅ Job would be routed to: {worker.get('id', 'Unknown')}")
        else:
            print(f"   ⚠️  No suitable worker found")
    except Exception as e:
        print(f"   ❌ Error routing job: {e}")
    
    # 5. Test result
    print("\n📋 Test Summary:")
    print("   - Bootstrap node: ✅ Online")
    print("   - IPFS: ✅ Working")
    print("   - Prompt upload: ✅ Success")
    print("   - Worker availability: ⚠️  No real workers")
    print("\n💡 Next steps:")
    print("   1. Deploy contracts to a real network")
    print("   2. Update bootstrap node with contract addresses")
    print("   3. Start real worker nodes with GPUs")
    print("   4. Test with real AI models")

def start_mock_workers():
    """Start mock workers for testing"""
    print("\n🤖 Starting mock workers...")
    
    workers = []
    for i in range(2):
        worker_id = f"mock-worker-{i+1}"
        port = 8010 + i
        worker = MockWorker(worker_id, port)
        
        # Start worker in thread
        thread = threading.Thread(target=worker.start, daemon=True)
        thread.start()
        workers.append((worker, thread))
        
        time.sleep(1)  # Give time to start
    
    return workers

def main():
    print("🚀 Complete AI Inference Test")
    print("=" * 60)
    
    # Check if we should start mock workers
    response = input("\nStart mock workers? (y/n): ")
    if response.lower() == 'y':
        workers = start_mock_workers()
        time.sleep(3)  # Give workers time to register
    
    # Run the test
    test_inference_flow()
    
    # Keep running if workers started
    if response.lower() == 'y':
        print("\n⏳ Mock workers running. Press Ctrl+C to stop...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            print("\n🛑 Shutting down...")

if __name__ == "__main__":
    main()