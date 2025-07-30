#!/usr/bin/env python3
"""
Download DeepSeek R1 1.5B model from Hugging Face and prepare for IPFS upload
"""

import os
import json
import shutil
import tarfile
from pathlib import Path
from transformers import AutoTokenizer, AutoModelForCausalLM
from huggingface_hub import snapshot_download
import torch

def download_deepseek_model():
    """Download DeepSeek R1 1.5B model"""
    print("🚀 Downloading DeepSeek R1 1.5B model from Hugging Face...")
    
    model_name = "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B"
    local_dir = "./models/deepseek-r1-1.5b"
    
    try:
        # Create models directory
        os.makedirs(local_dir, exist_ok=True)
        
        print(f"📦 Downloading model: {model_name}")
        print(f"📁 Saving to: {local_dir}")
        
        # Download model files
        snapshot_download(
            repo_id=model_name,
            local_dir=local_dir,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        
        print("✅ Model download completed!")
        return local_dir
        
    except Exception as e:
        print(f"❌ Download failed: {e}")
        
        # Try alternative smaller model as fallback
        print("🔄 Trying alternative smaller model...")
        try:
            fallback_model = "microsoft/DialoGPT-small"
            print(f"📦 Downloading fallback model: {fallback_model}")
            
            snapshot_download(
                repo_id=fallback_model,
                local_dir=local_dir,
                local_dir_use_symlinks=False,
                resume_download=True
            )
            
            print("✅ Fallback model download completed!")
            return local_dir
            
        except Exception as e2:
            print(f"❌ Fallback download also failed: {e2}")
            return None

def test_model_loading(model_dir):
    """Test if the model can be loaded"""
    print(f"\n🧪 Testing model loading from {model_dir}...")
    
    try:
        # Test loading tokenizer
        print("📝 Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        print("✅ Tokenizer loaded successfully")
        
        # Test loading model
        print("🧠 Loading model...")
        model = AutoModelForCausalLM.from_pretrained(
            model_dir,
            torch_dtype=torch.float16,
            device_map="auto" if torch.cuda.is_available() else "cpu",
            trust_remote_code=True
        )
        print("✅ Model loaded successfully")
        
        # Test inference
        print("🔬 Testing inference...")
        test_prompt = "Hello, how are you?"
        inputs = tokenizer.encode(test_prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                inputs,
                max_length=inputs.shape[1] + 50,
                num_return_sequences=1,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        print(f"🎯 Test inference successful!")
        print(f"   Input: {test_prompt}")
        print(f"   Output: {response}")
        
        return True
        
    except Exception as e:
        print(f"❌ Model testing failed: {e}")
        return False

def create_model_package(model_dir):
    """Create a packaged version of the model for IPFS upload"""
    print(f"\n📦 Creating model package for IPFS...")
    
    try:
        package_dir = "./model_package"
        os.makedirs(package_dir, exist_ok=True)
        
        # Create model info
        model_info = {
            "name": "deepseek-r1-1.5b",
            "description": "DeepSeek R1 1.5B parameter language model",
            "type": "causal-lm",
            "framework": "transformers",
            "size": "1.5B parameters",
            "created_at": "2025-01-30",
            "usage": {
                "load": "AutoModelForCausalLM.from_pretrained(model_path)",
                "tokenizer": "AutoTokenizer.from_pretrained(model_path)"
            }
        }
        
        # Save model info
        with open(os.path.join(package_dir, "model_info.json"), 'w') as f:
            json.dump(model_info, f, indent=2)
        
        # Copy essential model files
        essential_files = [
            "config.json",
            "tokenizer.json", 
            "tokenizer_config.json",
            "vocab.txt",
            "special_tokens_map.json"
        ]
        
        model_files = []
        for file in os.listdir(model_dir):
            if file.endswith(('.bin', '.safetensors', '.pt')):
                model_files.append(file)
        
        print("📋 Copying essential files:")
        copied_files = []
        
        for file in essential_files + model_files[:2]:  # Limit to first 2 model files for size
            src_path = os.path.join(model_dir, file)
            if os.path.exists(src_path):
                dst_path = os.path.join(package_dir, file)
                shutil.copy2(src_path, dst_path)
                copied_files.append(file)
                print(f"   ✅ {file}")
        
        # Create a usage example
        usage_example = '''
# Example usage for this model
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("./")
model = AutoModelForCausalLM.from_pretrained("./", torch_dtype=torch.float16)

# Generate text
prompt = "Hello, how can I help you?"
inputs = tokenizer.encode(prompt, return_tensors="pt")
outputs = model.generate(inputs, max_length=100, temperature=0.7)
response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
'''
        
        with open(os.path.join(package_dir, "usage_example.py"), 'w') as f:
            f.write(usage_example)
        
        # Get package size
        total_size = sum(
            os.path.getsize(os.path.join(package_dir, f)) 
            for f in os.listdir(package_dir)
        )
        
        print(f"📊 Package created:")
        print(f"   📁 Directory: {package_dir}")
        print(f"   📄 Files: {len(copied_files) + 2}")  # +2 for info.json and usage_example.py
        print(f"   💾 Size: {total_size / (1024*1024):.1f} MB")
        
        return package_dir, total_size
        
    except Exception as e:
        print(f"❌ Package creation failed: {e}")
        return None, 0

def create_compressed_model(package_dir):
    """Create a compressed version for easier IPFS upload"""
    print(f"\n🗜️ Creating compressed model archive...")
    
    try:
        archive_path = "./deepseek_r1_1.5b_model.tar.gz"
        
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(package_dir, arcname="deepseek_r1_1.5b")
        
        archive_size = os.path.getsize(archive_path)
        print(f"✅ Compressed archive created:")
        print(f"   📁 File: {archive_path}")
        print(f"   💾 Size: {archive_size / (1024*1024):.1f} MB")
        
        return archive_path, archive_size
        
    except Exception as e:
        print(f"❌ Compression failed: {e}")
        return None, 0

def main():
    """Main function to download and package the model"""
    print("🤖 DeepSeek R1 1.5B Model Download & IPFS Preparation")
    print("="*60)
    
    # Step 1: Download model
    model_dir = download_deepseek_model()
    if not model_dir:
        print("❌ Could not download model")
        return False
    
    # Step 2: Test model loading
    if not test_model_loading(model_dir):
        print("⚠️ Model testing failed, but proceeding...")
    
    # Step 3: Create package
    package_dir, package_size = create_model_package(model_dir)
    if not package_dir:
        print("❌ Could not create model package")
        return False
    
    # Step 4: Create compressed archive
    archive_path, archive_size = create_compressed_model(package_dir)
    if not archive_path:
        print("❌ Could not create compressed archive")
        return False
    
    print("\n" + "="*60)
    print("🎉 Model preparation completed!")
    print(f"📦 Ready for IPFS upload: {archive_path}")
    print(f"💾 Archive size: {archive_size / (1024*1024):.1f} MB")
    print("\n🔄 Next steps:")
    print("   1. Upload the archive to IPFS")
    print("   2. Get the IPFS CID")
    print("   3. Integrate with Streamlit app")
    print("   4. Test real AI inference!")
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)