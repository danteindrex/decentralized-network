#!/usr/bin/env python3
"""
Utility script to upload models to IPFS for decentralized inference
"""

import os
import sys
import argparse
import ipfshttpclient
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

def download_model(model_name, output_dir):
    """Download a model from Hugging Face"""
    try:
        print(f"Downloading model {model_name}...")
        
        # Download tokenizer
        tokenizer = AutoTokenizer.from_pretrained(model_name)
        tokenizer.save_pretrained(output_dir)
        
        # Download model
        model = AutoModelForCausalLM.from_pretrained(
            model_name,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            low_cpu_mem_usage=True
        )
        model.save_pretrained(output_dir)
        
        print(f"Model saved to {output_dir}")
        return True
        
    except Exception as e:
        print(f"Failed to download model: {e}")
        return False

def upload_to_ipfs(model_dir):
    """Upload model directory to IPFS"""
    try:
        client = ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
        
        print(f"Uploading {model_dir} to IPFS...")
        result = client.add(model_dir, recursive=True)
        
        # Find the root directory hash
        model_cid = None
        for item in result:
            if item['Name'] == os.path.basename(model_dir):
                model_cid = item['Hash']
                break
        
        if model_cid:
            print(f"Model uploaded to IPFS: {model_cid}")
            return model_cid
        else:
            print("Failed to find model CID")
            return None
            
    except Exception as e:
        print(f"Failed to upload to IPFS: {e}")
        return None

def validate_model_files(model_dir):
    """Validate that all required model files are present"""
    required_files = [
        'config.json',
        'tokenizer.json',
        'tokenizer_config.json'
    ]
    
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
    
    print("Model validation passed")
    return True

def main():
    parser = argparse.ArgumentParser(description='Upload models to IPFS for decentralized inference')
    parser.add_argument('--model', required=True, help='Model name from Hugging Face or local path')
    parser.add_argument('--output', default='./downloaded_model', help='Output directory for downloaded model')
    parser.add_argument('--skip-download', action='store_true', help='Skip download, just upload existing model')
    
    args = parser.parse_args()
    
    model_dir = args.output
    
    if not args.skip_download:
        # Download model from Hugging Face
        if not download_model(args.model, model_dir):
            sys.exit(1)
    else:
        # Use existing model directory
        model_dir = args.model
        if not os.path.exists(model_dir):
            print(f"Model directory {model_dir} does not exist")
            sys.exit(1)
    
    # Validate model files
    if not validate_model_files(model_dir):
        print("Model validation failed")
        sys.exit(1)
    
    # Upload to IPFS
    model_cid = upload_to_ipfs(model_dir)
    if model_cid:
        print(f"\n✓ Model successfully uploaded to IPFS!")
        print(f"Model CID: {model_cid}")
        print(f"\nYou can now use this CID in your inference requests:")
        print(f"submitPrompt(promptCID, '{model_cid}')")
    else:
        print("Failed to upload model to IPFS")
        sys.exit(1)

if __name__ == "__main__":
    main()