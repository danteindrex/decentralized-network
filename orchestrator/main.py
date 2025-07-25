import os
import time
import psutil
import torch
import subprocess
import requests
import json
import asyncio
import sys
from web3 import Web3
from threading import Thread
import ipfshttpclient
from vllm import LLM, SamplingParams
import ray
from model_cache import get_cached_model, cache_model, get_cache_stats

# Import structured logging
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'scripts'))
from structured_logger import (
    create_logger, with_circuit_breaker, with_retry,
    blockchain_logger, ipfs_logger, inference_logger
)

# Create logger for main orchestrator
logger = create_logger("orchestrator", 
                      level=os.getenv('LOG_LEVEL', 'INFO'),
                      log_file='orchestrator.log')

# Import MCP client
try:
    from mcp_client import MCPEnhancedInference
    MCP_AVAILABLE = True
    logger.info("MCP client loaded successfully")
except ImportError as e:
    logger.warning("MCP client not available", error=str(e))
    MCP_AVAILABLE = False
    MCPEnhancedInference = None

# Import blockchain model storage
try:
    from model_storage_integration import BlockchainModelStorage, setup_model_storage
    BLOCKCHAIN_STORAGE_AVAILABLE = True
    logger.info("Blockchain model storage loaded successfully")
except ImportError as e:
    logger.warning("Blockchain model storage not available", error=str(e))
    BLOCKCHAIN_STORAGE_AVAILABLE = False
    BlockchainModelStorage = None
    setup_model_storage = None

# Configuration and constants
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.yaml')

def load_config_with_fallbacks():
    """Load configuration with environment variable fallbacks"""
    import yaml
    
    try:
        # Load base config
        with open(CONFIG_PATH) as f:
            cfg = yaml.safe_load(f)
    except FileNotFoundError:
        logger.error("Configuration file not found", config_path=CONFIG_PATH)
        sys.exit(1)
    except yaml.YAMLError as e:
        logger.error("Invalid YAML configuration", error=e)
        sys.exit(1)
    
    # Environment variable fallbacks
    cfg['eth_node'] = os.getenv('ETH_NODE_URL', cfg.get('eth_node', 'http://localhost:8545'))
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
    
    # Validation
    required_fields = ['contract_address', 'default_account', 'private_key']
    for field in required_fields:
        if not cfg.get(field) or str(cfg[field]).startswith(('0xYour', 'REPLACE_WITH')):
            logger.error("Missing or invalid configuration field", field=field)
            logger.info("Consider running 'node scripts/setup_secure_keys.js setup'")
            sys.exit(1)
    
    return cfg

logger.info("Starting MCP-Enhanced Worker Node")
logger.info("Loading configuration")
cfg = load_config_with_fallbacks()
logger.info("Configuration loaded successfully")
logger.info("Connecting to Ethereum node", eth_node=cfg['eth_node'])

try:
    w3 = Web3(Web3.HTTPProvider(cfg['eth_node']))
    is_connected = w3.is_connected()
    blockchain_logger.blockchain_interaction("connect", is_connected, eth_node=cfg['eth_node'])
    
    if not is_connected:
        logger.error("Failed to connect to Ethereum node")
        sys.exit(1)
except Exception as e:
    logger.error("Ethereum connection failed", error=e)
    sys.exit(1)

try:
    logger.info("Loading smart contract", contract_address=cfg['contract_address'])
    contract = w3.eth.contract(address=cfg['contract_address'], abi=cfg['contract_abi'])
    logger.info("Smart contract loaded successfully")
except Exception as e:
    logger.error("Failed to load smart contract", error=e, contract_address=cfg['contract_address'])
    sys.exit(1)

MIN_RAM = cfg['min_free_ram']
MIN_VRAM = cfg['min_free_vram']

# Resource detection
def get_resources():
    ram = psutil.virtual_memory().available
    cpu = psutil.cpu_percent(interval=1)
    vram = torch.cuda.memory_reserved(0) if torch.cuda.is_available() else 0
    return ram, cpu, vram

# Ray cluster
RAY_PORT = cfg['ray_port']

def start_ray_head():
    subprocess.run(['ray', 'start', '--head', f'--port={RAY_PORT}'])

def join_ray(address):
    subprocess.run(['ray', 'start', '--address', f'{address}:{RAY_PORT}'])

# IPFS client with circuit breaker
@with_circuit_breaker(failure_threshold=3, recovery_timeout=30)
def get_ipfs_client():
    try:
        client = ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
        # Test connection
        client.version()
        return client
    except Exception as e:
        ipfs_logger.error("Failed to connect to IPFS", error=e)
        raise

# Global vLLM model instance, MCP client, and blockchain storage
vllm_model = None
mcp_inference_engine = None
blockchain_storage = None

# Initialize blockchain storage if available
if BLOCKCHAIN_STORAGE_AVAILABLE:
    try:
        blockchain_storage = setup_model_storage(cfg)
        print("✅ Blockchain model storage initialized")
    except Exception as e:
        print(f"❌ Failed to initialize blockchain storage: {e}")
        blockchain_storage = None

def load_local_model(model_path):
    """Load model directly using vLLM Python API with caching"""
    global vllm_model
    
    model_id = os.path.basename(model_path.rstrip('/'))
    
    try:
        # Check cache first
        cached_model = get_cached_model(model_id)
        if cached_model:
            logger.info("Using cached model", model_id=model_id, model_path=model_path)
            vllm_model = cached_model
            return True
        
        # Load new model
        start_time = time.time()
        logger.info("Loading model from path", model_path=model_path, model_id=model_id)
        
        # Configure vLLM for distributed inference
        vllm_model = LLM(
            model=model_path,
            tensor_parallel_size=torch.cuda.device_count() if torch.cuda.is_available() else 1,
            gpu_memory_utilization=cfg.get('gpu_memory_utilization', 0.8),
            max_model_len=cfg.get('max_model_len', 2048),
            enforce_eager=cfg.get('enforce_eager', False),
            trust_remote_code=cfg.get('trust_remote_code', True)
        )
        
        load_time = time.time() - start_time
        
        # Cache the model
        if cache_model(model_id, vllm_model, model_path):
            logger.model_loaded(model_path, load_time, cached=False, model_id=model_id)
        else:
            logger.warning("Failed to cache model", model_id=model_id, reason="memory_constraints")
        
        # Log cache statistics
        cache_stats = get_cache_stats()
        logger.info("Model cache status", **cache_stats)
        
        return True
        
    except Exception as e:
        logger.error("Failed to load model", error=e, model_path=model_path, model_id=model_id)
        return False

async def initialize_mcp_inference_engine():
    """Initialize MCP-enhanced inference engine"""
    global mcp_inference_engine
    try:
        # Get vLLM server URL from config
        vllm_base_url = cfg.get('vllm_base_url', 'http://localhost:8000/v1')
        model_name = cfg.get('model_name', 'default')
        
        mcp_inference_engine = MCPEnhancedInference(
            vllm_base_url=vllm_base_url,
            model_name=model_name
        )
        
        await mcp_inference_engine.initialize()
        print("MCP-enhanced inference engine initialized successfully")
        return True
        
    except Exception as e:
        print(f"Failed to initialize MCP inference engine: {e}")
        return False

def unload_model():
    """Unload the vLLM model to free memory"""
    global vllm_model, mcp_inference_engine
    if vllm_model:
        del vllm_model
        vllm_model = None
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        print("Model unloaded")
    
    # Close MCP connections
    if mcp_inference_engine:
        try:
            asyncio.run(mcp_inference_engine.close())
            mcp_inference_engine = None
            print("MCP inference engine closed")
        except Exception as e:
            print(f"Error closing MCP inference engine: {e}")

def run_local_inference(prompt_text, job_id):
    """Run inference directly with local vLLM model"""
    global vllm_model
    
    if not vllm_model:
        print("No model loaded for inference")
        return None
    
    try:
        # Configure sampling parameters
        sampling_params = SamplingParams(
            temperature=cfg.get('temperature', 0.7),
            top_p=cfg.get('top_p', 0.9),
            max_tokens=cfg.get('max_tokens', 512),
            stop=cfg.get('stop_tokens', None)
        )
        
        # Run inference
        print(f"Running local inference for job {job_id}...")
        outputs = vllm_model.generate([prompt_text], sampling_params)
        
        # Extract response
        if outputs and len(outputs) > 0:
            response_text = outputs[0].outputs[0].text
            print(f"Inference completed for job {job_id}")
            return response_text.strip()
        else:
            print("No output generated")
            return None
            
    except Exception as e:
        print(f"Local inference failed for job {job_id}: {e}")
        return None

async def run_mcp_enhanced_inference(prompt_text, job_id):
    """Run inference with MCP tool support"""
    global mcp_inference_engine
    
    if not mcp_inference_engine:
        print("MCP inference engine not initialized, falling back to local inference")
        return run_local_inference(prompt_text, job_id)
    
    try:
        print(f"Running MCP-enhanced inference for job {job_id}...")
        response_text = await mcp_inference_engine.run_inference_with_tools(
            prompt_text, 
            max_iterations=cfg.get('mcp_max_iterations', 5)
        )
        print(f"MCP-enhanced inference completed for job {job_id}")
        return response_text.strip() if response_text else None
        
    except Exception as e:
        print(f"MCP-enhanced inference failed for job {job_id}: {e}")
        print("Falling back to local inference...")
        return run_local_inference(prompt_text, job_id)

def validate_model_format(model_path):
    """Validate that the downloaded model is in correct format"""
    try:
        # Check if it's a directory with model files
        if os.path.isdir(model_path):
            required_files = ['config.json']
            model_files = os.listdir(model_path)
            
            # Check for essential files
            has_config = any('config.json' in f for f in model_files)
            has_weights = any(f.endswith(('.bin', '.safetensors', '.pt')) for f in model_files)
            
            if has_config and has_weights:
                print("Model format validation passed")
                return True
            else:
                print(f"Model validation failed. Found files: {model_files}")
                return False
        else:
            print(f"Model path {model_path} is not a directory")
            return False
            
    except Exception as e:
        print(f"Model validation error: {e}")
        return False

def upload_response_to_ipfs(response_text, job_id):
    """Upload inference response to IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return None
            
        # Create response object
        response_data = {
            "job_id": job_id,
            "response": response_text,
            "timestamp": int(time.time()),
            "node_address": w3.eth.defaultAccount
        }
        
        # Upload to IPFS
        result = ipfs_client.add_json(response_data)
        response_cid = result
        print(f"Response uploaded to IPFS: {response_cid}")
        return response_cid
        
    except Exception as e:
        print(f"Failed to upload response to IPFS: {e}")
        return None

def submit_response_to_contract(job_id, response_cid):
    """Submit response CID to smart contract"""
    try:
        # Build transaction
        tx = contract.functions.submitResponse(job_id, response_cid).build_transaction({
            'from': w3.eth.defaultAccount,
            'gas': 100000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(w3.eth.defaultAccount)
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, cfg['private_key'])
        tx_hash = w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        
        print(f"Response submitted to contract: {tx_hash.hex()}")
        return tx_hash
        
    except Exception as e:
        print(f"Failed to submit response to contract: {e}")
        return None

# Overload protection
def monitor_and_stop():
    while True:
        ram, cpu, vram = get_resources()
        if ram < MIN_RAM or cpu > cfg['max_cpu'] or vram > MIN_VRAM:
            subprocess.run(['ray', 'stop'])
            break
        time.sleep(5)

@with_retry(max_retries=3, base_delay=2.0)
def fetch_from_ipfs(cid, output_path):
    """Fetch content from IPFS with retry logic"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            raise Exception("IPFS client not available")
            
        ipfs_logger.info("Fetching content from IPFS", cid=cid, output_path=output_path)
        ipfs_client.get(cid, target=output_path)
        ipfs_logger.info("Successfully fetched from IPFS", cid=cid)
        return True
    except Exception as e:
        ipfs_logger.error("Failed to fetch from IPFS", cid=cid, error=e)
        raise

async def fetch_model_from_blockchain_storage(model_cid, output_path):
    """
    Fetch model using blockchain storage system (supports chunked models)
    Falls back to regular IPFS if blockchain storage is not available
    """
    global blockchain_storage
    
    if not blockchain_storage:
        print("Blockchain storage not available, falling back to regular IPFS")
        return fetch_from_ipfs(model_cid, output_path)
    
    try:
        print(f"Attempting to retrieve model via blockchain storage: {model_cid}")
        
        # First, try to find the model by CID in the blockchain registry
        models = blockchain_storage.list_models()
        target_model = None
        
        for model in models:
            if model['manifestCID'] == model_cid:
                target_model = model
                break
        
        if target_model:
            print(f"Found model in blockchain registry: {target_model['modelId']}")
            result = blockchain_storage.retrieve_model(target_model['modelId'], output_path)
            print(f"Model retrieved successfully via blockchain storage")
            return True
        else:
            print(f"Model CID {model_cid} not found in blockchain registry")
            print("Falling back to regular IPFS fetch")
            return fetch_from_ipfs(model_cid, output_path)
            
    except Exception as e:
        print(f"Error fetching model via blockchain storage: {e}")
        print("Falling back to regular IPFS fetch")
        return fetch_from_ipfs(model_cid, output_path)

def read_prompt_from_file(prompt_file):
    """Read prompt text from file"""
    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Failed to read prompt file: {e}")
        return None

# Job handling
async def handle_job_async(event):
    """Complete job handling workflow with MCP support"""
    args = event['args']
    job_id = args['jobId']
    prompt_cid = args['promptCID']
    model_cid = args['modelCID']
    controller = args['controller']
    
    print(f"Handling job {job_id}: prompt={prompt_cid}, model={model_cid}")
    
    try:
        # Controller bootstraps cluster
        if controller.lower() == w3.eth.defaultAccount.lower():
            print("Starting as Ray head node")
            start_ray_head()
        else:
            print(f"Joining Ray cluster at {controller}")
            join_ray(controller)

        # Fetch model using blockchain storage (with IPFS fallback)
        print("Fetching model from blockchain storage...")
        if not await fetch_model_from_blockchain_storage(model_cid, './model'):
            print("Failed to fetch model from blockchain storage")
            return
            
        print("Fetching prompt from IPFS...")
        if not fetch_from_ipfs(prompt_cid, './prompt.txt'):
            print("Failed to fetch prompt from IPFS")
            return

        # Read prompt text
        prompt_text = read_prompt_from_file('./prompt.txt')
        if not prompt_text:
            print("Failed to read prompt text")
            return

        # Validate model format
        if not validate_model_format('./model'):
            print("Invalid model format")
            return

        # Start resource monitoring
        Thread(target=monitor_and_stop, daemon=True).start()
        
        # Initialize MCP inference engine if enabled
        use_mcp = cfg.get('enable_mcp', True)
        if use_mcp:
            print("Initializing MCP-enhanced inference engine...")
            if await initialize_mcp_inference_engine():
                print("MCP inference engine ready")
            else:
                print("MCP initialization failed, falling back to local inference")
                use_mcp = False
        
        # Load local model (for fallback or direct use)
        print("Loading local model...")
        if not load_local_model('./model'):
            print("Failed to load local model")
            return

        # Run inference (MCP-enhanced or local)
        if use_mcp and mcp_inference_engine:
            print(f"Running MCP-enhanced inference for job {job_id}...")
            response_text = await run_mcp_enhanced_inference(prompt_text, job_id)
        else:
            print(f"Running local inference for job {job_id}...")
            response_text = run_local_inference(prompt_text, job_id)
            
        if not response_text:
            print("Inference failed")
            return

        # Upload response to IPFS
        print("Uploading response to IPFS...")
        response_cid = upload_response_to_ipfs(response_text, job_id)
        if not response_cid:
            print("Failed to upload response to IPFS")
            return

        # Submit response to contract
        print("Submitting response to contract...")
        tx_hash = submit_response_to_contract(job_id, response_cid)
        if tx_hash:
            print(f"Job {job_id} completed successfully!")
        else:
            print("Failed to submit response to contract")
            
    except Exception as e:
        print(f"Error handling job {job_id}: {e}")
    finally:
        # Cleanup
        unload_model()
        subprocess.run(['ray', 'stop'], capture_output=True)

def handle_job(event):
    """Synchronous wrapper for async job handling"""
    try:
        asyncio.run(handle_job_async(event))
    except Exception as e:
        print(f"Error in async job handling: {e}")

# Listening loop
def listen():
    logger.info("🎧 Setting up event listener for InferenceRequested events...")
    try:
        filter = contract.events.InferenceRequested.create_filter(from_block='latest')
        logger.info("✅ Event filter created successfully")
    except Exception as e:
        logger.error(f"❌ Failed to create event filter: {e}")
        return
    
    logger.info("👂 Starting to listen for inference requests...")
    logger.info(f"📡 Listening on contract: {cfg['contract_address']}")
    logger.info(f"👤 Worker account: {w3.eth.default_account}")
    
    iteration_count = 0
    while True:
        try:
            iteration_count += 1
            if iteration_count % 30 == 0:  # Log every minute (30 * 2 seconds)
                logger.info(f"💓 Worker node heartbeat - iteration {iteration_count}")
                logger.info(f"🔗 Web3 connected: {w3.is_connected()}")
                
                # Check current block number
                try:
                    current_block = w3.eth.block_number
                    logger.info(f"📦 Current block: {current_block}")
                except Exception as e:
                    logger.warning(f"⚠️ Could not get block number: {e}")
            
            # Check for new events
            new_entries = filter.get_new_entries()
            if new_entries:
                logger.info(f"🔔 Found {len(new_entries)} new inference request(s)!")
                for i, event in enumerate(new_entries):
                    logger.info(f"📋 Processing event {i+1}/{len(new_entries)}: {event}")
                    handle_job(event)
            
            time.sleep(2)
            
        except KeyboardInterrupt:
            logger.info("🛑 Received interrupt signal, shutting down...")
            break
        except Exception as e:
            logger.error(f"❌ Error in listening loop: {e}")
            logger.info("🔄 Continuing to listen...")
            time.sleep(5)  # Wait a bit longer on error

if __name__ == '__main__':
    resources = get_resources()
    if resources[0] > cfg['head_min_ram'] and resources[2] > cfg['head_min_vram']:
        w3.eth.default_account = cfg['default_account']
        logger.info(f"🎯 Set default account: {cfg['default_account']}")
        listen()
    else:
        w3.eth.default_account = cfg['default_account']
        logger.info(f"🎯 Set default account: {cfg['default_account']}")
        listen()