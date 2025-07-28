#!/usr/bin/env python3
"""
Create a simple test model for inference testing
"""

import os
import json
import requests

def create_test_model():
    """Create a simple test model configuration"""
    
    # Create test model directory
    model_dir = "./test_model"
    os.makedirs(model_dir, exist_ok=True)
    
    # Create a simple model config
    model_config = {
        "model_type": "test",
        "model_name": "simple-test-model",
        "description": "A simple test model for inference testing",
        "version": "1.0.0",
        "responses": {
            "default": "This is a test response from the simple test model. Your prompt was processed successfully!",
            "hello": "Hello! This is a test response from the AI model.",
            "test": "Test successful! The model is working correctly."
        }
    }
    
    # Save model config
    with open(f"{model_dir}/config.json", "w") as f:
        json.dump(model_config, f, indent=2)
    
    # Create a simple model file (placeholder)
    with open(f"{model_dir}/model.txt", "w") as f:
        f.write("This is a simple test model file for testing the inference system.")
    
    print(f"✅ Test model created in {model_dir}/")
    return model_dir

def upload_test_model_to_ipfs(model_dir):
    """Upload test model to IPFS"""
    try:
        ipfs_url = "http://127.0.0.1:5001/api/v0/add"
        
        # Upload config file
        with open(f"{model_dir}/config.json", "rb") as f:
            files = {'file': ('config.json', f)}
            response = requests.post(ipfs_url, files=files)
            
        if response.status_code == 200:
            config_cid = response.json()['Hash']
            print(f"✅ Model config uploaded to IPFS: {config_cid}")
            return config_cid
        else:
            print(f"❌ Failed to upload to IPFS: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Error uploading to IPFS: {e}")
        return None

def main():
    print("🔧 Creating simple test model...")
    
    # Create test model
    model_dir = create_test_model()
    
    # Upload to IPFS
    print("📤 Uploading to IPFS...")
    model_cid = upload_test_model_to_ipfs(model_dir)
    
    if model_cid:
        print(f"\n🎉 Test model ready!")
        print(f"📁 Local path: {model_dir}")
        print(f"🔗 IPFS CID: {model_cid}")
        print(f"\n💡 You can now use this CID in the Streamlit interface:")
        print(f"   Model CID: {model_cid}")
        
        # Update the Streamlit app with this CID
        print(f"\n🔧 To use this model, update the Streamlit app:")
        print(f'   "Test Model": "{model_cid}"')
    else:
        print("❌ Failed to upload test model to IPFS")

if __name__ == "__main__":
    main()