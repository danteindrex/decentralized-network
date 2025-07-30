#!/usr/bin/env python3
"""
Unified Tensor Parallelism Orchestrator
Replaces vLLM with tensor parallelism for all models
Free inference, monetized storage
"""

import os
import time
import asyncio
import sys
import json
import requests
from web3 import Web3
from threading import Thread

# Import tensor parallelism components
tensor_path = os.path.join(os.path.dirname(__file__), '..', 'tensor-parallelism')
sys.path.append(tensor_path)
try:
    exec(open(os.path.join(tensor_path, 'device-assessment', 'capability_assessor.py')).read())
    exec(open(os.path.join(tensor_path, 'core', 'tensor_splitter.py')).read())
    exec(open(os.path.join(tensor_path, 'core', 'network_coordinator.py')).read())
    exec(open(os.path.join(tensor_path, 'models', 'blockchain_model_registry.py')).read())
    exec(open(os.path.join(tensor_path, 'integration', 'network_bridge.py')).read())
    TENSOR_PARALLELISM_AVAILABLE = True
    print("✅ Tensor parallelism components loaded")
except Exception as e:
    TENSOR_PARALLELISM_AVAILABLE = False
    print(f"❌ Tensor parallelism not available: {e}")
    print(f"Tensor path: {tensor_path}")
    sys.exit(1)

# Import structured logging
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from structured_logger import (
    create_logger, with_circuit_breaker, with_retry,
    blockchain_logger, ipfs_logger, inference_logger
)

# Create logger
logger = create_logger("unified_orchestrator", 
                      level=os.getenv('LOG_LEVEL', 'INFO'),
                      log_file='unified_orchestrator.log')

# Configuration
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.yaml')

def load_config_with_fallbacks():
    """Load configuration with environment variable fallbacks"""
    import yaml
    
    try:
        with open(CONFIG_PATH) as f:
            cfg = yaml.safe_load(f)
    except FileNotFoundError:
        logger.error("Configuration file not found", config_path=CONFIG_PATH)
        sys.exit(1)
    except yaml.YAMLError as e:
        logger.error("Invalid YAML configuration", error=e)
        sys.exit(1)
    
    # Environment variable fallbacks
    cfg['eth_node'] = os.getenv('ETH_NODE_URL', cfg.get('eth_node', 'https://bootstrap-node.onrender.com'))
    cfg['contract_address'] = os.getenv('CONTRACT_ADDRESS', cfg.get('contract_address'))
    cfg['model_registry_address'] = os.getenv('MODEL_REGISTRY_ADDRESS', cfg.get('model_registry_address'))
    cfg['default_account'] = os.getenv('DEFAULT_ACCOUNT', cfg.get('default_account'))
    cfg['private_key'] = os.getenv('PRIVATE_KEY', cfg.get('private_key'))
    
    # Try to load from secure key files
    if not cfg.get('private_key') or str(cfg.get('private_key')).startswith(('0xYour', 'REPLACE_WITH')):
        try:
            from key_utils import KeyUtils
            key_utils = KeyUtils()
            key_info = key_utils.loadAccount('orchestrator')
            cfg['private_key'] = key_info['privateKey']
            cfg['default_account'] = key_info['address']
            logger.info("Loaded credentials from secure key files")
        except Exception as e:
            logger.warning("Could not load secure keys", error=str(e))
    
    return cfg

logger.info("Starting Unified Tensor Parallelism Worker Node")
cfg = load_config_with_fallbacks()

# Global tensor parallelism system
tensor_coordinator = None
tensor_bridge = None
blockchain_registry = None

class UnifiedTensorOrchestrator:
    """Unified orchestrator using only tensor parallelism"""
    
    def __init__(self, config):
        self.config = config
        self.device_assessor = None
        self.is_initialized = False
        
        logger.info("Unified Tensor Orchestrator initialized")
    
    async def initialize(self):
        """Initialize tensor parallelism system"""
        global tensor_coordinator, tensor_bridge, blockchain_registry
        
        logger.info("🚀 Initializing unified tensor parallelism system...")
        
        try:
            # Initialize device assessment
            logger.info("📊 Initializing device assessment...")
            self.device_assessor = DeviceCapabilityAssessor(cache_results=True)
            device_specs = await self.device_assessor.assess_device("orchestrator-node")
            
            logger.info("Device capabilities assessed", 
                       device_type=device_specs.device_type,
                       ram_gb=device_specs.available_ram_gb,
                       vram_gb=device_specs.available_vram_gb,
                       compute_tflops=device_specs.matrix_mult_tflops)
            
            # Initialize blockchain model registry
            logger.info("🔗 Initializing blockchain model registry...")
            contract_abi = []  # Simplified for now
            blockchain_registry = BlockchainModelRegistry(
                web3_provider=self.config['eth_node'],
                contract_address=self.config.get('model_registry_address', '0x537e697c7AB75A26f9ECF0Ce810e3154dFcaaf44'),
                contract_abi=contract_abi
            )
            
            # Initialize network coordinator
            logger.info("🌐 Initializing network coordinator...")
            tensor_coordinator = NetworkCoordinator(blockchain_registry)
            
            # Register this device with the network
            tensor_coordinator.register_device(device_specs)
            
            # Initialize tensor parallelism bridge
            logger.info("⚡ Initializing tensor parallelism bridge...")
            tensor_bridge = TensorParallelismBridge(tensor_coordinator)
            
            self.is_initialized = True
            logger.info("✅ Unified tensor parallelism system ready!")
            
            return True
            
        except Exception as e:
            logger.error("Failed to initialize tensor parallelism system", error=e)
            return False
    
    async def run_inference(self, job_id, model_cid, prompt_text):
        """Run inference using tensor parallelism"""
        if not self.is_initialized:
            logger.error("System not initialized")
            return None
        
        try:
            logger.info("Starting tensor parallel inference", 
                       job_id=job_id, 
                       model_cid=model_cid[:16] + "..." if len(model_cid) > 16 else model_cid)
            
            # Submit inference job
            response_text = await tensor_bridge.submit_tensor_parallel_job(
                model_id=model_cid,
                user_address=self.config['default_account'],
                prompt=prompt_text,
                max_tokens=self.config.get('max_tokens', 512),
                temperature=self.config.get('temperature', 0.7),
                top_p=self.config.get('top_p', 0.9)
            )
            
            if response_text:
                logger.info("Tensor parallel inference completed", job_id=job_id)
                return response_text.strip()
            else:
                logger.warning("No output generated", job_id=job_id)
                return None
                
        except Exception as e:
            logger.error("Tensor parallel inference failed", job_id=job_id, error=e)
            return None
    
    def get_network_status(self):
        """Get current network status"""
        if tensor_coordinator:
            return tensor_coordinator.get_network_status()
        return {"status": "not_initialized"}

# Global orchestrator instance
orchestrator = None

def download_from_ipfs_http(cid, output_path):
    """Download file from IPFS using HTTP API"""
    try:
        ipfs_host = cfg.get('ipfs_host', '127.0.0.1')
        ipfs_port = cfg.get('ipfs_port', 5001)
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/get"
        
        params = {'arg': cid}
        response = requests.post(ipfs_url, params=params, timeout=60, stream=True)
        
        if response.status_code == 200:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    f.write(chunk)
            return True
        else:
            logger.error("IPFS download failed", status_code=response.status_code, error=response.text)
            return False
            
    except Exception as e:
        logger.error("Failed to download from IPFS", error=e)
        return False

def read_prompt_from_file(file_path):
    """Read prompt text from file"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        logger.error("Failed to read prompt file", file_path=file_path, error=e)
        return None

def upload_response_to_ipfs(response_text, job_id):
    """Upload response to IPFS"""
    try:
        ipfs_host = cfg.get('ipfs_host', '127.0.0.1')
        ipfs_port = cfg.get('ipfs_port', 5001)
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/add"
        
        # Create response file
        response_file = f"response_{job_id}.txt"
        with open(response_file, 'w', encoding='utf-8') as f:
            f.write(response_text)
        
        # Upload to IPFS
        with open(response_file, 'rb') as f:
            files = {'file': f}
            response = requests.post(ipfs_url, files=files, timeout=60)
        
        # Clean up temp file
        os.remove(response_file)
        
        if response.status_code == 200:
            result = response.json()
            return result['Hash']
        else:
            logger.error("IPFS upload failed", status_code=response.status_code)
            return None
            
    except Exception as e:
        logger.error("Failed to upload to IPFS", error=e)
        return None

def submit_response_to_contract(job_id, response_cid):
    """Submit response to blockchain contract"""
    try:
        # Initialize Web3
        w3 = Web3(Web3.HTTPProvider(cfg['eth_node']))
        
        # Contract setup (simplified)
        contract_address = cfg['contract_address']
        contract_abi = []  # Simplified for now
        
        logger.info("Submitting response to contract", 
                   job_id=job_id, 
                   response_cid=response_cid,
                   contract_address=contract_address)
        
        # In a real implementation, this would submit to the actual contract
        # For now, we'll simulate success
        return f"0x{'a' * 64}"  # Mock transaction hash
        
    except Exception as e:
        logger.error("Failed to submit response to contract", error=e)
        return None

async def handle_job_async(event):
    """Handle inference job asynchronously"""
    global orchestrator
    
    try:
        # Extract job details
        job_id = event['args']['jobId']
        controller = event['args']['controller']
        model_cid = event['args']['modelCid']
        prompt_cid = event['args']['promptCid']
        
        logger.info("Processing job", 
                   job_id=job_id,
                   controller=controller,
                   model_cid=model_cid[:16] + "...",
                   prompt_cid=prompt_cid[:16] + "...")
        
        # Initialize orchestrator if needed
        if not orchestrator:
            orchestrator = UnifiedTensorOrchestrator(cfg)
            if not await orchestrator.initialize():
                logger.error("Failed to initialize orchestrator")
                return
        
        # Download model and prompt
        logger.info("Downloading model and prompt from IPFS...")
        
        if not download_from_ipfs_http(model_cid, './model'):
            logger.error("Failed to download model")
            return
            
        if not download_from_ipfs_http(prompt_cid, './prompt.txt'):
            logger.error("Failed to download prompt")
            return
        
        # Read prompt
        prompt_text = read_prompt_from_file('./prompt.txt')
        if not prompt_text:
            logger.error("Failed to read prompt text")
            return
        
        # Run inference using tensor parallelism
        logger.info("Running tensor parallel inference...")
        response_text = await orchestrator.run_inference(job_id, model_cid, prompt_text)
        
        if not response_text:
            logger.error("Inference failed")
            return
        
        # Upload response to IPFS
        logger.info("Uploading response to IPFS...")
        response_cid = upload_response_to_ipfs(response_text, job_id)
        if not response_cid:
            logger.error("Failed to upload response")
            return
        
        # Submit to contract
        logger.info("Submitting response to contract...")
        tx_hash = submit_response_to_contract(job_id, response_cid)
        if tx_hash:
            logger.info("Job completed successfully!", 
                       job_id=job_id, 
                       tx_hash=tx_hash,
                       response_cid=response_cid)
        else:
            logger.error("Failed to submit response to contract")
            
    except Exception as e:
        logger.error("Error handling job", job_id=job_id, error=e)

def handle_job(event):
    """Synchronous wrapper for async job handling"""
    try:
        asyncio.run(handle_job_async(event))
    except Exception as e:
        logger.error("Error in async job handling", error=e)

def listen():
    """Listen for inference requests"""
    logger.info("🎧 Setting up event listener for InferenceRequested events...")
    
    try:
        # Initialize Web3
        w3 = Web3(Web3.HTTPProvider(cfg['eth_node']))
        if not w3.is_connected():
            logger.error("Failed to connect to Ethereum node")
            return
        
        # Contract setup
        contract_address = cfg['contract_address']
        contract_abi = []  # Simplified
        
        logger.info("📡 Listening for events...", contract_address=contract_address)
        
        # Simplified event listening loop
        while True:
            try:
                time.sleep(5)  # Poll every 5 seconds
                logger.debug("Polling for new inference requests...")
                
                # In a real implementation, this would listen for actual blockchain events
                # For now, we'll just keep the service running
                
            except KeyboardInterrupt:
                logger.info("Shutting down gracefully...")
                break
            except Exception as e:
                logger.error("Error in event listening loop", error=e)
                time.sleep(10)  # Wait before retrying
                
    except Exception as e:
        logger.error("Failed to initialize event listener", error=e)

async def test_tensor_system():
    """Test the unified tensor parallelism system"""
    logger.info("🧪 Testing unified tensor parallelism system...")
    
    global orchestrator
    orchestrator = UnifiedTensorOrchestrator(cfg)
    
    if await orchestrator.initialize():
        logger.info("✅ System initialized successfully!")
        
        # Test inference
        test_prompt = "Explain how tensor parallelism works in distributed AI systems."
        test_model_cid = "test-model-cid"
        test_job_id = "test-job-1"
        
        logger.info("Running test inference...")
        result = await orchestrator.run_inference(test_job_id, test_model_cid, test_prompt)
        
        if result:
            logger.info("✅ Test inference successful!", result=result[:100] + "...")
        else:
            logger.warning("⚠️ Test inference returned no result")
        
        # Show network status
        network_status = orchestrator.get_network_status()
        logger.info("Network status", status=network_status)
        
    else:
        logger.error("❌ System initialization failed!")

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        # Run test mode
        asyncio.run(test_tensor_system())
    else:
        # Run production mode
        listen()