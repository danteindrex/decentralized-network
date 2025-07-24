import streamlit as st
import time
import json
import os
import yaml
import requests
from web3 import Web3
from datetime import datetime
import pandas as pd

# Page configuration
st.set_page_config(
    page_title="Decentralized Inference Tester",
    page_icon="🧠",
    layout="wide"
)

# Load configuration
@st.cache_data
def load_config():
    """Load configuration from environment variables and config files"""
    try:
        # Try to load from environment variables first
        config = {
            'eth_node': os.getenv('ETH_NODE_URL', 'http://localhost:8545'),
            'default_account': os.getenv('DEFAULT_ACCOUNT'),
            'private_key': os.getenv('PRIVATE_KEY'),
            'ipfs_host': os.getenv('IPFS_HOST', '127.0.0.1'),
            'ipfs_port': int(os.getenv('IPFS_PORT', '5001')),
        }
        
        # Try to load deployment info
        deployment_path = os.path.join(os.path.dirname(__file__), 'deployment.json')
        if os.path.exists(deployment_path):
            with open(deployment_path, 'r') as f:
                deployment = json.load(f)
                config['contract_address'] = deployment.get('inferenceCoordinator')
                config['model_registry_address'] = deployment.get('modelRegistry')
        
        # Try to load from config.yaml as fallback
        config_path = os.path.join(os.path.dirname(__file__), 'orchestrator', 'config.yaml')
        if os.path.exists(config_path):
            with open(config_path, 'r') as f:
                yaml_config = yaml.safe_load(f)
                # Update with yaml config, but don't override env vars
                for key, value in yaml_config.items():
                    if key not in config or config[key] is None:
                        config[key] = value
                
                # Convert numeric values to proper format
                if 'default_account' in config and isinstance(config['default_account'], int):
                    # Convert large integer to hex address
                    config['default_account'] = f"0x{config['default_account']:040x}"
                
                if 'private_key' in config and isinstance(config['private_key'], int):
                    # Convert large integer to hex private key
                    config['private_key'] = f"0x{config['private_key']:064x}"
        
        # Validate required fields
        required_fields = ['eth_node', 'default_account', 'private_key', 'contract_address']
        missing_fields = [field for field in required_fields if not config.get(field)]
        
        if missing_fields:
            st.error(f"Missing required configuration: {', '.join(missing_fields)}")
            st.info("Please set environment variables or create orchestrator/config.yaml")
            return None
        
        # Ensure addresses are in checksum format
        try:
            from web3 import Web3
            if config.get('default_account'):
                config['default_account'] = Web3.to_checksum_address(config['default_account'])
            if config.get('contract_address'):
                config['contract_address'] = Web3.to_checksum_address(config['contract_address'])
        except Exception as e:
            st.error(f"Invalid address format: {e}")
            return None
        
        return config
    except Exception as e:
        st.error(f"Failed to load config: {e}")
        return None

# Initialize Web3 connection
@st.cache_resource
def init_web3(config):
    """Initialize Web3 connection and contract"""
    try:
        w3 = Web3(Web3.HTTPProvider(config['eth_node']))
        
        # Load contract ABI (simplified for demo)
        contract_abi = [
            {
                "inputs": [{"name": "promptCID", "type": "string"}, {"name": "modelCID", "type": "string"}],
                "name": "submitPromptWithCID",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "jobId", "type": "uint256"},
                    {"indexed": True, "name": "controller", "type": "address"},
                    {"name": "promptCID", "type": "string"},
                    {"name": "modelId", "type": "string"},
                    {"name": "modelCID", "type": "string"}
                ],
                "name": "InferenceRequested",
                "type": "event"
            },
            {
                "anonymous": False,
                "inputs": [
                    {"indexed": True, "name": "jobId", "type": "uint256"},
                    {"indexed": True, "name": "worker", "type": "address"},
                    {"name": "responseCID", "type": "string"}
                ],
                "name": "InferenceCompleted",
                "type": "event"
            }
        ]
        
        # Ensure address is properly formatted
        contract_address = w3.to_checksum_address(config['contract_address'])
        contract = w3.eth.contract(
            address=contract_address,
            abi=contract_abi
        )
        
        return w3, contract
    except Exception as e:
        st.error(f"Failed to initialize Web3: {e}")
        return None, None

# IPFS HTTP client functions
def upload_to_ipfs(content, is_json=False):
    """Upload content to IPFS using HTTP API"""
    try:
        ipfs_host = os.getenv('IPFS_HOST', '127.0.0.1')
        ipfs_port = os.getenv('IPFS_PORT', '5001')
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/add"
        
        if is_json:
            content = json.dumps(content)
        
        files = {'file': ('content', content)}
        response = requests.post(ipfs_url, files=files, timeout=30)
        
        if response.status_code == 200:
            result = response.json()
            return result['Hash']
        else:
            st.error(f"IPFS upload failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        st.error(f"Failed to upload to IPFS: {e}")
        return None

def fetch_from_ipfs(cid):
    """Fetch content from IPFS using HTTP API"""
    try:
        ipfs_host = os.getenv('IPFS_HOST', '127.0.0.1')
        ipfs_port = os.getenv('IPFS_PORT', '5001')
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/cat"
        
        params = {'arg': cid}
        response = requests.post(ipfs_url, params=params, timeout=30)
        
        if response.status_code == 200:
            content = response.text
            # Try to parse as JSON first
            try:
                return json.loads(content)
            except:
                return content
        else:
            st.error(f"IPFS fetch failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        st.error(f"Failed to fetch from IPFS: {e}")
        return None

def submit_inference_job(w3, contract, prompt_cid, model_cid, account, private_key):
    """Submit inference job to the contract"""
    try:
        # Build transaction
        tx = contract.functions.submitPromptWithCID(prompt_cid, model_cid).build_transaction({
            'from': account,
            'gas': 200000,
            'gasPrice': w3.to_wei('20', 'gwei'),
            'nonce': w3.eth.get_transaction_count(account),
            'value': 0
        })
        
        # Sign and send transaction
        signed_tx = w3.eth.account.sign_transaction(tx, private_key)
        tx_hash = w3.eth.send_raw_transaction(signed_tx.raw_transaction)
        
        # Wait for transaction receipt
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        
        # Extract job ID from logs
        job_id = None
        for log in receipt.logs:
            try:
                decoded = contract.events.InferenceRequested().processLog(log)
                job_id = decoded['args']['jobId']
                break
            except:
                continue
        
        return tx_hash.hex(), job_id
    except Exception as e:
        st.error(f"Failed to submit job: {e}")
        return None, None

def monitor_job_completion(contract, job_id, timeout=300):
    """Monitor job completion"""
    start_time = time.time()
    
    # Create filter for InferenceCompleted events
    event_filter = contract.events.InferenceCompleted.createFilter(
        fromBlock='latest',
        argument_filters={'jobId': job_id}
    )
    
    while time.time() - start_time < timeout:
        try:
            for event in event_filter.get_new_entries():
                if event['args']['jobId'] == job_id:
                    return event['args']['responseCID'], event['args']['worker']
            time.sleep(2)
        except Exception as e:
            st.error(f"Error monitoring job: {e}")
            break
    
    return None, None

# Streamlit UI
def main():
    st.title("🧠 Decentralized Inference Tester")
    st.markdown("Test the decentralized vLLM inference network with custom prompts")
    
    # Load configuration
    config = load_config()
    if not config:
        st.stop()
    
    # Initialize Web3
    w3, contract = init_web3(config)
    if not w3 or not contract:
        st.stop()
    
    # Sidebar for configuration
    st.sidebar.header("Configuration")
    st.sidebar.json({
        "Contract Address": config.get('contract_address', 'Not set'),
        "Ethereum Node": config.get('eth_node', 'Not set'),
        "Account": config.get('default_account', 'Not set')
    })
    
    # Check connection status
    try:
        block_number = w3.eth.block_number
        st.sidebar.success(f"✅ Connected to Ethereum (Block: {block_number})")
    except:
        st.sidebar.error("❌ Failed to connect to Ethereum")
        st.stop()
    
    # Main interface
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("Submit Inference Job")
        
        # Prompt input
        prompt = st.text_area(
            "Enter your prompt:",
            placeholder="What is the capital of France?",
            height=100
        )
        
        # Model selection
        st.subheader("Select AI Model")
        
        # Predefined models (you can expand this list)
        available_models = {
            "Simple Test Model": "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe",
            "Custom Model": "custom"
        }
        
        st.info("✅ Test model available! The 'Simple Test Model' is a working test model for demonstration.")
        
        model_choice = st.selectbox(
            "Choose a model:",
            options=list(available_models.keys()),
            help="Select from available AI models"
        )
        
        if model_choice == "Custom Model":
            model_cid = st.text_input(
                "Enter custom Model CID (IPFS hash):",
                placeholder="QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
                help="IPFS hash of your custom model"
            )
        else:
            model_cid = available_models[model_choice]
            st.info(f"Using model: {model_choice}")
            st.code(f"Model CID: {model_cid}", language="text")
        
        # Submit button
        if st.button("🚀 Submit Inference Job", type="primary"):
            if not prompt.strip():
                st.error("Please enter a prompt")
            elif not model_cid.strip():
                st.error("Please enter a model CID")
            else:
                with st.spinner("Submitting job..."):
                    # Record start time
                    start_time = time.time()
                    
                    # Upload prompt to IPFS
                    st.info("📤 Uploading prompt to IPFS...")
                    prompt_cid = upload_to_ipfs(prompt)
                    
                    if not prompt_cid:
                        st.error("Failed to upload prompt to IPFS")
                        st.stop()
                    
                    st.success(f"✅ Prompt uploaded: {prompt_cid}")
                    
                    # Submit to contract
                    st.info("📝 Submitting to smart contract...")
                    tx_hash, job_id = submit_inference_job(
                        w3, contract, prompt_cid, model_cid,
                        config['default_account'], config['private_key']
                    )
                    
                    if not tx_hash or not job_id:
                        st.error("Failed to submit job to contract")
                        st.stop()
                    
                    st.success(f"✅ Job submitted! Job ID: {job_id}")
                    st.info(f"Transaction: {tx_hash}")
                    
                    # Monitor for completion
                    st.info("⏳ Waiting for inference completion...")
                    progress_bar = st.progress(0)
                    status_text = st.empty()
                    
                    response_cid, worker = monitor_job_completion(contract, job_id)
                    
                    if response_cid:
                        # Calculate total time
                        total_time = time.time() - start_time
                        
                        st.success(f"🎉 Inference completed in {total_time:.2f} seconds!")
                        st.info(f"Worker: {worker}")
                        st.info(f"Response CID: {response_cid}")
                        
                        # Fetch and display response
                        st.info("📥 Fetching response from IPFS...")
                        response_data = fetch_from_ipfs(response_cid)
                        
                        if response_data:
                            st.header("📋 Inference Result")
                            
                            # Display timing information
                            col_time1, col_time2, col_time3 = st.columns(3)
                            with col_time1:
                                st.metric("Total Time", f"{total_time:.2f}s")
                            with col_time2:
                                st.metric("Job ID", job_id)
                            with col_time3:
                                st.metric("Status", "✅ Completed")
                            
                            # Display response
                            if isinstance(response_data, dict):
                                st.json(response_data)
                                if 'response' in response_data:
                                    st.text_area("Response Text:", response_data['response'], height=200)
                            else:
                                st.text_area("Response:", response_data, height=200)
                        else:
                            st.error("Failed to fetch response from IPFS")
                    else:
                        st.error("⏰ Job timed out or failed")
    
    with col2:
        st.header("📊 Job History")
        
        # Initialize session state for job history
        if 'job_history' not in st.session_state:
            st.session_state.job_history = []
        
        # Display recent jobs
        if st.session_state.job_history:
            df = pd.DataFrame(st.session_state.job_history)
            st.dataframe(df, use_container_width=True)
        else:
            st.info("No jobs submitted yet")
        
        # Clear history button
        if st.button("🗑️ Clear History"):
            st.session_state.job_history = []
            st.rerun()
    
    # Footer
    st.markdown("---")
    st.markdown(
        "Built with ❤️ using Streamlit | "
        "[GitHub](https://github.com/your-repo) | "
        f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

if __name__ == "__main__":
    main()