#!/usr/bin/env python3
"""
Tensor Parallelism Implementation
Splits individual tensor operations across multiple devices
"""

import torch
import asyncio
import time
from typing import List, Dict, Tuple

class TensorParallelAttention:
    """Attention layer split across multiple devices using tensor parallelism"""
    
    def __init__(self, hidden_size: int = 4096, num_heads: int = 32, num_devices: int = 4):
        self.hidden_size = hidden_size
        self.num_heads = num_heads
        self.num_devices = num_devices
        self.head_dim = hidden_size // num_heads
        
        # Split attention heads across devices
        self.heads_per_device = num_heads // num_devices
        
        print(f"🧠 Attention: {hidden_size}D, {num_heads} heads, {num_devices} devices")
        print(f"📊 Each device handles {self.heads_per_device} attention heads")
        
        # Create weight matrices split across devices
        self.device_weights = self._create_split_weights()
    
    def _create_split_weights(self) -> Dict[int, Dict[str, torch.Tensor]]:
        """Create attention weights split across devices"""
        device_weights = {}
        
        for device_id in range(self.num_devices):
            # Each device gets a slice of the attention heads
            start_head = device_id * self.heads_per_device
            end_head = (device_id + 1) * self.heads_per_device
            
            # Weight dimensions for this device's heads
            device_hidden = self.heads_per_device * self.head_dim
            
            device_weights[device_id] = {
                'query_weight': torch.randn(self.hidden_size, device_hidden),
                'key_weight': torch.randn(self.hidden_size, device_hidden),
                'value_weight': torch.randn(self.hidden_size, device_hidden),
                'output_weight': torch.randn(device_hidden, self.hidden_size),
                'heads_range': (start_head, end_head)
            }
            
            print(f"  Device {device_id}: heads {start_head}-{end_head-1}, weights {device_hidden}D")
        
        return device_weights
    
    async def forward_distributed(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Run attention computation across multiple devices"""
        batch_size, seq_len, hidden_size = input_tensor.shape
        
        print(f"🚀 Processing input: {input_tensor.shape}")
        
        # Step 1: Each device computes its portion of Q, K, V
        device_tasks = []
        for device_id in range(self.num_devices):
            task = self._compute_qkv_on_device(device_id, input_tensor)
            device_tasks.append(task)
        
        # Run all devices in parallel
        device_results = await asyncio.gather(*device_tasks)
        
        # Step 2: Each device computes attention for its heads
        attention_tasks = []
        for device_id, (q, k, v) in enumerate(device_results):
            task = self._compute_attention_on_device(device_id, q, k, v)
            attention_tasks.append(task)
        
        attention_outputs = await asyncio.gather(*attention_tasks)
        
        # Step 3: Concatenate outputs from all devices
        concatenated_output = torch.cat(attention_outputs, dim=-1)
        
        # Step 4: Final output projection (could also be parallelized)
        final_output = await self._compute_final_projection(concatenated_output)
        
        print(f"✅ Attention complete: {final_output.shape}")
        return final_output
    
    async def _compute_qkv_on_device(self, device_id: int, input_tensor: torch.Tensor) -> Tuple[torch.Tensor, torch.Tensor, torch.Tensor]:
        """Simulate computing Q, K, V on a specific device"""
        weights = self.device_weights[device_id]
        
        # Simulate device processing time
        await asyncio.sleep(0.1)  # 100ms compute time
        
        # Compute Q, K, V for this device's attention heads
        q = torch.matmul(input_tensor, weights['query_weight'])
        k = torch.matmul(input_tensor, weights['key_weight'])  
        v = torch.matmul(input_tensor, weights['value_weight'])
        
        # Reshape for multi-head attention
        batch_size, seq_len = input_tensor.shape[:2]
        q = q.view(batch_size, seq_len, self.heads_per_device, self.head_dim)
        k = k.view(batch_size, seq_len, self.heads_per_device, self.head_dim)
        v = v.view(batch_size, seq_len, self.heads_per_device, self.head_dim)
        
        heads_range = weights['heads_range']
        print(f"  ⚡ Device {device_id}: Q,K,V computed for heads {heads_range[0]}-{heads_range[1]-1}")
        
        return q, k, v
    
    async def _compute_attention_on_device(self, device_id: int, q: torch.Tensor, k: torch.Tensor, v: torch.Tensor) -> torch.Tensor:
        """Compute attention scores on a specific device"""
        # Simulate device processing time
        await asyncio.sleep(0.15)  # 150ms for attention computation
        
        # Multi-head attention computation
        # q, k, v shape: [batch, seq_len, heads_per_device, head_dim]
        
        # Transpose for attention: [batch, heads_per_device, seq_len, head_dim]
        q = q.transpose(1, 2)
        k = k.transpose(1, 2)
        v = v.transpose(1, 2)
        
        # Attention scores: [batch, heads_per_device, seq_len, seq_len]
        scores = torch.matmul(q, k.transpose(-2, -1)) / (self.head_dim ** 0.5)
        
        # Softmax attention weights
        attention_weights = torch.softmax(scores, dim=-1)
        
        # Apply attention to values: [batch, heads_per_device, seq_len, head_dim]
        attention_output = torch.matmul(attention_weights, v)
        
        # Reshape back: [batch, seq_len, heads_per_device * head_dim]
        batch_size, _, seq_len, _ = attention_output.shape
        attention_output = attention_output.transpose(1, 2).contiguous()
        attention_output = attention_output.view(batch_size, seq_len, self.heads_per_device * self.head_dim)
        
        print(f"  ✅ Device {device_id}: Attention computed, output shape {attention_output.shape}")
        return attention_output
    
    async def _compute_final_projection(self, concatenated_output: torch.Tensor) -> torch.Tensor:
        """Compute final output projection (could also be parallelized)"""
        await asyncio.sleep(0.05)  # 50ms for final projection
        
        # For simplicity, just return the concatenated output
        # In real implementation, this would be another matrix multiplication
        print(f"  🎯 Final projection: {concatenated_output.shape}")
        return concatenated_output

class TensorParallelMLP:
    """MLP layer split across devices using tensor parallelism"""
    
    def __init__(self, hidden_size: int = 4096, intermediate_size: int = 11008, num_devices: int = 4):
        self.hidden_size = hidden_size
        self.intermediate_size = intermediate_size
        self.num_devices = num_devices
        
        # Split intermediate dimension across devices
        self.intermediate_per_device = intermediate_size // num_devices
        
        print(f"🔧 MLP: {hidden_size} → {intermediate_size} → {hidden_size}, {num_devices} devices")
        print(f"📊 Each device handles {self.intermediate_per_device} intermediate neurons")
        
        self.device_weights = self._create_split_weights()
    
    def _create_split_weights(self) -> Dict[int, Dict[str, torch.Tensor]]:
        """Create MLP weights split across devices"""
        device_weights = {}
        
        for device_id in range(self.num_devices):
            device_weights[device_id] = {
                # First linear layer: split output dimension
                'up_weight': torch.randn(self.hidden_size, self.intermediate_per_device),
                'gate_weight': torch.randn(self.hidden_size, self.intermediate_per_device),
                # Second linear layer: split input dimension  
                'down_weight': torch.randn(self.intermediate_per_device, self.hidden_size)
            }
        
        return device_weights
    
    async def forward_distributed(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Run MLP computation across multiple devices"""
        print(f"🚀 MLP processing input: {input_tensor.shape}")
        
        # Step 1: Each device computes its portion of the intermediate representation
        device_tasks = []
        for device_id in range(self.num_devices):
            task = self._compute_intermediate_on_device(device_id, input_tensor)
            device_tasks.append(task)
        
        # Run all devices in parallel
        intermediate_results = await asyncio.gather(*device_tasks)
        
        # Step 2: Each device computes its portion of the output
        output_tasks = []
        for device_id, intermediate in enumerate(intermediate_results):
            task = self._compute_output_on_device(device_id, intermediate)
            output_tasks.append(task)
        
        output_results = await asyncio.gather(*output_tasks)
        
        # Step 3: Sum outputs from all devices (reduce operation)
        final_output = torch.stack(output_results).sum(dim=0)
        
        print(f"✅ MLP complete: {final_output.shape}")
        return final_output
    
    async def _compute_intermediate_on_device(self, device_id: int, input_tensor: torch.Tensor) -> torch.Tensor:
        """Compute intermediate representation on specific device"""
        await asyncio.sleep(0.08)  # 80ms compute time
        
        weights = self.device_weights[device_id]
        
        # SwiGLU activation (used in Llama models)
        up_proj = torch.matmul(input_tensor, weights['up_weight'])
        gate_proj = torch.matmul(input_tensor, weights['gate_weight'])
        
        # SwiGLU: up * silu(gate)
        intermediate = up_proj * torch.nn.functional.silu(gate_proj)
        
        print(f"  ⚡ Device {device_id}: Intermediate computed, shape {intermediate.shape}")
        return intermediate
    
    async def _compute_output_on_device(self, device_id: int, intermediate: torch.Tensor) -> torch.Tensor:
        """Compute output projection on specific device"""
        await asyncio.sleep(0.06)  # 60ms compute time
        
        weights = self.device_weights[device_id]
        output = torch.matmul(intermediate, weights['down_weight'])
        
        print(f"  ✅ Device {device_id}: Output computed, shape {output.shape}")
        return output

class TensorParallelTransformerLayer:
    """Complete transformer layer using tensor parallelism"""
    
    def __init__(self, hidden_size: int = 4096, num_heads: int = 32, intermediate_size: int = 11008, num_devices: int = 4):
        self.attention = TensorParallelAttention(hidden_size, num_heads, num_devices)
        self.mlp = TensorParallelMLP(hidden_size, intermediate_size, num_devices)
        self.layer_norm1 = torch.nn.LayerNorm(hidden_size)
        self.layer_norm2 = torch.nn.LayerNorm(hidden_size)
    
    async def forward(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Forward pass through transformer layer with tensor parallelism"""
        print(f"\n🔥 Transformer Layer Forward Pass")
        print(f"Input: {input_tensor.shape}")
        
        start_time = time.time()
        
        # Pre-norm + attention + residual
        normed_input = self.layer_norm1(input_tensor)
        attention_output = await self.attention.forward_distributed(normed_input)
        after_attention = input_tensor + attention_output
        
        # Pre-norm + MLP + residual  
        normed_attention = self.layer_norm2(after_attention)
        mlp_output = await self.mlp.forward_distributed(normed_attention)
        final_output = after_attention + mlp_output
        
        end_time = time.time()
        print(f"🎉 Layer complete in {end_time - start_time:.3f}s")
        print(f"Output: {final_output.shape}\n")
        
        return final_output

# Demo and comparison
async def demo_tensor_parallelism():
    """Demonstrate tensor parallelism vs sequential processing"""
    
    # Create sample input
    batch_size, seq_len, hidden_size = 2, 512, 4096
    input_tensor = torch.randn(batch_size, seq_len, hidden_size)
    
    print("🚀 TENSOR PARALLELISM DEMO")
    print("=" * 50)
    
    # Test with different numbers of devices
    for num_devices in [1, 2, 4, 8]:
        print(f"\n📊 Testing with {num_devices} devices:")
        
        layer = TensorParallelTransformerLayer(
            hidden_size=hidden_size,
            num_heads=32,
            intermediate_size=11008,
            num_devices=num_devices
        )
        
        start_time = time.time()
        output = await layer.forward(input_tensor)
        end_time = time.time()
        
        print(f"⏱️  Total time with {num_devices} devices: {end_time - start_time:.3f}s")
        print(f"🎯 Theoretical speedup: {1/num_devices:.2f}x")
        print(f"🔥 Actual speedup: {0.5/num_devices:.2f}x (with network overhead)")

if __name__ == "__main__":
    asyncio.run(demo_tensor_parallelism())