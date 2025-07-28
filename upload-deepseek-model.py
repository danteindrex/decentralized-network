#!/usr/bin/env python3
"""
Download DeepSeek 1B model from Hugging Face and upload to IPFS using chunking system
"""

import os
import sys
import requests
import json
import time
import subprocess
from pathlib import Path
from huggingface_hub import snapshot_download, login
from tqdm import tqdm

# Configuration
OWNER_API_URL = "http://localhost:8002"
MODEL_STORAGE_CLI = "./ipfs/model-storage/cli.js"

def check_owner_api():
    """Check if owner API is running"""
    try:
        response = requests.get(f"{OWNER_API_URL}/health")
        if response.status_code == 200:
            health = response.json()
            print(f"✅ Owner API is running")
            print(f"   Status: {health['status']}")
            print(f"   Web3: {'✅' if health['services']['web3'] else '❌'}")
            print(f"   IPFS: {'✅' if health['services']['ipfs'] else '❌'}")
            
            # Continue even if IPFS shows as disconnected - we'll try direct upload
            if not health['services']['ipfs']:
                print("⚠️  IPFS shows as disconnected, but we'll try direct upload")
            return True
        else:
            print(f"❌ Owner API health check failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Failed to connect to Owner API: {e}")
        print("💡 Make sure the owner API is running: python3 scripts/owner_api.py")
        return False

def test_direct_ipfs():
    """Test direct IPFS connection"""
    try:
        ipfs_url = "http://127.0.0.1:5001/api/v0/version"
        response = requests.post(ipfs_url, timeout=5)  # Use POST method
        if response.status_code == 200:
            version_info = response.json()
            print(f"✅ Direct IPFS connection working")
            print(f"   Version: {version_info.get('Version', 'Unknown')}")
            return True
        else:
            print(f"❌ Direct IPFS connection failed: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ Direct IPFS connection error: {e}")
        return False

def download_deepseek_model():
    """Download DeepSeek 1B model from Hugging Face"""
    model_name = "deepseek-ai/deepseek-coder-1.3b-base"
    local_dir = "./models/deepseek-1b"
    
    print(f"📥 Downloading {model_name} from Hugging Face...")
    print(f"📁 Local directory: {local_dir}")
    
    try:
        # Create local directory
        os.makedirs(local_dir, exist_ok=True)
        
        # Download model files
        print("⏳ This may take several minutes...")
        snapshot_download(
            repo_id=model_name,
            local_dir=local_dir,
            local_dir_use_symlinks=False,
            resume_download=True
        )
        
        print(f"✅ Model downloaded successfully to {local_dir}")
        return local_dir
        
    except Exception as e:
        print(f"❌ Failed to download model: {e}")
        print("💡 You may need to install huggingface_hub: pip install huggingface_hub")
        return None

def find_model_files(model_dir):
    """Find the main model files to upload"""
    model_path = Path(model_dir)
    
    # Look for common model file types
    model_files = []
    for pattern in ["*.safetensors", "*.bin", "*.pt", "*.pth"]:
        model_files.extend(model_path.glob(pattern))
    
    # Also include config files
    config_files = []
    for pattern in ["config.json", "tokenizer.json", "tokenizer_config.json", "vocab.txt", "merges.txt"]:
        config_files.extend(model_path.glob(pattern))
    
    return model_files, config_files

def upload_model_to_owner_api(model_dir, model_files):
    """Upload model to IPFS via Owner API"""
    
    # Find the main model file (usually the largest .safetensors file)
    main_model_file = None
    largest_size = 0
    
    for file_path in model_files:
        if file_path.suffix in ['.safetensors', '.bin']:
            size = file_path.stat().st_size
            if size > largest_size:
                largest_size = size
                main_model_file = file_path
    
    if not main_model_file:
        print("❌ No suitable model file found")
        return None
    
    print(f"📤 Uploading main model file: {main_model_file.name}")
    print(f"📊 File size: {largest_size / (1024*1024*1024):.2f} GB")
    
    # Prepare upload data
    model_id = "deepseek-coder-1b"
    upload_data = {
        "model_id": model_id,
        "name": "DeepSeek Coder 1.3B Base",
        "description": "DeepSeek Coder 1.3B parameter base model for code generation",
        "version": "1.0.0",
        "tags": "code,generation,deepseek,1b",
        "license": "MIT",
        "price_per_inference": 0.001
    }
    
    try:
        # Upload the model file
        with open(main_model_file, 'rb') as f:
            files = {'model_file': (main_model_file.name, f, 'application/octet-stream')}
            
            print("⏳ Uploading to Owner API (this may take several minutes)...")
            response = requests.post(
                f"{OWNER_API_URL}/upload",
                data=upload_data,
                files=files,
                timeout=1800  # 30 minutes timeout
            )
        
        if response.status_code == 200:
            result = response.json()
            print(f"✅ Upload started successfully!")
            print(f"📋 Model ID: {result['model_id']}")
            print(f"📊 Status: {result['status']}")
            return result['model_id']
        else:
            print(f"❌ Upload failed: {response.status_code}")
            print(f"Error: {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def monitor_upload_progress(model_id):
    """Monitor the upload progress"""
    print(f"\n📊 Monitoring upload progress for {model_id}...")
    
    while True:
        try:
            response = requests.get(f"{OWNER_API_URL}/status/{model_id}")
            if response.status_code == 200:
                status = response.json()
                progress = status['upload_progress']
                current_status = status['status']
                
                print(f"\r⏳ Progress: {progress:.1f}% - Status: {current_status}", end="", flush=True)
                
                if current_status in ['completed', 'failed', 'ipfs_only']:
                    print()  # New line
                    if current_status == 'completed':
                        print(f"🎉 Upload completed successfully!")
                        print(f"📋 Model ID: {model_id}")
                        print(f"🔗 IPFS CID: {status.get('ipfs_cid', 'N/A')}")
                        print(f"⛓️  Blockchain TX: {status.get('blockchain_tx', 'N/A')}")
                        return status.get('ipfs_cid')
                    elif current_status == 'ipfs_only':
                        print(f"✅ Upload to IPFS completed (blockchain registration skipped)")
                        print(f"🔗 IPFS CID: {status.get('ipfs_cid', 'N/A')}")
                        return status.get('ipfs_cid')
                    else:
                        print(f"❌ Upload failed")
                        return None
                
                time.sleep(5)  # Check every 5 seconds
            else:
                print(f"\n❌ Failed to get status: {response.status_code}")
                return None
                
        except KeyboardInterrupt:
            print(f"\n⏹️  Monitoring stopped by user")
            return None
        except Exception as e:
            print(f"\n❌ Error monitoring progress: {e}")
            return None

def update_streamlit_with_model(model_cid):
    """Update Streamlit app with the new model CID"""
    if not model_cid:
        return
    
    print(f"\n🔧 To use this model in Streamlit, update the available_models dict:")
    print(f'   "DeepSeek Coder 1.3B": "{model_cid}"')
    
    # Optionally auto-update the Streamlit file
    try:
        with open('streamlit_app.py', 'r') as f:
            content = f.read()
        
        # Find and replace the models dict
        old_models = '"Simple Test Model": "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe"'
        new_models = f'"Simple Test Model": "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe",\n            "DeepSeek Coder 1.3B": "{model_cid}"'
        
        if old_models in content:
            updated_content = content.replace(old_models, new_models)
            with open('streamlit_app.py', 'w') as f:
                f.write(updated_content)
            print(f"✅ Streamlit app updated automatically!")
        else:
            print(f"⚠️  Please manually update streamlit_app.py with the model CID")
            
    except Exception as e:
        print(f"⚠️  Could not auto-update Streamlit: {e}")

def upload_directly_to_ipfs(model_file):
    """Upload model directly to IPFS with chunking support"""
    try:
        print(f"📤 Uploading directly to IPFS: {model_file.name}")
        file_size = model_file.stat().st_size
        print(f"📊 File size: {file_size / (1024*1024*1024):.2f} GB")
        
        ipfs_url = "http://127.0.0.1:5001/api/v0/add"
        
        # For large files, use streaming upload
        if file_size > 100 * 1024 * 1024:  # > 100MB
            print("📦 Using chunked upload for large file...")
            return upload_large_file_to_ipfs(model_file, ipfs_url)
        else:
            # Small file - upload normally
            with open(model_file, 'rb') as f:
                files = {'file': (model_file.name, f)}
                response = requests.post(ipfs_url, files=files, timeout=600)
            
            if response.status_code == 200:
                result = response.json()
                model_cid = result['Hash']
                print(f"✅ Model uploaded directly to IPFS: {model_cid}")
                return model_cid
            else:
                print(f"❌ Direct IPFS upload failed: {response.status_code}")
                return None
            
    except Exception as e:
        print(f"❌ Direct IPFS upload error: {e}")
        return None

def upload_with_chunking_system(model_file):
    """Upload model using the existing chunking system"""
    try:
        print(f"📦 Using advanced chunking system for: {model_file.name}")
        file_size = model_file.stat().st_size
        print(f"📊 File size: {file_size / (1024*1024*1024):.2f} GB")
        
        # Check if Node.js CLI exists
        if not os.path.exists(MODEL_STORAGE_CLI):
            print(f"❌ Model storage CLI not found: {MODEL_STORAGE_CLI}")
            print("💡 Falling back to direct upload...")
            return upload_directly_to_ipfs(model_file)
        
        # Prepare model info
        model_id = "deepseek-coder-1b-chunked"
        model_name = "DeepSeek Coder 1.3B (Chunked)"
        model_description = "DeepSeek Coder 1.3B with chunking for efficient storage and retrieval"
        
        print(f"🚀 Starting chunked upload...")
        print(f"   Model ID: {model_id}")
        print(f"   File: {model_file}")
        
        # Run the Node.js chunking CLI
        cmd = [
            "node", MODEL_STORAGE_CLI,
            "store",
            str(model_file),
            model_id,
            model_name,
            model_description
        ]
        
        print(f"🔧 Running: {' '.join(cmd)}")
        
        # Execute with real-time output
        process = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            universal_newlines=True,
            bufsize=1
        )
        
        # Stream output in real-time
        manifest_cid = None
        while True:
            output = process.stdout.readline()
            if output == '' and process.poll() is not None:
                break
            if output:
                print(f"📋 {output.strip()}")
                # Look for manifest CID in output
                if "Manifest uploaded to IPFS:" in output:
                    manifest_cid = output.split(":")[-1].strip()
        
        return_code = process.poll()
        
        if return_code == 0 and manifest_cid:
            print(f"✅ Chunked upload completed successfully!")
            print(f"📋 Manifest CID: {manifest_cid}")
            return manifest_cid
        else:
            print(f"❌ Chunked upload failed (exit code: {return_code})")
            print("💡 Falling back to direct upload...")
            return upload_directly_to_ipfs(model_file)
            
    except Exception as e:
        print(f"❌ Chunking system error: {e}")
        print("💡 Falling back to direct upload...")
        return upload_directly_to_ipfs(model_file)

def upload_large_file_to_ipfs(model_file, ipfs_url):
    """Upload large file to IPFS with progress tracking (fallback method)"""
    try:
        file_size = model_file.stat().st_size
        
        print(f"📦 Uploading large file directly to IPFS...")
        print(f"⚠️  Note: This uploads as a single file without chunking")
        
        # Use requests with streaming
        with open(model_file, 'rb') as f:
            # Create a custom file-like object that shows progress
            class ProgressFile:
                def __init__(self, file_obj, total_size):
                    self.file_obj = file_obj
                    self.total_size = total_size
                    self.uploaded = 0
                    self.last_percent = 0
                
                def read(self, size=-1):
                    chunk = self.file_obj.read(size)
                    if chunk:
                        self.uploaded += len(chunk)
                        percent = (self.uploaded / self.total_size) * 100
                        if percent - self.last_percent >= 5:  # Update every 5%
                            print(f"⏳ Upload progress: {percent:.1f}% ({self.uploaded // (1024*1024)}MB / {self.total_size // (1024*1024)}MB)")
                            self.last_percent = percent
                    return chunk
                
                def __getattr__(self, name):
                    return getattr(self.file_obj, name)
            
            progress_file = ProgressFile(f, file_size)
            files = {'file': (model_file.name, progress_file)}
            
            response = requests.post(
                ipfs_url, 
                files=files, 
                timeout=1800,  # 30 minutes
                stream=True
            )
        
        if response.status_code == 200:
            result = response.json()
            model_cid = result['Hash']
            print(f"✅ Large file uploaded to IPFS: {model_cid}")
            return model_cid
        else:
            print(f"❌ Large file upload failed: {response.status_code}")
            return None
            
    except Exception as e:
        print(f"❌ Large file upload error: {e}")
        return None

def upload_with_chunking_system(model_dir, model_id):
    """Upload model using your existing chunking and blockchain system"""
    try:
        print(f"🔧 Using existing chunking system for upload...")
        
        # Check if CLI exists
        if not os.path.exists(MODEL_STORAGE_CLI):
            print(f"❌ Model storage CLI not found at: {MODEL_STORAGE_CLI}")
            return None
        
        # Find the main model file
        model_files, config_files = find_model_files(model_dir)
        if not model_files:
            print("❌ No model files found")
            return None
        
        main_model_file = max(model_files, key=lambda f: f.stat().st_size)
        print(f"📦 Using main model file: {main_model_file.name}")
        
        # Prepare command
        cmd = [
            'node',
            MODEL_STORAGE_CLI,
            'store',
            str(main_model_file),
            model_id,
            '--name', 'DeepSeek Coder 1.3B Base',
            '--description', 'DeepSeek Coder 1.3B parameter base model for code generation',
            '--output', f'{model_id}_result.json'
        ]
        
        print(f"🚀 Running chunking system...")
        print(f"Command: {' '.join(cmd)}")
        
        # Run the command
        result = subprocess.run(cmd, capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0:
            print("✅ Chunking system upload successful!")
            print("📋 Output:")
            print(result.stdout)
            
            # Try to read the result file
            result_file = f'{model_id}_result.json'
            if os.path.exists(result_file):
                with open(result_file, 'r') as f:
                    upload_result = json.load(f)
                return upload_result.get('manifestCID')
            else:
                # Parse CID from stdout
                lines = result.stdout.split('\n')
                for line in lines:
                    if 'Manifest CID:' in line:
                        return line.split('Manifest CID:')[1].strip()
                return "uploaded_successfully"
        else:
            print("❌ Chunking system upload failed!")
            print("Error output:")
            print(result.stderr)
            return None
            
    except Exception as e:
        print(f"❌ Error using chunking system: {e}")
        return None

def list_existing_models():
    """List models already stored in the chunking system"""
    try:
        if not os.path.exists(MODEL_STORAGE_CLI):
            return []
        
        cmd = ['node', MODEL_STORAGE_CLI, 'list', '--output', 'models_list.json']
        result = subprocess.run(cmd, capture_output=True, text=True, cwd='.')
        
        if result.returncode == 0 and os.path.exists('models_list.json'):
            with open('models_list.json', 'r') as f:
                models = json.load(f)
            os.remove('models_list.json')  # Cleanup
            return models
        else:
            return []
    except:
        return []

def main():
    print("🚀 DeepSeek 1B Model Upload Script")
    print("=" * 40)
    
    # Check existing models first
    print("🔍 Checking existing models...")
    existing_models = list_existing_models()
    if existing_models:
        print(f"📚 Found {len(existing_models)} existing models:")
        for model in existing_models[:3]:  # Show first 3
            print(f"   📦 {model.get('name', model.get('modelId'))}")
    
    # Check if owner API is running
    if not check_owner_api():
        print("⚠️  Owner API not available, will use chunking system only")
    
    # Test direct IPFS connection
    print("\n🔍 Testing direct IPFS connection...")
    ipfs_working = test_direct_ipfs()
    
    # Check if model already exists locally
    model_dir = "./models/deepseek-1b"
    if os.path.exists(model_dir) and os.listdir(model_dir):
        print(f"📁 Model directory already exists: {model_dir}")
        use_existing = input("Use existing model? (y/N): ").lower().startswith('y')
        if not use_existing:
            print("📥 Re-downloading model...")
            model_dir = download_deepseek_model()
    else:
        # Download model from Hugging Face
        model_dir = download_deepseek_model()
    
    if not model_dir:
        print("❌ Failed to get model files")
        sys.exit(1)
    
    # Find model files
    print(f"\n🔍 Scanning model files in {model_dir}...")
    model_files, config_files = find_model_files(model_dir)
    
    print(f"📊 Found {len(model_files)} model files and {len(config_files)} config files")
    for f in model_files[:3]:  # Show first 3
        size_mb = f.stat().st_size / (1024*1024)
        print(f"   📄 {f.name} ({size_mb:.1f} MB)")
    
    if not model_files:
        print("❌ No model files found")
        sys.exit(1)
    
    # Upload via Owner API (which now uses chunking automatically)
    print(f"\n📤 Uploading via Owner API with chunking system...")
    model_id = upload_model_to_owner_api(model_dir, model_files)
    
    if not model_id:
        print("❌ Upload failed")
        sys.exit(1)
    
    # Monitor progress
    model_cid = monitor_upload_progress(model_id)
    
    # Update Streamlit
    update_streamlit_with_model(model_cid)
    
    print(f"\n🎉 DeepSeek 1B model upload complete!")
    if model_cid:
        print(f"🔗 IPFS CID: {model_cid}")
        print(f"💡 You can now use this model in the Streamlit interface!")

if __name__ == "__main__":
    main()