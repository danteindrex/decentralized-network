#!/usr/bin/env python3
"""
Test DeepSeek R1 1.5B model integration with Streamlit app
"""

import os
import sys
import json

def test_model_files():
    """Test if DeepSeek model files are present"""
    print("🔍 Testing DeepSeek model files...")
    
    model_dir = "./models/deepseek-r1-1.5b"
    required_files = [
        "config.json",
        "tokenizer.json", 
        "tokenizer_config.json",
        "model.safetensors"
    ]
    
    if not os.path.exists(model_dir):
        print(f"❌ Model directory not found: {model_dir}")
        return False
    
    print(f"✅ Model directory exists: {model_dir}")
    
    missing_files = []
    for file in required_files:
        file_path = os.path.join(model_dir, file)
        if os.path.exists(file_path):
            file_size = os.path.getsize(file_path)
            print(f"   ✅ {file} ({file_size / (1024*1024):.1f} MB)")
        else:
            missing_files.append(file)
            print(f"   ❌ {file} (missing)")
    
    if missing_files:
        print(f"⚠️ Missing files: {missing_files}")
        return False
    
    return True

def test_dependencies():
    """Test if required dependencies are available"""
    print("\n🔍 Testing dependencies...")
    
    dependencies = {
        "streamlit": "streamlit",
        "transformers": "transformers", 
        "torch": "torch",
        "accelerate": "accelerate",
        "safetensors": "safetensors"
    }
    
    available = []
    missing = []
    
    for name, module in dependencies.items():
        try:
            __import__(module)
            available.append(name)
            print(f"   ✅ {name}")
        except ImportError:
            missing.append(name)
            print(f"   ❌ {name}")
    
    if missing:
        print(f"\n⚠️ Missing dependencies: {missing}")
        print("💡 Install with: pip install " + " ".join(missing))
        return False
    
    return True

def test_model_loading():
    """Test if the model can be loaded"""
    print("\n🔍 Testing model loading...")
    
    try:
        from transformers import AutoTokenizer, AutoModelForCausalLM
        import torch
        
        model_dir = "./models/deepseek-r1-1.5b"
        
        print("   📝 Loading tokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        print("   ✅ Tokenizer loaded")
        
        print("   🧠 Loading model...")
        model = AutoModelForCausalLM.from_pretrained(
            model_dir,
            torch_dtype=torch.float16 if torch.cuda.is_available() else torch.float32,
            device_map="auto" if torch.cuda.is_available() else "cpu",
            trust_remote_code=True
        )
        print("   ✅ Model loaded")
        
        print("   🔬 Testing inference...")
        test_prompt = "Hello, how are you?"
        inputs = tokenizer.encode(test_prompt, return_tensors="pt")
        
        with torch.no_grad():
            outputs = model.generate(
                inputs,
                max_length=inputs.shape[1] + 20,
                temperature=0.7,
                do_sample=True,
                pad_token_id=tokenizer.eos_token_id
            )
        
        response = tokenizer.decode(outputs[0], skip_special_tokens=True)
        print(f"   ✅ Inference successful!")
        print(f"   📝 Test output: {response[:100]}...")
        
        return True
        
    except Exception as e:
        print(f"   ❌ Model loading failed: {e}")
        return False

def test_ipfs_metadata():
    """Test IPFS metadata file"""
    print("\n🔍 Testing IPFS metadata...")
    
    metadata_file = "./deepseek_model_ipfs_metadata.json"
    if os.path.exists(metadata_file):
        with open(metadata_file, 'r') as f:
            metadata = json.load(f)
        
        cid = metadata.get('ipfs', {}).get('cid', 'Unknown')
        size_gb = metadata.get('ipfs', {}).get('size_gb', 0)
        
        print(f"   ✅ IPFS metadata found")
        print(f"   🌐 CID: {cid}")
        print(f"   💾 Size: {size_gb:.1f} GB")
        return True
    else:
        print(f"   ❌ IPFS metadata not found: {metadata_file}")
        return False

def main():
    """Run all tests"""
    print("🚀 DeepSeek R1 1.5B Integration Test")
    print("=" * 50)
    
    tests = [
        ("Model Files", test_model_files),
        ("Dependencies", test_dependencies), 
        ("IPFS Metadata", test_ipfs_metadata),
        ("Model Loading", test_model_loading)
    ]
    
    results = []
    for test_name, test_func in tests:
        try:
            result = test_func()
            results.append((test_name, result))
        except Exception as e:
            print(f"   ❌ {test_name} test crashed: {e}")
            results.append((test_name, False))
    
    print("\n" + "=" * 50)
    print("📊 Test Results:")
    
    all_passed = True
    for test_name, passed in results:
        status = "✅ PASS" if passed else "❌ FAIL"
        print(f"   {test_name}: {status}")
        if not passed:
            all_passed = False
    
    if all_passed:
        print("\n🎉 All tests passed! DeepSeek integration is ready!")
        print("💡 You can now use the DeepSeek R1 1.5B model in the Streamlit app")
    else:
        print("\n⚠️ Some tests failed. Please fix the issues above.")
        print("💡 Install missing dependencies: pip install -r requirements.txt")
    
    return all_passed

if __name__ == "__main__":
    success = main()
    exit(0 if success else 1)