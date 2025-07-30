#!/usr/bin/env python3
"""
Simple test script for decentralized inference
"""

import time
import yaml
import os
import sys
from web3 import Web3
import ipfshttpclient

def load_config():
    """Load configuration from config.yaml"""
    try:
        config_path = os.path.join(os.path.dirname(__file__), 'orchestrator', 'config.yaml')
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"Failed to load config: {e}")
        return None

def get_ipfs_client():
    """Get IPFS client"""
    try:
        return ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
    except Exception as e:
        print(f"Failed to connect to IPFS: {e}")
        return None

def upload_to_ipfs(content):
    """Upload content to IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return None
        return ipfs_client.add_str(content)
    except Exception as e:
        print(f"Failed to upload to IPFS: {e}")
        return None

def fetch_from_ipfs(cid):
    """Fetch content from IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return None
        
        # Try to get as JSON first, then as string
        try:
            return ipfs_client.get_json(cid)
        except:
            return ipfs_client.cat(cid).decode('utf-8')
    except Exception as e:
        print(f"Failed to fetch from IPFS: {e}")
        return None

def test_inference(prompt, model_cid):
    """Test inference with timing"""
    print("🧠 Decentralized Inference Test")
    print("=" * 50)
    
    # Load config
    config = load_config()
    if not config:
        print("❌ Failed to load configuration")
        return
    
    # Initialize Web3
    try:
        w3 = Web3(Web3.HTTPProvider(config['eth_node']))
        
        # Simple contract ABI for testing
        contract_abi = [
            {
                "inputs": [{"name": "promptCID", "type": "string"}, {"name": "modelCID", "type": "string"}],
                "name": "submitPromptWithCID",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "jobId", "type": "uint256"},
                    {"indexed": True, "name": "controller", "type": "address"},
                    {"name": "promptCID", "type": "string"},
                    {"name": "modelId", "type": "string"},
                    {"name": "modelCID", "type": "string"}
                ],
                "name": "InferenceRequested",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "jobId", "type": "uint256"},
                    {"indexed": True, "name": "worker", "type": "address"},
                    {"name": "responseCID", "type": "string"}
                ],
                "name": "InferenceCompleted",
                "type": "event"
            }
        ]
        
        contract = w3.eth.contract(
            address=config['contract_address'],
            abi=contract_abi
        )
        
        print(f"✅ Connected to Ethereum (Block: {w3.eth.block_number})")
        
    except Exception as e:
        print(f"❌ Failed to connect to Ethereum: {e}")
        return
    
    # Start timing
    start_time = time.time()
    
    # Upload prompt to IPFS
    print(f"\n📤 Uploading prompt to IPFS...")
    print(f"Prompt: {prompt}")
    
    prompt_cid = upload_to_ipfs(prompt)
    if not prompt_cid:
        print("❌ Failed to upload prompt")
        return
    
    upload_time = time.time() - start_time
    print(f"✅ Prompt uploaded: {prompt_cid} ({upload_time:.2f}s)")
    
    # Submit to contract
    print(f"\n📝 Submitting to smart contract...")
    try:
        tx = contract.functions.submitPromptWithCID(prompt_cid, model_cid).build_transaction({
            'from': config['default_account'],
            'gas': 200000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(config['default_account']),
            'value': 0
        })
        
        signed_tx = w3.eth.account.sign_transaction(tx, config['private_key'])
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Extract job ID
        job_id = None
        for log in receipt.logs:
            try:
                decoded = contract.events.InferenceRequested().processLog(log)
                job_id = decoded['args']['jobId']
                break
            except:
                continue
        
        submit_time = time.time() - start_time
        print(f"✅ Job submitted: {job_id} ({submit_time:.2f}s)")
        print(f"Transaction: {tx_hash.hex()}")
        
    except Exception as e:
        print(f"❌ Failed to submit job: {e}")
        return
    
    # Monitor for completion
    print(f"\n⏳ Waiting for inference completion...")
    
    event_filter = contract.events.InferenceCompleted.createFilter(
        fromBlock='latest',
        argument_filters={'jobId': job_id}
    )
    
    timeout = 300  # 5 minutes
    while time.time() - start_time < timeout:
        try:
            for event in event_filter.get_new_entries():
                if event['args']['jobId'] == job_id:
                    total_time = time.time() - start_time
                    response_cid = event['args']['responseCID']
                    worker = event['args']['worker']
                    
                    print(f"🎉 Inference completed in {total_time:.2f} seconds!")
                    print(f"Worker: {worker}")
                    print(f"Response CID: {response_cid}")
                    
                    # Fetch response
                    print(f"\n📥 Fetching response from IPFS...")
                    response_data = fetch_from_ipfs(response_cid)
                    
                    if response_data:
                        print(f"\n📋 Response:")
                        print("-" * 50)
                        if isinstance(response_data, dict):
                            if 'response' in response_data:
                                print(response_data['response'])
                            else:
                                print(response_data)
                        else:
                            print(response_data)
                        print("-" * 50)
                        
                        # Timing breakdown
                        print(f"\n⏱️  Timing Breakdown:")
                        print(f"   Upload time: {upload_time:.2f}s")
                        print(f"   Submit time: {submit_time:.2f}s")
                        print(f"   Total time:  {total_time:.2f}s")
                        
                    else:
                        print("❌ Failed to fetch response from IPFS")
                    
                    return
            
            time.sleep(2)
            
        except Exception as e:
            print(f"❌ Error monitoring job: {e}")
            break
    
    print("⏰ Job timed out")

def main():
    """Main function"""
    if len(sys.argv) < 3:
        print("Usage: python test_inference_simple.py <prompt> <model_cid>")
        print("Example: python test_inference_simple.py 'What is AI?' QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX")
        return
    
    prompt = sys.argv[1]
    model_cid = sys.argv[2]
    
    test_inference(prompt, model_cid)

if __name__ == "__main__":
    main()