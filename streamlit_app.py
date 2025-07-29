import streamlit as st
import time
import json
import os
import yaml
import requests
from web3 import Web3
from datetime import datetime
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from pathlib import Path

# For FastAPI integration
from fastapi import FastAPI
import uvicorn
import threading

# --- FastAPI App for Network Configuration ---
network_api_app = FastAPI()

@network_api_app.get("/network-config")
async def get_network_config():
    config = load_config()
    if not config:
        return {"error": "Configuration not loaded"}
    
    # Exclude sensitive info like private key
    public_config = {
        "eth_node": config.get('eth_node'),
        "ipfs_host": config.get('ipfs_host'),
        "ipfs_port": config.get('ipfs_port'),
        "contract_address": config.get('contract_address'),
        "model_registry_address": config.get('model_registry_address'),
        "network_id": "decentralized-ai-network", # Example network ID
        "bootstrap_nodes": [] # This node itself can be a bootstrap node
    }
    return public_config

def run_fastapi():
    uvicorn.run(network_api_app, host="0.0.0.0", port=8001, log_level="warning")

# Start FastAPI in a separate thread
# This ensures Streamlit can run without being blocked by FastAPI
if not hasattr(st, 'fastapi_thread_started'):
    st.fastapi_thread_started = True
    threading.Thread(target=run_fastapi, daemon=True).start()

# --- Streamlit App Continues ---

# Page configuration
st.set_page_config(
    page_title="Surgent - Decentralized AI Network",
    page_icon="🧠",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Path for persistent storage of uploaded file metadata
UPLOADED_FILES_METADATA_PATH = Path(__file__).parent / "uploaded_files_metadata.json"
JOB_HISTORY_PATH = Path(__file__).parent / "job_history.json"

def load_uploaded_files_metadata():
    if UPLOADED_FILES_METADATA_PATH.exists():
        with open(UPLOADED_FILES_METADATA_PATH, 'r') as f:
            return json.load(f)
    return []

def save_uploaded_files_metadata(metadata):
    with open(UPLOADED_FILES_METADATA_PATH, 'w') as f:
        json.dump(metadata, f, indent=4)

def load_job_history():
    if JOB_HISTORY_PATH.exists():
        with open(JOB_HISTORY_PATH, 'r') as f:
            return json.load(f)
    return []

def save_job_history(history):
    with open(JOB_HISTORY_PATH, 'w') as f:
        json.dump(history, f, indent=4, default=str)

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
            'ipfs_port': 5001, # Default value
        }
        raw_ipfs_port = os.getenv('IPFS_PORT')
        st.write(f"Debug: Raw IPFS_PORT from env: {raw_ipfs_port}") # Debug print
        try:
            config['ipfs_port'] = int(raw_ipfs_port or '5001')
        except ValueError:
            st.warning(f"Invalid IPFS_PORT environment variable: {raw_ipfs_port}. Using default 5001.")

        
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
def upload_to_ipfs(file_content, file_name, is_json=False):
    """Upload content to IPFS using HTTP API"""
    try:
        ipfs_host = os.getenv('IPFS_HOST', '127.0.0.1')
        ipfs_port = os.getenv('IPFS_PORT', '5001')
        ipfs_url = f"http://{ipfs_host}:{ipfs_port}/api/v0/add"
        
        if is_json:
            content_to_upload = json.dumps(file_content)
        else:
            content_to_upload = file_content

        files = {'file': (file_name, content_to_upload)}
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

# Additional utility functions for enhanced features
def format_file_size(size_bytes):
    """Format file size in human readable format"""
    if size_bytes == 0:
        return "0 Bytes"
    size_names = ["Bytes", "KB", "MB", "GB", "TB"]
    i = int(math.floor(math.log(size_bytes, 1024)))
    p = math.pow(1024, i)
    s = round(size_bytes / p, 2)
    return f"{s} {size_names[i]}"

def get_mock_storage_info():
    """Get mock storage information"""
    uploaded_files = load_uploaded_files_metadata()
    total_size = sum(f['size'] for f in uploaded_files)
    return {
        'used_space': total_size,
        'total_space': 1073741824,  # 1GB (mock total space)
        'file_count': len(uploaded_files),
        'available_space': 1073741824 - total_size
    }

def get_mock_files():
    """Get actual file list from metadata"""
    return load_uploaded_files_metadata()

def create_storage_chart():
    """Create storage usage chart"""
    storage_info = get_mock_storage_info()
    
    # Pie chart for storage usage
    fig = go.Figure(data=[go.Pie(
        labels=['Used Space', 'Available Space'],
        values=[storage_info['used_space'], storage_info['available_space']],
        hole=0.4,
        marker_colors=['#ff6b6b', '#51cf66']
    )])
    
    fig.update_layout(
        title="Storage Usage",
        height=300,
        showlegend=True,
        margin=dict(t=50, b=0, l=0, r=0)
    )
    
    return fig

def create_job_performance_chart():
    """Create job performance chart"""
    # Load job history from persistent storage
    job_history = load_job_history()
    if not job_history:
        return None
    
    df = pd.DataFrame(job_history)
    
    fig = px.line(
        df, 
        x='timestamp', 
        y='duration',
        title='Job Performance Over Time',
        labels={'duration': 'Duration (seconds)', 'timestamp': 'Time'}
    )
    
    fig.update_layout(height=300, margin=dict(t=50, b=0, l=0, r=0))
    return fig

# Enhanced Streamlit UI with all new features
def main():
    # Custom CSS for better styling
    st.markdown("""
    <style>
    .main-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        padding: 2rem;
        border-radius: 10px;
        color: white;
        margin-bottom: 2rem;
    }
    .metric-card {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        border: 1px solid #e1e5e9;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .chat-message {
        padding: 1rem;
        margin: 0.5rem 0;
        border-radius: 8px;
        border-left: 4px solid #667eea;
        background: #f8f9fa;
    }
    .file-item {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        border: 1px solid #e1e5e9;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Header
    st.markdown("""
    <div class="main-header">
        <h1>🧠 Surgent - Decentralized AI Network</h1>
        <p>Advanced AI inference platform with IPFS storage and blockchain coordination</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Load configuration
    config = load_config()
    if not config:
        st.stop()
    
    # Initialize Web3
    w3, contract = init_web3(config)
    if not w3 or not contract:
        st.stop()
    
    # Navigation tabs
    tab1, tab2, tab3, tab4, tab5 = st.tabs([
        "🚀 AI Chat", 
        "📊 Dashboard", 
        "💾 Storage", 
        "📈 Analytics", 
        "⚙️ Settings"
    ])
    
    with tab1:
        render_chat_interface(w3, contract, config)
    
    with tab2:
        render_dashboard(w3, contract, config)
    
    with tab3:
        render_storage_interface()
    
    with tab4:
        render_analytics()
    
    with tab5:
        render_settings(config)

def render_chat_interface(w3, contract, config):
    """Render the chat-like interface for AI interactions"""
    st.header("💬 AI Assistant Chat")
    st.markdown("Chat with the decentralized AI network to process your requests")
    
    # Get uploaded models for selection
    uploaded_models = [f for f in load_uploaded_files_metadata() if f.get('type') == 'model']
    model_options = {model['name']: model['hash'] for model in uploaded_models}
    
    selected_model_name = st.selectbox(
        "Select Model for Inference:",
        options=list(model_options.keys()) or ["No models uploaded"],
        disabled=not bool(model_options)
    )
    
    selected_model_cid = model_options.get(selected_model_name)

    # Initialize chat history
    if 'chat_history' not in st.session_state:
        st.session_state.chat_history = [
            {
                'role': 'assistant',
                'content': 'Hello! I\'m your IPFS and AI assistant. I can help you upload files, run AI inference, and manage your decentralized storage. What would you like to do today?',
                'timestamp': datetime.now()
            }
        ]
    
    # Chat container
    chat_container = st.container()
    
    with chat_container:
        for message in st.session_state.chat_history:
            if message['role'] == 'user':
                st.markdown(f"""
                <div style="text-align: right; margin: 1rem 0;">
                    <div style="background: #667eea; color: white; padding: 1rem; border-radius: 18px 18px 4px 18px; display: inline-block; max-width: 70%;">
                        {message['content']}
                    </div>
                    <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
                        {message['timestamp'].strftime('%H:%M')}
                    </div>
                </div>
                """, unsafe_allow_html=True)
            else:
                st.markdown(f"""
                <div style="text-align: left; margin: 1rem 0;">
                    <div style="background: #f1f3f4; color: #333; padding: 1rem; border-radius: 18px 18px 18px 4px; display: inline-block; max-width: 70%;">
                        {message['content']}
                    </div>
                    <div style="font-size: 0.8rem; color: #666; margin-top: 0.25rem;">
                        AI Assistant • {message['timestamp'].strftime('%H:%M')}
                    </div>
                </div>
                """, unsafe_allow_html=True)
    
    # Chat input
    col1, col2 = st.columns([4, 1])
    
    with col1:
        user_input = st.text_input(
            "Type your message...",
            placeholder="e.g., 'run inference on: What is machine learning?', 'upload a file', 'show my storage stats'",
            key="chat_input"
        )
    
    with col2:
        send_button = st.button("Send", type="primary", use_container_width=True)
    
    if send_button and user_input:
        # Add user message
        st.session_state.chat_history.append({
            'role': 'user',
            'content': user_input,
            'timestamp': datetime.now()
        })
        
        # Process the request
        response = process_chat_request(user_input, w3, contract, config, selected_model_cid)
        
        # Add assistant response
        st.session_state.chat_history.append({
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.now()
        })
        
        st.rerun()

def process_chat_request(user_input, w3, contract, config, selected_model_cid):
    """Process user chat requests and return appropriate responses"""
    user_input_lower = user_input.lower()
    
    if 'inference' in user_input_lower or 'run' in user_input_lower:
        # Extract prompt from the request
        if ':' in user_input:
            prompt = user_input.split(':', 1)[1].strip()
        else:
            prompt = user_input
        
        return run_inference_from_chat(prompt, w3, contract, config, selected_model_cid)
    
    elif 'upload' in user_input_lower or 'file' in user_input_lower:
        return "I can help you upload files! Please use the Storage tab to upload files to IPFS. You can drag and drop files or use the upload button."
    
    elif 'storage' in user_input_lower or 'stats' in user_input_lower:
        storage_info = get_mock_storage_info()
        return f"📊 Storage Stats:\n• Used: {format_file_size(storage_info['used_space'])}\n• Available: {format_file_size(storage_info['available_space'])}\n• Files: {storage_info['file_count']}\n• Usage: {(storage_info['used_space']/storage_info['total_space']*100):.1f}%"
    
    elif 'help' in user_input_lower:
        return """🤖 I can help you with:
        
• **AI Inference**: Say "run inference on: [your prompt]" to get AI responses
• **File Management**: Upload, download, and manage files on IPFS
• **Storage Stats**: Check your storage usage and file information\n• **Network Status**: Monitor blockchain and IPFS connectivity

Try asking me something like:
- "run inference on: Explain quantum computing"
- "show my storage stats"
- "upload a file"
        """
    
    else:
        return f"I understand you said: '{user_input}'. I can help with AI inference, file management, and storage. Type 'help' to see what I can do!"

def run_inference_from_chat(prompt, w3, contract, config, model_cid):
    """Run inference from chat and return formatted response"""
    if not model_cid:
        return "❌ No model selected for inference. Please upload a model and select it."

    try:
        # Upload prompt to IPFS
        prompt_cid = upload_to_ipfs(prompt)
        if not prompt_cid:
            return "❌ Failed to upload prompt to IPFS. Please try again."
        
        # Submit job
        tx_hash, job_id = submit_inference_job(
            w3, contract, prompt_cid, model_cid,
            config['default_account'], config['private_key']
        )
        
        if not tx_hash or not job_id:
            return "❌ Failed to submit inference job. Please check your configuration."
        
        # Monitor completion (with shorter timeout for chat)
        response_cid, worker = monitor_job_completion(contract, job_id, timeout=60)
        
        if response_cid:
            response_data = fetch_from_ipfs(response_cid)
            if response_data:
                # Store in job history
                job_history = load_job_history()
                job_history.append({
                    'job_id': str(job_id),
                    'prompt': prompt[:50] + '...' if len(prompt) > 50 else prompt,
                    'status': 'Completed',
                    'timestamp': datetime.now().isoformat(),
                    'duration': 30,  # Mock duration, replace with actual if available
                    'worker': worker[:10] + '...' if worker else 'Unknown'
                })
                save_job_history(job_history)
                
                if isinstance(response_data, dict) and 'response' in response_data:
                    return f"🎉 **Inference Complete!**\n\n**Response:** {response_data['response']}\n\n*Job ID: {job_id}*"
                else:
                    return f"🎉 **Inference Complete!**\n\n*Job ID: {job_id}*"
            else:
                return f"✅ Inference completed but failed to fetch response. Job ID: {job_id}"
        else:
            return f"⏰ Inference job timed out. Job ID: {job_id}. Check the Dashboard for updates."
            
    except Exception as e:
        return f"❌ Error running inference: {str(e)}"

def render_dashboard(w3, contract, config):
    """Render the main dashboard"""
    st.header("📊 Network Dashboard")
    
    # Network status
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        try:
            block_number = w3.eth.block_number
            st.metric("Blockchain", f"Block {block_number}", "✅ Connected")
        except:
            st.metric("Blockchain", "Disconnected", "❌ Error")
    
    with col2:
        # Mock IPFS status
        st.metric("IPFS", "Connected", "✅ Online")
    
    with col3:
        # Mock worker count
        st.metric("Active Workers", "3", "+1 from yesterday")
    
    with col4:
        # Mock job count
        job_count = len(load_job_history())
        st.metric("Total Jobs", str(job_count), f"+{job_count} this session")
    
    st.markdown("---")
    
    # Recent activity and charts
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("🔄 Recent Activity")
        
        job_history = load_job_history()
        if job_history:
            for job in job_history[-5:]:  # Show last 5 jobs
                st.markdown(f"""
                <div class="file-item">
                    <strong>Job #{job['job_id']}</strong><br>
                    <small>{job['prompt']} • {datetime.fromisoformat(job['timestamp']).strftime('%H:%M:%S')} • {job['status']}</small>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("No recent activity. Start a conversation in the AI Chat tab!")
    
    with col2:
        st.subheader("⚡ Quick Actions")
        
        if st.button("🚀 Quick Inference", use_container_width=True):
            st.session_state.quick_inference = True
        
        if st.button("📁 View Files", use_container_width=True):
            st.switch_page("Storage")
        
        if st.button("📈 View Analytics", use_container_width=True):
            st.switch_page("Analytics")
    
    # Quick inference modal
    if st.session_state.get('quick_inference', False):
        with st.expander("🚀 Quick Inference", expanded=True):
            quick_prompt = st.text_input("Enter your prompt:", key="quick_prompt")
            col1, col2 = st.columns(2)
            
            with col1:
                if st.button("Submit", type="primary"):
                    if quick_prompt:
                        # Need to pass selected model CID here
                        st.warning("Model selection not yet implemented for Quick Inference.")
                        # response = run_inference_from_chat(quick_prompt, w3, contract, config, selected_model_cid)
                        # st.success("Job submitted! Check AI Chat for results.")
                        # st.session_state.quick_inference = False
                        # st.rerun()
            
            with col2:
                if st.button("Cancel"):
                    st.session_state.quick_inference = False
                    st.rerun()

def render_storage_interface():
    """Render the storage management interface"""
    st.header("💾 IPFS Storage Management")
    
    # Storage overview
    storage_info = get_mock_storage_info()
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        st.metric(
            "Used Space", 
            format_file_size(storage_info['used_space']),
            f"{(storage_info['used_space']/storage_info['total_space']*100):.1f}% of total"
        )
    
    with col2:
        st.metric(
            "Available Space",
            format_file_size(storage_info['available_space']),
            "Ready for uploads"
        )
    
    with col3:
        st.metric(
            "Files Stored",
            str(storage_info['file_count']),
            "Across IPFS network"
        )
    
    # Storage usage chart
    st.subheader("📊 Storage Usage")
    storage_chart = create_storage_chart()
    st.plotly_chart(storage_chart, use_container_width=True)
    
    # File upload section
    st.subheader("📤 Upload Files")
    
    uploaded_file = st.file_uploader(
        "Choose files to upload to IPFS",
        accept_multiple_files=True,
        help="Upload files to the decentralized IPFS network"
    )
    
    if uploaded_file:
        for file in uploaded_file:
            file_type = 'model' if file.name.endswith(('.bin', '.pt', '.onnx', '.h5')) else 'file'
            if st.button(f"Upload {file.name} as {file_type}", key=f"upload_{file.name}"):
                with st.spinner(f"Uploading {file.name} to IPFS..."):
                    # Read file content
                    file_content = file.read()
                    
                    # Upload to IPFS
                    cid = upload_to_ipfs(file_content, file.name)
                    
                    if cid:
                        # Add to uploaded files metadata
                        new_file_metadata = {
                            'id': str(time.time()), # Simple unique ID
                            'name': file.name,
                            'size': file.size,
                            'hash': cid,
                            'uploaded_at': datetime.now().isoformat(),
                            'mime_type': file.type or 'application/octet-stream',
                            'type': file_type # Store the type
                        }
                        uploaded_files_metadata = load_uploaded_files_metadata()
                        uploaded_files_metadata.append(new_file_metadata)
                        save_uploaded_files_metadata(uploaded_files_metadata)
                        
                        st.success(f"✅ {file.name} uploaded successfully!")
                        st.info(f"IPFS Hash: {cid}")
                        st.rerun()
                    else:
                        st.error(f"❌ Failed to upload {file.name} to IPFS.")
    
    # File list
    st.subheader("📁 Your Files")
    
    files = get_mock_files()
    
    if files:
        # Separate models and other files for display
        models = [f for f in files if f.get('type') == 'model']
        other_files = [f for f in files if f.get('type') != 'model']

        if models:
            st.write("#### Uploaded Models")
            for file in models:
                with st.expander(f"🧠 {file['name']} ({format_file_size(file['size'])})"):
                    col1, col2 = st.columns([3, 1])
                    
                    with col1:
                        st.write(f"**Hash:** `{file['hash']}`")
                        st.write(f"**Size:** {format_file_size(file['size'])}")
                        st.write(f"**Type:** {file['mime_type']}")
                        st.write(f"**Uploaded:** {datetime.fromisoformat(file['uploaded_at']).strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    with col2:
                        if st.button("📥 Download", key=f"download_{file['id']}"):
                            st.success(f"Downloading {file['name']}...")
                        
                        if st.button("🗑️ Delete", key=f"delete_{file['id']}"):
                            # Remove from metadata
                            uploaded_files_metadata = load_uploaded_files_metadata()
                            updated_metadata = [f for f in uploaded_files_metadata if f['id'] != file['id']]
                            save_uploaded_files_metadata(updated_metadata)
                            st.success(f"Deleted {file['name']}")
                            st.rerun()
        
        if other_files:
            st.write("#### Other Uploaded Files")
            for file in other_files:
                with st.expander(f"📄 {file['name']} ({format_file_size(file['size'])})"):
                    col1, col2 = st.columns([3, 1])
                    
                    with col1:
                        st.write(f"**Hash:** `{file['hash']}`")
                        st.write(f"**Size:** {format_file_size(file['size'])}")
                        st.write(f"**Type:** {file['mime_type']}")
                        st.write(f"**Uploaded:** {datetime.fromisoformat(file['uploaded_at']).strftime('%Y-%m-%d %H:%M:%S')}")
                    
                    with col2:
                        if st.button("📥 Download", key=f"download_{file['id']}"):
                            st.success(f"Downloading {file['name']}...")
                        
                        if st.button("🗑️ Delete", key=f"delete_{file['id']}"):
                            # Remove from metadata
                            uploaded_files_metadata = load_uploaded_files_metadata()
                            updated_metadata = [f for f in uploaded_files_metadata if f['id'] != file['id']]
                            save_uploaded_files_metadata(updated_metadata)
                            st.success(f"Deleted {file['name']}")
                            st.rerun()
    else:
        st.info("No files uploaded yet. Use the upload section above to add files.")

def render_analytics():
    """Render analytics and performance metrics"""
    st.header("📈 Network Analytics")
    
    # Performance metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Avg Response Time", "2.3s", "-0.5s from last hour")
    
    with col2:
        st.metric("Success Rate", "98.5%", "+1.2% from yesterday")
    
    with col3:
        st.metric("Network Load", "Medium", "Stable")
    
    with col4:
        st.metric("Cost per Job", "$0.02", "-$0.01 from last week")
    
    # Charts
    job_history = load_job_history()
    if job_history:
        st.subheader("📊 Job Performance")
        perf_chart = create_job_performance_chart()
        if perf_chart:
            st.plotly_chart(perf_chart, use_container_width=True)
    else:
        st.info("No job history available for analytics.")
    
    # Network statistics
    st.subheader("🌐 Network Statistics")
    
    # Mock network data - REMOVED
    st.info("Network statistics will be displayed here once real data is available.")

def render_settings(config):
    """Render settings and configuration"""
    st.header("⚙️ Settings & Configuration")
    
    # Network settings
    st.subheader("🌐 Network Configuration")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.text_input("Ethereum Node URL", value=config.get('eth_node', ''), disabled=True)
        st.text_input("IPFS Host", value=config.get('ipfs_host', ''), disabled=True)
    
    with col2:
        st.text_input("Contract Address", value=config.get('contract_address', ''), disabled=True)
        st.text_input("IPFS Port", value=str(config.get('ipfs_port', '')), disabled=True)
    
    # Account settings
    st.subheader("👤 Account Settings")
    
    account_display = config.get('default_account', '')
    if account_display:
        account_display = f"{account_display[:6]}...{account_display[-4:]}"
    
    st.text_input("Account Address", value=account_display, disabled=True)
    
    # Preferences
    st.subheader("🎛️ Preferences")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.selectbox("Default Model", ["Simple Test Model", "Custom Model"])
        st.slider("Max Job Timeout (seconds)", 30, 600, 300)
    
    with col2:
        st.checkbox("Auto-refresh Dashboard", value=True)
        st.checkbox("Show Advanced Metrics", value=False)
    
    # System info
    st.subheader("ℹ️ System Information")
    
    system_info = {
        "Python Version": "3.9+",
        "Streamlit Version": st.__version__,
        "Web3 Version": "6.0+",
        "Platform": "Linux"
    }
    
    for key, value in system_info.items():
        st.text(f"{key}: {value}")
    
    # Actions
    st.subheader("🔧 Actions")
    
    col1, col2, col3 = st.columns(3)
    
    with col1:
        if st.button("🔄 Refresh Configuration", use_container_width=True):
            st.cache_data.clear()
            st.success("Configuration refreshed!")
    
    with col2:
        if st.button("🧹 Clear Cache", use_container_width=True):
            st.cache_data.clear()
            st.cache_resource.clear()
            st.success("Cache cleared!")
    
    with col3:
        if st.button("📊 Export Data", use_container_width=True):
            # Mock export functionality
            export_data = {
                'job_history': load_job_history(), # Use actual job history
                'uploaded_files': load_uploaded_files_metadata(), # Use actual uploaded files
                'export_time': datetime.now().isoformat()
            }
            st.download_button(
                "Download Export",
                json.dumps(export_data, indent=2, default=str),
                file_name=f"surgent_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )

if __name__ == "__main__":
    import math
    main()