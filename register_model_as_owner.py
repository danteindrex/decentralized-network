#!/usr/bin/env python3
"""
Register Model as Owner
"""

import json
from web3 import Web3

# Configuration
CONFIG = {
    'eth_node': 'http://192.168.1.103:8545',
    'owner_account': '0x71562b71999873DB5b286dF957af199Ec94617F7',
    'model_cid': 'QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q'  # Already uploaded
}

def register_model():
    """Register model using owner account"""
    print("📝 Registering model as owner...")
    
    # Connect to Web3
    web3 = Web3(Web3.HTTPProvider(CONFIG['eth_node']))
    
    # Load deployment info
    with open('deployment.json', 'r') as f:
        deployment = json.load(f)
        model_registry = deployment['modelRegistry']
    
    # Load ModelRegistry ABI
    with open('artifacts/contracts/ModelRegistry.sol/ModelRegistry.json', 'r') as f:
        abi = json.load(f)['abi']
    
    contract = web3.eth.contract(
        address=model_registry,
        abi=abi
    )
    
    # Use the owner account (it's unlocked in the node)
    owner = CONFIG['owner_account']
    
    # Build and send transaction
    tx_hash = contract.functions.registerModel(
        "deepseek-1b",         # modelId
        CONFIG['model_cid'],   # modelCID
        "DeepSeek-1B",         # name
        "DeepSeek 1B parameter language model for inference"  # description
    ).transact({'from': owner})
    
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
                print(f"   CID: {event['args']['modelCID']}")
                return model_id
            except:
                continue
    else:
        print(f"❌ Registration failed")
        return None

def main():
    print("🚀 Model Registration (As Owner)")
    print("=" * 60)
    
    model_id = register_model()
    
    if model_id:
        print(f"\n✅ Success! Model ready for inference:")
        print(f"   Model ID: {model_id}")
        print(f"   Model CID: {CONFIG['model_cid']}")

if __name__ == "__main__":
    main()