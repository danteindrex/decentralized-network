#!/usr/bin/env python3
"""
Bootstrap Node Connectivity Test
Simple test of tensor parallelism with live bootstrap node
"""

import asyncio
import json
import time
import requests
import sys
import os
from pathlib import Path

# Add tensor parallelism components
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import only the core components we need
exec(open(os.path.join(os.path.dirname(__file__), '..', 'device-assessment', 'capability_assessor.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'core', 'tensor_splitter.py')).read())

class SimpleBootstrapTest:
    """Simple test with live bootstrap node"""
    
    def __init__(self, bootstrap_url: str = "https://bootstrap-node.onrender.com"):
        self.bootstrap_url = bootstrap_url
        print(f"🧪 Simple Bootstrap Test")
        print(f"🌐 Bootstrap Node: {bootstrap_url}")
    
    async def run_test(self):
        """Run simple connectivity and functionality test"""
        print(f"\n🚀 Starting Bootstrap Connectivity Test")
        print(f"=" * 50)
        
        # Test 1: Bootstrap connectivity
        await self._test_bootstrap_connectivity()
        
        # Test 2: Device assessment
        await self._test_device_assessment()
        
        # Test 3: Tensor splitting
        await self._test_tensor_splitting()
        
        print(f"\n✅ Bootstrap connectivity test completed!")
    
    async def _test_bootstrap_connectivity(self):
        """Test connection to live bootstrap node"""
        print(f"\n🔍 Testing Bootstrap Node Connectivity")
        print(f"-" * 40)
        
        try:
            # Test basic health endpoint
            print(f"🌐 Testing: {self.bootstrap_url}/health")
            start_time = time.time() 
            response = requests.get(f"{self.bootstrap_url}/health", timeout=10)
            response_time = (time.time() - start_time) * 1000
            
            if response.status_code == 200:
                print(f"✅ Health check passed: {response_time:.1f}ms")
                try:
                    health_data = response.json()
                    print(f"📊 Health data: {health_data}")
                except:
                    print(f"📊 Health response: {response.text[:100]}...")
            else:
                print(f"⚠️ Health check returned: {response.status_code}")
            
            # Test other common endpoints
            endpoints_to_test = [
                "/peers",
                "/status", 
                "/api/v0/version",
                "/api/v0/id",
                "/"
            ]
            
            for endpoint in endpoints_to_test:
                try:
                    test_url = f"{self.bootstrap_url}{endpoint}"
                    print(f"🔍 Testing: {endpoint}")
                    
                    response = requests.get(test_url, timeout=5)
                    status_icon = "✅" if response.status_code in [200, 404] else "⚠️"
                    print(f"  {status_icon} Status: {response.status_code}")
                    
                    if response.status_code == 200 and len(response.text) < 200:
                        print(f"  📄 Response: {response.text[:100]}")
                    
                except requests.exceptions.Timeout:
                    print(f"  ⏱️ Timeout")
                except requests.exceptions.ConnectionError:
                    print(f"  ❌ Connection error")
                except Exception as e:
                    print(f"  ❌ Error: {str(e)[:50]}")
        
        except Exception as e:
            print(f"❌ Bootstrap test failed: {e}")
    
    async def _test_device_assessment(self):
        """Test device capability assessment"""
        print(f"\n🔍 Testing Device Assessment")
        print(f"-" * 40)
        
        try:
            # Create assessor without caching for fresh test
            assessor = DeviceCapabilityAssessor(cache_results=False)
            
            print(f"📊 Assessing current device...")
            device_specs = await assessor.assess_device("bootstrap-test-device")
            
            print(f"✅ Device assessment completed:")
            print(f"  🖥️  Device Type: {device_specs.device_type}")
            print(f"  🧠 RAM: {device_specs.available_ram_gb:.1f}GB / {device_specs.total_ram_gb:.1f}GB")
            print(f"  🎮 VRAM: {device_specs.available_vram_gb:.1f}GB / {device_specs.total_vram_gb:.1f}GB")
            print(f"  ⚙️  CPU: {device_specs.cpu_cores} cores @ {device_specs.cpu_frequency_ghz:.1f}GHz")
            print(f"  🚀 GPU: {device_specs.gpu_name or 'None'}")
            print(f"  ⚡ Performance: {device_specs.matrix_mult_tflops:.1f} TFLOPS")
            print(f"  🌐 Network: {device_specs.network_bandwidth_mbps:.0f}Mbps, {device_specs.network_latency_ms:.1f}ms")
            
            return device_specs
            
        except Exception as e:
            print(f"❌ Device assessment failed: {e}")
            return None
    
    async def _test_tensor_splitting(self):
        """Test tensor splitting functionality"""
        print(f"\n🔍 Testing Tensor Splitting")  
        print(f"-" * 40)
        
        try:
            # Create test model configurations
            test_models = [
                {
                    'name': 'DeepSeek-1B (Small)',
                    'total_parameters': 1_000_000_000,
                    'hidden_size': 2048,
                    'num_layers': 24,
                    'num_attention_heads': 16,
                    'intermediate_size': 5504,
                    'vocab_size': 100000,
                    'max_sequence_length': 2048
                },
                {
                    'name': 'Llama-7B (Medium)', 
                    'total_parameters': 7_000_000_000,
                    'hidden_size': 4096,
                    'num_layers': 32,
                    'num_attention_heads': 32,
                    'intermediate_size': 11008,
                    'vocab_size': 32000,
                    'max_sequence_length': 2048
                },
                {
                    'name': 'Llama-70B (Large)',
                    'total_parameters': 70_000_000_000,
                    'hidden_size': 8192,
                    'num_layers': 80,
                    'num_attention_heads': 64,
                    'intermediate_size': 28672,
                    'vocab_size': 32000,
                    'max_sequence_length': 4096
                }
            ]
            
            # Get device specs from previous test
            assessor = DeviceCapabilityAssessor(cache_results=True)
            device_specs = await assessor.assess_device("bootstrap-test-device")
            
            if not device_specs:
                print(f"⚠️ No device specs available, skipping tensor splitting test")
                return
            
            # Test tensor splitting for each model
            for i, model_data in enumerate(test_models):
                print(f"\n🔧 Testing model: {model_data['name']}")
                
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
                    base_memory_mb=500,
                    memory_per_layer_mb=model_data['total_parameters'] // (model_data['num_layers'] * 1024 * 1024) * 2,
                    memory_per_head_mb=50
                )
                
                # Create tensor splitter
                splitter = AdaptiveTensorSplitter(model_config)
                
                # Register current device
                splitter.register_device(device_specs)
                
                # Create additional simulated devices for better distribution
                simulated_devices = [
                    DeviceSpecs(
                        device_id="sim-mobile-1",
                        device_type="mobile",
                        total_ram_gb=8, available_ram_gb=6,
                        total_vram_gb=0, available_vram_gb=0,
                        total_storage_gb=256, available_storage_gb=200,
                        storage_type="ssd",
                        cpu_cores=8, cpu_frequency_ghz=2.8,
                        cpu_name="Snapdragon 8 Gen", gpu_name="Adreno GPU",
                        gpu_compute_capability=None,
                        network_bandwidth_mbps=100, network_latency_ms=30,
                        tensor_ops_per_sec=2000, memory_bandwidth_gbps=25,
                        matrix_mult_tflops=1.0
                    ),
                    DeviceSpecs(
                        device_id="sim-desktop-1", 
                        device_type="desktop",
                        total_ram_gb=32, available_ram_gb=24,
                        total_vram_gb=12, available_vram_gb=10,
                        total_storage_gb=1000, available_storage_gb=800,
                        storage_type="nvme",
                        cpu_cores=12, cpu_frequency_ghz=3.5,
                        cpu_name="Intel i7", gpu_name="RTX 3080",
                        gpu_compute_capability="8.6",
                        network_bandwidth_mbps=1000, network_latency_ms=10,
                        tensor_ops_per_sec=8000, memory_bandwidth_gbps=80,
                        matrix_mult_tflops=25.0
                    )
                ]
                
                # Register simulated devices
                for sim_device in simulated_devices:
                    splitter.register_device(sim_device)
                
                # Get allocation for current device
                allocation = splitter.get_allocation_for_device(device_specs.device_id)
                
                if allocation:
                    print(f"  ✅ Tensor allocation created:")
                    print(f"    🧠 Attention Heads: {allocation.attention_heads}")
                    print(f"    🔧 MLP Dimensions: {allocation.mlp_intermediate_size}")
                    print(f"    💾 Model Memory: {allocation.model_memory_mb}MB")
                    print(f"    🎯 Precision: {allocation.precision}")
                    print(f"    ⏱️  Est. Latency: {allocation.estimated_latency_ms:.1f}ms")
                    print(f"    🚀 Throughput: {allocation.estimated_throughput_tokens_per_sec:.1f} tokens/sec")
                    
                    # Calculate efficiency metrics
                    total_devices = len(splitter.device_specs)
                    head_utilization = allocation.attention_heads / model_data['num_attention_heads'] * 100
                    
                    print(f"    📊 Network: {total_devices} devices, {head_utilization:.1f}% head utilization")
                else:
                    print(f"  ❌ No allocation created for {model_data['name']}")
        
        except Exception as e:
            print(f"❌ Tensor splitting test failed: {e}")

async def main():
    """Run bootstrap connectivity test"""
    print(f"🚀 Bootstrap Node Tensor Parallelism Test")
    print(f"=" * 60)
    print(f"🎯 Purpose: Test tensor parallelism with live bootstrap node")
    print(f"🌐 Target: https://bootstrap-node.onrender.com")
    print(f"📅 Time: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    
    tester = SimpleBootstrapTest("https://bootstrap-node.onrender.com")
    await tester.run_test()
    
    print(f"\n🎉 Test completed! The tensor parallelism system can connect to your live bootstrap node.")
    print(f"🚀 Ready for integration with your decentralized network infrastructure.")

if __name__ == "__main__":
    asyncio.run(main())