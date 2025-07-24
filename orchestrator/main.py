import os
import time
import psutil
import torch
import subprocess
import requests
import json
import asyncio
import sys
import logging
from web3 import Web3
from threading import Thread
# import ipfshttpclient  # Removed due to version compatibility
from vllm import LLM, SamplingParams
import ray

# Configure comprehensive logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('worker_node.log')
    ]
)
logger = logging.getLogger(__name__)

# Import MCP client
try:
    from mcp_client import MCPEnhancedInference
    MCP_AVAILABLE = True
    print("✅ MCP client loaded successfully")
except ImportError as e:
    print(f"❌ MCP client not available: {e}")
    MCP_AVAILABLE = False
    MCPEnhancedInference = None

# Import blockchain model storage
try:
    from model_storage_integration import BlockchainModelStorage, setup_model_storage
    BLOCKCHAIN_STORAGE_AVAILABLE = True
    print("✅ Blockchain model storage loaded successfully")
except ImportError as e:
    print(f"❌ Blockchain model storage not available: {e}")
    BLOCKCHAIN_STORAGE_AVAILABLE = False
    BlockchainModelStorage = None
    setup_model_storage = None

# Configuration and constants
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.yaml')

def load_config_with_fallbacks():
    """Load configuration with environment variable fallbacks"""
    import yaml
    
    # Load base config
    with open(CONFIG_PATH) as f:
        cfg = yaml.safe_load(f)
    
    # Environment variable fallbacks
    cfg['eth_node'] = os.getenv('ETH_NODE_URL', cfg.get('eth_node', 'http://localhost:8545'))
    cfg['contract_address'] = os.getenv('CONTRACT_ADDRESS', cfg.get('contract_address'))
    cfg['model_registry_address'] = os.getenv('MODEL_REGISTRY_ADDRESS', cfg.get('model_registry_address'))
    cfg['default_account'] = os.getenv('DEFAULT_ACCOUNT', cfg.get('default_account'))
    cfg['private_key'] = os.getenv('PRIVATE_KEY', cfg.get('private_key'))
    
    # Validation
    required_fields = ['contract_address', 'default_account', 'private_key']
    for field in required_fields:
        if not cfg.get(field) or str(cfg[field]).startswith(('0xYour', 'REPLACE_WITH')):
            print(f"❌ Missing or invalid {field}")
            print(f"💡 Set environment variable: export {field.upper()}=your_value")
            sys.exit(1)
    
    return cfg

logger.info("🚀 Starting MCP-Enhanced Worker Node...")
logger.info("📋 Loading configuration...")
cfg = load_config_with_fallbacks()
logger.info(f"✅ Configuration loaded successfully")
logger.info(f"🔗 Connecting to Ethereum node: {cfg['eth_node']}")

w3 = Web3(Web3.HTTPProvider(cfg['eth_node']))
logger.info(f"🌐 Web3 connection status: {w3.is_connected()}")

logger.info(f"📄 Loading contract at address: {cfg['contract_address']}")
contract = w3.eth.contract(address=cfg['contract_address'], abi=cfg['contract_abi'])
logger.info("✅ Smart contract loaded successfully")

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
    subprocess.run(['ray', 'start', '--head', f'--port={RAY_PORT}', '--host=127.0.0.1'])

def join_ray(address):
    subprocess.run(['ray', 'start', '--address', f'127.0.0.1:{RAY_PORT}'])

# IPFS HTTP client functions (compatible with IPFS 0.36.0)
def upload_to_ipfs_http(content, is_json=False):
    """Upload content to IPFS using HTTP API"""
    try:
        ipfs_host = cfg.get('ipfs_host', '127.0.0.1')
        ipfs_port = cfg.get('ipfs_port', 5001)
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/add"
        
        if is_json:
            content = json.dumps(content)
        
        files = {'file': ('content', content)}
        response = requests.post(ipfs_url, files=files, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result['Hash']
        else:
            print(f"IPFS upload failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Failed to upload to IPFS: {e}")
        return None

def fetch_from_ipfs_http(cid):
    """Fetch content from IPFS using HTTP API"""
    try:
        ipfs_host = cfg.get('ipfs_host', '127.0.0.1')
        ipfs_port = cfg.get('ipfs_port', 5001)
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/cat"
        
        params = {'arg': cid}
        response = requests.post(ipfs_url, params=params, timeout=30)
        
        if response.status_code == 200:
            return response.text
        else:
            print(f"IPFS fetch failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"Failed to fetch from IPFS: {e}")
        return None

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
            print(f"IPFS download failed: {response.status_code} - {response.text}")
            return False
            
    except Exception as e:
        print(f"Failed to download from IPFS: {e}")
        return False

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
    """Load model directly using vLLM Python API"""
    global vllm_model
    try:
        print(f"Loading model from {model_path}...")
        
        # Configure vLLM for distributed inference
        vllm_model = LLM(
            model=model_path,
            tensor_parallel_size=torch.cuda.device_count() if torch.cuda.is_available() else 1,
            gpu_memory_utilization=cfg.get('gpu_memory_utilization', 0.8),
            max_model_len=cfg.get('max_model_len', 2048),
            enforce_eager=cfg.get('enforce_eager', False),
            trust_remote_code=cfg.get('trust_remote_code', True)
        )
        
        print("Model loaded successfully")
        return True
        
    except Exception as e:
        print(f"Failed to load model: {e}")
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
        # Create response object
        response_data = {
            "job_id": job_id,
            "response": response_text,
            "timestamp": int(time.time()),
            "node_address": cfg.get('default_account', w3.eth.accounts[0] if w3.eth.accounts else None)
        }
        
        # Upload to IPFS using HTTP API
        response_cid = upload_to_ipfs_http(response_data, is_json=True)
        if response_cid:
            print(f"Response uploaded to IPFS: {response_cid}")
        return response_cid
        
    except Exception as e:
        print(f"Failed to upload response to IPFS: {e}")
        return None

def submit_response_to_contract(job_id, response_cid):
    """Submit response CID to smart contract"""
    try:
        # Build transaction
        default_account = cfg.get('default_account')
        tx = contract.functions.submitResponse(job_id, response_cid).build_transaction({
            'from': default_account,
            'gas': 100000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(default_account)
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, cfg['private_key'])
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
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

def fetch_from_ipfs(cid, output_path):
    """Fetch content from IPFS using HTTP API"""
    try:
        # For text content, fetch and save to file
        content = fetch_from_ipfs_http(cid)
        if content:
            os.makedirs(os.path.dirname(output_path), exist_ok=True)
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
    except Exception as e:
        print(f"Failed to fetch {cid} from IPFS: {e}")
        return False

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
        default_account = cfg.get('default_account')
        # Convert to string and format as hex address if it's a number
        if isinstance(default_account, int):
            default_account = f"0x{default_account:040x}"
        
        if controller.lower() == default_account.lower():
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
    logger.info(f"👤 Worker account: {cfg.get('default_account')}")
    
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
    logger.info(f"🎯 Using account: {cfg['default_account']}")
    if resources[0] > cfg['head_min_ram'] and resources[2] > cfg['head_min_vram']:
        listen()
    else:
        listen()