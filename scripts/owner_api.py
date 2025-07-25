#!/usr/bin/env python3
"""
Model Owner API Server
Provides REST API for model owners to upload and manage AI models
"""

import os
import sys
import asyncio
import logging
from pathlib import Path
from typing import List, Dict, Any, Optional
import json
import hashlib
import shutil
from datetime import datetime

from fastapi import FastAPI, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
from pydantic import BaseModel

# Add orchestrator to path
sys.path.append('/app/orchestrator')

try:
    from web3 import Web3
    import ipfshttpclient
    from main import load_config_with_fallbacks
except ImportError as e:
    print(f"Import error: {e}")
    print("Some features may not be available")

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize FastAPI app
app = FastAPI(
    title="Model Owner API",
    description="API for AI model owners to upload and manage models",
    version="1.0.0"
)

# Add CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global variables
config = None
w3 = None
contract = None
ipfs_client = None

# Pydantic models
class ModelInfo(BaseModel):
    model_id: str
    name: str
    description: str
    version: str = "1.0.0"
    tags: List[str] = []
    license: str = "MIT"
    price_per_inference: float = 0.01

class ModelStatus(BaseModel):
    model_id: str
    status: str
    upload_progress: float
    ipfs_cid: Optional[str] = None
    blockchain_tx: Optional[str] = None
    created_at: str
    updated_at: str

# In-memory storage for model status (in production, use a database)
model_status_db: Dict[str, ModelStatus] = {}

@app.on_event("startup")
async def startup_event():
    """Initialize connections on startup"""
    global config, w3, contract, ipfs_client
    
    try:
        # Load configuration
        config = load_config_with_fallbacks()
        logger.info("✅ Configuration loaded")
        
        # Initialize Web3
        eth_node_url = os.getenv('ETH_NODE_URL', config.get('eth_node', 'http://localhost:8545'))
        w3 = Web3(Web3.HTTPProvider(eth_node_url))
        
        if w3.is_connected():
            logger.info(f"✅ Connected to Ethereum node: {eth_node_url}")
        else:
            logger.warning(f"⚠️ Failed to connect to Ethereum node: {eth_node_url}")
        
        # Load smart contract
        try:
            with open('/app/deployment.json', 'r') as f:
                deployment = json.load(f)
            
            contract_address = deployment['InferenceCoordinator']
            with open('/app/orchestrator/abis/InferenceCoordinator.json', 'r') as f:
                contract_abi = json.load(f)['abi']
            
            contract = w3.eth.contract(address=contract_address, abi=contract_abi)
            logger.info(f"✅ Smart contract loaded: {contract_address}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to load smart contract: {e}")
        
        # Initialize IPFS client
        try:
            ipfs_host = os.getenv('IPFS_HOST', '127.0.0.1')
            ipfs_port = int(os.getenv('IPFS_PORT', '5001'))
            ipfs_client = ipfshttpclient.connect(f'/ip4/{ipfs_host}/tcp/{ipfs_port}')
            logger.info(f"✅ Connected to IPFS: {ipfs_host}:{ipfs_port}")
        except Exception as e:
            logger.warning(f"⚠️ Failed to connect to IPFS: {e}")
            ipfs_client = None
        
    except Exception as e:
        logger.error(f"❌ Startup failed: {e}")

@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "message": "Model Owner API",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "upload": "/upload",
            "models": "/models",
            "status": "/status/{model_id}",
            "health": "/health"
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat(),
        "services": {
            "web3": w3.is_connected() if w3 else False,
            "ipfs": ipfs_client is not None,
            "contract": contract is not None
        }
    }

@app.get("/models")
async def list_models():
    """List all uploaded models"""
    try:
        models = []
        for model_id, status in model_status_db.items():
            models.append({
                "model_id": model_id,
                "status": status.status,
                "ipfs_cid": status.ipfs_cid,
                "created_at": status.created_at
            })
        
        return {"models": models, "count": len(models)}
    except Exception as e:
        logger.error(f"Error listing models: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/status/{model_id}")
async def get_model_status(model_id: str):
    """Get status of a specific model"""
    if model_id not in model_status_db:
        raise HTTPException(status_code=404, detail="Model not found")
    
    return model_status_db[model_id]

@app.post("/upload")
async def upload_model(
    background_tasks: BackgroundTasks,
    model_file: UploadFile = File(...),
    model_id: str = Form(...),
    name: str = Form(...),
    description: str = Form(...),
    version: str = Form("1.0.0"),
    tags: str = Form(""),
    license: str = Form("MIT"),
    price_per_inference: float = Form(0.01)
):
    """Upload a new AI model"""
    try:
        # Validate model file
        if not model_file.filename.endswith(('.safetensors', '.bin', '.pt', '.pth')):
            raise HTTPException(
                status_code=400, 
                detail="Invalid file type. Supported: .safetensors, .bin, .pt, .pth"
            )
        
        # Create model status entry
        model_status = ModelStatus(
            model_id=model_id,
            status="uploading",
            upload_progress=0.0,
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat()
        )
        model_status_db[model_id] = model_status
        
        # Start background upload task
        background_tasks.add_task(
            process_model_upload,
            model_file,
            ModelInfo(
                model_id=model_id,
                name=name,
                description=description,
                version=version,
                tags=tags.split(",") if tags else [],
                license=license,
                price_per_inference=price_per_inference
            )
        )
        
        return {
            "message": "Model upload started",
            "model_id": model_id,
            "status": "uploading"
        }
        
    except Exception as e:
        logger.error(f"Error starting model upload: {e}")
        raise HTTPException(status_code=500, detail=str(e))

async def process_model_upload(model_file: UploadFile, model_info: ModelInfo):
    """Background task to process model upload"""
    model_id = model_info.model_id
    
    try:
        # Update status
        model_status_db[model_id].status = "processing"
        model_status_db[model_id].upload_progress = 10.0
        
        # Create model directory
        model_dir = Path(f"/app/model_cache/{model_id}")
        model_dir.mkdir(parents=True, exist_ok=True)
        
        # Save uploaded file
        file_path = model_dir / model_file.filename
        with open(file_path, "wb") as buffer:
            content = await model_file.read()
            buffer.write(content)
        
        model_status_db[model_id].upload_progress = 30.0
        
        # Create model metadata
        metadata = {
            "model_id": model_info.model_id,
            "name": model_info.name,
            "description": model_info.description,
            "version": model_info.version,
            "tags": model_info.tags,
            "license": model_info.license,
            "price_per_inference": model_info.price_per_inference,
            "file_name": model_file.filename,
            "file_size": len(content),
            "file_hash": hashlib.sha256(content).hexdigest(),
            "uploaded_at": datetime.now().isoformat()
        }
        
        # Save metadata
        metadata_path = model_dir / "metadata.json"
        with open(metadata_path, "w") as f:
            json.dump(metadata, f, indent=2)
        
        model_status_db[model_id].upload_progress = 50.0
        
        # Upload to IPFS
        if ipfs_client:
            try:
                # Upload model directory to IPFS
                ipfs_result = ipfs_client.add(str(model_dir), recursive=True)
                
                # Get the root CID (last item in the result)
                if isinstance(ipfs_result, list):
                    model_cid = ipfs_result[-1]['Hash']
                else:
                    model_cid = ipfs_result['Hash']
                
                model_status_db[model_id].ipfs_cid = model_cid
                model_status_db[model_id].upload_progress = 80.0
                
                logger.info(f"✅ Model {model_id} uploaded to IPFS: {model_cid}")
                
                # Register on blockchain
                if contract and w3:
                    try:
                        # Get account
                        account = os.getenv('OWNER_ACCOUNT')
                        private_key = os.getenv('OWNER_PRIVATE_KEY')
                        
                        if account and private_key:
                            # Build transaction
                            tx = contract.functions.registerModel(
                                model_info.model_id,
                                model_cid,
                                model_info.name,
                                model_info.description
                            ).build_transaction({
                                'from': account,
                                'gas': 500000,
                                'gasPrice': w3.to_wei('20', 'gwei'),
                                'nonce': w3.eth.get_transaction_count(account)
                            })
                            
                            # Sign and send transaction
                            signed_tx = w3.eth.account.sign_transaction(tx, private_key)
                            tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
                            
                            model_status_db[model_id].blockchain_tx = tx_hash.hex()
                            model_status_db[model_id].upload_progress = 100.0
                            model_status_db[model_id].status = "completed"
                            
                            logger.info(f"✅ Model {model_id} registered on blockchain: {tx_hash.hex()}")
                        else:
                            logger.warning("⚠️ No owner account configured for blockchain registration")
                            model_status_db[model_id].status = "ipfs_only"
                            model_status_db[model_id].upload_progress = 90.0
                    
                    except Exception as e:
                        logger.error(f"❌ Blockchain registration failed: {e}")
                        model_status_db[model_id].status = "ipfs_only"
                        model_status_db[model_id].upload_progress = 90.0
                else:
                    logger.warning("⚠️ Blockchain not available")
                    model_status_db[model_id].status = "ipfs_only"
                    model_status_db[model_id].upload_progress = 90.0
                    
            except Exception as e:
                logger.error(f"❌ IPFS upload failed: {e}")
                model_status_db[model_id].status = "failed"
                model_status_db[model_id].upload_progress = 50.0
        else:
            logger.warning("⚠️ IPFS not available")
            model_status_db[model_id].status = "local_only"
            model_status_db[model_id].upload_progress = 60.0
        
        model_status_db[model_id].updated_at = datetime.now().isoformat()
        
    except Exception as e:
        logger.error(f"❌ Model upload processing failed: {e}")
        model_status_db[model_id].status = "failed"
        model_status_db[model_id].updated_at = datetime.now().isoformat()

@app.delete("/models/{model_id}")
async def delete_model(model_id: str):
    """Delete a model"""
    if model_id not in model_status_db:
        raise HTTPException(status_code=404, detail="Model not found")
    
    try:
        # Remove from local storage
        model_dir = Path(f"/app/model_cache/{model_id}")
        if model_dir.exists():
            shutil.rmtree(model_dir)
        
        # Remove from status database
        del model_status_db[model_id]
        
        return {"message": f"Model {model_id} deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting model: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/download/{model_id}")
async def download_model(model_id: str):
    """Download a model file"""
    if model_id not in model_status_db:
        raise HTTPException(status_code=404, detail="Model not found")
    
    model_dir = Path(f"/app/model_cache/{model_id}")
    if not model_dir.exists():
        raise HTTPException(status_code=404, detail="Model files not found")
    
    # Find the model file
    model_files = list(model_dir.glob("*.safetensors")) + \
                 list(model_dir.glob("*.bin")) + \
                 list(model_dir.glob("*.pt")) + \
                 list(model_dir.glob("*.pth"))
    
    if not model_files:
        raise HTTPException(status_code=404, detail="Model file not found")
    
    return FileResponse(
        path=str(model_files[0]),
        filename=model_files[0].name,
        media_type='application/octet-stream'
    )

if __name__ == "__main__":
    port = int(os.getenv("PORT", 8002))
    uvicorn.run(
        "owner_api:app",
        host="0.0.0.0",
        port=port,
        reload=False,
        log_level="info"
    )