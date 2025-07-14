#!/usr/bin/env python3
"""
Owner utility script to upload models to IPFS and register them in the smart contract
"""

import os
import sys
import argparse
import json
import subprocess
import ipfshttpclient
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch
from web3 import Web3

def load_config():
    """Load configuration from config.yaml"""
    try:
        import yaml
        config_path = os.path.join(os.path.dirname(__file__), 'config.yaml')
        with open(config_path, 'r') as f:
            return yaml.safe_load(f)
    except Exception as e:
        print(f"Failed to load config: {e}")
        return None

def connect_to_blockchain(config):
    """Connect to blockchain and load contracts"""
    try:
        w3 = Web3(Web3.HTTPProvider(config['eth_node']))
        if not w3.is_connected():
            print("Failed to connect to blockchain")
            return None, None
        
        # Load contract ABIs
        abi_dir = os.path.join(os.path.dirname(__file__), 'abis')
        
        with open(os.path.join(abi_dir, 'ModelRegistry.json'), 'r') as f:
            model_registry_abi = json.load(f)
        
        model_registry = w3.eth.contract(
            address=config['model_registry_address'],
            abi=model_registry_abi
        )
        
        return w3, model_registry
    except Exception as e:
        print(f"Failed to connect to blockchain: {e}")
        return None, None

def download_model(model_name, output_dir):
    """Download a model from Hugging Face"""
    try:
        print(f"📥 Downloading model {model_name}...")
        
        # Create output directory
        os.makedirs(output_dir, exist_ok=True)
        
        # Download tokenizer
        print("  Downloading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.save_pretrained(output_dir)
        
        # Download model
        print("  Downloading model weights...")
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
        model.save_pretrained(output_dir)
        
        print(f"✓ Model saved to {output_dir}")
        return True
        
    except Exception as e:
        print(f"✗ Failed to download model: {e}")
        return False

def upload_to_ipfs(model_dir):
    """Upload model directory to IPFS"""
    try:
        client = ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
        
        print(f"📤 Uploading {model_dir} to IPFS...")
        
        # Add directory recursively
        result = client.add(model_dir, recursive=True)
        
        # Find the root directory hash
        model_cid = None
        for item in result:
            if item['Name'] == os.path.basename(model_dir):
                model_cid = item['Hash']
                break
        
        if model_cid:
            print(f"✓ Model uploaded to IPFS: {model_cid}")
            
            # Pin the content to ensure it stays available
            client.pin.add(model_cid)
            print(f"✓ Model pinned to local IPFS node")
            
            return model_cid
        else:
            print("✗ Failed to find model CID")
            return None
            
    except Exception as e:
        print(f"✗ Failed to upload to IPFS: {e}")
        return None

def register_model_on_chain(w3, model_registry, model_id, model_cid, name, description, config):
    """Register model in the smart contract"""
    try:
        print(f"📝 Registering model on blockchain...")
        
        # Build transaction
        tx = model_registry.functions.registerModel(
            model_id, model_cid, name, description
        ).build_transaction({
            'from': config['default_account'],
            'gas': 200000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(config['default_account'])
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, config['private_key'])
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        # Wait for confirmation
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        if receipt.status == 1:
            print(f"✓ Model registered on blockchain!")
            print(f"  Transaction hash: {tx_hash.hex()}")
            return tx_hash.hex()
        else:
            print("✗ Transaction failed")
            return None
            
    except Exception as e:
        print(f"✗ Failed to register model on blockchain: {e}")
        return None

def validate_model_files(model_dir):
    """Validate that all required model files are present"""
    required_files = [
        'config.json',
        'tokenizer.json',
        'tokenizer_config.json'
    ]
    
    if not os.path.exists(model_dir):
        print(f"Model directory {model_dir} does not exist")
        return False
    
    model_files = os.listdir(model_dir)
    
    # Check for required files
    missing_files = []
    for file in required_files:
        if file not in model_files:
            missing_files.append(file)
    
    # Check for model weights
    has_weights = any(f.endswith(('.bin', '.safetensors', '.pt')) for f in model_files)
    
    if missing_files:
        print(f"Missing required files: {missing_files}")
        return False
    
    if not has_weights:
        print("No model weight files found")
        return False
    
    print("✓ Model validation passed")
    return True

def main():
    parser = argparse.ArgumentParser(description='Owner tool to upload models to IPFS and register them')
    parser.add_argument('--model', required=True, help='Model name from Hugging Face or local path')
    parser.add_argument('--model-id', required=True, help='Unique model ID for the registry')
    parser.add_argument('--name', required=True, help='Human-readable model name')
    parser.add_argument('--description', required=True, help='Model description')
    parser.add_argument('--output', default='./temp_model', help='Temporary directory for downloaded model')
    parser.add_argument('--skip-download', action='store_true', help='Skip download, use existing model directory')
    parser.add_argument('--skip-blockchain', action='store_true', help='Skip blockchain registration')
    
    args = parser.parse_args()
    
    # Load configuration
    config = load_config()
    if not config:
        sys.exit(1)
    
    model_dir = args.output
    
    # Step 1: Download or validate model
    if not args.skip_download:
        if not download_model(args.model, model_dir):
            sys.exit(1)
    else:
        model_dir = args.model
        if not validate_model_files(model_dir):
            sys.exit(1)
    
    # Step 2: Upload to IPFS
    model_cid = upload_to_ipfs(model_dir)
    if not model_cid:
        sys.exit(1)
    
    # Step 3: Register on blockchain
    if not args.skip_blockchain:
        w3, model_registry = connect_to_blockchain(config)
        if not w3 or not model_registry:
            print("⚠️  Blockchain connection failed, but model is uploaded to IPFS")
            print(f"Model CID: {model_cid}")
            print("You can register it manually later using the owner tools")
        else:
            tx_hash = register_model_on_chain(
                w3, model_registry, args.model_id, model_cid, 
                args.name, args.description, config
            )
            if not tx_hash:
                print("⚠️  Blockchain registration failed, but model is uploaded to IPFS")
    
    # Step 4: Cleanup temporary files
    if not args.skip_download and os.path.exists(args.output):
        import shutil
        shutil.rmtree(args.output)
        print("✓ Temporary files cleaned up")
    
    print(f"\n🎉 Model upload completed!")
    print(f"Model ID: {args.model_id}")
    print(f"Model CID: {model_cid}")
    print(f"Name: {args.name}")
    print(f"\nUsers can now request inference with:")
    print(f"submitPrompt(promptCID, '{args.model_id}')")

if __name__ == "__main__":
    main()