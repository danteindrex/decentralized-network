#!/usr/bin/env python3
"""
Test script for vLLM inference integration
"""

import os
import sys
import json
import time
import requests
from web3 import Web3
import ipfshttpclient

# Add current directory to path
sys.path.append(os.path.dirname(__file__))

def test_ipfs_connection():
    """Test IPFS connection"""
    try:
        client = ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
        print("✓ IPFS connection successful")
        return client
    except Exception as e:
        print(f"✗ IPFS connection failed: {e}")
        return None

def test_upload_prompt_to_ipfs(client, prompt_text):
    """Upload a test prompt to IPFS"""
    try:
        result = client.add_str(prompt_text)
        print(f"✓ Prompt uploaded to IPFS: {result}")
        return result
    except Exception as e:
        print(f"✗ Failed to upload prompt: {e}")
        return None

def test_web3_connection():
    """Test Web3 connection"""
    try:
        w3 = Web3(Web3.HTTPProvider("http://localhost:8545"))
        if w3.is_connected():
            print("✓ Web3 connection successful")
            return w3
        else:
            print("✗ Web3 connection failed")
            return None
    except Exception as e:
        print(f"✗ Web3 connection error: {e}")
        return None

def test_vllm_health():
    """Test vLLM server health"""
    try:
        response = requests.get("http://localhost:8000/health", timeout=5)
        if response.status_code == 200:
            print("✓ vLLM server is healthy")
            return True
        else:
            print(f"✗ vLLM server returned status {response.status_code}")
            return False
    except requests.exceptions.ConnectionError:
        print("✗ vLLM server is not running")
        return False
    except Exception as e:
        print(f"✗ vLLM health check failed: {e}")
        return False

def test_local_vllm_inference():
    """Test local vLLM inference directly"""
    try:
        from vllm import LLM, SamplingParams
        import torch
        
        # Use a small model for testing (you can change this)
        model_path = "microsoft/DialoGPT-small"  # Small model for testing
        
        print("Loading test model...")
        llm = LLM(
            model=model_path,
            tensor_parallel_size=1,
            gpu_memory_utilization=0.3,
            max_model_len=512,
            trust_remote_code=True
        )
        
        sampling_params = SamplingParams(
            temperature=0.7,
            top_p=0.9,
            max_tokens=50
        )
        
        outputs = llm.generate(["Hello, how are you?"], sampling_params)
        
        if outputs and len(outputs) > 0:
            result = outputs[0].outputs[0].text
            print(f"✓ Local vLLM inference successful: {result[:100]}...")
            return True
        else:
            print("✗ No output generated")
            return False
        
    except Exception as e:
        print(f"✗ Local vLLM inference failed: {e}")
        return False

def test_model_validation():
    """Test model format validation"""
    try:
        # Create a dummy model directory structure for testing
        test_model_dir = "./test_model"
        os.makedirs(test_model_dir, exist_ok=True)
        
        # Create dummy files
        with open(os.path.join(test_model_dir, "config.json"), "w") as f:
            json.dump({"model_type": "test"}, f)
        
        with open(os.path.join(test_model_dir, "pytorch_model.bin"), "w") as f:
            f.write("dummy weights")
        
        # Import validation function
        sys.path.append(os.path.dirname(__file__))
        from main import validate_model_format
        
        result = validate_model_format(test_model_dir)
        
        # Cleanup
        import shutil
        shutil.rmtree(test_model_dir)
        
        if result:
            print("✓ Model validation test passed")
            return True
        else:
            print("✗ Model validation test failed")
            return False
            
    except Exception as e:
        print(f"✗ Model validation test error: {e}")
        return False

def main():
    """Run all tests"""
    print("Testing vLLM Integration Components")
    print("=" * 40)
    
    # Test IPFS
    print("\n1. Testing IPFS connection...")
    ipfs_client = test_ipfs_connection()
    
    if ipfs_client:
        print("\n2. Testing prompt upload to IPFS...")
        test_prompt = "What is the capital of France?"
        prompt_cid = test_upload_prompt_to_ipfs(ipfs_client, test_prompt)
    
    # Test Web3
    print("\n3. Testing Web3 connection...")
    w3 = test_web3_connection()
    
    # Test model validation
    print("\n4. Testing model validation...")
    test_model_validation()
    
    # Test local vLLM inference
    print("\n5. Testing local vLLM inference...")
    test_local_vllm_inference()
    
    print("\n" + "=" * 40)
    print("Test completed!")

if __name__ == "__main__":
    main()