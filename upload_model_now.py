#!/usr/bin/env python3
"""
Upload DeepSeek Model to IPFS and Register on Blockchain
"""

import os
import json
import requests
from web3 import Web3
import time

# Configuration
CONFIG = {
    'eth_node': 'http://192.168.1.103:8545',
    'ipfs_host': '192.168.1.103',
    'ipfs_port': 5001,
    'model_path': '/home/lambda/contracts/models/deepseek-1b',
    'account': '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    'private_key': '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
}

# Load deployment info
with open('deployment.json', 'r') as f:
    deployment = json.load(f)
    CONFIG['model_registry'] = deployment['modelRegistry']

def upload_model_to_ipfs():
    """Upload model config to IPFS"""
    print("📤 Uploading DeepSeek-1B model to IPFS...")
    
    # For now, just upload the config file as a test
    config_path = os.path.join(CONFIG['model_path'], 'config.json')
    
    with open(config_path, 'rb') as f:
        files = {'file': f}
        url = f"http://{CONFIG['ipfs_host']}:{CONFIG['ipfs_port']}/api/v0/add"
        response = requests.post(url, files=files)
    
    if response.status_code == 200:
        cid = response.json()['Hash']
        print(f"✅ Model config uploaded to IPFS: {cid}")
        return cid
    else:
        print(f"❌ Failed to upload: {response.text}")
        return None

def register_model_on_chain(model_cid):
    """Register model in the ModelRegistry contract"""
    print("\n📝 Registering model on blockchain...")
    
    # Connect to Web3
    web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
    
    # Load ModelRegistry ABI
    abi_path = 'artifacts/contracts/ModelRegistry.sol/ModelRegistry.json'
    with open(abi_path, 'r') as f:
        abi = json.load(f)['abi']
    
    contract = web3.eth.contract(
        address=CONFIG['model_registry'],
        abi=abi
    )
    
    # Register model
    account = web3.eth.account.from_key(CONFIG['private_key'])
    
    # Build transaction
    nonce = web3.eth.get_transaction_count(account.address)
    
    tx = contract.functions.registerModel(
        "deepseek-1b",         # modelId
        model_cid,             # modelCID
        "DeepSeek-1B",         # name
        "DeepSeek 1B parameter language model for inference"  # description
    ).build_transaction({
        'from': account.address,
        'nonce': nonce,
        'gas': 500000,
        'gasPrice': web3.eth.gas_price
    })
    
    # Sign and send
    signed = account.sign_transaction(tx)
    tx_hash = web3.eth.send_raw_transaction(signed.raw_transaction)
    
    print(f"⏳ Transaction sent: {tx_hash.hex()}")
    
    # Wait for receipt
    receipt = web3.eth.wait_for_transaction_receipt(tx_hash)
    
    if receipt.status == 1:
        print(f"✅ Model registered successfully!")
        
        # Get the model ID from events
        for log in receipt.logs:
            try:
                event = contract.events.ModelRegistered().process_log(log)
                model_id = event['args']['modelId']
                print(f"   Model ID: {model_id}")
                print(f"   Name: {event['args']['name']}")
                print(f"   CID: {event['args']['ipfsCid']}")
                return model_id
            except:
                continue
    else:
        print(f"❌ Registration failed")
        return None

def main():
    print("🚀 Model Upload and Registration")
    print("=" * 60)
    
    # Upload to IPFS
    model_cid = upload_model_to_ipfs()
    if not model_cid:
        return
    
    # Register on blockchain
    model_id = register_model_on_chain(model_cid)
    
    if model_id is not None:
        print(f"\n✅ Success! Model ready for inference:")
        print(f"   Model ID: {model_id}")
        print(f"   Model CID: {model_cid}")
        print(f"\n📝 Use this for testing:")
        print(f"   Model ID: {model_id}")
        print(f"   Model CID: {model_cid}")

if __name__ == "__main__":
    main()