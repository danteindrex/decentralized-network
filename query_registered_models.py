#!/usr/bin/env python3
"""
Query Registered Models from Blockchain
"""

import json
from web3 import Web3

# Configuration
ETH_NODE = 'http://192.168.1.103:8545'
DEPLOYMENT_FILE = 'deployment.json'

def query_models():
    """Query all registered models from the blockchain"""
    print("🔍 Querying registered models from blockchain...")
    
    # Connect to Web3
    w3 = Web3(Web3.HTTPProvider(ETH_NODE))
    
    # Load deployment info
    with open(DEPLOYMENT_FILE, 'r') as f:
        deployment = json.load(f)
    
    model_registry_addr = deployment['modelRegistry']
    
    # Load ModelRegistry ABI
    with open('artifacts/contracts/ModelRegistry.sol/ModelRegistry.json', 'r') as f:
        abi = json.load(f)['abi']
    
    contract = w3.eth.contract(address=model_registry_addr, abi=abi)
    
    # Try to get model count
    try:
        # Look for a function to enumerate models
        # Most contracts have getModelCount or similar
        models = []
        
        # For now, we know we registered deepseek-1b
        model_id = 'deepseek-1b'
        try:
            # Try to call getModel
            model = contract.functions.getModel(model_id).call()
            if model and len(model) > 0:
                models.append({
                    'id': model_id,
                    'name': model[0] if len(model) > 0 else 'Unknown',
                    'cid': model[1] if len(model) > 1 else '',
                    'active': model[2] if len(model) > 2 else False
                })
        except:
            # Contract might not have getModel function
            pass
        
        # Also check our known model
        print(f"\n📋 Known Models:")
        print(f"   - DeepSeek-1B")
        print(f"     ID: deepseek-1b")
        print(f"     CID: QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q")
        
        return models
        
    except Exception as e:
        print(f"❌ Error querying models: {e}")
        return []

def update_streamlit_metadata(models):
    """Update Streamlit metadata with blockchain models"""
    metadata_file = 'uploaded_files_metadata.json'
    
    # Load existing metadata
    try:
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
    except:
        metadata = []
    
    # Add models if not already present
    for model in models:
        exists = any(item.get('hash') == model['cid'] for item in metadata)
        if not exists and model['cid']:
            metadata.append({
                'name': model['name'],
                'hash': model['cid'],
                'type': 'model',
                'blockchain_id': model['id'],
                'uploaded_at': '2025-01-29T12:00:00'
            })
    
    # Save updated metadata
    with open(metadata_file, 'w') as f:
        json.dump(metadata, f, indent=4)
    
    print(f"\n✅ Updated {metadata_file}")

def main():
    models = query_models()
    if models:
        update_streamlit_metadata(models)
    
    print("\n💡 To use models in Streamlit:")
    print("   1. Refresh the Streamlit app")
    print("   2. Select 'DeepSeek-1B' from the model dropdown")
    print("   3. Enter a prompt and submit")

if __name__ == "__main__":
    main()