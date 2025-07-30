#!/usr/bin/env python3
"""
Network Bridge Integration
Connects tensor parallelism system with existing decentralized network infrastructure
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional
from pathlib import Path
import sys
import os

# Add project root to path
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))

# Import existing network services
try:
    from easyapps.src.shared_core.network_service import initWeb3, submitInferenceJob, monitorJobCompletion
    from easyapps.src.shared_core.ai_service import runInference
    from services.networkDiscovery import NetworkDiscovery
except ImportError as e:
    print(f"⚠️ Could not import existing services: {e}")
    print("   Creating mock services for standalone operation")

# Import tensor parallelism components
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))
exec(open(os.path.join(os.path.dirname(__file__), '..', 'core', 'network_coordinator.py')).read())

class TensorParallelismBridge:
    """Bridges tensor parallelism with existing network infrastructure"""
    
    def __init__(self, network_coordinator: NetworkCoordinator):
        self.network_coordinator = network_coordinator
        self.blockchain_registry = network_coordinator.blockchain_registry
        
        # Integration with existing services
        self.web3_instance = None
        self.network_discovery = None
        self.contract_addresses = {}
        
        # Load existing configuration
        self._load_existing_config()
        
        print(f"🌉 Tensor Parallelism Bridge initialized")
    
    def _load_existing_config(self):
        """Load configuration from existing network"""
        try:
            # Load deployment configuration
            deployment_file = project_root / "deployment.json"
            if deployment_file.exists():
                with open(deployment_file, 'r') as f:
                    deployment_config = json.load(f)
                    self.contract_addresses = deployment_config
                    print(f"📋 Loaded contract addresses: {list(self.contract_addresses.keys())}")
            
            # Initialize Web3 connection
            try:
                web3_result = initWeb3()
                if web3_result and 'w3' in web3_result:
                    self.web3_instance = web3_result['w3']
                    print(f"🔗 Connected to blockchain network")
            except Exception as e:
                print(f"⚠️ Web3 initialization failed: {e}")
        
        except Exception as e:
            print(f"⚠️ Configuration loading failed: {e}")
    
    async def start_integration(self):
        """Start integration with existing network"""
        print(f"🚀 Starting network integration...")
        
        # Start integration tasks
        await asyncio.gather(
            self._integrate_with_network_discovery(),
            self._monitor_existing_inference_jobs(),
            self._bridge_device_registrations(),
            self._sync_model_registry()
        )
    
    async def _integrate_with_network_discovery(self):
        """Integrate with existing network discovery system"""
        try:
            # Initialize network discovery if available
            if 'NetworkDiscovery' in globals():
                config = {
                    'nodeType': 'tensor-coordinator',
                    'ethNodeUrl': 'http://localhost:8545',
                    'endpoint': 'localhost:8888',
                    'version': '1.0.0'
                }
                
                self.network_discovery = NetworkDiscovery(config)
                await self.network_discovery.start()
                
                # Listen for peer discovery events
                self.network_discovery.on('peerDiscovered', self._on_peer_discovered)
                self.network_discovery.on('peerRemoved', self._on_peer_removed)
                
                print(f"🌐 Integrated with network discovery")
        
        except Exception as e:
            print(f"⚠️ Network discovery integration failed: {e}")
    
    async def _on_peer_discovered(self, peer_info: Dict):
        """Handle new peer discovered by network discovery"""
        try:
            print(f"🤝 New peer discovered: {peer_info.get('type', 'unknown')} at {peer_info.get('endpoint', 'unknown')}")
            
            # If peer is a worker node, attempt to register it for tensor parallelism
            if peer_info.get('type') == 'worker':
                await self._attempt_device_registration(peer_info)
        
        except Exception as e:
            print(f"❌ Error handling peer discovery: {e}")
    
    async def _on_peer_removed(self, peer_info: Dict):
        """Handle peer removal"""
        try:
            peer_id = peer_info.get('id', peer_info.get('endpoint', 'unknown'))
            print(f"👋 Peer removed: {peer_id}")
            
            # Remove from tensor parallelism if registered
            if peer_id in self.network_coordinator.registered_devices:
                await self.network_coordinator._handle_device_disconnection(peer_id)
        
        except Exception as e:
            print(f"❌ Error handling peer removal: {e}")
    
    async def _attempt_device_registration(self, peer_info: Dict):
        """Attempt to register a discovered peer as a tensor parallelism device"""
        try:
            endpoint = peer_info.get('endpoint', '')
            if not endpoint:
                return
            
            # Query peer for tensor parallelism capabilities
            capabilities = await self._query_peer_capabilities(endpoint)
            
            if capabilities:
                # Create device specs from capabilities
                device_specs = self._create_device_specs_from_capabilities(peer_info, capabilities)
                
                if device_specs:
                    # Register with network coordinator
                    await self.network_coordinator._update_model_splitters_with_device(device_specs)
                    print(f"✅ Registered peer {peer_info.get('id', endpoint)} for tensor parallelism")
        
        except Exception as e:
            print(f"❌ Device registration attempt failed: {e}")
    
    async def _query_peer_capabilities(self, endpoint: str) -> Optional[Dict]:
        """Query peer for tensor parallelism capabilities"""
        try:
            # In a real implementation, this would make an HTTP/WebSocket request
            # For now, create mock capabilities based on endpoint
            
            # Mock different device types based on endpoint patterns
            if 'mobile' in endpoint or '192.168' in endpoint:
                return {
                    'device_type': 'mobile',
                    'total_ram_gb': 8,
                    'available_ram_gb': 6,
                    'cpu_cores': 8,
                    'supports_tensor_parallelism': True
                }
            elif 'cloud' in endpoint or 'amazonaws' in endpoint:
                return {
                    'device_type': 'cloud',
                    'total_ram_gb': 64,
                    'available_ram_gb': 48,
                    'total_vram_gb': 24,
                    'available_vram_gb': 20,
                    'cpu_cores': 16,
                    'supports_tensor_parallelism': True
                }
            else:
                return {
                    'device_type': 'desktop',
                    'total_ram_gb': 32,
                    'available_ram_gb': 24,
                    'total_vram_gb': 12,
                    'available_vram_gb': 10,
                    'cpu_cores': 12,
                    'supports_tensor_parallelism': True
                }
        
        except Exception as e:
            print(f"❌ Capability query failed: {e}")
            return None
    
    def _create_device_specs_from_capabilities(self, peer_info: Dict, capabilities: Dict) -> Optional[DeviceSpecs]:
        """Create DeviceSpecs from peer capabilities"""
        try:
            device_id = peer_info.get('id', peer_info.get('endpoint', f"device_{int(time.time())}"))
            
            return DeviceSpecs(
                device_id=device_id,
                device_type=capabilities.get('device_type', 'desktop'),
                total_ram_gb=capabilities.get('total_ram_gb', 16),
                available_ram_gb=capabilities.get('available_ram_gb', 12),
                total_vram_gb=capabilities.get('total_vram_gb', 0),
                available_vram_gb=capabilities.get('available_vram_gb', 0),
                total_storage_gb=capabilities.get('total_storage_gb', 500),
                available_storage_gb=capabilities.get('available_storage_gb', 400),
                storage_type=capabilities.get('storage_type', 'ssd'),
                cpu_cores=capabilities.get('cpu_cores', 8),
                cpu_frequency_ghz=capabilities.get('cpu_frequency_ghz', 2.5),
                cpu_name=capabilities.get('cpu_name', 'Unknown CPU'),
                gpu_name=capabilities.get('gpu_name'),
                gpu_compute_capability=capabilities.get('gpu_compute_capability'),
                network_bandwidth_mbps=capabilities.get('network_bandwidth_mbps', 100),
                network_latency_ms=capabilities.get('network_latency_ms', 50),
                tensor_ops_per_sec=capabilities.get('tensor_ops_per_sec', 1000),
                memory_bandwidth_gbps=capabilities.get('memory_bandwidth_gbps', 20),
                matrix_mult_tflops=capabilities.get('matrix_mult_tflops', 1.0)
            )
        
        except Exception as e:
            print(f"❌ Error creating device specs: {e}")
            return None
    
    async def _monitor_existing_inference_jobs(self):
        """Monitor and integrate with existing inference job system"""
        print(f"👁️ Monitoring existing inference jobs...")
        
        while True:
            try:
                # Check for inference jobs that could benefit from tensor parallelism
                # This is a placeholder - real implementation would monitor blockchain events
                await asyncio.sleep(30)
                
            except Exception as e:
                print(f"❌ Job monitoring error: {e}")
                await asyncio.sleep(60)
    
    async def _bridge_device_registrations(self):
        """Bridge device registrations between systems"""
        print(f"🌉 Bridging device registrations...")
        
        while True:
            try:
                # Sync devices between old system and tensor parallelism system
                if self.network_discovery:
                    # Get peers from network discovery
                    discovered_peers = self.network_discovery.getPeers()
                    
                    # Check if any new peers should be registered for tensor parallelism
                    for peer in discovered_peers:
                        peer_id = peer.get('id', peer.get('endpoint'))
                        
                        if (peer_id not in self.network_coordinator.registered_devices and
                            peer.get('type') == 'worker'):
                            await self._attempt_device_registration(peer)
                
                await asyncio.sleep(60)  # Check every minute
                
            except Exception as e:
                print(f"❌ Device bridge error: {e}")
                await asyncio.sleep(120)
    
    async def _sync_model_registry(self):
        """Sync model registry with existing blockchain contracts"""
        print(f"🔄 Syncing model registry...")
        
        while True:
            try:
                if self.web3_instance and 'modelRegistry' in self.contract_addresses:
                    # Check for new models on blockchain
                    # This would query the ModelRegistry contract for new models
                    
                    # For now, create a mock sync
                    await asyncio.sleep(120)  # Check every 2 minutes
                else:
                    await asyncio.sleep(300)  # Wait 5 minutes if not connected
                
            except Exception as e:
                print(f"❌ Model registry sync error: {e}")
                await asyncio.sleep(300)
    
    # Public API for integration
    
    async def submit_tensor_parallel_job(self, model_id: str, user_address: str, prompt: str, 
                                       **kwargs) -> str:
        """Submit job that uses tensor parallelism"""
        try:
            # Check if model supports tensor parallelism
            splitter = self.blockchain_registry.get_model_splitter(model_id)
            
            if splitter and len(self.network_coordinator.registered_devices) > 1:
                # Use tensor parallelism
                job_id = await self.network_coordinator.submit_inference_job(
                    model_id=model_id,
                    user_address=user_address,
                    prompt=prompt,
                    max_tokens=kwargs.get('max_tokens', 100),
                    temperature=kwargs.get('temperature', 0.7)
                )
                
                print(f"🚀 Submitted tensor parallel job: {job_id}")
                return job_id
            else:
                # Fall back to traditional inference
                return await self._submit_traditional_job(model_id, user_address, prompt, **kwargs)
        
        except Exception as e:
            print(f"❌ Job submission error: {e}")
            # Fall back to traditional inference
            return await self._submit_traditional_job(model_id, user_address, prompt, **kwargs)
    
    async def _submit_traditional_job(self, model_id: str, user_address: str, prompt: str, **kwargs) -> str:
        """Submit job using traditional inference system"""
        try:
            # Use existing inference system
            if 'submitInferenceJob' in globals():
                job_result = await submitInferenceJob(
                    model_id=model_id,
                    input_data=prompt,
                    user_address=user_address
                )
                
                print(f"📝 Submitted traditional job: {job_result.get('job_id', 'unknown')}")
                return job_result.get('job_id', 'unknown')
            else:
                # Mock traditional job
                job_id = f"traditional_{int(time.time())}"
                print(f"📝 Mock traditional job: {job_id}")
                return job_id
        
        except Exception as e:
            print(f"❌ Traditional job submission error: {e}")
            return f"error_{int(time.time())}"
    
    def get_optimal_inference_method(self, model_id: str) -> str:
        """Determine optimal inference method for a model"""
        try:
            # Check if tensor parallelism is available and beneficial
            splitter = self.blockchain_registry.get_model_splitter(model_id)
            online_devices = len([r for r in self.network_coordinator.registered_devices.values() 
                                if r.status == 'online'])
            
            if splitter and online_devices >= 2:
                model_metadata = self.blockchain_registry.registered_models.get(model_id)
                
                if model_metadata and model_metadata.total_parameters > 1_000_000_000:  # 1B+ parameters
                    return 'tensor_parallel'
            
            return 'traditional'
        
        except Exception as e:
            print(f"❌ Method selection error: {e}")
            return 'traditional'
    
    def get_integration_status(self) -> Dict[str, Any]:
        """Get status of network integration"""
        return {
            'web3_connected': self.web3_instance is not None,
            'network_discovery_active': self.network_discovery is not None,
            'contract_addresses_loaded': len(self.contract_addresses) > 0,
            'tensor_parallel_devices': len(self.network_coordinator.registered_devices),
            'available_models': len(self.blockchain_registry.registered_models),
            'active_jobs': len(self.network_coordinator.active_jobs),
            'network_coordinator_status': self.network_coordinator.get_network_status()
        }

class EnhancedInferenceAPI:
    """Enhanced inference API that automatically chooses optimal method"""
    
    def __init__(self, bridge: TensorParallelismBridge):
        self.bridge = bridge
    
    async def infer(self, model_id: str, prompt: str, user_address: str, **kwargs) -> Dict[str, Any]:
        """Automatically choose and execute optimal inference method"""
        try:
            # Determine optimal method
            method = self.bridge.get_optimal_inference_method(model_id)
            
            print(f"🧠 Using {method} inference for model {model_id}")
            
            # Execute inference
            job_id = await self.bridge.submit_tensor_parallel_job(
                model_id=model_id,
                user_address=user_address,
                prompt=prompt,
                **kwargs
            )
            
            # Monitor job completion
            result = await self._monitor_job_completion(job_id, method)
            
            return result
        
        except Exception as e:
            print(f"❌ Inference error: {e}")
            return {
                'success': False,
                'error': str(e),
                'method': 'error'
            }
    
    async def _monitor_job_completion(self, job_id: str, method: str) -> Dict[str, Any]:
        """Monitor job until completion"""
        max_wait_time = 300  # 5 minutes
        start_time = time.time()
        
        while time.time() - start_time < max_wait_time:
            try:
                # Check job status
                if method == 'tensor_parallel':
                    job_status = self.bridge.network_coordinator.get_job_status(job_id)
                else:
                    # Monitor traditional job (placeholder)
                    job_status = {'status': 'completed', 'generated_text': 'Mock response'}
                
                if job_status:
                    if job_status.get('status') == 'completed':
                        return {
                            'success': True,
                            'job_id': job_id,
                            'generated_text': job_status.get('generated_text', ''),
                            'processing_time_ms': job_status.get('processing_time_ms', 0),
                            'method': method,
                            'tokens_generated': job_status.get('total_tokens', 0)
                        }
                    elif job_status.get('status') == 'failed':
                        return {
                            'success': False,
                            'job_id': job_id,
                            'error': 'Job failed',
                            'method': method
                        }
                
                # Wait before checking again
                await asyncio.sleep(2)
                
            except Exception as e:
                print(f"❌ Job monitoring error: {e}")
                await asyncio.sleep(5)
        
        # Timeout
        return {
            'success': False,
            'job_id': job_id,
            'error': 'Job timeout',
            'method': method
        }

# Testing and demonstration
async def test_integration():
    """Test the network integration"""
    
    # Create blockchain registry
    contract_abi = []
    registry = BlockchainModelRegistry(
        web3_provider="http://localhost:8545",
        contract_address="0x537e697c7AB75A26f9ECF0Ce810e3154dFcaaf44",
        contract_abi=contract_abi
    )
    
    # Create network coordinator
    coordinator = NetworkCoordinator(registry)
    
    # Create integration bridge
    bridge = TensorParallelismBridge(coordinator)
    
    # Create enhanced API
    api = EnhancedInferenceAPI(bridge)
    
    print("🚀 Testing Network Integration")
    print("=" * 50)
    
    # Test integration status
    status = bridge.get_integration_status()
    print(f"📊 Integration Status:")
    for key, value in status.items():
        print(f"   {key}: {value}")
    
    # Test inference API
    print(f"\n🧠 Testing Enhanced Inference API...")
    
    # Mock inference job
    result = await api.infer(
        model_id="test-model-1",
        prompt="Explain quantum computing",
        user_address="0x1234567890123456789012345678901234567890",
        max_tokens=100,
        temperature=0.7
    )
    
    print(f"📋 Inference Result:")
    for key, value in result.items():
        print(f"   {key}: {value}")
    
    print(f"\n✅ Integration test completed")

if __name__ == "__main__":
    asyncio.run(test_integration())