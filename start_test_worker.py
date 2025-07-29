#!/usr/bin/env python3
"""
Start a Test Worker Node for AI Inference
This creates a mock worker that can process inference jobs
"""

import os
import sys
import json
import time
import asyncio
from web3 import Web3
import requests
from threading import Thread

# Configuration
CONFIG = {
    'eth_node': os.environ.get('ETH_NODE', 'http://192.168.1.103:8545'),
    'ipfs_host': os.environ.get('IPFS_HOST', '192.168.1.103'),
    'ipfs_port': int(os.environ.get('IPFS_PORT', 5001)),
    'worker_account': '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    'worker_key': '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
}

# Load deployment info
deployment_path = os.path.join(os.path.dirname(__file__), 'deployment.json')
if os.path.exists(deployment_path):
    with open(deployment_path, 'r') as f:
        deployment = json.load(f)
        CONFIG['inference_coordinator'] = deployment.get('inferenceCoordinator')

class MockWorkerNode:
    def __init__(self):
        self.web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
        self.account = self.web3.eth.account.from_key(CONFIG['worker_key'])
        self.running = True
        self.jobs_processed = 0
        
    def start(self):
        """Start the worker node"""
        print(f"🚀 Starting Mock Worker Node")
        print(f"   Worker Address: {self.account.address}")
        print(f"   Listening for inference jobs...\n")
        
        # Check balance
        balance = self.web3.eth.get_balance(self.account.address)
        print(f"   Balance: {self.web3.from_wei(balance, 'ether')} ETH")
        
        if balance == 0:
            print("⚠️  Worker has no ETH for gas. Send some ETH to the worker address.")
        
        # Start monitoring
        self.monitor_jobs()
    
    def monitor_jobs(self):
        """Monitor for new inference jobs"""
        if not CONFIG.get('inference_coordinator'):
            print("❌ Inference coordinator address not found")
            return
            
        try:
            # Load contract ABI
            abi_path = os.path.join(os.path.dirname(__file__), 
                                   'artifacts/contracts/InferenceCoordinator.sol/InferenceCoordinator.json')
            with open(abi_path, 'r') as f:
                abi = json.load(f)['abi']
                
            contract = self.web3.eth.contract(
                address=CONFIG['inference_coordinator'],
                abi=abi
            )
            
            last_block = self.web3.eth.block_number
            
            while self.running:
                try:
                    current_block = self.web3.eth.block_number
                    
                    if current_block > last_block:
                        # Check for new inference requests
                        events = contract.events.InferenceRequested().get_logs(
                            fromBlock=last_block,
                            toBlock=current_block
                        )
                        
                        for event in events:
                            self.process_job(event, contract)
                        
                        last_block = current_block
                    
                    time.sleep(2)
                    
                except Exception as e:
                    print(f"❌ Monitoring error: {e}")
                    time.sleep(5)
                    
        except Exception as e:
            print(f"❌ Failed to start monitoring: {e}")
    
    def process_job(self, event, contract):
        """Process an inference job"""
        job_id = event['args']['jobId']
        prompt_cid = event['args']['promptCID']
        model_cid = event['args']['modelCID']
        controller = event['args']['controller']
        
        print(f"\n📥 New Job Received!")
        print(f"   Job ID: {job_id}")
        print(f"   Controller: {controller}")
        print(f"   Prompt CID: {prompt_cid}")
        print(f"   Model CID: {model_cid}")
        
        try:
            # Fetch prompt from IPFS
            prompt = self.fetch_from_ipfs(prompt_cid)
            if not prompt:
                print("   ❌ Failed to fetch prompt")
                return
                
            print(f"   Prompt: {prompt}")
            
            # Generate mock response
            response = self.generate_mock_response(prompt)
            print(f"   Generated response: {response}")
            
            # Upload response to IPFS
            response_cid = self.upload_to_ipfs(response)
            if not response_cid:
                print("   ❌ Failed to upload response")
                return
                
            print(f"   Response CID: {response_cid}")
            
            # Submit response on-chain
            success = self.submit_response(contract, job_id, response_cid)
            
            if success:
                self.jobs_processed += 1
                print(f"   ✅ Job completed successfully! Total processed: {self.jobs_processed}")
            else:
                print("   ❌ Failed to submit response on-chain")
                
        except Exception as e:
            print(f"   ❌ Error processing job: {e}")
    
    def fetch_from_ipfs(self, cid):
        """Fetch content from IPFS"""
        try:
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/cat?arg={cid}"
            response = requests.post(url, timeout=10)
            if response.status_code == 200:
                return response.text
            return None
        except Exception as e:
            print(f"IPFS fetch error: {e}")
            return None
    
    def upload_to_ipfs(self, content):
        """Upload content to IPFS"""
        try:
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
            response = requests.post(url, files={'file': content.encode()})
            if response.status_code == 200:
                return response.json()['Hash']
            return None
        except Exception as e:
            print(f"IPFS upload error: {e}")
            return None
    
    def generate_mock_response(self, prompt):
        """Generate a mock AI response"""
        # Simple mock responses based on keywords
        prompt_lower = prompt.lower()
        
        if "meaning of life" in prompt_lower:
            return "The meaning of life is 42, according to the Hitchhiker's Guide to the Galaxy. But philosophically, it's about finding purpose, connection, and contributing to something greater than ourselves."
        elif "hello" in prompt_lower:
            return "Hello! I'm a decentralized AI assistant running on the blockchain. How can I help you today?"
        elif "what is" in prompt_lower:
            return f"That's an interesting question about '{prompt}'. In a decentralized AI network, knowledge is distributed across multiple nodes, each contributing to the collective intelligence."
        elif "how" in prompt_lower:
            return f"To answer '{prompt}', I would need to process this through our distributed inference network. Each node contributes computational power to generate responses."
        else:
            return f"I received your prompt: '{prompt}'. This response was generated by a decentralized worker node in the AI inference network."
    
    def submit_response(self, contract, job_id, response_cid):
        """Submit job response on-chain"""
        try:
            # Build transaction
            nonce = self.web3.eth.get_transaction_count(self.account.address)
            
            tx = contract.functions.submitResponse(
                job_id,
                response_cid
            ).build_transaction({
                'from': self.account.address,
                'nonce': nonce,
                'gas': 200000,
                'gasPrice': self.web3.eth.gas_price
            })
            
            # Sign and send
            signed = self.account.sign_transaction(tx)
            tx_hash = self.web3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            
            return receipt.status == 1
            
        except Exception as e:
            print(f"Response submission error: {e}")
            return False
    
    def stop(self):
        """Stop the worker node"""
        self.running = False
        print("\n🛑 Stopping worker node...")

def fund_worker():
    """Fund the worker account with some ETH"""
    web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
    
    # Use the first default account (has ETH in local network)
    funder_key = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
    funder = web3.eth.account.from_key(funder_key)
    worker_address = CONFIG['worker_account']
    
    # Check balances
    funder_balance = web3.eth.get_balance(funder.address)
    worker_balance = web3.eth.get_balance(worker_address)
    
    print(f"\n💰 Funding Worker Account")
    print(f"   Funder balance: {web3.from_wei(funder_balance, 'ether')} ETH")
    print(f"   Worker balance: {web3.from_wei(worker_balance, 'ether')} ETH")
    
    if worker_balance < web3.to_wei(0.1, 'ether'):
        # Send 0.5 ETH to worker
        amount = web3.to_wei(0.5, 'ether')
        
        tx = {
            'from': funder.address,
            'to': worker_address,
            'value': amount,
            'gas': 21000,
            'gasPrice': web3.eth.gas_price,
            'nonce': web3.eth.get_transaction_count(funder.address)
        }
        
        signed = funder.sign_transaction(tx)
        tx_hash = web3.eth.send_raw_transaction(signed.rawTransaction)
        receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
        
        if receipt.status == 1:
            print(f"   ✅ Sent 0.5 ETH to worker")
        else:
            print(f"   ❌ Failed to send ETH")
    else:
        print(f"   ✅ Worker has sufficient balance")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Start a test worker node')
    parser.add_argument('--fund', action='store_true', help='Fund the worker account')
    parser.add_argument('--no-fund', action='store_true', help='Skip funding')
    args = parser.parse_args()
    
    print("🤖 Mock Worker Node for AI Inference Testing\n")
    
    # Fund worker if needed
    if not args.no_fund:
        try:
            fund_worker()
        except Exception as e:
            print(f"⚠️  Could not fund worker: {e}")
    
    # Start worker
    worker = MockWorkerNode()
    
    try:
        worker.start()
    except KeyboardInterrupt:
        worker.stop()
        print("Worker stopped.")