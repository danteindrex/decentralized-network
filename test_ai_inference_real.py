#!/usr/bin/env python3
"""
Test AI Inference with Real Models
This script tests the complete AI inference pipeline with actual models
"""

import os
import sys
import json
import time
import asyncio
from web3 import Web3
from pathlib import Path
import requests

# Add orchestrator to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'orchestrator'))

# Configuration
CONFIG = {
    'eth_node': os.environ.get('ETH_NODE', 'http://192.168.1.103:8545'),
    'ipfs_host': os.environ.get('IPFS_HOST', '192.168.1.103'),
    'ipfs_port': int(os.environ.get('IPFS_PORT', 5001)),
    'model_path': os.path.join(os.path.dirname(__file__), 'models/deepseek-1b'),
    'test_prompt': "What is the meaning of life?",
    'account': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    'private_key': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
}

# Load deployment info
deployment_path = os.path.join(os.path.dirname(__file__), 'deployment.json')
if os.path.exists(deployment_path):
    with open(deployment_path, 'r') as f:
        deployment = json.load(f)
        CONFIG['inference_coordinator'] = deployment.get('inferenceCoordinator')
        CONFIG['model_registry'] = deployment.get('modelRegistry')
else:
    print("⚠️  deployment.json not found")

class InferenceTestSuite:
    def __init__(self):
        self.web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
        self.passed_tests = 0
        self.failed_tests = 0
        
    def test(self, name, func):
        """Run a test and track results"""
        print(f"\n🧪 Testing: {name}")
        try:
            result = func()
            if result:
                print(f"✅ {name} passed")
                self.passed_tests += 1
            else:
                print(f"❌ {name} failed")
                self.failed_tests += 1
            return result
        except Exception as e:
            print(f"❌ {name} failed with error: {e}")
            self.failed_tests += 1
            return False
    
    def check_services(self):
        """Check if required services are running"""
        # Check Ethereum
        try:
            block = self.web3.eth.block_number
            print(f"  Ethereum connected - Block: {block}")
            eth_ok = True
        except:
            print("  ❌ Ethereum not connected")
            eth_ok = False
            
        # Check IPFS
        try:
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/version"
            response = requests.post(url, timeout=5)
            if response.status_code == 200:
                print(f"  IPFS connected - Version: {response.json()['Version']}")
                ipfs_ok = True
            else:
                ipfs_ok = False
        except:
            print("  ❌ IPFS not connected")
            ipfs_ok = False
            
        return eth_ok and ipfs_ok
    
    def upload_model_to_ipfs(self):
        """Upload model to IPFS"""
        model_path = CONFIG['model_path']
        if not os.path.exists(model_path):
            print(f"  Model not found at {model_path}")
            return None
            
        # For testing, we'll upload just the config file
        config_file = os.path.join(model_path, 'config.json')
        
        try:
            with open(config_file, 'rb') as f:
                files = {'file': f}
                url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
                response = requests.post(url, files=files)
                
            if response.status_code == 200:
                cid = response.json()['Hash']
                print(f"  Model config uploaded to IPFS: {cid}")
                return cid
            else:
                print(f"  Failed to upload: {response.text}")
                return None
        except Exception as e:
            print(f"  Upload error: {e}")
            return None
    
    def register_model_on_chain(self, model_cid):
        """Register model in the ModelRegistry contract"""
        if not CONFIG.get('model_registry'):
            print("  Model registry address not found")
            return False
            
        try:
            # Load ModelRegistry ABI
            abi_path = os.path.join(os.path.dirname(__file__), 
                                   'artifacts/contracts/ModelRegistry.sol/ModelRegistry.json')
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    abi = json.load(f)['abi']
            else:
                # Simplified ABI
                abi = [{
                    "inputs": [
                        {"name": "_name", "type": "string"},
                        {"name": "_ipfsCid", "type": "string"},
                        {"name": "_modelType", "type": "uint8"}
                    ],
                    "name": "registerModel",
                    "outputs": [],
                    "stateMutability": "nonpayable",
                    "type": "function"
                }]
            
            contract = self.web3.eth.contract(
                address=CONFIG['model_registry'],
                abi=abi
            )
            
            # Build transaction
            account = self.web3.eth.account.from_key(CONFIG['private_key'])
            nonce = self.web3.eth.get_transaction_count(account.address)
            
            tx = contract.functions.registerModel(
                "DeepSeek-1B",
                model_cid,
                0  # ModelType.LLM
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 300000,
                'gasPrice': self.web3.eth.gas_price
            })
            
            # Sign and send
            signed = account.sign_transaction(tx)
            tx_hash = self.web3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            
            print(f"  Model registered on chain - Tx: {tx_hash.hex()}")
            return receipt.status == 1
            
        except Exception as e:
            print(f"  Registration error: {e}")
            return False
    
    def submit_inference_job(self, prompt_cid, model_cid):
        """Submit an inference job to the coordinator"""
        if not CONFIG.get('inference_coordinator'):
            print("  Inference coordinator address not found")
            return None
            
        try:
            # Load InferenceCoordinator ABI
            abi_path = os.path.join(os.path.dirname(__file__), 
                                   'artifacts/contracts/InferenceCoordinator.sol/InferenceCoordinator.json')
            if os.path.exists(abi_path):
                with open(abi_path, 'r') as f:
                    abi = json.load(f)['abi']
            else:
                print("  ABI file not found")
                return None
            
            contract = self.web3.eth.contract(
                address=CONFIG['inference_coordinator'],
                abi=abi
            )
            
            # Build transaction
            account = self.web3.eth.account.from_key(CONFIG['private_key'])
            nonce = self.web3.eth.get_transaction_count(account.address)
            
            # Check minimum payment
            try:
                min_payment = contract.functions.minimumPayment().call()
                payment = max(min_payment, self.web3.to_wei(0.01, 'ether'))
            except:
                payment = self.web3.to_wei(0.01, 'ether')
            
            tx = contract.functions.submitPromptWithCID(
                prompt_cid,
                model_cid
            ).build_transaction({
                'from': account.address,
                'nonce': nonce,
                'gas': 500000,
                'gasPrice': self.web3.eth.gas_price,
                'value': payment
            })
            
            # Sign and send
            signed = account.sign_transaction(tx)
            tx_hash = self.web3.eth.send_raw_transaction(signed.rawTransaction)
            receipt = self.web3.eth.wait_for_transaction_receipt(tx_hash)
            
            if receipt.status == 1:
                # Extract job ID from events
                for log in receipt.logs:
                    try:
                        event = contract.events.InferenceRequested().process_log(log)
                        job_id = event['args']['jobId']
                        print(f"  Job submitted - ID: {job_id}, Tx: {tx_hash.hex()}")
                        return job_id
                    except:
                        continue
            
            return None
            
        except Exception as e:
            print(f"  Job submission error: {e}")
            return None
    
    def monitor_job(self, job_id, timeout=60):
        """Monitor job completion"""
        if not CONFIG.get('inference_coordinator'):
            return None
            
        try:
            abi_path = os.path.join(os.path.dirname(__file__), 
                                   'artifacts/contracts/InferenceCoordinator.sol/InferenceCoordinator.json')
            with open(abi_path, 'r') as f:
                abi = json.load(f)['abi']
                
            contract = self.web3.eth.contract(
                address=CONFIG['inference_coordinator'],
                abi=abi
            )
            
            start_time = time.time()
            print(f"  Monitoring job {job_id} for {timeout}s...")
            
            while time.time() - start_time < timeout:
                # Check for completion event
                events = contract.events.InferenceCompleted().get_logs(
                    fromBlock=self.web3.eth.block_number - 100,
                    toBlock='latest'
                )
                
                for event in events:
                    if event['args']['jobId'] == job_id:
                        response_cid = event['args']['responseCID']
                        worker = event['args']['worker']
                        print(f"  Job completed! Response CID: {response_cid}")
                        print(f"  Worker: {worker}")
                        return response_cid
                
                time.sleep(2)
            
            print(f"  Job {job_id} timed out")
            return None
            
        except Exception as e:
            print(f"  Monitoring error: {e}")
            return None
    
    def run_full_test(self):
        """Run the complete inference test"""
        print("\n🚀 Starting AI Inference Test Suite\n")
        
        # Test 1: Check services
        if not self.test("Service Connectivity", self.check_services):
            print("\n⚠️  Required services not running. Please start:")
            print("  1. Ethereum node: cd /home/lambda/contracts && npx hardhat node")
            print("  2. IPFS daemon: ipfs daemon")
            return
        
        # Test 2: Upload model to IPFS
        model_cid = self.test("Model Upload to IPFS", self.upload_model_to_ipfs)
        if not model_cid:
            print("\n⚠️  Failed to upload model")
            return
        
        # Test 3: Register model on chain
        self.test("Model Registration on Chain", lambda: self.register_model_on_chain(model_cid))
        
        # Test 4: Upload prompt to IPFS
        def upload_prompt():
            prompt = CONFIG['test_prompt']
            url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
            response = requests.post(url, files={'file': prompt.encode()})
            if response.status_code == 200:
                cid = response.json()['Hash']
                print(f"  Prompt uploaded: {cid}")
                return cid
            return None
        
        prompt_cid = self.test("Prompt Upload to IPFS", upload_prompt)
        if not prompt_cid:
            return
        
        # Test 5: Submit inference job
        job_id = self.test("Job Submission", lambda: self.submit_inference_job(prompt_cid, model_cid))
        if not job_id:
            print("\n⚠️  Failed to submit job. Possible issues:")
            print("  - No worker nodes running")
            print("  - Insufficient ETH balance")
            print("  - Contract not deployed correctly")
            return
        
        # Test 6: Monitor job completion
        response_cid = self.test("Job Completion Monitoring", lambda: self.monitor_job(job_id))
        
        if response_cid:
            # Test 7: Fetch response
            def fetch_response():
                url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/cat?arg={response_cid}"
                response = requests.post(url)
                if response.status_code == 200:
                    print(f"  Response: {response.text}")
                    return True
                return False
            
            self.test("Response Retrieval", fetch_response)
        
        # Summary
        print("\n" + "="*60)
        print(f"Test Summary: {self.passed_tests} passed, {self.failed_tests} failed")
        print("="*60)
        
        if self.failed_tests == 0:
            print("\n🎉 All tests passed! AI inference is working.")
        else:
            print("\n⚠️  Some tests failed. Check the errors above.")

# Quick test function
def quick_test():
    """Quick test to check if inference is possible"""
    print("\n🔍 Quick AI Inference Check\n")
    
    # Check services
    web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
    
    try:
        block = web3.eth.block_number
        balance = web3.eth.get_balance(CONFIG['account'])
        print(f"✅ Ethereum connected - Block: {block}")
        print(f"   Account balance: {web3.from_wei(balance, 'ether')} ETH")
    except:
        print("❌ Ethereum not connected")
        return
    
    try:
        url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/version"
        response = requests.post(url, timeout=5)
        print(f"✅ IPFS connected - Version: {response.json()['Version']}")
    except:
        print("❌ IPFS not connected")
        return
    
    # Check if contracts are deployed
    if CONFIG.get('inference_coordinator'):
        code = web3.eth.get_code(CONFIG['inference_coordinator'])
        if code and len(code) > 2:
            print(f"✅ InferenceCoordinator deployed at {CONFIG['inference_coordinator']}")
        else:
            print("❌ InferenceCoordinator not deployed")
    else:
        print("❌ InferenceCoordinator address not found")
    
    print("\n📝 To run full test: python test_ai_inference_real.py --full")

if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description='Test AI Inference with Real Models')
    parser.add_argument('--full', action='store_true', help='Run full test suite')
    parser.add_argument('--model-path', help='Path to model directory')
    args = parser.parse_args()
    
    if args.model_path:
        CONFIG['model_path'] = args.model_path
    
    if args.full:
        suite = InferenceTestSuite()
        suite.run_full_test()
    else:
        quick_test()