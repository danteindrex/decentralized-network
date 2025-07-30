#!/usr/bin/env python3
"""
Dynamic Tensor Splitting Algorithm
Intelligently distributes tensor operations based on device capabilities
"""

import math
import torch
from typing import Dict, List, Tuple, Optional
from dataclasses import dataclass
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import DeviceSpecs and TensorAllocation directly
exec(open(os.path.join(os.path.dirname(__file__), '..', 'device-assessment', 'capability_assessor.py')).read())

@dataclass
class ModelConfig:
    """Configuration for a specific model"""
    model_name: str
    total_parameters: int
    hidden_size: int
    num_layers: int
    num_attention_heads: int
    intermediate_size: int
    vocab_size: int
    max_sequence_length: int
    
    # Memory requirements (in MB)
    base_memory_mb: int
    memory_per_layer_mb: int
    memory_per_head_mb: int

@dataclass
class TensorSplit:
    """Defines how a tensor operation is split across devices"""
    operation_id: str
    operation_type: str  # 'attention', 'mlp', 'embedding'
    
    # Device assignments
    device_assignments: Dict[str, Dict[str, any]]
    
    # Coordination info
    coordinator_device: str
    backup_devices: List[str]
    
    # Performance estimates
    estimated_latency_ms: float
    estimated_memory_mb: int
    estimated_flops: int

class AdaptiveTensorSplitter:
    """Splits tensor operations adaptively based on device capabilities"""
    
    def __init__(self, model_config: ModelConfig):
        self.model_config = model_config
        self.device_specs: Dict[str, DeviceSpecs] = {}
        self.current_splits: Dict[str, TensorSplit] = {}
        
        # Splitting strategies
        self.min_heads_per_device = 1
        self.max_heads_per_device = 32
        self.memory_safety_factor = 0.8  # Use 80% of available memory
        
    def register_device(self, device_specs: DeviceSpecs):
        """Register a device and its capabilities"""
        self.device_specs[device_specs.device_id] = device_specs
        print(f"📝 Registered device: {device_specs.device_id} ({device_specs.device_type})")
        
        # Trigger rebalancing if needed
        self._rebalance_tensor_splits()
    
    def remove_device(self, device_id: str):
        """Remove a device and rebalance splits"""
        if device_id in self.device_specs:
            del self.device_specs[device_id]
            print(f"❌ Removed device: {device_id}")
            self._rebalance_tensor_splits()
    
    def _rebalance_tensor_splits(self):
        """Rebalance tensor splits when devices change"""
        if not self.device_specs:
            return
            
        print(f"⚖️ Rebalancing tensor splits across {len(self.device_specs)} devices")
        
        # Calculate new splits for each layer
        self.current_splits = {}
        
        for layer_id in range(self.model_config.num_layers):
            # Split attention operations
            attention_split = self._create_attention_split(layer_id)
            self.current_splits[f"attention_layer_{layer_id}"] = attention_split
            
            # Split MLP operations
            mlp_split = self._create_mlp_split(layer_id)
            self.current_splits[f"mlp_layer_{layer_id}"] = mlp_split
        
        self._print_split_summary()
    
    def _create_attention_split(self, layer_id: int) -> TensorSplit:
        """Create attention tensor split for a specific layer"""
        
        # Calculate device capabilities for attention
        device_capabilities = self._calculate_attention_capabilities()
        
        # Sort devices by capability (descending)
        sorted_devices = sorted(
            device_capabilities.items(),
            key=lambda x: x[1]['score'],
            reverse=True
        )
        
        # Distribute attention heads
        total_heads = self.model_config.num_attention_heads
        head_assignments = {}
        heads_assigned = 0
        
        for device_id, capability in sorted_devices:
            if heads_assigned >= total_heads:
                break
                
            # Calculate optimal heads for this device
            optimal_heads = capability['optimal_heads']
            remaining_heads = total_heads - heads_assigned
            assigned_heads = min(optimal_heads, remaining_heads)
            
            if assigned_heads > 0:
                head_assignments[device_id] = {
                    'head_start': heads_assigned,
                    'head_end': heads_assigned + assigned_heads - 1,
                    'head_count': assigned_heads,
                    'head_dim': self.model_config.hidden_size // self.model_config.num_attention_heads,
                    'memory_mb': capability['memory_required'],
                    'precision': capability['precision']
                }
                heads_assigned += assigned_heads
        
        # Select coordinator (most capable device)
        coordinator_device = sorted_devices[0][0] if sorted_devices else None
        backup_devices = [dev[0] for dev in sorted_devices[1:3]]  # Top 2 backups
        
        # Estimate performance
        estimated_latency = self._estimate_attention_latency(head_assignments)
        estimated_memory = sum(assignment['memory_mb'] for assignment in head_assignments.values())
        estimated_flops = self._estimate_attention_flops(head_assignments)
        
        return TensorSplit(
            operation_id=f"attention_layer_{layer_id}",
            operation_type="attention",
            device_assignments=head_assignments,
            coordinator_device=coordinator_device,
            backup_devices=backup_devices,
            estimated_latency_ms=estimated_latency,
            estimated_memory_mb=estimated_memory,
            estimated_flops=estimated_flops
        )
    
    def _create_mlp_split(self, layer_id: int) -> TensorSplit:
        """Create MLP tensor split for a specific layer"""
        
        # Calculate device capabilities for MLP
        device_capabilities = self._calculate_mlp_capabilities()
        
        # Sort devices by capability
        sorted_devices = sorted(
            device_capabilities.items(),
            key=lambda x: x[1]['score'],
            reverse=True
        )
        
        # Distribute intermediate dimensions
        total_intermediate = self.model_config.intermediate_size
        intermediate_assignments = {}
        assigned_dims = 0
        
        for device_id, capability in sorted_devices:
            if assigned_dims >= total_intermediate:
                break
                
            optimal_dims = capability['optimal_intermediate_dims']
            remaining_dims = total_intermediate - assigned_dims
            assigned_dims_for_device = min(optimal_dims, remaining_dims)
            
            if assigned_dims_for_device > 0:
                intermediate_assignments[device_id] = {
                    'dim_start': assigned_dims,
                    'dim_end': assigned_dims + assigned_dims_for_device - 1,
                    'dim_count': assigned_dims_for_device,
                    'memory_mb': capability['memory_required'],
                    'precision': capability['precision']
                }
                assigned_dims += assigned_dims_for_device
        
        # Select coordinator and backups
        coordinator_device = sorted_devices[0][0] if sorted_devices else None
        backup_devices = [dev[0] for dev in sorted_devices[1:3]]
        
        # Estimate performance
        estimated_latency = self._estimate_mlp_latency(intermediate_assignments)
        estimated_memory = sum(assignment['memory_mb'] for assignment in intermediate_assignments.values())
        estimated_flops = self._estimate_mlp_flops(intermediate_assignments)
        
        return TensorSplit(
            operation_id=f"mlp_layer_{layer_id}",
            operation_type="mlp",
            device_assignments=intermediate_assignments,
            coordinator_device=coordinator_device,
            backup_devices=backup_devices,
            estimated_latency_ms=estimated_latency,
            estimated_memory_mb=estimated_memory,
            estimated_flops=estimated_flops
        )
    
    def _calculate_attention_capabilities(self) -> Dict[str, Dict[str, any]]:
        """Calculate each device's capability for attention operations"""
        capabilities = {}
        
        for device_id, specs in self.device_specs.items():
            # Base capability score
            memory_score = specs.available_vram_gb if specs.available_vram_gb > 0 else specs.available_ram_gb
            compute_score = specs.matrix_mult_tflops
            
            # Device type adjustments
            if specs.device_type == 'mobile':
                # Mobile devices get smaller allocations
                base_heads = max(1, min(8, int(memory_score * 2)))
                precision = 'int8' if memory_score < 4 else 'fp16'
            elif specs.device_type == 'desktop':
                # Desktop devices get larger allocations
                base_heads = max(4, min(16, int(memory_score * 1.5)))
                precision = 'fp16' if memory_score >= 8 else 'int8'
            else:  # cloud
                # Cloud devices get the largest allocations
                base_heads = max(8, min(32, int(memory_score)))
                precision = 'fp32' if memory_score >= 16 else 'fp16'
            
            # Memory requirement calculation
            head_dim = self.model_config.hidden_size // self.model_config.num_attention_heads
            memory_per_head = self._calculate_attention_memory_per_head(head_dim, precision)
            memory_required = base_heads * memory_per_head
            
            # Ensure we don't exceed available memory
            max_affordable_heads = int((memory_score * 1024 * self.memory_safety_factor) / memory_per_head)
            optimal_heads = min(base_heads, max_affordable_heads, self.max_heads_per_device)
            optimal_heads = max(optimal_heads, self.min_heads_per_device)
            
            capabilities[device_id] = {
                'optimal_heads': optimal_heads,
                'memory_required': memory_required,
                'precision': precision,
                'score': memory_score * compute_score,
                'max_sequence_length': self._calculate_max_sequence_length(specs, optimal_heads)
            }
        
        return capabilities
    
    def _calculate_mlp_capabilities(self) -> Dict[str, Dict[str, any]]:
        """Calculate each device's capability for MLP operations"""
        capabilities = {}
        
        for device_id, specs in self.device_specs.items():
            memory_score = specs.available_vram_gb if specs.available_vram_gb > 0 else specs.available_ram_gb
            compute_score = specs.matrix_mult_tflops
            
            # Calculate optimal intermediate dimensions
            if specs.device_type == 'mobile':
                base_dims = max(256, min(2048, int(memory_score * 200)))
                precision = 'int8'
            elif specs.device_type == 'desktop':
                base_dims = max(1024, min(4096, int(memory_score * 300)))
                precision = 'fp16'
            else:  # cloud
                base_dims = max(2048, min(8192, int(memory_score * 400)))
                precision = 'fp16'
            
            # Memory requirement calculation
            memory_per_dim = self._calculate_mlp_memory_per_dim(precision)
            memory_required = base_dims * memory_per_dim
            
            # Ensure we don't exceed available memory
            max_affordable_dims = int((memory_score * 1024 * self.memory_safety_factor) / memory_per_dim)
            optimal_dims = min(base_dims, max_affordable_dims)
            optimal_dims = max(optimal_dims, 256)  # Minimum 256 dimensions
            
            capabilities[device_id] = {
                'optimal_intermediate_dims': optimal_dims,
                'memory_required': memory_required,
                'precision': precision,
                'score': memory_score * compute_score
            }
        
        return capabilities
    
    def _calculate_attention_memory_per_head(self, head_dim: int, precision: str) -> float:
        """Calculate memory required per attention head (in MB)"""
        # Memory for Q, K, V matrices + attention scores + output
        bytes_per_param = {'fp32': 4, 'fp16': 2, 'int8': 1, 'int4': 0.5}[precision]
        
        # Q, K, V weights: 3 * hidden_size * head_dim
        qkv_params = 3 * self.model_config.hidden_size * head_dim
        
        # Output projection: head_dim * hidden_size  
        output_params = head_dim * self.model_config.hidden_size
        
        # Attention scores: seq_len * seq_len (temporary)
        seq_len = self.model_config.max_sequence_length
        attention_scores = seq_len * seq_len * 4  # fp32 for numerical stability
        
        total_bytes = (qkv_params + output_params) * bytes_per_param + attention_scores
        return total_bytes / (1024 * 1024)  # Convert to MB
    
    def _calculate_mlp_memory_per_dim(self, precision: str) -> float:
        """Calculate memory required per MLP intermediate dimension (in MB)"""
        bytes_per_param = {'fp32': 4, 'fp16': 2, 'int8': 1, 'int4': 0.5}[precision]
        
        # Up projection: hidden_size * 1 (per intermediate dim)
        # Gate projection: hidden_size * 1 (per intermediate dim)  
        # Down projection: 1 * hidden_size (per intermediate dim)
        params_per_dim = 3 * self.model_config.hidden_size
        
        total_bytes = params_per_dim * bytes_per_param
        return total_bytes / (1024 * 1024)  # Convert to MB
    
    def _calculate_max_sequence_length(self, specs: DeviceSpecs, num_heads: int) -> int:
        """Calculate maximum sequence length a device can handle"""
        available_memory_mb = (specs.available_vram_gb if specs.available_vram_gb > 0 else specs.available_ram_gb) * 1024
        
        # Reserve memory for model weights
        head_dim = self.model_config.hidden_size // self.model_config.num_attention_heads
        model_memory = self._calculate_attention_memory_per_head(head_dim, 'fp16') * num_heads
        
        available_for_activations = (available_memory_mb - model_memory) * self.memory_safety_factor
        
        # Attention activations scale quadratically with sequence length
        # Memory for activations ≈ num_heads * seq_len^2 * 4 bytes (fp32 scores)
        max_seq_len_squared = (available_for_activations * 1024 * 1024) / (num_heads * 4)
        if max_seq_len_squared > 0:
            max_seq_len = int(math.sqrt(max_seq_len_squared))
        else:
            max_seq_len = 512  # Fallback minimum
        
        # Clamp to reasonable bounds
        return max(512, min(max_seq_len, self.model_config.max_sequence_length))
    
    def _estimate_attention_latency(self, assignments: Dict[str, Dict]) -> float:
        """Estimate attention operation latency"""
        if not assignments:
            return float('inf')
        
        # Find the slowest device (bottleneck)
        max_latency = 0
        for device_id, assignment in assignments.items():
            if device_id in self.device_specs:
                specs = self.device_specs[device_id]
                
                # Base computation time (depends on TFLOPS)
                flops_required = assignment['head_count'] * (self.model_config.max_sequence_length ** 2) * self.model_config.hidden_size
                compute_time = flops_required / (specs.matrix_mult_tflops * 10**12) * 1000  # Convert to ms
                
                # Add network communication overhead
                if specs.device_type == 'mobile':
                    network_overhead = 50  # ms
                elif specs.device_type == 'desktop':
                    network_overhead = 10  # ms
                else:
                    network_overhead = 5   # ms
                
                total_latency = compute_time + network_overhead
                max_latency = max(max_latency, total_latency)
        
        return max_latency
    
    def _estimate_mlp_latency(self, assignments: Dict[str, Dict]) -> float:
        """Estimate MLP operation latency"""
        if not assignments:
            return float('inf')
        
        max_latency = 0
        for device_id, assignment in assignments.items():
            if device_id in self.device_specs:
                specs = self.device_specs[device_id]
                
                # MLP computation: 2 matrix multiplications
                flops_required = 2 * self.model_config.hidden_size * assignment['dim_count'] * self.model_config.max_sequence_length
                compute_time = flops_required / (specs.matrix_mult_tflops * 10**12) * 1000
                
                # Network overhead
                network_overhead = 20 if specs.device_type == 'mobile' else 5
                
                total_latency = compute_time + network_overhead
                max_latency = max(max_latency, total_latency)
        
        return max_latency
    
    def _estimate_attention_flops(self, assignments: Dict[str, Dict]) -> int:
        """Estimate FLOPS for attention operation"""
        total_flops = 0
        seq_len = self.model_config.max_sequence_length
        
        for assignment in assignments.values():
            head_count = assignment['head_count']
            head_dim = assignment['head_dim']
            
            # Q@K^T: head_count * seq_len * seq_len * head_dim
            qk_flops = head_count * seq_len * seq_len * head_dim
            
            # Attention@V: head_count * seq_len * seq_len * head_dim  
            av_flops = head_count * seq_len * seq_len * head_dim
            
            # Linear projections: 3 * head_count * seq_len * head_dim * hidden_size
            proj_flops = 3 * head_count * seq_len * head_dim * self.model_config.hidden_size
            
            total_flops += qk_flops + av_flops + proj_flops
        
        return total_flops
    
    def _estimate_mlp_flops(self, assignments: Dict[str, Dict]) -> int:
        """Estimate FLOPS for MLP operation"""
        total_flops = 0
        seq_len = self.model_config.max_sequence_length
        
        for assignment in assignments.values():
            dim_count = assignment['dim_count']
            
            # Up and gate projections: 2 * seq_len * hidden_size * dim_count
            up_gate_flops = 2 * seq_len * self.model_config.hidden_size * dim_count
            
            # Down projection: seq_len * dim_count * hidden_size
            down_flops = seq_len * dim_count * self.model_config.hidden_size
            
            total_flops += up_gate_flops + down_flops
        
        return total_flops
    
    def _print_split_summary(self):
        """Print summary of current tensor splits"""
        if not self.current_splits:
            print("📊 No tensor splits configured")
            return
        
        print(f"\n📊 Tensor Split Summary")
        print(f"{"="*60}")
        
        for split_id, split in self.current_splits.items():
            print(f"\n🔧 {split.operation_type.upper()}: {split_id}")
            print(f"   Coordinator: {split.coordinator_device}")
            print(f"   Estimated Latency: {split.estimated_latency_ms:.1f}ms")
            print(f"   Memory Usage: {split.estimated_memory_mb:.0f}MB")
            print(f"   Device Assignments:")
            
            for device_id, assignment in split.device_assignments.items():
                device_type = self.device_specs[device_id].device_type if device_id in self.device_specs else "unknown"
                
                if split.operation_type == "attention":
                    print(f"     - {device_id} ({device_type}): heads {assignment['head_start']}-{assignment['head_end']} ({assignment['head_count']} heads)")
                else:  # mlp
                    print(f"     - {device_id} ({device_type}): dims {assignment['dim_start']}-{assignment['dim_end']} ({assignment['dim_count']} dims)")
        
        print(f"{"="*60}\n")
    
    def get_allocation_for_device(self, device_id: str) -> Optional[TensorAllocation]:
        """Get tensor allocation recommendations for a specific device"""
        if device_id not in self.device_specs:
            return None
        
        specs = self.device_specs[device_id]
        
        # Aggregate allocation across all splits
        total_attention_heads = 0
        total_mlp_dims = 0
        total_memory_mb = 0
        
        for split in self.current_splits.values():
            if device_id in split.device_assignments:
                assignment = split.device_assignments[device_id]
                
                if split.operation_type == "attention":
                    total_attention_heads += assignment['head_count']
                else:  # mlp
                    total_mlp_dims += assignment['dim_count']
                
                total_memory_mb += assignment['memory_mb']
        
        # Calculate performance estimates
        estimated_latency = max(split.estimated_latency_ms for split in self.current_splits.values() 
                               if device_id in split.device_assignments)
        
        tokens_per_sec = (1000 / estimated_latency) if estimated_latency > 0 else 0
        
        # Determine precision based on device capability
        if specs.device_type == 'mobile':
            precision = 'int8'
        elif specs.available_vram_gb >= 16:
            precision = 'fp16'
        else:
            precision = 'fp16'
        
        return TensorAllocation(
            device_id=device_id,
            attention_heads=total_attention_heads,
            attention_head_dim=self.model_config.hidden_size // self.model_config.num_attention_heads,
            max_sequence_length=self._calculate_max_sequence_length(specs, total_attention_heads),
            mlp_intermediate_size=total_mlp_dims,
            mlp_layers=self.model_config.num_layers,
            model_memory_mb=int(total_memory_mb),
            activation_memory_mb=int(total_memory_mb * 0.3),  # Estimate
            buffer_memory_mb=int(total_memory_mb * 0.1),     # Estimate
            estimated_latency_ms=estimated_latency,
            estimated_throughput_tokens_per_sec=tokens_per_sec,
            precision=precision,
            quantization_method='dynamic' if precision in ['int8', 'int4'] else None
        )

# Test the tensor splitting system
def test_tensor_splitter():
    """Test the adaptive tensor splitter"""
    
    # Create a Llama-70B-like model configuration
    model_config = ModelConfig(
        model_name="llama-70b",
        total_parameters=70_000_000_000,
        hidden_size=8192,
        num_layers=80,
        num_attention_heads=64,
        intermediate_size=28672,
        vocab_size=32000,
        max_sequence_length=4096,
        base_memory_mb=1000,
        memory_per_layer_mb=875,  # 70GB / 80 layers
        memory_per_head_mb=136    # Rough estimate
    )
    
    splitter = AdaptiveTensorSplitter(model_config)
    
    # DeviceSpecs is already imported from exec above
    
    # High-end desktop
    desktop_specs = DeviceSpecs(
        device_id="desktop-rtx4090",
        device_type="desktop",
        total_ram_gb=64, available_ram_gb=48,
        total_vram_gb=24, available_vram_gb=20,
        total_storage_gb=2000, available_storage_gb=1500, storage_type="nvme",
        cpu_cores=16, cpu_frequency_ghz=4.0, cpu_name="Intel i9-13900K",
        gpu_name="RTX 4090", gpu_compute_capability="8.9",
        network_bandwidth_mbps=1000, network_latency_ms=5,
        tensor_ops_per_sec=15000, memory_bandwidth_gbps=150, matrix_mult_tflops=50
    )
    
    # Mid-range mobile
    mobile_specs = DeviceSpecs(
        device_id="iphone-15-pro",
        device_type="mobile",
        total_ram_gb=8, available_ram_gb=6,
        total_vram_gb=0, available_vram_gb=0,
        total_storage_gb=256, available_storage_gb=200, storage_type="nvme",
        cpu_cores=6, cpu_frequency_ghz=3.2, cpu_name="A17 Pro",
        gpu_name="A17 Pro GPU", gpu_compute_capability=None,
        network_bandwidth_mbps=100, network_latency_ms=20,
        tensor_ops_per_sec=5000, memory_bandwidth_gbps=50, matrix_mult_tflops=2
    )
    
    # Budget mobile
    budget_mobile_specs = DeviceSpecs(
        device_id="android-midrange",
        device_type="mobile",
        total_ram_gb=6, available_ram_gb=4,
        total_vram_gb=0, available_vram_gb=0,
        total_storage_gb=128, available_storage_gb=80, storage_type="ssd",
        cpu_cores=8, cpu_frequency_ghz=2.4, cpu_name="Snapdragon 778G",
        gpu_name="Adreno 642L", gpu_compute_capability=None,
        network_bandwidth_mbps=50, network_latency_ms=30,
        tensor_ops_per_sec=2000, memory_bandwidth_gbps=20, matrix_mult_tflops=0.5
    )
    
    # Register devices
    splitter.register_device(desktop_specs)
    splitter.register_device(mobile_specs)
    splitter.register_device(budget_mobile_specs)
    
    # Get allocations for each device
    print("\n🎯 Device-Specific Allocations:")
    print("="*50)
    
    for device_id in [desktop_specs.device_id, mobile_specs.device_id, budget_mobile_specs.device_id]:
        allocation = splitter.get_allocation_for_device(device_id)
        if allocation:
            print(f"\n📱 {device_id}:")
            print(f"   Attention Heads: {allocation.attention_heads}")
            print(f"   MLP Dimensions: {allocation.mlp_intermediate_size}")
            print(f"   Memory Usage: {allocation.model_memory_mb}MB")
            print(f"   Max Sequence: {allocation.max_sequence_length}")
            print(f"   Precision: {allocation.precision}")
            print(f"   Est. Latency: {allocation.estimated_latency_ms:.1f}ms")
            print(f"   Throughput: {allocation.estimated_throughput_tokens_per_sec:.1f} tokens/sec")

if __name__ == "__main__":
    test_tensor_splitter()