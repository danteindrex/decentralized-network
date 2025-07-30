#!/usr/bin/env python3
"""
Device Capability Assessment System
Profiles device hardware to determine optimal tensor chunk allocation
"""

import asyncio
import psutil
import torch
import time
import json
from typing import Dict, Any, Tuple, Optional
from dataclasses import dataclass, asdict
from pathlib import Path

@dataclass
class DeviceSpecs:
    """Hardware specifications of a device"""
    device_id: str
    device_type: str  # 'mobile', 'desktop', 'cloud'
    
    # Memory specifications
    total_ram_gb: float
    available_ram_gb: float
    total_vram_gb: float
    available_vram_gb: float
    
    # Storage specifications  
    total_storage_gb: float
    available_storage_gb: float
    storage_type: str  # 'ssd', 'hdd', 'nvme'
    
    # Compute specifications
    cpu_cores: int
    cpu_frequency_ghz: float
    cpu_name: str
    gpu_name: Optional[str]
    gpu_compute_capability: Optional[str]
    
    # Network specifications
    network_bandwidth_mbps: float
    network_latency_ms: float
    
    # Benchmark results
    tensor_ops_per_sec: float
    memory_bandwidth_gbps: float
    matrix_mult_tflops: float

@dataclass
class TensorAllocation:
    """Optimal tensor allocation for a device"""
    device_id: str
    
    # Attention allocation
    attention_heads: int
    attention_head_dim: int
    max_sequence_length: int
    
    # MLP allocation
    mlp_intermediate_size: int
    mlp_layers: int
    
    # Memory allocation
    model_memory_mb: int
    activation_memory_mb: int
    buffer_memory_mb: int
    
    # Performance expectations
    estimated_latency_ms: float
    estimated_throughput_tokens_per_sec: float
    
    # Quality settings
    precision: str  # 'fp32', 'fp16', 'int8', 'int4'
    quantization_method: Optional[str]

class DeviceCapabilityAssessor:
    """Assesses device capabilities and determines optimal tensor allocation"""
    
    def __init__(self, cache_results: bool = True):
        self.cache_results = cache_results
        self.cache_file = Path("device_capabilities_cache.json")
        self.device_cache = self._load_cache()
        
    def _load_cache(self) -> Dict[str, Dict]:
        """Load cached device assessments"""
        if self.cache_file.exists():
            try:
                with open(self.cache_file, 'r') as f:
                    return json.load(f)
            except Exception as e:
                print(f"⚠️ Failed to load cache: {e}")
        return {}
    
    def _save_cache(self):
        """Save device assessments to cache"""
        if self.cache_results:
            try:
                with open(self.cache_file, 'w') as f:
                    json.dump(self.device_cache, f, indent=2)
            except Exception as e:
                print(f"⚠️ Failed to save cache: {e}")
    
    async def assess_device(self, device_id: str, force_refresh: bool = False) -> DeviceSpecs:
        """Comprehensively assess device capabilities"""
        
        if not force_refresh and device_id in self.device_cache:
            print(f"📋 Using cached assessment for {device_id}")
            cached_data = self.device_cache[device_id]
            return DeviceSpecs(**cached_data)
        
        print(f"🔍 Assessing device capabilities: {device_id}")
        
        # Gather hardware information
        specs = await self._gather_hardware_specs(device_id)
        
        # Run performance benchmarks
        await self._run_performance_benchmarks(specs)
        
        # Cache results
        self.device_cache[device_id] = asdict(specs)
        self._save_cache()
        
        print(f"✅ Device assessment complete: {device_id}")
        self._print_device_summary(specs)
        
        return specs
    
    async def _gather_hardware_specs(self, device_id: str) -> DeviceSpecs:
        """Gather basic hardware specifications"""
        
        # Memory information
        memory = psutil.virtual_memory()
        total_ram_gb = memory.total / (1024**3)
        available_ram_gb = memory.available / (1024**3)
        
        # Storage information
        disk = psutil.disk_usage('/')
        total_storage_gb = disk.total / (1024**3)
        available_storage_gb = disk.free / (1024**3)
        storage_type = self._detect_storage_type()
        
        # CPU information
        cpu_count = psutil.cpu_count(logical=False)
        cpu_freq = psutil.cpu_freq()
        cpu_frequency_ghz = cpu_freq.current / 1000 if cpu_freq else 2.0
        cpu_name = self._get_cpu_name()
        
        # GPU information
        gpu_info = self._get_gpu_info()
        
        # Network information  
        network_info = await self._assess_network_performance()
        
        # Detect device type
        device_type = self._classify_device_type(total_ram_gb, cpu_count, gpu_info['name'])
        
        return DeviceSpecs(
            device_id=device_id,
            device_type=device_type,
            
            total_ram_gb=total_ram_gb,
            available_ram_gb=available_ram_gb,
            total_vram_gb=gpu_info['vram_gb'],
            available_vram_gb=gpu_info['available_vram_gb'],
            
            total_storage_gb=total_storage_gb,
            available_storage_gb=available_storage_gb,
            storage_type=storage_type,
            
            cpu_cores=cpu_count,
            cpu_frequency_ghz=cpu_frequency_ghz,
            cpu_name=cpu_name,
            gpu_name=gpu_info['name'],
            gpu_compute_capability=gpu_info['compute_capability'],
            
            network_bandwidth_mbps=network_info['bandwidth'],
            network_latency_ms=network_info['latency'],
            
            # Will be filled by benchmarks
            tensor_ops_per_sec=0.0,
            memory_bandwidth_gbps=0.0,
            matrix_mult_tflops=0.0
        )
    
    def _detect_storage_type(self) -> str:
        """Detect storage type (SSD/HDD/NVMe)"""
        try:
            # Simple heuristic: check if /sys/block exists (Linux)
            if Path("/sys/block").exists():
                # Check for NVMe devices
                if any(Path("/sys/block").glob("nvme*")):
                    return "nvme"
                # Check for SSD indicators
                if any(Path("/sys/block").glob("sd*")):
                    return "ssd"  # Assume SSD for simplicity
            return "ssd"  # Default assumption
        except:
            return "unknown"
    
    def _get_cpu_name(self) -> str:
        """Get CPU model name"""
        try:
            if Path("/proc/cpuinfo").exists():
                with open("/proc/cpuinfo", 'r') as f:
                    for line in f:
                        if "model name" in line:
                            return line.split(":")[1].strip()
            return "Unknown CPU"
        except:
            return "Unknown CPU"
    
    def _get_gpu_info(self) -> Dict[str, Any]:
        """Get GPU information"""
        gpu_info = {
            'name': None,
            'vram_gb': 0.0,
            'available_vram_gb': 0.0,
            'compute_capability': None
        }
        
        if torch.cuda.is_available():
            try:
                gpu_info['name'] = torch.cuda.get_device_name(0)
                
                # Get VRAM information
                gpu_memory = torch.cuda.get_device_properties(0).total_memory
                gpu_info['vram_gb'] = gpu_memory / (1024**3)
                
                # Get available VRAM
                torch.cuda.empty_cache()
                available_memory = torch.cuda.memory_reserved(0)
                gpu_info['available_vram_gb'] = (gpu_memory - available_memory) / (1024**3)
                
                # Get compute capability
                props = torch.cuda.get_device_properties(0)
                gpu_info['compute_capability'] = f"{props.major}.{props.minor}"
                
            except Exception as e:
                print(f"⚠️ Failed to get GPU info: {e}")
        
        return gpu_info
    
    async def _assess_network_performance(self) -> Dict[str, float]:
        """Assess network performance"""
        # Simple network assessment - in production would do actual speed tests
        try:
            # Measure local network latency
            start_time = time.time()
            # Simulate network test
            await asyncio.sleep(0.001)  # 1ms simulated latency
            latency = (time.time() - start_time) * 1000
            
            # Estimate bandwidth based on device type
            bandwidth = 1000.0  # Default 1Gbps
            
            return {
                'bandwidth': bandwidth,
                'latency': latency
            }
        except:
            return {'bandwidth': 100.0, 'latency': 50.0}  # Conservative defaults
    
    def _classify_device_type(self, ram_gb: float, cpu_cores: int, gpu_name: Optional[str]) -> str:
        """Classify device type based on specs"""
        if ram_gb >= 32 and cpu_cores >= 8:
            if gpu_name and any(x in gpu_name.lower() for x in ['rtx', 'gtx', 'radeon', 'a100', 'v100']):
                return 'desktop'
            return 'desktop'
        elif ram_gb >= 16 and cpu_cores >= 4:
            return 'desktop'
        elif ram_gb >= 4 and cpu_cores >= 4:
            return 'mobile'
        else:
            return 'mobile'
    
    async def _run_performance_benchmarks(self, specs: DeviceSpecs):
        """Run performance benchmarks to assess compute capability"""
        print(f"🏃 Running performance benchmarks...")
        
        try:
            # Tensor operations benchmark
            specs.tensor_ops_per_sec = await self._benchmark_tensor_ops()
            
            # Memory bandwidth benchmark
            specs.memory_bandwidth_gbps = await self._benchmark_memory_bandwidth()
            
            # Matrix multiplication benchmark
            specs.matrix_mult_tflops = await self._benchmark_matrix_multiplication()
            
        except Exception as e:
            print(f"⚠️ Benchmark failed: {e}")
            # Set conservative defaults
            specs.tensor_ops_per_sec = 1000.0
            specs.memory_bandwidth_gbps = 10.0
            specs.matrix_mult_tflops = 0.1
    
    async def _benchmark_tensor_ops(self) -> float:
        """Benchmark basic tensor operations"""
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Create test tensors
        tensor_size = 1000
        a = torch.randn(tensor_size, tensor_size, device=device)
        b = torch.randn(tensor_size, tensor_size, device=device)
        
        # Warm up
        for _ in range(5):
            _ = torch.add(a, b)
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        # Benchmark tensor additions
        start_time = time.time()
        num_ops = 100
        
        for _ in range(num_ops):
            c = torch.add(a, b)
            c = torch.mul(c, 0.5)
            c = torch.relu(c)
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        ops_per_sec = (num_ops * 3) / elapsed  # 3 ops per iteration
        return ops_per_sec
    
    async def _benchmark_memory_bandwidth(self) -> float:
        """Benchmark memory bandwidth"""
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Create large tensor for memory bandwidth test
        size = 10000
        tensor = torch.randn(size, size, device=device)
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        start_time = time.time()
        
        # Memory copy operations
        for _ in range(10):
            copied = tensor.clone()
            _ = copied.sum()
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        # Calculate bandwidth (GB/s)
        bytes_copied = size * size * 4 * 10  # float32 = 4 bytes, 10 iterations
        bandwidth = (bytes_copied / (1024**3)) / elapsed
        
        return bandwidth
    
    async def _benchmark_matrix_multiplication(self) -> float:
        """Benchmark matrix multiplication performance"""
        device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
        
        # Matrix sizes for TFLOPS calculation
        m, n, k = 1024, 1024, 1024
        a = torch.randn(m, k, device=device)
        b = torch.randn(k, n, device=device)
        
        # Warm up
        for _ in range(3):
            _ = torch.matmul(a, b)
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        start_time = time.time()
        num_iterations = 20
        
        for _ in range(num_iterations):
            c = torch.matmul(a, b)
        
        if device.type == 'cuda':
            torch.cuda.synchronize()
        
        end_time = time.time()
        elapsed = end_time - start_time
        
        # Calculate TFLOPS
        flops_per_matmul = 2 * m * n * k  # 2 operations per multiply-add
        total_flops = flops_per_matmul * num_iterations
        tflops = (total_flops / elapsed) / (10**12)
        
        return tflops
    
    def _print_device_summary(self, specs: DeviceSpecs):
        """Print device capability summary"""
        print(f"\n📊 Device Assessment Summary: {specs.device_id}")
        print(f"{'='*50}")
        print(f"Device Type: {specs.device_type}")
        print(f"RAM: {specs.available_ram_gb:.1f}GB / {specs.total_ram_gb:.1f}GB")
        print(f"VRAM: {specs.available_vram_gb:.1f}GB / {specs.total_vram_gb:.1f}GB")
        print(f"Storage: {specs.available_storage_gb:.1f}GB / {specs.total_storage_gb:.1f}GB ({specs.storage_type})")
        print(f"CPU: {specs.cpu_name} ({specs.cpu_cores} cores @ {specs.cpu_frequency_ghz:.1f}GHz)")
        print(f"GPU: {specs.gpu_name or 'None'}")
        print(f"Network: {specs.network_bandwidth_mbps:.0f}Mbps, {specs.network_latency_ms:.1f}ms latency")
        print(f"Performance:")
        print(f"  - Tensor Ops: {specs.tensor_ops_per_sec:.0f} ops/sec")
        print(f"  - Memory BW: {specs.memory_bandwidth_gbps:.1f} GB/s")
        print(f"  - Matrix Mult: {specs.matrix_mult_tflops:.2f} TFLOPS")
        print(f"{'='*50}\n")

# Testing function
async def test_capability_assessment():
    """Test the capability assessment system"""
    assessor = DeviceCapabilityAssessor()
    
    # Test with current device
    device_specs = await assessor.assess_device("test-device-1")
    
    print(f"Assessment completed successfully!")
    return device_specs

if __name__ == "__main__":
    asyncio.run(test_capability_assessment())