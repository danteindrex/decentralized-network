import os
import time
import psutil
import torch
import subprocess
import requests
import json
import asyncio
from web3 import Web3
from threading import Thread
import ipfshttpclient
from vllm import LLM, SamplingParams
import ray

# Configuration and constants
CONFIG_PATH = os.path.join(os.path.dirname(__file__), 'config.yaml')

with open(CONFIG_PATH) as f:
    import yaml
    cfg = yaml.safe_load(f)

w3 = Web3(Web3.HTTPProvider(cfg['eth_node']))
contract = w3.eth.contract(address=cfg['contract_address'], abi=cfg['contract_abi'])

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

# IPFS client
def get_ipfs_client():
    try:
        return ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
    except Exception as e:
        print(f"Failed to connect to IPFS: {e}")
        return None

# Global vLLM model instance
vllm_model = None

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

def unload_model():
    """Unload the vLLM model to free memory"""
    global vllm_model
    if vllm_model:
        del vllm_model
        vllm_model = None
        torch.cuda.empty_cache() if torch.cuda.is_available() else None
        print("Model unloaded")

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

def fetch_from_ipfs(cid, output_path):
    """Fetch content from IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return False
            
        ipfs_client.get(cid, target=output_path)
        return True
    except Exception as e:
        print(f"Failed to fetch {cid} from IPFS: {e}")
        return False

def read_prompt_from_file(prompt_file):
    """Read prompt text from file"""
    try:
        with open(prompt_file, 'r', encoding='utf-8') as f:
            return f.read().strip()
    except Exception as e:
        print(f"Failed to read prompt file: {e}")
        return None

# Job handling
def handle_job(event):
    """Complete job handling workflow"""
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

        # Fetch model and prompt from IPFS
        print("Fetching model from IPFS...")
        if not fetch_from_ipfs(model_cid, './model'):
            print("Failed to fetch model from IPFS")
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
        
        # Load local model
        print("Loading local model...")
        if not load_local_model('./model'):
            print("Failed to load local model")
            return

        # Run local inference
        print(f"Running local inference for job {job_id}...")
        response_text = run_local_inference(prompt_text, job_id)
        if not response_text:
            print("Local inference failed")
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

# Listening loop
def listen():
    filter = contract.events.InferenceRequested.createFilter(fromBlock='latest')
    while True:
        for e in filter.get_new_entries():
            handle_job(e)
        time.sleep(2)

if __name__ == '__main__':
    resources = get_resources()
    if resources[0] > cfg['head_min_ram'] and resources[2] > cfg['head_min_vram']:
        w3.eth.defaultAccount = cfg['default_account']
        listen()
    else:
        listen()