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

# Page configuration
st.set_page_config(
    page_title="Decentralized Inference Tester",
    page_icon="🧠",
    layout="wide"
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

# Streamlit UI
def main():
    st.title("🧠 Decentralized Inference Tester")
    st.markdown("Test the decentralized vLLM inference network with MetaMask integration")
    
    # Inject MetaMask JavaScript
    st.components.v1.html(metamask_js, height=0)
    
    # Load configuration
    config = load_config()
    if not config:
        st.stop()
    
    # Initialize Web3
    w3, contract = init_web3(config)
    if not w3 or not contract:
        st.stop()
    
    # Wallet Connection Section
    st.header("🦊 Wallet Connection")
    
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
    
    # Only show inference interface if wallet is connected
    if st.session_state.wallet_connected:
        st.header("🚀 Submit Inference Job")
        
        # Prompt input
        prompt = st.text_area(
            "Enter your prompt:",
            placeholder="What is the capital of France?",
            height=100
        )
        
        # Model CID input
        model_cid = st.text_input(
            "Model CID (IPFS hash):",
            placeholder="QmXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
            help="IPFS hash of the model to use for inference"
        )
        
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
                    
                    # For MetaMask integration, we would use JavaScript to sign the transaction
                    st.info("📝 Please confirm the transaction in MetaMask...")
                    
                    # JavaScript to submit transaction
                    submit_js = f"""
                    <script>
                    async function submitTransaction() {{
                        if (!walletManager || !walletManager.signer) {{
                            alert('Please connect your wallet first');
                            return;
                        }}
                        
                        try {{
                            const contract = new ethers.Contract(
                                '{config['contract_address']}',
                                [{{"inputs": [{{"name": "promptCID", "type": "string"}}, {{"name": "modelCID", "type": "string"}}], "name": "submitPromptWithCID", "outputs": [{{"name": "", "type": "uint256"}}], "stateMutability": "payable", "type": "function"}}],
                                walletManager.signer
                            );
                            
                            const tx = await contract.submitPromptWithCID('{prompt_cid}', '{model_cid}');
                            console.log('Transaction submitted:', tx.hash);
                            
                            const receipt = await tx.wait();
                            console.log('Transaction confirmed:', receipt);
                            
                            // Update Streamlit with success
                            window.parent.postMessage({{
                                type: 'transaction_success',
                                txHash: tx.hash,
                                jobId: receipt.events[0].args.jobId.toString()
                            }}, '*');
                            
                        }} catch (error) {{
                            console.error('Transaction failed:', error);
                            alert('Transaction failed: ' + error.message);
                        }}
                    }}
                    
                    // Auto-submit if wallet is connected
                    if (walletManager && walletManager.account) {{
                        submitTransaction();
                    }}
                    </script>
                    """
                    
                    st.components.v1.html(submit_js, height=0)
                    
                    # Show transaction status
                    st.info("⏳ Waiting for transaction confirmation...")
                    st.info("💡 Check your MetaMask for the transaction request")
    
    else:
        st.info("👆 Please connect your MetaMask wallet to submit inference jobs")
    
    # Job History
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
        "Built with ❤️ using Streamlit + MetaMask | "
        "[GitHub](https://github.com/your-repo) | "
        f"Current time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
    )

if __name__ == "__main__":
    main()