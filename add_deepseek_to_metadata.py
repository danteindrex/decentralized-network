#!/usr/bin/env python3
"""
Add DeepSeek Model to Streamlit Metadata
"""

import json
import os
from pathlib import Path

# Configuration
MODEL_CID = "QmVyvJ3BUuz1KiFidCHCKN2ZNJkt2dNWREYuyn4AJSnu6Q"
MODEL_NAME = "DeepSeek-1B"

# Metadata file path
METADATA_PATH = Path("uploaded_files_metadata.json")

def add_model_to_metadata():
    """Add DeepSeek model to metadata"""
    print("📝 Adding DeepSeek model to metadata...")
    
    # Load existing metadata
    if METADATA_PATH.exists():
        with open(METADATA_PATH, 'r') as f:
            metadata = json.load(f)
    else:
        metadata = []
    
    # Check if model already exists
    for item in metadata:
        if item.get('hash') == MODEL_CID:
            print("✅ Model already in metadata")
            return
    
    # Add model
    model_entry = {
        'name': MODEL_NAME,
        'hash': MODEL_CID,
        'size': 1024 * 1024 * 100,  # Approximate 100MB
        'type': 'model',
        'uploaded_at': '2025-01-29T12:00:00',
        'description': 'DeepSeek 1B parameter language model for AI inference'
    }
    
    metadata.append(model_entry)
    
    # Save metadata
    with open(METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=4)
    
    print(f"✅ Added {MODEL_NAME} to metadata")
    print(f"   CID: {MODEL_CID}")

def main():
    add_model_to_metadata()
    
    # Also create job history file if it doesn't exist
    job_history_path = Path("job_history.json")
    if not job_history_path.exists():
        with open(job_history_path, 'w') as f:
            json.dump([], f)
        print("✅ Created job_history.json")

if __name__ == "__main__":
    main()