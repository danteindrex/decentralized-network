#!/usr/bin/env python3
"""
Quick test to check if dependencies work in Streamlit context
"""

import streamlit as st
import sys
import os

st.title("🔍 Dependency Test")

st.write("**Python Environment:**")
st.code(f"Python: {sys.executable}")
st.code(f"Working Directory: {os.getcwd()}")

st.write("**Testing Dependencies:**")

deps = ["torch", "transformers", "accelerate", "safetensors"]
results = {}

for dep in deps:
    try:
        __import__(dep)
        st.success(f"✅ {dep}")
        results[dep] = True
    except ImportError as e:
        st.error(f"❌ {dep}: {e}")
        results[dep] = False

if all(results.values()):
    st.balloons()
    st.success("🎉 All dependencies available! DeepSeek model should work.")
else:
    st.warning("⚠️ Some dependencies missing. Will use simulation mode.")

# Test model directory
model_dir = "./models/deepseek-r1-1.5b"
if os.path.exists(model_dir):
    st.success(f"✅ Model directory found: {model_dir}")
    
    # Check key files
    key_files = ["config.json", "model.safetensors", "tokenizer.json"]
    for file in key_files:
        file_path = os.path.join(model_dir, file)
        if os.path.exists(file_path):
            size = os.path.getsize(file_path) / (1024*1024)
            st.write(f"   ✅ {file} ({size:.1f} MB)")
        else:
            st.write(f"   ❌ {file} (missing)")
else:
    st.error(f"❌ Model directory not found: {model_dir}")