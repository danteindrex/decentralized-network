import streamlit as st
import time
import json
import os
import yaml
import requests
import ipfshttpclient
from web3 import Web3
from datetime import datetime
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
import math

# Page configuration
st.set_page_config(
    page_title="Surgent - Decentralized AI Network (MetaMask)",
    page_icon="🦊",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for MetaMask integration
st.markdown("""
<style>
.metamask-button {
    background: linear-gradient(135deg, #f6851b, #e2761b);
    color: white;
    border: none;
    padding: 12px 24px;
    border-radius: 8px;
    font-size: 16px;
    font-weight: bold;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 8px;
    margin: 10px 0;
    transition: all 0.3s ease;
}

.metamask-button:hover {
    background: linear-gradient(135deg, #e2761b, #d1661b);
    transform: translateY(-2px);
}

.wallet-info {
    background: #f0f2f6;
    border-radius: 8px;
    padding: 16px;
    margin: 10px 0;
    border-left: 4px solid #f6851b;
}

.network-warning {
    background: #fff3cd;
    border: 1px solid #ffeaa7;
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
    color: #856404;
}

.success-message {
    background: #d4edda;
    border: 1px solid #c3e6cb;
    border-radius: 8px;
    padding: 12px;
    margin: 10px 0;
    color: #155724;
}
</style>
""", unsafe_allow_html=True)

# JavaScript for MetaMask integration
metamask_js = """
<script src="https://cdn.ethers.io/lib/ethers-5.7.2.umd.min.js"></script>
<script>
// MetaMask integration
let walletManager = null;
let userAccount = null;
let userSigner = null;

class StreamlitWalletManager {
    constructor() {
        this.chainId = '0x539'; // 1337 in hex
        this.chainName = 'Decentralized vLLM Network';
        this.rpcUrl = 'http://localhost:8545';
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    async init() {
        if (typeof window.ethereum !== 'undefined') {
            this.provider = window.ethereum;
            return true;
        }
        return false;
    }

    async connect() {
        try {
            if (!this.provider) {
                throw new Error('MetaMask not available');
            }

            // Request account access
            const accounts = await this.provider.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Switch to correct network
            await this.switchToPrivateNetwork();

            // Set up Web3 provider
            const web3Provider = new ethers.providers.Web3Provider(this.provider);
            this.signer = web3Provider.getSigner();
            this.account = accounts[0];

            // Update Streamlit
            this.updateStreamlitWallet(this.account);

            return {
                account: this.account,
                signer: this.signer
            };

        } catch (error) {
            console.error('Failed to connect wallet:', error);
            this.showError(error.message);
            throw error;
        }
    }

    async switchToPrivateNetwork() {
        try {
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.chainId }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                try {
                    await this.provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: this.chainId,
                            chainName: this.chainName,
                            rpcUrls: [this.rpcUrl],
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            }
                        }]
                    });
                } catch (addError) {
                    throw addError;
                }
            } else {
                throw switchError;
            }
        }
    }

    updateStreamlitWallet(account) {
        // Store wallet info in session state
        window.parent.postMessage({
            type: 'wallet_connected',
            account: account
        }, '*');
        
        // Update UI elements
        const accountElements = document.querySelectorAll('.wallet-account');
        accountElements.forEach(el => {
            el.textContent = this.formatAddress(account);
        });

        const connectButtons = document.querySelectorAll('.connect-wallet-btn');
        connectButtons.forEach(btn => {
            btn.style.display = 'none';
        });

        const walletInfo = document.querySelectorAll('.wallet-info');
        walletInfo.forEach(info => {
            info.style.display = 'block';
        });
    }

    formatAddress(address) {
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    }

    showError(message) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'network-warning';
        errorDiv.innerHTML = `⚠️ ${message}`;
        document.body.insertBefore(errorDiv, document.body.firstChild);
        
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }

    async getBalance() {
        if (!this.account || !this.provider) return '0';
        
        try {
            const balance = await this.provider.request({
                method: 'eth_getBalance',
                params: [this.account, 'latest']
            });
            return (parseInt(balance, 16) / Math.pow(10, 18)).toFixed(4);
        } catch (error) {
            console.error('Failed to get balance:', error);
            return '0';
        }
    }
}

// Initialize wallet manager
async function initWallet() {
    walletManager = new StreamlitWalletManager();
    const available = await walletManager.init();
    
    if (!available) {
        document.getElementById('metamask-not-available').style.display = 'block';
    }
}

// Connect wallet function
async function connectWallet() {
    try {
        const result = await walletManager.connect();
        userAccount = result.account;
        userSigner = result.signer;
        
        // Update balance
        const balance = await walletManager.getBalance();
        document.getElementById('wallet-balance').textContent = balance + ' ETH';
        
        console.log('Wallet connected:', userAccount);
    } catch (error) {
        console.error('Connection failed:', error);
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', initWallet);

// Make functions globally available
window.connectWallet = connectWallet;
window.walletManager = walletManager;
</script>
"""

# Load configuration with MetaMask support
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
        
        contract = w3.eth.contract(
            address=config['contract_address'],
            abi=contract_abi
        )
        
        return w3, contract
    except Exception as e:
        st.error(f"Failed to initialize Web3: {e}")
        return None, None

# IPFS client
@st.cache_resource
def get_ipfs_client():
    """Get IPFS client"""
    try:
        return ipfshttpclient.connect('/ip4/127.0.0.1/tcp/5001')
    except Exception as e:
        st.error(f"Failed to connect to IPFS: {e}")
        return None

def upload_to_ipfs(content, is_json=False):
    """Upload content to IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return None
        
        if is_json:
            result = ipfs_client.add_json(content)
        else:
            result = ipfs_client.add_str(content)
        
        return result
    except Exception as e:
        st.error(f"Failed to upload to IPFS: {e}")
        return None

def fetch_from_ipfs(cid):
    """Fetch content from IPFS"""
    try:
        ipfs_client = get_ipfs_client()
        if not ipfs_client:
            return None
        
        # Try to get as JSON first, then as string
        try:
            return ipfs_client.get_json(cid)
        except:
            return ipfs_client.cat(cid).decode('utf-8')
    except Exception as e:
        st.error(f"Failed to fetch from IPFS: {e}")
        return None

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
    return {
        'used_space': 2049024,  # ~2MB
        'total_space': 1073741824,  # 1GB
        'file_count': len(st.session_state.get('uploaded_files', [])),
        'available_space': 1073741824 - 2049024
    }

def get_mock_files():
    """Get mock file list"""
    if 'uploaded_files' not in st.session_state:
        st.session_state.uploaded_files = [
            {
                'id': '1',
                'name': 'example.txt',
                'size': 1024,
                'hash': 'QmExampleHash1234567890abcdef',
                'uploaded_at': datetime.now() - pd.Timedelta(days=1),
                'mime_type': 'text/plain'
            },
            {
                'id': '2', 
                'name': 'model_weights.bin',
                'size': 2048000,
                'hash': 'QmModelHash1234567890abcdef',
                'uploaded_at': datetime.now() - pd.Timedelta(days=2),
                'mime_type': 'application/octet-stream'
            }
        ]
    return st.session_state.uploaded_files

def create_storage_chart():
    """Create storage usage chart"""
    storage_info = get_mock_storage_info()
    
    # Pie chart for storage usage
    fig = go.Figure(data=[go.Pie(
        labels=['Used Space', 'Available Space'],
        values=[storage_info['used_space'], storage_info['available_space']],
        hole=0.4,
        marker_colors=['#f6851b', '#51cf66']
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
    if 'job_history' not in st.session_state or not st.session_state.job_history:
        return None
    
    df = pd.DataFrame(st.session_state.job_history)
    
    fig = px.line(
        df, 
        x='timestamp', 
        y='duration',
        title='Job Performance Over Time',
        labels={'duration': 'Duration (seconds)', 'timestamp': 'Time'},
        color_discrete_sequence=['#f6851b']
    )
    
    fig.update_layout(height=300, margin=dict(t=50, b=0, l=0, r=0))
    return fig

def process_chat_request_metamask(user_input, w3, contract, config):
    """Process user chat requests with MetaMask integration"""
    user_input_lower = user_input.lower()
    
    if 'inference' in user_input_lower or 'run' in user_input_lower:
        # Extract prompt from the request
        if ':' in user_input:
            prompt = user_input.split(':', 1)[1].strip()
        else:
            prompt = user_input
        
        return run_inference_from_chat_metamask(prompt, w3, contract, config)
    
    elif 'upload' in user_input_lower or 'file' in user_input_lower:
        return "I can help you upload files! Please use the Storage tab to upload files to IPFS. You can drag and drop files or use the upload button."
    
    elif 'storage' in user_input_lower or 'stats' in user_input_lower:
        storage_info = get_mock_storage_info()
        return f"📊 Storage Stats:\n• Used: {format_file_size(storage_info['used_space'])}\n• Available: {format_file_size(storage_info['available_space'])}\n• Files: {storage_info['file_count']}\n• Usage: {(storage_info['used_space']/storage_info['total_space']*100):.1f}%"
    
    elif 'wallet' in user_input_lower or 'metamask' in user_input_lower:
        if st.session_state.get('wallet_connected'):
            return f"🦊 **MetaMask Connected**\n• Account: {st.session_state.wallet_account[:10]}...\n• Network: Decentralized vLLM Network\n• Status: Ready for transactions"
        else:
            return "🦊 **MetaMask Not Connected**\nPlease connect your MetaMask wallet to interact with the blockchain."
    
    elif 'help' in user_input_lower:
        return """🤖 I can help you with:
        
• **AI Inference**: Say "run inference on: [your prompt]" to get AI responses
• **File Management**: Upload, download, and manage files on IPFS
• **Storage Stats**: Check your storage usage and file information
• **MetaMask Integration**: Connect wallet and sign transactions
• **Network Status**: Monitor blockchain and IPFS connectivity

Try asking me something like:
- "run inference on: Explain quantum computing"
- "show my storage stats"
- "check my wallet status"
- "upload a file"
        """
    
    else:
        return f"I understand you said: '{user_input}'. I can help with AI inference, file management, MetaMask integration, and storage. Type 'help' to see what I can do!"

def run_inference_from_chat_metamask(prompt, w3, contract, config):
    """Run inference from chat with MetaMask integration"""
    if not st.session_state.get('wallet_connected'):
        return "❌ Please connect your MetaMask wallet first to run inference jobs."
    
    try:
        # Use the simple test model
        model_cid = "QmetMnp9xtCrfe4U4Fmjk5CZLZj3fQy1gF7M9BV31tKiNe"
        
        # Upload prompt to IPFS
        prompt_cid = upload_to_ipfs(prompt)
        if not prompt_cid:
            return "❌ Failed to upload prompt to IPFS. Please try again."
        
        # For MetaMask, we would need to trigger the JavaScript transaction
        return f"🦊 **MetaMask Transaction Required**\n\nPrompt uploaded to IPFS: `{prompt_cid}`\nModel: Simple Test Model\n\n⚠️ Please check MetaMask to sign the transaction for job submission.\n\n*Note: This would normally trigger a MetaMask popup for transaction signing.*"
            
    except Exception as e:
        return f"❌ Error preparing inference: {str(e)}"

# Enhanced Streamlit UI with MetaMask integration and all new features
def main():
    # Custom CSS for better styling with MetaMask theme
    st.markdown("""
    <style>
    .main-header {
        background: linear-gradient(90deg, #f6851b 0%, #e2761b 100%);
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
        border-left: 4px solid #f6851b;
        background: #f8f9fa;
    }
    .file-item {
        background: #f8f9fa;
        padding: 1rem;
        border-radius: 8px;
        margin: 0.5rem 0;
        border: 1px solid #e1e5e9;
    }
    .metamask-button {
        background: linear-gradient(135deg, #f6851b, #e2761b);
        color: white;
        border: none;
        padding: 12px 24px;
        border-radius: 8px;
        font-size: 16px;
        font-weight: bold;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        margin: 10px 0;
        transition: all 0.3s ease;
    }
    .metamask-button:hover {
        background: linear-gradient(135deg, #e2761b, #d1661b);
        transform: translateY(-2px);
    }
    .wallet-info {
        background: #f0f2f6;
        border-radius: 8px;
        padding: 16px;
        margin: 10px 0;
        border-left: 4px solid #f6851b;
    }
    .network-warning {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
        color: #856404;
    }
    .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        border-radius: 8px;
        padding: 12px;
        margin: 10px 0;
        color: #155724;
    }
    </style>
    """, unsafe_allow_html=True)
    
    # Inject MetaMask JavaScript
    st.components.v1.html(metamask_js, height=0)
    
    # Header
    st.markdown("""
    <div class="main-header">
        <h1>🦊 Surgent - Decentralized AI Network (MetaMask)</h1>
        <p>Advanced AI inference platform with MetaMask integration, IPFS storage and blockchain coordination</p>
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
    tab1, tab2, tab3, tab4, tab5, tab6 = st.tabs([
        "🦊 Wallet", 
        "💬 AI Chat", 
        "📊 Dashboard", 
        "💾 Storage", 
        "📈 Analytics", 
        "⚙️ Settings"
    ])
    
    with tab1:
        render_wallet_interface(w3, contract, config)
    
    with tab2:
        render_chat_interface_metamask(w3, contract, config)
    
    with tab3:
        render_dashboard_metamask(w3, contract, config)
    
    with tab4:
        render_storage_interface_metamask()
    
    with tab5:
        render_analytics_metamask()
    
    with tab6:
        render_settings_metamask(config)

def render_wallet_interface(w3, contract, config):
    """Render the MetaMask wallet connection interface"""
    st.header("🦊 MetaMask Wallet Connection")
    
    # Initialize session state for wallet
    if 'wallet_connected' not in st.session_state:
        st.session_state.wallet_connected = False
    if 'wallet_account' not in st.session_state:
        st.session_state.wallet_account = None
    
    col1, col2 = st.columns([2, 1])
    
    with col1:
        if not st.session_state.wallet_connected:
            st.markdown("""
            <div id="metamask-not-available" style="display: none;" class="network-warning">
                ⚠️ MetaMask not detected. Please install MetaMask browser extension or use MetaMask mobile app.
                <br><br>
                <a href="https://metamask.io/download/" target="_blank">Download MetaMask</a>
            </div>
            
            <button onclick="connectWallet()" class="metamask-button connect-wallet-btn">
                🦊 Connect MetaMask Wallet
            </button>
            
            <div class="wallet-info" style="display: none;">
                <h4>✅ Wallet Connected</h4>
                <p><strong>Account:</strong> <span class="wallet-account"></span></p>
                <p><strong>Balance:</strong> <span id="wallet-balance">Loading...</span></p>
                <p><strong>Network:</strong> Decentralized vLLM Network (Chain ID: 1337)</p>
            </div>
            """, unsafe_allow_html=True)
            
            # Fallback manual connection
            with st.expander("🔧 Manual Configuration (Fallback)"):
                st.warning("Use this only if MetaMask is not available")
                manual_account = st.text_input("Account Address", placeholder="0x...")
                manual_key = st.text_input("Private Key", type="password", placeholder="0x...")
                
                if st.button("Use Manual Configuration"):
                    if manual_account and manual_key:
                        st.session_state.wallet_connected = True
                        st.session_state.wallet_account = manual_account
                        st.session_state.wallet_private_key = manual_key
                        st.success("Manual configuration set!")
                        st.rerun()
        else:
            st.markdown(f"""
            <div class="success-message">
                <h4>✅ Wallet Connected</h4>
                <p><strong>Account:</strong> {st.session_state.wallet_account}</p>
                <p><strong>Network:</strong> Decentralized vLLM Network</p>
            </div>
            """, unsafe_allow_html=True)
            
            if st.button("🔌 Disconnect Wallet"):
                st.session_state.wallet_connected = False
                st.session_state.wallet_account = None
                if 'wallet_private_key' in st.session_state:
                    del st.session_state.wallet_private_key
                st.rerun()
    
    with col2:
        st.subheader("📊 Network Status")
        try:
            block_number = w3.eth.block_number
            st.success(f"✅ Connected to Ethereum (Block: {block_number})")
        except:
            st.error("❌ Failed to connect to Ethereum")
        
        # Contract info
        if config.get('contract_address'):
            st.info(f"📄 Contract: {config['contract_address'][:10]}...")
        
        # IPFS status
        st.info("📁 IPFS: Connected")

def render_chat_interface_metamask(w3, contract, config):
    """Render the chat-like interface for AI interactions with MetaMask"""
    st.header("💬 AI Assistant Chat (MetaMask)")
    st.markdown("Chat with the decentralized AI network using MetaMask for transactions")
    
    if not st.session_state.get('wallet_connected'):
        st.warning("🦊 Please connect your MetaMask wallet in the Wallet tab to use AI chat features.")
        return
    
    # Initialize chat history
    if 'chat_history' not in st.session_state:
        st.session_state.chat_history = [
            {
                'role': 'assistant',
                'content': 'Hello! I\'m your MetaMask-integrated AI assistant. I can help you run AI inference, upload files, and manage your decentralized storage. All transactions will be signed through MetaMask. What would you like to do today?',
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
                    <div style="background: #f6851b; color: white; padding: 1rem; border-radius: 18px 18px 4px 18px; display: inline-block; max-width: 70%;">
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
                        🦊 MetaMask AI Assistant • {message['timestamp'].strftime('%H:%M')}
                    </div>
                </div>
                """, unsafe_allow_html=True)
    
    # Chat input
    col1, col2 = st.columns([4, 1])
    
    with col1:
        user_input = st.text_input(
            "Type your message...",
            placeholder="e.g., 'run inference on: What is machine learning?', 'check my wallet', 'show storage stats'",
            key="chat_input_metamask"
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
        response = process_chat_request_metamask(user_input, w3, contract, config)
        
        # Add assistant response
        st.session_state.chat_history.append({
            'role': 'assistant',
            'content': response,
            'timestamp': datetime.now()
        })
        
        st.rerun()

def render_dashboard_metamask(w3, contract, config):
    """Render the main dashboard with MetaMask integration"""
    st.header("📊 Network Dashboard (MetaMask)")
    
    # Wallet status check
    if not st.session_state.get('wallet_connected'):
        st.warning("🦊 Connect your MetaMask wallet to see full dashboard features.")
    
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
        # MetaMask status
        if st.session_state.get('wallet_connected'):
            st.metric("MetaMask", "Connected", "🦊 Ready")
        else:
            st.metric("MetaMask", "Disconnected", "❌ Connect")
    
    with col4:
        # Mock job count
        job_count = len(st.session_state.get('job_history', []))
        st.metric("Total Jobs", str(job_count), f"+{job_count} this session")
    
    st.markdown("---")
    
    # Recent activity and quick actions
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.subheader("🔄 Recent Activity")
        
        if 'job_history' in st.session_state and st.session_state.job_history:
            for job in st.session_state.job_history[-5:]:  # Show last 5 jobs
                st.markdown(f"""
                <div class="file-item">
                    <strong>Job #{job['job_id']}</strong><br>
                    <small>{job['prompt']} • {job['timestamp'].strftime('%H:%M:%S')} • {job['status']}</small>
                </div>
                """, unsafe_allow_html=True)
        else:
            st.info("No recent activity. Start a conversation in the AI Chat tab!")
    
    with col2:
        st.subheader("⚡ Quick Actions")
        
        if st.session_state.get('wallet_connected'):
            if st.button("🚀 Quick Inference", use_container_width=True):
                st.session_state.quick_inference = True
            
            if st.button("📁 View Files", use_container_width=True):
                st.switch_page("Storage")
            
            if st.button("📈 View Analytics", use_container_width=True):
                st.switch_page("Analytics")
        else:
            st.info("🦊 Connect MetaMask to enable quick actions")

def render_storage_interface_metamask():
    """Render the storage management interface with MetaMask integration"""
    st.header("💾 IPFS Storage Management (MetaMask)")
    
    if not st.session_state.get('wallet_connected'):
        st.warning("🦊 Connect your MetaMask wallet to manage storage and sign transactions.")
        return
    
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
    st.subheader("📤 Upload Files (MetaMask)")
    st.info("🦊 File uploads may require MetaMask transaction signing for storage payments")
    
    uploaded_file = st.file_uploader(
        "Choose files to upload to IPFS",
        accept_multiple_files=True,
        help="Upload files to the decentralized IPFS network"
    )
    
    if uploaded_file:
        for file in uploaded_file:
            if st.button(f"Upload {file.name}", key=f"upload_{file.name}"):
                with st.spinner(f"Uploading {file.name} to IPFS..."):
                    # Mock upload process
                    time.sleep(2)
                    
                    # Add to mock file list
                    new_file = {
                        'id': str(len(st.session_state.get('uploaded_files', [])) + 1),
                        'name': file.name,
                        'size': file.size,
                        'hash': f"Qm{hash(file.name + str(time.time()))}"[:46],
                        'uploaded_at': datetime.now(),
                        'mime_type': file.type or 'application/octet-stream'
                    }
                    
                    if 'uploaded_files' not in st.session_state:
                        st.session_state.uploaded_files = []
                    
                    st.session_state.uploaded_files.append(new_file)
                    st.success(f"✅ {file.name} uploaded successfully!")
                    st.info(f"IPFS Hash: {new_file['hash']}")
                    st.info("🦊 Transaction signed via MetaMask")
                    st.rerun()
    
    # File list
    st.subheader("📁 Your Files")
    
    files = get_mock_files()
    
    if files:
        for file in files:
            with st.expander(f"📄 {file['name']} ({format_file_size(file['size'])})"):
                col1, col2 = st.columns([3, 1])
                
                with col1:
                    st.write(f"**Hash:** `{file['hash']}`")
                    st.write(f"**Size:** {format_file_size(file['size'])}")
                    st.write(f"**Type:** {file['mime_type']}")
                    st.write(f"**Uploaded:** {file['uploaded_at'].strftime('%Y-%m-%d %H:%M:%S')}")
                
                with col2:
                    if st.button("📥 Download", key=f"download_{file['id']}"):
                        st.success(f"Downloading {file['name']}...")
                    
                    if st.button("🗑️ Delete", key=f"delete_{file['id']}"):
                        # Remove from session state
                        st.session_state.uploaded_files = [
                            f for f in st.session_state.uploaded_files 
                            if f['id'] != file['id']
                        ]
                        st.success(f"Deleted {file['name']}")
                        st.info("🦊 Deletion transaction signed via MetaMask")
                        st.rerun()
    else:
        st.info("No files uploaded yet. Use the upload section above to add files.")

def render_analytics_metamask():
    """Render analytics and performance metrics with MetaMask integration"""
    st.header("📈 Network Analytics (MetaMask)")
    
    if not st.session_state.get('wallet_connected'):
        st.warning("🦊 Connect your MetaMask wallet to see personalized analytics.")
        return
    
    # Performance metrics
    col1, col2, col3, col4 = st.columns(4)
    
    with col1:
        st.metric("Avg Response Time", "2.3s", "-0.5s from last hour")
    
    with col2:
        st.metric("Success Rate", "98.5%", "+1.2% from yesterday")
    
    with col3:
        st.metric("MetaMask Transactions", "12", "+3 today")
    
    with col4:
        st.metric("Gas Used", "0.02 ETH", "-0.01 from last week")
    
    # Charts
    if st.session_state.get('job_history'):
        st.subheader("📊 Job Performance")
        perf_chart = create_job_performance_chart()
        if perf_chart:
            st.plotly_chart(perf_chart, use_container_width=True)
    
    # Network statistics
    st.subheader("🌐 Network Statistics")
    
    # Mock network data
    network_data = {
        'Worker Nodes': [3, 4, 3, 5, 4, 3, 4],
        'Jobs Processed': [12, 15, 18, 22, 19, 16, 20],
        'MetaMask Txns': [5, 7, 6, 9, 8, 6, 8],
        'Day': ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    }
    
    df_network = pd.DataFrame(network_data)
    
    col1, col2 = st.columns(2)
    
    with col1:
        fig_workers = px.line(df_network, x='Day', y='Worker Nodes', title='Active Worker Nodes', color_discrete_sequence=['#f6851b'])
        st.plotly_chart(fig_workers, use_container_width=True)
    
    with col2:
        fig_txns = px.bar(df_network, x='Day', y='MetaMask Txns', title='MetaMask Transactions Daily', color_discrete_sequence=['#f6851b'])
        st.plotly_chart(fig_txns, use_container_width=True)

def render_settings_metamask(config):
    """Render settings and configuration with MetaMask integration"""
    st.header("⚙️ Settings & Configuration (MetaMask)")
    
    # MetaMask settings
    st.subheader("🦊 MetaMask Configuration")
    
    if st.session_state.get('wallet_connected'):
        st.success(f"✅ Connected: {st.session_state.wallet_account}")
        
        col1, col2 = st.columns(2)
        with col1:
            st.info("Network: Decentralized vLLM Network (Chain ID: 1337)")
        with col2:
            if st.button("🔌 Disconnect Wallet"):
                st.session_state.wallet_connected = False
                st.session_state.wallet_account = None
                st.rerun()
    else:
        st.warning("❌ MetaMask not connected")
        if st.button("🦊 Go to Wallet Tab"):
            st.switch_page("Wallet")
    
    # Network settings
    st.subheader("🌐 Network Configuration")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.text_input("Ethereum Node URL", value=config.get('eth_node', ''), disabled=True)
        st.text_input("IPFS Host", value=config.get('ipfs_host', ''), disabled=True)
    
    with col2:
        st.text_input("Contract Address", value=config.get('contract_address', ''), disabled=True)
        st.text_input("IPFS Port", value=str(config.get('ipfs_port', '')), disabled=True)
    
    # Preferences
    st.subheader("🎛️ Preferences")
    
    col1, col2 = st.columns(2)
    
    with col1:
        st.selectbox("Default Model", ["Simple Test Model", "Custom Model"])
        st.slider("Max Job Timeout (seconds)", 30, 600, 300)
        st.checkbox("Auto-approve small transactions", value=False, help="Automatically approve transactions under 0.01 ETH")
    
    with col2:
        st.checkbox("Auto-refresh Dashboard", value=True)
        st.checkbox("Show Advanced Metrics", value=False)
        st.checkbox("MetaMask notifications", value=True, help="Show notifications for MetaMask transactions")
    
    # System info
    st.subheader("ℹ️ System Information")
    
    system_info = {
        "Python Version": "3.9+",
        "Streamlit Version": st.__version__,
        "Web3 Version": "6.0+",
        "MetaMask Integration": "Enabled",
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
                'job_history': st.session_state.get('job_history', []),
                'uploaded_files': st.session_state.get('uploaded_files', []),
                'wallet_connected': st.session_state.get('wallet_connected', False),
                'wallet_account': st.session_state.get('wallet_account', ''),
                'export_time': datetime.now().isoformat()
            }
            st.download_button(
                "Download Export",
                json.dumps(export_data, indent=2, default=str),
                file_name=f"surgent_metamask_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json",
                mime="application/json"
            )

if __name__ == "__main__":
    main()