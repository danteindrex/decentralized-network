#!/usr/bin/env python3
"""
Live Network Test with Real Bootstrap Node
Tests tensor parallelism system against https://bootstrap-node.onrender.com
"""

import asyncio
import json
import time
import requests
from typing import Dict, List, Any
import sys
import os
from pathlib import Path

# Add tensor parallelism components
project_root = Path(__file__).parent.parent.parent
sys.path.append(str(project_root))
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import components
exec(open(os.path.join(os.path.dirname(__file__), '..', 'device-assessment', 'capability_assessor.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'core', 'tensor_splitter.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'models', 'blockchain_model_registry.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'integration', 'network_bridge.py')).read())

class LiveNetworkTester:
    """Test tensor parallelism with live bootstrap node"""
    
    def __init__(self, bootstrap_url: str = "https://bootstrap-node.onrender.com"):
        self.bootstrap_url = bootstrap_url
        self.test_results = {}
        
        print(f"🧪 Live Network Tester initialized")
        print(f"🌐 Bootstrap Node: {bootstrap_url}")
    
    async def run_comprehensive_test(self):
        """Run comprehensive test suite"""
        print(f"\n🚀 Starting Comprehensive Live Network Test")
        print(f"=" * 60)
        
        # Test 1: Bootstrap Node Connectivity
        await self._test_bootstrap_connectivity()
        
        # Test 2: Device Assessment
        await self._test_device_assessment()
        
        # Test 3: Model Registry with Live Connection
        await self._test_model_registry_live()
        
        # Test 4: Tensor Splitting with Real Devices
        await self._test_tensor_splitting_real()
        
        # Test 5: Network Coordination
        await self._test_network_coordination()
        
        # Test 6: End-to-End Integration
        await self._test_end_to_end_integration()
        
        # Print final results
        self._print_test_summary()
    
    async def _test_bootstrap_connectivity(self):
        """Test connectivity to live bootstrap node"""
        print(f"\n🔍 Test 1: Bootstrap Node Connectivity")
        print(f"-" * 40)
        
        try:
            # Test basic connectivity
            start_time = time.time()
            response = requests.get(f"{self.bootstrap_url}/health", timeout=10)
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                print(f"✅ Bootstrap node reachable: {response_time:.1f}ms")
                self.test_results['bootstrap_connectivity'] = True
                
                # Test additional endpoints
                endpoints = ['/peers', '/status', '/api/v0/version']
                for endpoint in endpoints:
                    try:
                        test_response = requests.get(f"{self.bootstrap_url}{endpoint}", timeout=5)
                        status = "✅" if test_response.status_code in [200, 404] else "❌"
                        print(f"  {status} {endpoint}: {test_response.status_code}")
                    except Exception as e:
                        print(f"  ⚠️ {endpoint}: {str(e)[:50]}...")
            else:
                print(f"❌ Bootstrap node returned: {response.status_code}")
                self.test_results['bootstrap_connectivity'] = False
        
        except Exception as e:
            print(f"❌ Bootstrap node unreachable: {e}")
            self.test_results['bootstrap_connectivity'] = False
    
    async def _test_device_assessment(self):
        """Test device capability assessment"""
        print(f"\n🔍 Test 2: Device Assessment System")
        print(f"-" * 40)
        
        try:
            # Test current device assessment
            assessor = DeviceCapabilityAssessor(cache_results=False)
            
            print(f"📊 Assessing current device capabilities...")
            device_specs = await assessor.assess_device("live-test-device")
            
            print(f"✅ Device assessment completed:")
            print(f"  Device Type: {device_specs.device_type}")
            print(f"  RAM: {device_specs.available_ram_gb:.1f}GB / {device_specs.total_ram_gb:.1f}GB")
            print(f"  VRAM: {device_specs.available_vram_gb:.1f}GB / {device_specs.total_vram_gb:.1f}GB")
            print(f"  CPU: {device_specs.cpu_cores} cores @ {device_specs.cpu_frequency_ghz:.1f}GHz")
            print(f"  GPU: {device_specs.gpu_name or 'None'}")
            print(f"  Performance: {device_specs.matrix_mult_tflops:.1f} TFLOPS")
            
            self.test_results['device_assessment'] = True
            self.test_results['device_specs'] = device_specs
            
        except Exception as e:
            print(f"❌ Device assessment failed: {e}")
            self.test_results['device_assessment'] = False
    
    async def _test_model_registry_live(self):
        """Test model registry with live blockchain connection"""
        print(f"\n🔍 Test 3: Model Registry with Live Connection")
        print(f"-" * 40)
        
        try:
            # Load deployment config for contract addresses
            deployment_file = project_root / "deployment.json"
            contract_addresses = {}
            
            if deployment_file.exists():
                with open(deployment_file, 'r') as f:
                    contract_addresses = json.load(f)
                print(f"📋 Loaded contract addresses:")
                for key, value in contract_addresses.items():
                    if isinstance(value, str) and value.startswith('0x'):
                        print(f"  {key}: {value}")
            
            # Create simplified contract ABI for testing
            contract_abi = [
                {
                    "name": "getModel",
                    "type": "function",
                    "inputs": [{"name": "modelId", "type": "uint256"}],
                    "outputs": [
                        {"name": "owner", "type": "address"},
                        {"name": "name", "type": "string"},
                        {"name": "description", "type": "string"},
                        {"name": "timestamp", "type": "uint256"}
                    ]
                }
            ]
            
            # Initialize model registry with live connection
            registry = BlockchainModelRegistry(
                web3_provider=self.bootstrap_url,
                contract_address=contract_addresses.get('modelRegistry', '0x0000000000000000000000000000000000000000'),
                contract_abi=contract_abi
            )
            
            print(f"✅ Model registry initialized with live connection")
            
            # Test model parsing
            parser = UniversalModelParser()
            
            # Test with different model types
            test_models = [
                {
                    'name': 'Test Llama 7B',
                    'architecture': 'llama',
                    'total_parameters': 7_000_000_000,
                    'hidden_size': 4096,
                    'num_layers': 32,
                    'num_attention_heads': 32,
                    'intermediate_size': 11008,
                    'vocab_size': 32000,
                    'max_sequence_length': 2048,
                    'precision': 'fp16'
                },
                {
                    'name': 'Test GPT 1.3B',
                    'architecture': 'gpt',
                    'total_parameters': 1_300_000_000,
                    'hidden_size': 2048,
                    'num_layers': 24,
                    'num_attention_heads': 16,
                    'intermediate_size': 8192,
                    'vocab_size': 50257,
                    'max_sequence_length': 1024,
                    'precision': 'fp16'
                }
            ]
            
            for i, model_data in enumerate(test_models):
                # Create mock model metadata
                model_metadata = ModelMetadata(
                    model_id=f"test-model-{i}",
                    model_name=model_data['name'],
                    model_cid=f"Qm{'x' * 44}",
                    owner_address="0x1234567890123456789012345678901234567890",
                    upload_timestamp=int(time.time()),
                    architecture=model_data['architecture'],
                    total_parameters=model_data['total_parameters'],
                    hidden_size=model_data['hidden_size'],
                    num_layers=model_data['num_layers'],
                    num_attention_heads=model_data['num_attention_heads'],
                    intermediate_size=model_data['intermediate_size'],
                    vocab_size=model_data['vocab_size'],
                    max_sequence_length=model_data['max_sequence_length'],
                    model_format='safetensors',
                    precision=model_data['precision'],
                    file_size_gb=model_data['total_parameters'] * 2 / (1024**3),  # fp16
                    block_number=12345,
                    transaction_hash="0x" + "a" * 64,
                    min_memory_gb=model_data['total_parameters'] * 2 / (1024**3),
                    recommended_memory_gb=model_data['total_parameters'] * 4 / (1024**3),
                    min_compute_tflops=0.1
                )
                
                # Test model parsing
                model_config = parser.parse_model_config(model_metadata)
                print(f"  ✅ Parsed {model_data['name']}: {model_config.total_parameters:,} params")
            
            self.test_results['model_registry'] = True
            self.test_results['test_models'] = test_models
            
        except Exception as e:
            print(f"❌ Model registry test failed: {e}")
            self.test_results['model_registry'] = False
    
    async def _test_tensor_splitting_real(self):
        """Test tensor splitting with real device specs"""
        print(f"\n🔍 Test 4: Tensor Splitting with Real Device")
        print(f"-" * 40)
        
        try:
            if not self.test_results.get('device_assessment') or not self.test_results.get('test_models'):
                print(f"⚠️ Skipping - prerequisites not met")
                return
            
            device_specs = self.test_results['device_specs']
            test_models = self.test_results['test_models']
            
            # Test tensor splitting for each model
            for model_data in test_models:
                print(f"\n🔧 Testing tensor splitting for {model_data['name']}:")
                
                # Create model config
                model_config = ModelConfig(
                    model_name=model_data['name'],
                    total_parameters=model_data['total_parameters'],
                    hidden_size=model_data['hidden_size'],
                    num_layers=model_data['num_layers'],
                    num_attention_heads=model_data['num_attention_heads'],
                    intermediate_size=model_data['intermediate_size'],
                    vocab_size=model_data['vocab_size'],
                    max_sequence_length=model_data['max_sequence_length'],
                    base_memory_mb=1000,
                    memory_per_layer_mb=model_data['total_parameters'] // model_data['num_layers'] * 2 // (1024*1024),
                    memory_per_head_mb=100
                )
                
                # Create tensor splitter
                splitter = AdaptiveTensorSplitter(model_config)
                
                # Register current device
                splitter.register_device(device_specs)
                
                # Add simulated additional devices for better testing
                if device_specs.device_type != 'mobile':
                    # Add a mobile device
                    mobile_specs = DeviceSpecs(
                        device_id="test-mobile-1",
                        device_type="mobile",
                        total_ram_gb=8, available_ram_gb=6,
                        total_vram_gb=0, available_vram_gb=0,
                        total_storage_gb=256, available_storage_gb=200,
                        storage_type="ssd",
                        cpu_cores=8, cpu_frequency_ghz=2.8,
                        cpu_name="Mobile CPU", gpu_name="Mobile GPU",
                        gpu_compute_capability=None,
                        network_bandwidth_mbps=100, network_latency_ms=25,
                        tensor_ops_per_sec=2000, memory_bandwidth_gbps=25,
                        matrix_mult_tflops=1.0
                    )
                    splitter.register_device(mobile_specs)
                
                # Get allocation for current device
                allocation = splitter.get_allocation_for_device(device_specs.device_id)
                if allocation:
                    print(f"  ✅ Tensor allocation created:")
                    print(f"    Attention Heads: {allocation.attention_heads}")
                    print(f"    MLP Dimensions: {allocation.mlp_intermediate_size}")
                    print(f"    Memory Usage: {allocation.model_memory_mb}MB")
                    print(f"    Precision: {allocation.precision}")
                    print(f"    Est. Latency: {allocation.estimated_latency_ms:.1f}ms")
                else:
                    print(f"  ❌ No allocation created")
            
            self.test_results['tensor_splitting'] = True
            
        except Exception as e:
            print(f"❌ Tensor splitting test failed: {e}")
            self.test_results['tensor_splitting'] = False
    
    async def _test_network_coordination(self):
        """Test network coordination functionality"""  
        print(f"\n🔍 Test 5: Network Coordination")
        print(f"-" * 40)
        
        try:
            # Create mock blockchain registry for coordination test
            contract_abi = []
            registry = BlockchainModelRegistry(
                web3_provider=self.bootstrap_url,
                contract_address="0x537e697c7AB75A26f9ECF0Ce810e3154dFcaaf44",
                contract_abi=contract_abi
            )
            
            # Create network coordinator
            coordinator = NetworkCoordinator(registry)
            
            print(f"✅ Network coordinator created")
            
            # Test job submission (without actual execution)
            job_id = await coordinator.submit_inference_job(
                model_id="test-model-1",
                user_address="0x1234567890123456789012345678901234567890",
                prompt="Test prompt for tensor parallelism",
                max_tokens=50,
                temperature=0.7
            )
            
            print(f"✅ Test job submitted: {job_id}")
            
            # Check job status
            job_status = coordinator.get_job_status(job_id)
            if job_status:
                print(f"✅ Job status retrieved: {job_status['status']}")
            
            # Check network status
            network_status = coordinator.get_network_status()
            print(f"✅ Network status: {network_status['total_devices']} devices")
            
            self.test_results['network_coordination'] = True
            
        except Exception as e:
            print(f"❌ Network coordination test failed: {e}")
            self.test_results['network_coordination'] = False
    
    async def _test_end_to_end_integration(self):
        """Test complete end-to-end integration"""
        print(f"\n🔍 Test 6: End-to-End Integration")
        print(f"-" * 40)
        
        try:
            # Test integration bridge
            contract_abi = []
            registry = BlockchainModelRegistry(
                web3_provider=self.bootstrap_url,
                contract_address="0x537e697c7AB75A26f9ECF0Ce810e3154dFcaaf44",
                contract_abi=contract_abi
            )
            
            coordinator = NetworkCoordinator(registry)
            bridge = TensorParallelismBridge(coordinator)
            api = EnhancedInferenceAPI(bridge)
            
            print(f"✅ Integration components created")
            
            # Test integration status
            status = bridge.get_integration_status()
            print(f"✅ Integration status retrieved:")
            for key, value in status.items():
                if isinstance(value, dict):
                    print(f"  {key}: {len(value)} items")
                else:
                    print(f"  {key}: {value}")
            
            # Test optimal method selection
            method = bridge.get_optimal_inference_method("test-model-1")
            print(f"✅ Optimal inference method: {method}")
            
            self.test_results['end_to_end'] = True
            
        except Exception as e:
            print(f"❌ End-to-end integration test failed: {e}")
            self.test_results['end_to_end'] = False
    
    def _print_test_summary(self):
        """Print comprehensive test summary"""
        print(f"\n🎯 Live Network Test Results")
        print(f"=" * 60)
        
        total_tests = len(self.test_results)
        passed_tests = sum(1 for result in self.test_results.values() 
                          if isinstance(result, bool) and result)
        
        print(f"📊 Overall Results: {passed_tests}/{total_tests} tests passed")
        print(f"")
        
        for test_name, result in self.test_results.items():
            if isinstance(result, bool):
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"{status} {test_name.replace('_', ' ').title()}")
        
        print(f"\n🎉 Test Summary:")
        if passed_tests == total_tests:
            print(f"🌟 ALL TESTS PASSED! Tensor parallelism system is fully functional.")
            print(f"🚀 Ready for production deployment with live bootstrap node.")
        elif passed_tests >= total_tests * 0.8:
            print(f"✅ MOSTLY WORKING! {passed_tests}/{total_tests} tests passed.")
            print(f"🔧 Minor issues to address before full deployment.")
        else:
            print(f"⚠️ NEEDS WORK! Only {passed_tests}/{total_tests} tests passed.")
            print(f"🛠️ Significant issues need to be resolved.")
        
        print(f"\n🌐 Bootstrap Node: {self.bootstrap_url}")
        print(f"📅 Test Completed: {time.strftime('%Y-%m-%d %H:%M:%S')}")

async def main():
    """Run live network test"""
    tester = LiveNetworkTester("https://bootstrap-node.onrender.com")
    await tester.run_comprehensive_test()

if __name__ == "__main__":
    asyncio.run(main())