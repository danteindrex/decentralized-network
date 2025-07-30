#!/usr/bin/env python3
"""
High-Performance Tensor Streaming for Distributed Inference
Handles real-time tensor passing between devices
"""

import asyncio
import websockets
import torch
import numpy as np
import json
import gzip
import pickle
from typing import Dict, Any, Optional
import time

class TensorStreamingProtocol:
    def __init__(self, compression_level: int = 6):
        self.compression_level = compression_level
        self.active_streams = {}
        self.tensor_cache = {}
        
    async def send_tensor(self, websocket, tensor: torch.Tensor, metadata: Dict[str, Any]):
        """Stream tensor to next device in pipeline"""
        start_time = time.time()
        
        # Convert tensor to bytes
        tensor_bytes = self._serialize_tensor(tensor)
        
        # Compress for network efficiency
        compressed_bytes = gzip.compress(tensor_bytes, self.compression_level)
        
        # Create message
        message = {
            'type': 'tensor_data',
            'metadata': metadata,
            'tensor_size': len(tensor_bytes),
            'compressed_size': len(compressed_bytes),
            'shape': list(tensor.shape),
            'dtype': str(tensor.dtype)
        }
        
        # Send metadata first
        await websocket.send(json.dumps(message))
        
        # Send compressed tensor data
        await websocket.send(compressed_bytes)
        
        transfer_time = time.time() - start_time
        compression_ratio = len(compressed_bytes) / len(tensor_bytes)
        
        print(f"📤 Tensor sent: {tensor.shape} in {transfer_time:.3f}s (compression: {compression_ratio:.2f})")
        
    async def receive_tensor(self, websocket) -> tuple[torch.Tensor, Dict[str, Any]]:
        """Receive tensor from previous device in pipeline"""
        # Receive metadata
        metadata_msg = await websocket.recv()
        metadata = json.loads(metadata_msg)
        
        # Receive tensor data
        compressed_bytes = await websocket.recv()
        
        # Decompress
        tensor_bytes = gzip.decompress(compressed_bytes)
        
        # Deserialize tensor
        tensor = self._deserialize_tensor(tensor_bytes, metadata['shape'], metadata['dtype'])
        
        print(f"📥 Tensor received: {tensor.shape}")
        return tensor, metadata['metadata']
    
    def _serialize_tensor(self, tensor: torch.Tensor) -> bytes:
        """Convert tensor to bytes for network transmission"""
        # Move to CPU and convert to numpy for serialization
        np_array = tensor.detach().cpu().numpy()
        return pickle.dumps(np_array)
    
    def _deserialize_tensor(self, data: bytes, shape: list, dtype: str) -> torch.Tensor:
        """Convert bytes back to tensor"""
        np_array = pickle.loads(data)
        tensor = torch.from_numpy(np_array).reshape(shape)
        
        # Convert dtype string back to torch dtype
        if 'float32' in dtype:
            tensor = tensor.float()
        elif 'float16' in dtype:
            tensor = tensor.half()
        elif 'int64' in dtype:
            tensor = tensor.long()
            
        return tensor

class DistributedModelLayer:
    """Represents a model layer running on a specific device"""
    
    def __init__(self, layer_weights_path: str, layer_id: int, device: str = 'cpu'):
        self.layer_id = layer_id
        self.device = device
        self.weights = self._load_layer_weights(layer_weights_path)
        
    def _load_layer_weights(self, weights_path: str):
        """Load specific layer weights from file"""
        # In real implementation: load from safetensors/pytorch file
        # For demo: create random weights
        return {
            'attention_weights': torch.randn(4096, 4096, device=self.device),
            'mlp_weights': torch.randn(4096, 11008, device=self.device),
            'layer_norm_weights': torch.randn(4096, device=self.device)
        }
    
    def forward(self, input_tensor: torch.Tensor) -> torch.Tensor:
        """Process input through this layer"""
        # Move input to device
        x = input_tensor.to(self.device)
        
        # Simplified transformer layer computation
        # 1. Layer norm
        x_norm = torch.layer_norm(x, x.shape[-1:])
        
        # 2. Self-attention (simplified)
        attn_out = torch.matmul(x_norm, self.weights['attention_weights'])
        x = x + attn_out  # Residual connection
        
        # 3. MLP block
        x_norm2 = torch.layer_norm(x, x.shape[-1:])
        mlp_out = torch.relu(torch.matmul(x_norm2, self.weights['mlp_weights']))
        x = x + mlp_out[:, :x.shape[-1]]  # Residual connection + dimension fix
        
        return x

class DeviceWorkerNode:
    """Worker node that processes assigned model layers"""
    
    def __init__(self, node_id: str, assigned_layers: list, port: int = 8765):
        self.node_id = node_id
        self.assigned_layers = assigned_layers
        self.port = port
        self.streaming = TensorStreamingProtocol()
        self.model_layers = {}
        self.next_node_url = None
        
        # Load assigned model layers
        self._load_model_layers()
    
    def _load_model_layers(self):
        """Load the model layers assigned to this device"""
        for layer_id in self.assigned_layers:
            weights_path = f"model_weights/layer_{layer_id}.safetensors"
            self.model_layers[layer_id] = DistributedModelLayer(weights_path, layer_id)
        
        print(f"📚 Loaded layers {self.assigned_layers} on {self.node_id}")
    
    async def start_worker(self):
        """Start WebSocket server to handle inference requests"""
        async def handle_client(websocket, path):
            try:
                async for message in websocket:
                    if isinstance(message, str):
                        # Control message
                        data = json.loads(message)
                        if data['type'] == 'inference_request':
                            await self._process_inference_request(websocket, data)
                    else:
                        # Binary tensor data
                        pass
            except Exception as e:
                print(f"❌ Error in worker {self.node_id}: {e}")
        
        print(f"🚀 Starting worker {self.node_id} on port {self.port}")
        await websockets.serve(handle_client, "localhost", self.port)
    
    async def _process_inference_request(self, websocket, request_data):
        """Process inference through assigned layers"""
        session_id = request_data['session_id']
        
        # Receive input tensor
        input_tensor, metadata = await self.streaming.receive_tensor(websocket)
        
        print(f"⚡ Processing layers {self.assigned_layers} for session {session_id}")
        
        # Process through assigned layers sequentially
        current_tensor = input_tensor
        for layer_id in sorted(self.assigned_layers):
            layer = self.model_layers[layer_id]
            current_tensor = layer.forward(current_tensor)
            print(f"  ✅ Layer {layer_id} complete")
        
        # Send to next node or return result
        if self.next_node_url:
            # Forward to next node in pipeline
            await self._forward_to_next_node(current_tensor, session_id)
        else:
            # This is the final node - send result back
            await self.streaming.send_tensor(websocket, current_tensor, {
                'session_id': session_id,
                'final_result': True
            })
    
    async def _forward_to_next_node(self, tensor: torch.Tensor, session_id: str):
        """Forward tensor to next node in pipeline"""
        try:
            async with websockets.connect(self.next_node_url) as next_websocket:
                await self.streaming.send_tensor(next_websocket, tensor, {
                    'session_id': session_id,
                    'from_node': self.node_id
                })
        except Exception as e:
            print(f"❌ Failed to forward to next node: {e}")

class DistributedInferencePipeline:
    """Coordinates the entire distributed inference pipeline"""
    
    def __init__(self):
        self.worker_nodes = {}
        self.pipeline_order = []
        self.streaming = TensorStreamingProtocol()
        
    def register_worker_node(self, node_id: str, layers: list, websocket_url: str):
        """Register a worker node in the pipeline"""
        self.worker_nodes[node_id] = {
            'layers': layers,
            'url': websocket_url,
            'min_layer': min(layers),
            'max_layer': max(layers)
        }
        
        # Rebuild pipeline order
        self._rebuild_pipeline_order()
    
    def _rebuild_pipeline_order(self):
        """Rebuild the pipeline execution order"""
        # Sort nodes by their minimum layer number
        sorted_nodes = sorted(
            self.worker_nodes.items(),
            key=lambda x: x[1]['min_layer']
        )
        
        self.pipeline_order = [node_id for node_id, _ in sorted_nodes]
        
        # Set next_node_url for each worker
        for i, node_id in enumerate(self.pipeline_order[:-1]):
            next_node_id = self.pipeline_order[i + 1]
            next_url = self.worker_nodes[next_node_id]['url']
            # In real implementation: send this to the worker node
            print(f"🔗 {node_id} → {next_node_id}")
    
    async def run_distributed_inference(self, prompt: str) -> str:
        """Run inference across the distributed pipeline"""
        session_id = f"session_{int(time.time())}"
        
        # Tokenize input
        input_tokens = self._tokenize(prompt)
        input_tensor = torch.tensor(input_tokens, dtype=torch.float32).unsqueeze(0)
        
        print(f"🚀 Starting distributed inference: {prompt}")
        print(f"📊 Pipeline: {' → '.join(self.pipeline_order)}")
        
        # Send to first node in pipeline
        first_node_id = self.pipeline_order[0]
        first_node_url = self.worker_nodes[first_node_id]['url']
        
        try:
            async with websockets.connect(first_node_url) as websocket:
                # Send inference request
                request = {
                    'type': 'inference_request',
                    'session_id': session_id,
                    'prompt': prompt
                }
                await websocket.send(json.dumps(request))
                
                # Send input tensor
                await self.streaming.send_tensor(websocket, input_tensor, {
                    'session_id': session_id,
                    'prompt': prompt
                })
                
                # Wait for final result (from last node)
                result_tensor, metadata = await self.streaming.receive_tensor(websocket)
                
                # Convert back to text
                response = self._detokenize(result_tensor)
                
                print(f"✅ Distributed inference complete!")
                return response
                
        except Exception as e:
            print(f"❌ Distributed inference failed: {e}")
            return f"Error: {e}"
    
    def _tokenize(self, text: str) -> list:
        """Simple tokenization"""
        return [hash(word) % 32000 for word in text.split()][:512]
    
    def _detokenize(self, tensor: torch.Tensor) -> str:
        """Convert tensor back to text"""
        # Simplified detokenization
        tokens = tensor.flatten()[:20].int().tolist()
        return f"Generated response based on {len(tokens)} tokens: " + " ".join([f"word_{t%1000}" for t in tokens])

# Example usage
async def demo_distributed_inference():
    # Create distributed pipeline
    pipeline = DistributedInferencePipeline()
    
    # Register worker nodes (in real scenario, these would be on different machines)
    pipeline.register_worker_node("desktop-1", [0, 1, 2, 3, 4], "ws://localhost:8765")
    pipeline.register_worker_node("mobile-cluster", [5, 6, 7, 8, 9], "ws://localhost:8766")
    pipeline.register_worker_node("desktop-2", [10, 11, 12, 13, 14], "ws://localhost:8767")
    
    # Start worker nodes (in separate processes/machines)
    # This is just a demo - in reality each worker runs on different device
    
    # Run inference
    response = await pipeline.run_distributed_inference("Explain quantum computing")
    print(f"Final Response: {response}")

if __name__ == "__main__":
    asyncio.run(demo_distributed_inference())