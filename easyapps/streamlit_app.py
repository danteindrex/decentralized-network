"""
Tensor Parallelism Network - Streamlit MVP
Decentralized AI Network with Node Choice Capability
"""

import streamlit as st
import requests
import json
import time
import random
import hashlib
import os
from typing import Dict, List, Optional, Any
import pandas as pd
from datetime import datetime, timedelta
import plotly.express as px
import plotly.graph_objects as go
from web3 import Web3
import base64
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization

# Page configuration
st.set_page_config(
    page_title="AI Network Node - Decentralized Tensor Parallelism",
    page_icon="⚡",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Initialize session state
if 'wallet_address' not in st.session_state:
    st.session_state.wallet_address = None
if 'private_key' not in st.session_state:
    st.session_state.private_key = None
if 'chat_history' not in st.session_state:
    st.session_state.chat_history = []
if 'user_stats' not in st.session_state:
    st.session_state.user_stats = {
        'total_messages': 0,
        'total_inferences': 0,
        'storage_used': 0,
        'first_message': None
    }
if 'network_config' not in st.session_state:
    st.session_state.network_config = {
        'bootstrap_url': 'https://bootstrap-node.onrender.com',
        'ipfs_gateway': 'https://gateway.pinata.cloud/ipfs/',
        'network_id': 'tensor-parallelism-mainnet'
    }

# Custom CSS
st.markdown("""
<style>
    .main-header {
        background: linear-gradient(90deg, #667eea 0%, #764ba2 100%);
        padding: 1rem;
        border-radius: 10px;
        color: white;
        text-align: center;
        margin-bottom: 2rem;
    }
    .node-card {
        background: white;
        padding: 1rem;
        border-radius: 8px;
        border-left: 4px solid #667eea;
        margin: 0.5rem 0;
        box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .metric-card {
        background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
        padding: 1rem;
        border-radius: 8px;
        text-align: center;
        margin: 0.5rem 0;
    }
    .success-message {
        background: #d4edda;
        border: 1px solid #c3e6cb;
        color: #155724;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
    }
    .warning-message {
        background: #fff3cd;
        border: 1px solid #ffeaa7;
        color: #856404;
        padding: 1rem;
        border-radius: 8px;
        margin: 1rem 0;
    }
    .chat-message {
        padding: 1rem;
        margin: 0.5rem 0;
        border-radius: 10px;
        border-left: 4px solid #667eea;
    }
    .user-message {
        background: #e3f2fd;
        border-left-color: #2196f3;
    }
    .assistant-message {
        background: #f3e5f5;
        border-left-color: #9c27b0;
    }
    .wallet-card {
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        padding: 1rem;
        border-radius: 10px;
        margin: 1rem 0;
    }
    .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        margin: 1rem 0;
    }
</style>
""", unsafe_allow_html=True)

class WalletManager:
    @staticmethod
    def generate_wallet():
        """Generate a new Ethereum wallet"""
        # Generate private key
        private_key = os.urandom(32)
        private_key_hex = private_key.hex()
        
        # Create Web3 account
        account = Web3().eth.account.from_key(private_key_hex)
        
        return {
            'address': account.address,
            'private_key': private_key_hex
        }
    
    @staticmethod
    def sign_message(message: str, private_key: str) -> str:
        """Sign a message with private key"""
        try:
            account = Web3().eth.account.from_key(private_key)
            signed = account.sign_message(message.encode())
            return signed.signature.hex()
        except Exception as e:
            return f"Error signing: {str(e)}"

class IPFSManager:
    def __init__(self, gateway_url: str = "https://gateway.pinata.cloud/ipfs/"):
        self.gateway_url = gateway_url
    
    def store_message(self, message: Dict, user_address: str) -> str:
        """Simulate storing message to IPFS and return CID"""
        # In a real implementation, this would upload to IPFS
        # For now, generate a mock CID based on content
        content = json.dumps(message, sort_keys=True)
        hash_object = hashlib.sha256(content.encode())
        mock_cid = f"Qm{hash_object.hexdigest()[:44]}"
        return mock_cid
    
    def retrieve_message(self, cid: str) -> Optional[Dict]:
        """Simulate retrieving message from IPFS"""
        # Mock implementation - in reality would fetch from IPFS
        return None

class AIProviderManager:
    def __init__(self):
        self.providers = {
            'openai': {
                'name': 'OpenAI GPT',
                'models': ['gpt-3.5-turbo', 'gpt-4'],
                'endpoint': 'https://api.openai.com/v1/chat/completions'
            },
            'anthropic': {
                'name': 'Anthropic Claude',
                'models': ['claude-3-sonnet', 'claude-3-haiku'],
                'endpoint': 'https://api.anthropic.com/v1/messages'
            },
            'local': {
                'name': 'Local Tensor Network',
                'models': ['llama-7b', 'mistral-7b', 'gpt-j-6b'],
                'endpoint': 'https://bootstrap-node.onrender.com/inference'
            }
        }
    
    def get_available_providers(self) -> List[str]:
        return list(self.providers.keys())
    
    def get_models_for_provider(self, provider: str) -> List[str]:
        return self.providers.get(provider, {}).get('models', [])
    
    async def run_inference(self, prompt: str, provider: str, model: str, user_address: str) -> Dict:
        """Run AI inference using selected provider"""
        try:
            # Simulate API call with processing time
            processing_time = random.uniform(1.0, 5.0)
            
            # Generate realistic response based on provider
            if provider == 'local':
                response = f"[Tensor Parallelism Network Response]\n\nYour query: '{prompt[:100]}...' has been processed using the {model} model distributed across multiple nodes in our decentralized network.\n\nThis response demonstrates the capabilities of distributed AI inference where models are split across different compute nodes using tensor parallelism techniques. Each node processes different parts of the neural network (attention heads, MLP layers) simultaneously, then combines results for faster inference.\n\nProcessing details:\n- Model: {model}\n- Network: Tensor Parallelism\n- User: {user_address[:8]}...\n- Processing time: {processing_time:.2f}s\n\nCost: FREE (Decentralized Network)"
            else:
                response = f"[{self.providers[provider]['name']} Response]\n\nI understand you're asking about: '{prompt[:100]}...'\n\nThis is a simulated response from {self.providers[provider]['name']} using the {model} model. In a production environment, this would connect to the actual API and provide real AI responses.\n\nFor now, this demonstrates the multi-provider capability of the tensor parallelism network, where users can choose between different AI providers and models based on their needs.\n\nProvider: {provider}\nModel: {model}\nProcessing time: {processing_time:.2f}s"
            
            return {
                'success': True,
                'response': response,
                'processing_time': processing_time,
                'provider': provider,
                'model': model,
                'user_address': user_address,
                'timestamp': datetime.now().isoformat(),
                'cost': 'FREE' if provider == 'local' else 'API_COST'
            }
            
        except Exception as e:
            return {
                'success': False,
                'error': str(e),
                'provider': provider,
                'model': model
            }

class NetworkNode:
    def __init__(self, node_id: str, name: str, region: str, capabilities: Dict):
        self.node_id = node_id
        self.name = name
        self.region = region
        self.capabilities = capabilities
        self.status = "active"
        self.load = random.uniform(0.1, 0.9)
        self.last_ping = datetime.now()
        self.earnings = random.uniform(0.1, 10.0)  # ETH earned
    
    def to_dict(self):
        return {
            "id": self.node_id,
            "name": self.name,
            "region": self.region,
            "capabilities": self.capabilities,
            "status": self.status,
            "load": self.load,
            "earnings": self.earnings,
            "last_ping": self.last_ping.isoformat()
        }

class TensorParallelismNetwork:
    def __init__(self):
        self.nodes = self._initialize_nodes()
        self.selected_nodes = []
        self.inference_history = []
        self.wallet_manager = WalletManager()
        self.ipfs_manager = IPFSManager()
        self.ai_manager = AIProviderManager()
    
    def _initialize_nodes(self) -> List[NetworkNode]:
        """Initialize network nodes with different capabilities"""
        nodes = [
            NetworkNode("node_001", "Bootstrap Node (US-East)", "us-east-1", {
                "gpu_memory": "24GB",
                "compute_capability": "8.6",
                "tensor_parallel_size": 4,
                "model_types": ["llama-7b", "gpt-j-6b", "mistral-7b"],
                "max_batch_size": 32,
                "provider_types": ["local", "openai"]
            }),
            NetworkNode("node_002", "High-Performance Node (EU-West)", "eu-west-1", {
                "gpu_memory": "40GB", 
                "compute_capability": "8.9",
                "tensor_parallel_size": 8,
                "model_types": ["llama-13b", "gpt-4", "mistral-7b", "claude-3-sonnet"],
                "max_batch_size": 64,
                "provider_types": ["local", "openai", "anthropic"]
            }),
            NetworkNode("node_003", "Mobile Cluster (Asia-Pacific)", "ap-southeast-1", {
                "gpu_memory": "16GB",
                "compute_capability": "7.5",
                "tensor_parallel_size": 2,
                "model_types": ["gpt-3.5-turbo", "claude-3-haiku"],
                "max_batch_size": 16,
                "provider_types": ["openai", "anthropic"]
            }),
            NetworkNode("node_004", "Edge Computing Node (US-West)", "us-west-2", {
                "gpu_memory": "32GB",
                "compute_capability": "8.0",
                "tensor_parallel_size": 6,
                "model_types": ["llama-7b", "gpt-j-6b", "bloom-7b"],
                "max_batch_size": 48,
                "provider_types": ["local"]
            }),
            NetworkNode("node_005", "Research Node (EU-Central)", "eu-central-1", {
                "gpu_memory": "80GB",
                "compute_capability": "9.0",
                "tensor_parallel_size": 16,
                "model_types": ["llama-70b", "gpt-4", "mistral-8x7b", "claude-3-opus"],
                "max_batch_size": 128,
                "provider_types": ["local", "openai", "anthropic"]
            })
        ]
        
        # Simulate some nodes being offline occasionally
        for node in nodes:
            if random.random() < 0.1:  # 10% chance of being offline
                node.status = "offline"
            node.load = random.uniform(0.1, 0.95)
        
        return nodes
    
    def get_available_nodes(self) -> List[NetworkNode]:
        """Get nodes that are currently available"""
        return [node for node in self.nodes if node.status == "active"]
    
    def select_optimal_nodes(self, model_type: str, required_capability: str = "medium") -> List[NetworkNode]:
        """Select optimal nodes based on model requirements"""
        available = self.get_available_nodes()
        
        # Filter by model support
        compatible = [node for node in available if model_type in node.capabilities["model_types"]]
        
        # Sort by load and capability
        if required_capability == "high":
            compatible = [node for node in compatible if float(node.capabilities["gpu_memory"].replace("GB", "")) >= 32]
        elif required_capability == "medium":
            compatible = [node for node in compatible if float(node.capabilities["gpu_memory"].replace("GB", "")) >= 16]
        
        # Sort by load (prefer less loaded nodes)
        compatible.sort(key=lambda x: x.load)
        
        return compatible[:3]  # Return top 3 nodes
    
    async def run_inference(self, prompt: str, provider: str, model: str, selected_nodes: List[str], user_address: str) -> Dict:
        """Run AI inference using selected provider and nodes"""
        nodes = [node for node in self.nodes if node.node_id in selected_nodes]
        
        if not nodes:
            return {"error": "No valid nodes selected"}
        
        # Run inference through AI provider
        result = await self.ai_manager.run_inference(prompt, provider, model, user_address)
        
        if result['success']:
            # Add network-specific information
            result['nodes_used'] = [n.to_dict() for n in nodes]
            result['network_regions'] = list(set([n.region for n in nodes]))
            result['total_parallel_size'] = sum([n.capabilities['tensor_parallel_size'] for n in nodes])
            
            # Update node loads and earnings
            earning_per_node = 0.001  # Mock earning in ETH
            for node in nodes:
                node.load = min(0.95, node.load + 0.05)
                node.earnings += earning_per_node
            
            # Store message to IPFS
            message_data = {
                'prompt': prompt,
                'response': result['response'],
                'timestamp': result['timestamp'],
                'user_address': user_address,
                'provider': provider,
                'model': model
            }
            
            cid = self.ipfs_manager.store_message(message_data, user_address)
            result['ipfs_cid'] = cid
            
            self.inference_history.append(result)
        
        return result
    
    def generate_user_wallet(self):
        """Generate new wallet for user"""
        return self.wallet_manager.generate_wallet()
    
    def get_user_stats(self, user_address: str) -> Dict:
        """Get user statistics"""
        user_inferences = [inf for inf in self.inference_history 
                          if inf.get('user_address') == user_address]
        
        if not user_inferences:
            return {
                'total_messages': 0,
                'total_inferences': 0,
                'storage_used': 0,
                'first_message': None,
                'last_message': None,
                'total_cost': 0.0
            }
        
        return {
            'total_messages': len(user_inferences),
            'total_inferences': len(user_inferences),
            'storage_used': sum([len(str(inf)) for inf in user_inferences]),
            'first_message': min([inf['timestamp'] for inf in user_inferences]),
            'last_message': max([inf['timestamp'] for inf in user_inferences]),
            'total_cost': 0.0  # Free in our network
        }

# Initialize network
@st.cache_resource
def get_network():
    return TensorParallelismNetwork()

def setup_user_wallet():
    """Setup or load user wallet"""
    if not st.session_state.wallet_address:
        network = get_network()
        wallet = network.generate_user_wallet()
        st.session_state.wallet_address = wallet['address']
        st.session_state.private_key = wallet['private_key']
        st.success(f"🎉 New wallet created: {wallet['address'][:8]}...")
    return st.session_state.wallet_address, st.session_state.private_key

def main():
    network = get_network()
    
    # Main header
    st.markdown("""
    <div class="main-header">
        <h1>⚡ Tensor Parallelism Network</h1>
        <p>Decentralized AI Processing with Node Choice Capability</p>
    </div>
    """, unsafe_allow_html=True)
    
    # Sidebar for node selection and configuration
    with st.sidebar:
        st.header("🌐 Network Configuration")
        
        # Model selection
        model_type = st.selectbox(
            "Select AI Model",
            ["llama", "gpt", "mistral", "bert", "mobile-transformer", "t5", "bloom"],
            index=0,
            help="Choose the AI model type for inference"
        )
        
        # Performance requirement
        performance_req = st.selectbox(
            "Performance Requirement",
            ["low", "medium", "high"],
            index=1,
            help="Higher requirements will select more powerful nodes"
        )
        
        st.subheader("🖥️ Available Nodes")
        
        # Node selection
        available_nodes = network.get_available_nodes()
        optimal_nodes = network.select_optimal_nodes(model_type, performance_req)
        
        st.info(f"**Optimal Selection:** {len(optimal_nodes)} nodes recommended for {model_type}")
        
        selected_node_ids = []
        for node in available_nodes:
            is_optimal = node in optimal_nodes
            is_compatible = model_type in node.capabilities["model_types"]
            
            # Create node display
            status_emoji = "🟢" if node.status == "active" else "🔴"
            optimal_emoji = "⭐" if is_optimal else ""
            compatible_emoji = "✅" if is_compatible else "❌"
            
            col1, col2 = st.columns([3, 1])
            with col1:
                selected = st.checkbox(
                    f"{status_emoji} {optimal_emoji} {node.name}",
                    key=f"node_{node.node_id}",
                    value=is_optimal,
                    disabled=(node.status != "active" or not is_compatible)
                )
            with col2:
                st.write(f"{compatible_emoji}")
            
            if selected:
                selected_node_ids.append(node.node_id)
            
            # Show node details in expander
            with st.expander(f"📊 {node.name} Details"):
                st.write(f"**Region:** {node.region}")
                st.write(f"**GPU Memory:** {node.capabilities['gpu_memory']}")
                st.write(f"**Compute:** {node.capabilities['compute_capability']}")
                st.write(f"**Tensor Parallel Size:** {node.capabilities['tensor_parallel_size']}")
                st.write(f"**Current Load:** {node.load:.1%}")
                st.write(f"**Supported Models:** {', '.join(node.capabilities['model_types'])}")
        
        st.markdown("---")
        if st.button("🔄 Refresh Network Status"):
            st.cache_resource.clear()
            st.rerun()
    
    # Main content area
    col1, col2 = st.columns([2, 1])
    
    with col1:
        st.header("💬 AI Chat Interface")
        
        # Chat input
        prompt = st.text_area(
            "Enter your question or prompt:",
            height=100,
            placeholder="Ask me anything! Example: Explain how tensor parallelism works in distributed AI systems."
        )
        
        # Process button
        col_btn1, col_btn2, col_btn3 = st.columns([1, 1, 2])
        with col_btn1:
            process_btn = st.button("🚀 Process Query", type="primary")
        with col_btn2:
            if st.button("🎲 Random Example"):
                examples = [
                    "Explain the concept of tensor parallelism in machine learning",
                    "How does distributed computing improve AI inference speed?",
                    "What are the advantages of edge computing for AI applications?",
                    "Compare different neural network architectures",
                    "Explain the transformer model architecture"
                ]
                prompt = random.choice(examples)
                st.rerun()
        
        # Process the query
        if process_btn and prompt and selected_node_ids:
            with st.spinner("Processing via tensor parallelism network..."):
                result = network.run_inference(prompt, model_type, selected_node_ids)
                
                if "error" not in result:
                    st.markdown('<div class="success-message">', unsafe_allow_html=True)
                    st.markdown("### 🎉 Inference Complete!")
                    st.markdown(result["response"])
                    
                    # Technical metrics
                    col_metric1, col_metric2, col_metric3 = st.columns(3)
                    with col_metric1:
                        st.metric("Processing Time", f"{result['processing_time']:.2f}s")
                    with col_metric2:
                        st.metric("Nodes Used", len(result["nodes_used"]))
                    with col_metric3:
                        st.metric("Model Type", result["model_type"])
                    
                    st.markdown('</div>', unsafe_allow_html=True)
                else:
                    st.error(result["error"])
        
        elif process_btn and not selected_node_ids:
            st.warning("⚠️ Please select at least one node to process your query.")
        elif process_btn and not prompt:
            st.warning("⚠️ Please enter a prompt to process.")
    
    with col2:
        st.header("📊 Network Statistics")
        
        # Real-time metrics
        active_nodes = len([n for n in network.nodes if n.status == "active"])
        total_nodes = len(network.nodes)
        avg_load = sum([n.load for n in network.nodes if n.status == "active"]) / max(active_nodes, 1)
        
        st.metric("Active Nodes", f"{active_nodes}/{total_nodes}")
        st.metric("Average Load", f"{avg_load:.1%}")
        st.metric("Selected Nodes", len(selected_node_ids))
        
        # Network health chart
        if available_nodes:
            df_nodes = pd.DataFrame([{
                "Node": node.name.split("(")[0].strip(),
                "Load": node.load,
                "Region": node.region,
                "Status": node.status
            } for node in available_nodes])
            
            fig = px.bar(
                df_nodes, 
                x="Node", 
                y="Load", 
                color="Load",
                title="Node Load Distribution",
                color_continuous_scale="RdYlGn_r"
            )
            fig.update_layout(height=300)
            st.plotly_chart(fig, use_container_width=True)
        
        # Recent inference history
        st.subheader("📈 Recent Inferences")
        if network.inference_history:
            for i, inference in enumerate(reversed(network.inference_history[-5:])):
                with st.expander(f"Query {len(network.inference_history) - i}"):
                    st.write(f"**Time:** {inference['processing_time']:.2f}s")
                    st.write(f"**Nodes:** {len(inference['nodes_used'])}")
                    st.write(f"**Model:** {inference['model_type']}")
                    st.write(f"**Timestamp:** {inference['timestamp']}")
        else:
            st.info("No inferences yet. Submit a query to see history here.")
    
    # Network topology visualization
    st.header("🌐 Network Topology")
    
    col_topo1, col_topo2 = st.columns([3, 1])
    
    with col_topo1:
        if available_nodes:
            # Create network graph
            node_data = []
            for node in network.nodes:
                node_data.append({
                    "id": node.node_id,
                    "name": node.name,
                    "region": node.region,
                    "status": node.status,
                    "load": node.load,
                    "gpu_memory": int(node.capabilities["gpu_memory"].replace("GB", "")),
                    "selected": node.node_id in selected_node_ids
                })
            
            df_network = pd.DataFrame(node_data)
            
            # Create scatter plot for network visualization
            fig = px.scatter(
                df_network,
                x="region",
                y="gpu_memory",
                size="load",
                color="status",
                symbol="selected",
                hover_data=["name", "load"],
                title="Network Node Distribution",
                labels={"gpu_memory": "GPU Memory (GB)", "region": "Region"}
            )
            
            fig.update_traces(marker=dict(line=dict(width=2, color='DarkSlateGrey')))
            fig.update_layout(height=400)
            st.plotly_chart(fig, use_container_width=True)
    
    with col_topo2:
        st.subheader("🎯 Node Selection Guide")
        st.markdown("""
        **Optimal Selection Tips:**
        - ⭐ Stars indicate optimal nodes
        - ✅ Green checkmarks show compatibility
        - 🟢 Green dots mean active status
        - Lower load % is better
        - More GPU memory = better performance
        """)
        
        if selected_node_ids:
            total_memory = sum([int(node.capabilities["gpu_memory"].replace("GB", "")) 
                              for node in network.nodes if node.node_id in selected_node_ids])
            total_parallel = sum([node.capabilities["tensor_parallel_size"] 
                                for node in network.nodes if node.node_id in selected_node_ids])
            
            st.success(f"""
            **Your Selection:**
            - Total GPU Memory: {total_memory}GB
            - Parallel Processes: {total_parallel}
            - Estimated Speed: {total_parallel}x faster
            """)
    
    # Footer
    st.markdown("---")
    st.markdown("""
    <div style="text-align: center; color: #666; margin-top: 2rem;">
        <p>🚀 Tensor Parallelism Network MVP - Built for Streamlit Cloud</p>
        <p>Select nodes, process queries, and experience distributed AI inference!</p>
    </div>
    """, unsafe_allow_html=True)

if __name__ == "__main__":
    main()