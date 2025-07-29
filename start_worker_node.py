#!/usr/bin/env python3
"""
Start a Worker Node for AI Inference
"""

import os
import json
import time
import requests
import threading
from web3 import Web3
from flask import Flask, request, jsonify
import logging

# Configuration
CONFIG = {
    'eth_node': 'http://192.168.1.103:8545',
    'ipfs_host': '192.168.1.103',
    'ipfs_port': 5001,
    'bootstrap_url': 'https://bootstrap-node.onrender.com',
    'worker_port': 8002,
    'worker_id': 'worker-001',
    'worker_account': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',  # Second hardhat account
}

# Load deployment info
with open('deployment.json', 'r') as f:
    deployment = json.load(f)
    CONFIG.update(deployment)

class WorkerNode:
    def __init__(self):
        self.app = Flask(__name__)
        self.running = True
        self.jobs = {}
        self.setup_routes()
        
        # Web3 connection
        self.web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
        
        # Register with bootstrap node
        self.register_with_bootstrap()
        
    def setup_routes(self):
        """Setup Flask routes"""
        
        @self.app.route('/health', methods=['GET'])
        def health():
            return jsonify({
                'status': 'healthy',
                'worker_id': CONFIG['worker_id'],
                'timestamp': int(time.time())
            })
        
        @self.app.route('/inference', methods=['POST'])
        def handle_inference():
            """Handle inference request"""
            data = request.json
            job_id = data.get('job_id')
            prompt_cid = data.get('prompt_cid')
            model_cid = data.get('model_cid')
            
            print(f"📥 Received inference request:")
            print(f"   Job ID: {job_id}")
            print(f"   Prompt CID: {prompt_cid}")
            print(f"   Model CID: {model_cid}")
            
            # Process in background
            threading.Thread(
                target=self.process_inference,
                args=(job_id, prompt_cid, model_cid)
            ).start()
            
            return jsonify({
                'status': 'accepted',
                'job_id': job_id,
                'message': 'Inference job accepted'
            })
        
        @self.app.route('/job/<job_id>', methods=['GET'])
        def get_job_status(job_id):
            """Get job status"""
            if job_id in self.jobs:
                return jsonify(self.jobs[job_id])
            return jsonify({'error': 'Job not found'}), 404
    
    def register_with_bootstrap(self):
        """Register with bootstrap node"""
        try:
            data = {
                'nodeId': CONFIG['worker_id'],
                'nodeType': 'worker',
                'endpoint': f"localhost:{CONFIG['worker_port']}",
                'capabilities': {
                    'gpu': False,
                    'models': ['mock-llm', 'deepseek-1b'],
                    'maxJobs': 5
                }
            }
            
            response = requests.post(
                f"{CONFIG['bootstrap_url']}/peers/register",
                json=data
            )
            
            if response.status_code == 200:
                print(f"✅ Registered with bootstrap node")
            else:
                print(f"❌ Failed to register: {response.text}")
                
        except Exception as e:
            print(f"❌ Bootstrap registration error: {e}")
    
    def send_heartbeat(self):
        """Send heartbeat to bootstrap"""
        while self.running:
            try:
                data = {
                    'nodeId': CONFIG['worker_id'],
                    'status': 'active',
                    'performance': {
                        'jobsCompleted': len([j for j in self.jobs.values() if j['status'] == 'completed']),
                        'avgProcessingTime': 2.5
                    }
                }
                
                requests.post(
                    f"{CONFIG['bootstrap_url']}/heartbeat",
                    json=data
                )
                
            except:
                pass
            
            time.sleep(30)  # Send heartbeat every 30 seconds
    
    def process_inference(self, job_id, prompt_cid, model_cid):
        """Process inference job"""
        print(f"⚙️  Processing job {job_id}...")
        
        self.jobs[job_id] = {
            'status': 'processing',
            'started_at': int(time.time())
        }
        
        try:
            # 1. Fetch prompt from IPFS
            prompt_url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/cat?arg={prompt_cid}"
            response = requests.post(prompt_url)
            prompt_data = json.loads(response.text)
            prompt = prompt_data.get('prompt', 'Hello world')
            
            print(f"   Prompt: {prompt}")
            
            # 2. Simulate inference (in real implementation, load model and run)
            time.sleep(2)  # Simulate processing
            
            # 3. Generate response
            if "meaning of life" in prompt.lower():
                response_text = "The meaning of life is 42, according to Douglas Adams. But more philosophically, it's about finding purpose and joy in our connections and contributions."
            else:
                response_text = f"This is a mock response to: {prompt}. In a real implementation, this would be generated by the AI model."
            
            # 4. Upload response to IPFS
            response_data = {
                'job_id': job_id,
                'prompt_cid': prompt_cid,
                'model_cid': model_cid,
                'response': response_text,
                'worker_id': CONFIG['worker_id'],
                'timestamp': int(time.time()),
                'processing_time': time.time() - self.jobs[job_id]['started_at']
            }
            
            files = {'file': json.dumps(response_data, indent=2).encode()}
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
            response = requests.post(url, files=files)
            response_cid = response.json()['Hash']
            
            print(f"✅ Response uploaded: {response_cid}")
            
            # 5. Update job status
            self.jobs[job_id].update({
                'status': 'completed',
                'response_cid': response_cid,
                'completed_at': int(time.time()),
                'processing_time': response_data['processing_time']
            })
            
            # 6. TODO: Submit proof to blockchain
            
        except Exception as e:
            print(f"❌ Error processing job: {e}")
            self.jobs[job_id]['status'] = 'failed'
            self.jobs[job_id]['error'] = str(e)
    
    def start(self):
        """Start worker node"""
        print(f"🚀 Starting Worker Node: {CONFIG['worker_id']}")
        print(f"📍 Endpoint: http://localhost:{CONFIG['worker_port']}")
        print(f"⛓️  Connected to: {CONFIG['eth_node']}")
        print(f"📦 IPFS: http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}")
        
        # Start heartbeat thread
        threading.Thread(target=self.send_heartbeat, daemon=True).start()
        
        # Start Flask server
        self.app.run(host='0.0.0.0', port=CONFIG['worker_port'], debug=False)

def main():
    worker = WorkerNode()
    try:
        worker.start()
    except KeyboardInterrupt:
        print("\n🛑 Shutting down worker node...")
        worker.running = False

if __name__ == "__main__":
    main()