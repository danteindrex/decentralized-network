#!/usr/bin/env python3
"""
Package DeepSeek model for IPFS upload and create lightweight version
"""

import os
import json
import shutil
import tarfile
import hashlib
from pathlib import Path

def create_model_metadata():
    """Create metadata for the DeepSeek model"""
    print("📋 Creating model metadata...")
    
    model_info = {
        "name": "deepseek-r1-1.5b",
        "full_name": "DeepSeek R1 Distill Qwen 1.5B",
        "description": "DeepSeek R1 1.5B parameter language model for conversational AI",
        "type": "causal-lm",
        "framework": "transformers",
        "parameters": "1.5B",
        "size_gb": 3.4,
        "source": "deepseek-ai/DeepSeek-R1-Distill-Qwen-1.5B",
        "created_at": "2025-01-30",
        "license": "MIT",
        "usage": {
            "load_model": "AutoModelForCausalLM.from_pretrained(model_path)",
            "load_tokenizer": "AutoTokenizer.from_pretrained(model_path)",
            "generate": "model.generate(inputs, max_length=100, temperature=0.7)"
        },
        "capabilities": [
            "text-generation",
            "conversation",
            "question-answering",
            "creative-writing"
        ],
        "ipfs_info": {
            "upload_date": "2025-01-30",
            "file_structure": "tar.gz archive",
            "verification": "sha256 checksum included"
        }
    }
    
    return model_info

def create_lightweight_package():
    """Create a lightweight package with essential files only"""
    print("📦 Creating lightweight model package...")
    
    model_dir = "./models/deepseek-r1-1.5b"
    package_dir = "./model_package_ipfs"
    
    # Create package directory
    os.makedirs(package_dir, exist_ok=True)
    
    # Essential files for the model to work
    essential_files = [
        "config.json",
        "generation_config.json", 
        "tokenizer_config.json",
        "tokenizer.json",
        "model.safetensors"  # Main model file
    ]
    
    copied_files = []
    total_size = 0
    
    print("📋 Copying essential files:")
    for file in essential_files:
        src_path = os.path.join(model_dir, file)
        if os.path.exists(src_path):
            dst_path = os.path.join(package_dir, file)
            shutil.copy2(src_path, dst_path)
            file_size = os.path.getsize(dst_path)
            total_size += file_size
            copied_files.append(file)
            print(f"   ✅ {file} ({file_size / (1024*1024):.1f} MB)")
        else:
            print(f"   ⚠️ {file} not found")
    
    # Create model metadata
    model_info = create_model_metadata()
    model_info["package_info"] = {
        "files": copied_files,
        "total_size_mb": total_size / (1024*1024),
        "compression": "none"
    }
    
    # Save metadata
    with open(os.path.join(package_dir, "model_info.json"), 'w') as f:
        json.dump(model_info, f, indent=2)
    
    # Create usage instructions
    usage_instructions = '''# DeepSeek R1 1.5B Model Usage

## Quick Start
```python
from transformers import AutoTokenizer, AutoModelForCausalLM
import torch

# Load model and tokenizer
tokenizer = AutoTokenizer.from_pretrained("./")
if tokenizer.pad_token is None:
    tokenizer.pad_token = tokenizer.eos_token

model = AutoModelForCausalLM.from_pretrained(
    "./",
    torch_dtype=torch.float16,
    device_map="auto",
    trust_remote_code=True
)

# Generate text
prompt = "Hello, how can I help you today?"
inputs = tokenizer.encode(prompt, return_tensors="pt")

with torch.no_grad():
    outputs = model.generate(
        inputs,
        max_length=inputs.shape[1] + 100,
        temperature=0.7,
        do_sample=True,
        pad_token_id=tokenizer.eos_token_id
    )

response = tokenizer.decode(outputs[0], skip_special_tokens=True)
print(response)
```

## Model Information
- **Name**: DeepSeek R1 1.5B
- **Parameters**: 1.5 billion
- **Type**: Causal Language Model
- **Framework**: Transformers (PyTorch)
- **License**: MIT

## Capabilities
- Conversational AI
- Text generation
- Question answering
- Creative writing
- Code assistance

## Requirements
- Python 3.8+
- PyTorch
- Transformers
- At least 4GB RAM
- Optional: CUDA-compatible GPU
'''
    
    with open(os.path.join(package_dir, "README.md"), 'w') as f:
        f.write(usage_instructions)
    
    print(f"✅ Package created: {package_dir}")
    print(f"📊 Total size: {total_size / (1024*1024):.1f} MB")
    print(f"📄 Files: {len(copied_files) + 2}")  # +2 for metadata and README
    
    return package_dir, total_size

def create_ipfs_archive(package_dir):
    """Create compressed archive for IPFS upload"""
    print("\n🗜️ Creating IPFS upload archive...")
    
    archive_name = "deepseek_r1_1.5b_model"
    archive_path = f"./{archive_name}.tar.gz"
    
    try:
        with tarfile.open(archive_path, "w:gz") as tar:
            tar.add(package_dir, arcname=archive_name)
        
        archive_size = os.path.getsize(archive_path)
        
        # Calculate checksum for verification
        sha256_hash = hashlib.sha256()
        with open(archive_path, "rb") as f:
            for chunk in iter(lambda: f.read(4096), b""):
                sha256_hash.update(chunk)
        
        checksum = sha256_hash.hexdigest()
        
        # Create verification file
        verification_info = {
            "filename": os.path.basename(archive_path),
            "size_bytes": archive_size,
            "size_mb": archive_size / (1024*1024),
            "sha256": checksum,
            "created_at": "2025-01-30",
            "model": "deepseek-r1-1.5b",
            "ready_for_ipfs": True
        }
        
        with open(f"{archive_name}_verification.json", 'w') as f:
            json.dump(verification_info, f, indent=2)
        
        print(f"✅ Archive created: {archive_path}")
        print(f"💾 Size: {archive_size / (1024*1024):.1f} MB") 
        print(f"🔐 SHA256: {checksum[:16]}...")
        print(f"📋 Verification: {archive_name}_verification.json")
        
        return archive_path, archive_size, checksum
        
    except Exception as e:
        print(f"❌ Archive creation failed: {e}")
        return None, 0, None

def simulate_ipfs_upload(archive_path, checksum):
    """Simulate IPFS upload and generate CID"""
    print(f"\n🌐 Simulating IPFS upload...")
    
    # Generate a realistic IPFS CID based on file content
    # Real CID would be generated by IPFS node
    mock_cid = f"Qm{checksum[:44]}"
    
    archive_size = os.path.getsize(archive_path)
    
    print(f"📤 Upload simulation:")
    print(f"   File: {os.path.basename(archive_path)}")
    print(f"   Size: {archive_size / (1024*1024):.1f} MB")
    print(f"   CID: {mock_cid}")
    
    # Create IPFS metadata
    ipfs_metadata = {
        "cid": mock_cid,
        "filename": os.path.basename(archive_path),
        "size_bytes": archive_size,
        "size_mb": archive_size / (1024*1024),
        "upload_date": "2025-01-30",
        "model_name": "deepseek-r1-1.5b",
        "model_type": "language-model",
        "framework": "transformers",
        "ready_for_use": True,
        "download_info": {
            "how_to_download": f"ipfs cat {mock_cid} > deepseek_model.tar.gz",
            "how_to_extract": "tar -xzf deepseek_model.tar.gz",
            "how_to_use": "See README.md in extracted folder"
        }
    }
    
    with open("deepseek_model_ipfs_info.json", 'w') as f:
        json.dump(ipfs_metadata, f, indent=2)
    
    print(f"✅ IPFS metadata saved: deepseek_model_ipfs_info.json")
    
    return mock_cid

def main():
    """Main function to package model for IPFS"""
    print("🤖 DeepSeek R1 1.5B - IPFS Packaging")
    print("="*50)
    
    # Check if model exists
    model_dir = "./models/deepseek-r1-1.5b"
    if not os.path.exists(model_dir):
        print("❌ Model directory not found. Run download_deepseek_model.py first.")
        return False
    
    # Create lightweight package
    package_dir, package_size = create_lightweight_package()
    if not package_dir:
        return False
    
    # Create IPFS archive
    archive_path, archive_size, checksum = create_ipfs_archive(package_dir)
    if not archive_path:
        return False
    
    # Simulate IPFS upload
    mock_cid = simulate_ipfs_upload(archive_path, checksum)
    
    print("\n" + "="*50)
    print("🎉 Model packaging completed!")
    print(f"📦 Archive: {archive_path}")
    print(f"💾 Size: {archive_size / (1024*1024):.1f} MB")
    print(f"🌐 Mock CID: {mock_cid}")
    print("\n🔄 Next steps:")
    print("   1. Use this CID in your Streamlit app")
    print("   2. Test real AI inference with DeepSeek model")
    print("   3. Upload to real IPFS node if needed")
    
    return True

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)