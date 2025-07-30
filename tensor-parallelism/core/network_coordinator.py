#!/usr/bin/env python3
"""
Real-Time Network Coordinator
Manages dynamic tensor parallelism across the decentralized network
"""

import asyncio
import json
import time
from typing import Dict, List, Any, Optional, Set
from dataclasses import dataclass, asdict
from concurrent.futures import ThreadPoolExecutor
import websockets
import uuid
import sys
import os

# Add parent directory to path for imports
sys.path.append(os.path.join(os.path.dirname(__file__), '..'))

# Import required components
exec(open(os.path.join(os.path.dirname(__file__), '..', 'device-assessment', 'capability_assessor.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'core', 'tensor_splitter.py')).read())
exec(open(os.path.join(os.path.dirname(__file__), '..', 'models', 'blockchain_model_registry.py')).read())

@dataclass
class InferenceJob:
    """Represents a distributed inference job"""
    job_id: str
    model_id: str
    user_address: str
    prompt: str
    max_tokens: int
    temperature: float
    
    # Job state
    status: str  # 'pending', 'processing', 'completed', 'failed'
    created_at: float
    started_at: Optional[float] = None
    completed_at: Optional[float] = None
    
    # Assigned resources
    assigned_devices: List[str] = None
    coordinator_device: str = None
    
    # Results
    generated_text: Optional[str] = None
    total_tokens: int = 0
    processing_time_ms: float = 0.0
    
    # Performance metrics
    device_latencies: Dict[str, float] = None
    network_overhead_ms: float = 0.0

@dataclass
class DeviceRegistration:
    """Device registration with network coordinator"""
    device_id: str
    device_specs: DeviceSpecs
    websocket_url: str
    last_heartbeat: float
    status: str  # 'online', 'busy', 'offline', 'error'
    
    # Current assignments
    assigned_models: Set[str] = None
    current_jobs: List[str] = None
    
    # Performance tracking
    completed_jobs: int = 0
    average_latency_ms: float = 0.0
    success_rate: float = 1.0

class NetworkCoordinator:
    """Coordinates distributed tensor parallelism across the network"""
    
    def __init__(self, blockchain_registry: BlockchainModelRegistry):
        self.blockchain_registry = blockchain_registry
        
        # Device management
        self.registered_devices: Dict[str, DeviceRegistration] = {}
        self.device_websockets: Dict[str, websockets.WebSocketServerProtocol] = {}
        
        # Job management
        self.pending_jobs: List[InferenceJob] = []
        self.active_jobs: Dict[str, InferenceJob] = {}
        self.completed_jobs: List[InferenceJob] = []
        
        # Network state
        self.coordinator_port = 8888
        self.heartbeat_interval = 30  # seconds
        self.job_timeout = 300  # 5 minutes
        
        # Performance optimization
        self.load_balancer = LoadBalancer()
        self.performance_monitor = PerformanceMonitor()
        
        print(f"🌐 Network Coordinator initialized on port {self.coordinator_port}")
    
    async def start(self):
        """Start the network coordinator"""
        print(f"🚀 Starting Network Coordinator...")
        
        # Start WebSocket server for device connections
        server_task = asyncio.create_task(self._start_websocket_server())
        
        # Start background tasks
        heartbeat_task = asyncio.create_task(self._heartbeat_monitor())
        job_processor_task = asyncio.create_task(self._job_processor())
        performance_task = asyncio.create_task(self._performance_monitor())
        
        # Connect to blockchain events
        blockchain_task = asyncio.create_task(self._monitor_blockchain_events())
        
        print(f"✅ Network Coordinator started")
        
        # Run all tasks
        await asyncio.gather(
            server_task,
            heartbeat_task,
            job_processor_task,
            performance_task,
            blockchain_task
        )
    
    async def _start_websocket_server(self):
        """Start WebSocket server for device connections"""
        async def handle_device_connection(websocket, path):
            device_id = None
            try:
                print(f"🔗 New device connection from {websocket.remote_address}")
                
                async for message in websocket:
                    await self._handle_device_message(websocket, message)
                    
            except websockets.exceptions.ConnectionClosed:
                if device_id:
                    await self._handle_device_disconnection(device_id)
                    print(f"❌ Device {device_id} disconnected")
            except Exception as e:
                print(f"❌ Device connection error: {e}")
        
        print(f"🌐 Starting WebSocket server on port {self.coordinator_port}")
        await websockets.serve(handle_device_connection, "localhost", self.coordinator_port)
    
    async def _handle_device_message(self, websocket, message: str):
        """Handle messages from devices"""
        try:
            data = json.loads(message)
            message_type = data.get('type')
            
            if message_type == 'device_registration':
                await self._handle_device_registration(websocket, data)
            elif message_type == 'heartbeat':
                await self._handle_heartbeat(data)
            elif message_type == 'job_result':
                await self._handle_job_result(data)
            elif message_type == 'job_error':
                await self._handle_job_error(data)
            elif message_type == 'status_update':
                await self._handle_status_update(data)
            else:
                print(f"⚠️ Unknown message type: {message_type}")
                
        except json.JSONDecodeError:
            print(f"❌ Invalid JSON message from device")
        except Exception as e:
            print(f"❌ Error handling device message: {e}")
    
    async def _handle_device_registration(self, websocket, data: Dict):
        """Handle device registration"""
        try:
            device_id = data['device_id']
            device_specs_data = data['device_specs']
            websocket_url = data.get('websocket_url', f"ws://localhost:{self.coordinator_port}")
            
            # Create DeviceSpecs object
            device_specs = DeviceSpecs(**device_specs_data)
            
            # Create device registration
            registration = DeviceRegistration(
                device_id=device_id,
                device_specs=device_specs,
                websocket_url=websocket_url,
                last_heartbeat=time.time(),
                status='online',
                assigned_models=set(),
                current_jobs=[]
            )
            
            # Register device
            self.registered_devices[device_id] = registration
            self.device_websockets[device_id] = websocket
            
            print(f"📝 Device registered: {device_id} ({device_specs.device_type})")
            
            # Update all model splitters with new device
            await self._update_model_splitters_with_device(device_specs)
            
            # Send registration confirmation
            confirmation = {
                'type': 'registration_confirmed',
                'device_id': device_id,
                'coordinator_info': {
                    'total_devices': len(self.registered_devices),
                    'available_models': list(self.blockchain_registry.registered_models.keys())
                }
            }
            await websocket.send(json.dumps(confirmation))
            
        except Exception as e:
            print(f"❌ Device registration error: {e}")
            error_response = {
                'type': 'registration_error',
                'error': str(e)
            }
            await websocket.send(json.dumps(error_response))
    
    async def _handle_device_disconnection(self, device_id: str):
        """Handle device disconnection"""
        if device_id in self.registered_devices:
            registration = self.registered_devices[device_id]
            registration.status = 'offline'
            
            # Remove from websocket tracking
            if device_id in self.device_websockets:
                del self.device_websockets[device_id]
            
            # Reassign any active jobs
            await self._reassign_device_jobs(device_id)
            
            # Update model splitters
            await self._remove_device_from_splitters(device_id)
            
            print(f"🔌 Device {device_id} marked offline")
    
    async def _handle_heartbeat(self, data: Dict):
        """Handle device heartbeat"""
        device_id = data['device_id']
        
        if device_id in self.registered_devices:
            registration = self.registered_devices[device_id]
            registration.last_heartbeat = time.time()
            registration.status = data.get('status', 'online')
            
            # Update device metrics if provided
            if 'metrics' in data:
                metrics = data['metrics']
                registration.average_latency_ms = metrics.get('average_latency_ms', registration.average_latency_ms)
                registration.success_rate = metrics.get('success_rate', registration.success_rate)
    
    async def _handle_job_result(self, data: Dict):
        """Handle job completion from device"""
        job_id = data['job_id']
        device_id = data['device_id']
        
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            
            # Update job with results
            job.generated_text = data.get('generated_text', '')
            job.total_tokens = data.get('total_tokens', 0)
            job.processing_time_ms = data.get('processing_time_ms', 0.0)
            job.status = 'completed'
            job.completed_at = time.time()
            
            # Update device performance
            if device_id in self.registered_devices:
                registration = self.registered_devices[device_id]
                registration.completed_jobs += 1
                
                # Update average latency
                old_avg = registration.average_latency_ms
                new_latency = job.processing_time_ms
                registration.average_latency_ms = (old_avg + new_latency) / 2
            
            # Move job to completed
            self.completed_jobs.append(job)
            del self.active_jobs[job_id]
            
            print(f"✅ Job {job_id} completed by {device_id} in {job.processing_time_ms:.1f}ms")
    
    async def _handle_job_error(self, data: Dict):
        """Handle job error from device"""
        job_id = data['job_id']
        device_id = data['device_id']
        error_message = data.get('error', 'Unknown error')
        
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            job.status = 'failed'
            job.completed_at = time.time()
            
            print(f"❌ Job {job_id} failed on {device_id}: {error_message}")
            
            # Try to reassign to another device
            await self._reassign_job(job)
    
    async def _handle_status_update(self, data: Dict):
        """Handle device status updates"""
        device_id = data['device_id']
        new_status = data['status']
        
        if device_id in self.registered_devices:
            registration = self.registered_devices[device_id]
            old_status = registration.status
            registration.status = new_status
            
            print(f"📊 Device {device_id} status: {old_status} → {new_status}")
    
    async def _update_model_splitters_with_device(self, device_specs: DeviceSpecs):
        """Update all model splitters with new device"""
        for model_id, splitter in self.blockchain_registry.active_splitters.items():
            splitter.register_device(device_specs)
            
        print(f"🔄 Updated {len(self.blockchain_registry.active_splitters)} model splitters")
    
    async def _remove_device_from_splitters(self, device_id: str):
        """Remove device from all model splitters"""
        for splitter in self.blockchain_registry.active_splitters.values():
            splitter.remove_device(device_id)
    
    async def _heartbeat_monitor(self):
        """Monitor device heartbeats and mark offline devices"""
        while True:
            try:
                current_time = time.time()
                offline_devices = []
                
                for device_id, registration in self.registered_devices.items():
                    if current_time - registration.last_heartbeat > self.heartbeat_interval * 2:
                        if registration.status != 'offline':
                            offline_devices.append(device_id)
                
                # Mark offline devices and clean up
                for device_id in offline_devices:
                    await self._handle_device_disconnection(device_id)
                
                await asyncio.sleep(self.heartbeat_interval)
                
            except Exception as e:
                print(f"❌ Heartbeat monitor error: {e}")
                await asyncio.sleep(10)
    
    async def _job_processor(self):
        """Process pending inference jobs"""
        while True:
            try:
                if self.pending_jobs:
                    job = self.pending_jobs.pop(0)
                    await self._assign_and_execute_job(job)
                
                await asyncio.sleep(1)  # Check every second
                
            except Exception as e:
                print(f"❌ Job processor error: {e}")
                await asyncio.sleep(5)
    
    async def _assign_and_execute_job(self, job: InferenceJob):
        """Assign job to optimal devices and execute"""
        try:
            # Get model splitter
            splitter = self.blockchain_registry.get_model_splitter(job.model_id)
            if not splitter:
                print(f"❌ No splitter found for model {job.model_id}")
                job.status = 'failed'
                return
            
            # Find optimal device assignment
            device_assignment = await self._find_optimal_assignment(job, splitter)
            if not device_assignment:
                print(f"❌ No devices available for job {job.job_id}")
                job.status = 'failed'
                return
            
            # Assign job to devices
            job.assigned_devices = device_assignment['devices']
            job.coordinator_device = device_assignment['coordinator']
            job.status = 'processing'
            job.started_at = time.time()
            
            # Move to active jobs
            self.active_jobs[job.job_id] = job
            
            # Send job to coordinator device
            await self._send_job_to_coordinator(job, device_assignment)
            
            print(f"🚀 Job {job.job_id} assigned to {len(job.assigned_devices)} devices")
            
        except Exception as e:
            print(f"❌ Job assignment error: {e}")
            job.status = 'failed'
    
    async def _find_optimal_assignment(self, job: InferenceJob, splitter: AdaptiveTensorSplitter) -> Optional[Dict]:
        """Find optimal device assignment for a job"""
        try:
            # Get available devices
            available_devices = []
            for device_id, registration in self.registered_devices.items():
                if (registration.status == 'online' and 
                    len(registration.current_jobs) < 3 and  # Max 3 concurrent jobs per device
                    device_id in splitter.device_specs):
                    available_devices.append(device_id)
            
            if not available_devices:
                return None
            
            # Use load balancer to find optimal assignment
            assignment = self.load_balancer.find_optimal_assignment(
                available_devices,
                splitter.current_splits,
                self.registered_devices
            )
            
            return assignment
            
        except Exception as e:
            print(f"❌ Assignment error: {e}")
            return None
    
    async def _send_job_to_coordinator(self, job: InferenceJob, assignment: Dict):
        """Send job to coordinator device"""
        coordinator_id = job.coordinator_device
        
        if coordinator_id not in self.device_websockets:
            print(f"❌ Coordinator device {coordinator_id} not connected")
            return
        
        websocket = self.device_websockets[coordinator_id]
        
        job_message = {
            'type': 'inference_job',
            'job_id': job.job_id,
            'model_id': job.model_id,
            'prompt': job.prompt,
            'max_tokens': job.max_tokens,
            'temperature': job.temperature,
            'device_assignment': assignment,
            'tensor_splits': {split_id: asdict(split) for split_id, split in assignment['tensor_splits'].items()}
        }
        
        try:
            await websocket.send(json.dumps(job_message))
            
            # Update device current jobs
            for device_id in job.assigned_devices:
                if device_id in self.registered_devices:
                    self.registered_devices[device_id].current_jobs.append(job.job_id)
                    
        except Exception as e:
            print(f"❌ Failed to send job to coordinator: {e}")
            job.status = 'failed'
    
    async def _reassign_job(self, job: InferenceJob):
        """Reassign failed job to different devices"""
        try:
            # Move back to pending for reassignment
            job.status = 'pending'
            job.assigned_devices = None
            job.coordinator_device = None
            self.pending_jobs.append(job)
            
            print(f"🔄 Job {job.job_id} queued for reassignment")
            
        except Exception as e:
            print(f"❌ Job reassignment error: {e}")
    
    async def _reassign_device_jobs(self, device_id: str):
        """Reassign all jobs from a disconnected device"""
        jobs_to_reassign = []
        
        for job in self.active_jobs.values():
            if device_id in (job.assigned_devices or []) or job.coordinator_device == device_id:
                jobs_to_reassign.append(job)
        
        for job in jobs_to_reassign:
            await self._reassign_job(job)
            del self.active_jobs[job.job_id]
    
    async def _performance_monitor(self):
        """Monitor and optimize network performance"""
        while True:
            try:
                # Collect performance metrics
                metrics = await self._collect_performance_metrics()
                
                # Store metrics
                self.performance_monitor.add_metrics(metrics)
                
                # Trigger optimization if needed
                if self.performance_monitor.should_optimize(metrics):
                    await self._optimize_network_performance()
                
                await asyncio.sleep(60)  # Monitor every minute
                
            except Exception as e:
                print(f"❌ Performance monitor error: {e}")
                await asyncio.sleep(30)
    
    async def _collect_performance_metrics(self) -> Dict[str, Any]:
        """Collect network performance metrics"""
        metrics = {
            'timestamp': time.time(),
            'total_devices': len(self.registered_devices),
            'online_devices': len([r for r in self.registered_devices.values() if r.status == 'online']),
            'active_jobs': len(self.active_jobs),
            'pending_jobs': len(self.pending_jobs),
            'completed_jobs_last_hour': len([j for j in self.completed_jobs if time.time() - j.completed_at < 3600]),
            'average_job_latency': 0.0,
            'device_utilization': {}
        }
        
        # Calculate average job latency
        recent_jobs = [j for j in self.completed_jobs if j.completed_at and time.time() - j.completed_at < 3600]
        if recent_jobs:
            total_latency = sum(j.processing_time_ms for j in recent_jobs)
            metrics['average_job_latency'] = total_latency / len(recent_jobs)
        
        # Calculate device utilization
        for device_id, registration in self.registered_devices.items():
            utilization = len(registration.current_jobs) / 3.0  # Max 3 jobs per device
            metrics['device_utilization'][device_id] = min(utilization, 1.0)
        
        return metrics
    
    async def _optimize_network_performance(self):
        """Optimize network performance"""
        print(f"🎯 Optimizing network performance...")
        
        # Rebalance model splitters
        await self.blockchain_registry._rebalance_all_models()
        
        print(f"✅ Network optimization complete")
    
    async def _monitor_blockchain_events(self):
        """Monitor blockchain for new models and network changes"""
        # Connect to blockchain registry events
        self.blockchain_registry.add_model_uploaded_callback(self._on_model_uploaded)
        self.blockchain_registry.add_model_updated_callback(self._on_model_updated)
        
        # Start blockchain monitoring
        await self.blockchain_registry.start_monitoring()
    
    async def _on_model_uploaded(self, model_metadata: ModelMetadata):
        """Handle new model upload"""
        print(f"🎉 New model available for inference: {model_metadata.model_name}")
        
        # Notify all connected devices about new model
        notification = {
            'type': 'new_model_available',
            'model_id': model_metadata.model_id,
            'model_name': model_metadata.model_name,
            'architecture': model_metadata.architecture,
            'parameters': model_metadata.total_parameters
        }
        
        # Send to all connected devices
        for device_id, websocket in self.device_websockets.items():
            try:
                await websocket.send(json.dumps(notification))
            except Exception as e:
                print(f"⚠️ Failed to notify device {device_id}: {e}")
    
    async def _on_model_updated(self, model_metadata: ModelMetadata):
        """Handle model update"""
        print(f"🔄 Model updated: {model_metadata.model_name}")
        
        # Reassign any active jobs using this model
        jobs_to_reassign = [job for job in self.active_jobs.values() if job.model_id == model_metadata.model_id]
        
        for job in jobs_to_reassign:
            await self._reassign_job(job)
            del self.active_jobs[job.job_id]
    
    # Public API methods
    
    async def submit_inference_job(self, model_id: str, user_address: str, prompt: str, 
                                  max_tokens: int = 100, temperature: float = 0.7) -> str:
        """Submit new inference job"""
        job_id = str(uuid.uuid4())
        
        job = InferenceJob(
            job_id=job_id,
            model_id=model_id,
            user_address=user_address,
            prompt=prompt,
            max_tokens=max_tokens,
            temperature=temperature,
            status='pending',
            created_at=time.time(),
            device_latencies={}
        )
        
        self.pending_jobs.append(job)
        
        print(f"📝 Inference job submitted: {job_id}")
        return job_id
    
    def get_job_status(self, job_id: str) -> Optional[Dict[str, Any]]:
        """Get status of inference job"""
        # Check active jobs
        if job_id in self.active_jobs:
            job = self.active_jobs[job_id]
            return asdict(job)
        
        # Check completed jobs
        for job in self.completed_jobs:
            if job.job_id == job_id:
                return asdict(job)
        
        # Check pending jobs
        for job in self.pending_jobs:
            if job.job_id == job_id:
                return asdict(job)
        
        return None
    
    def get_network_status(self) -> Dict[str, Any]:
        """Get current network status"""
        return {
            'total_devices': len(self.registered_devices),
            'online_devices': len([r for r in self.registered_devices.values() if r.status == 'online']),
            'device_types': {
                device_type: len([r for r in self.registered_devices.values() if r.device_specs.device_type == device_type])
                for device_type in ['desktop', 'mobile', 'cloud']
            },
            'active_jobs': len(self.active_jobs),
            'pending_jobs': len(self.pending_jobs),
            'available_models': len(self.blockchain_registry.registered_models)
        }

class LoadBalancer:
    """Optimizes device assignment for jobs"""
    
    def find_optimal_assignment(self, available_devices: List[str], tensor_splits: Dict, 
                               device_registrations: Dict[str, DeviceRegistration]) -> Dict:
        """Find optimal device assignment"""
        # Simple assignment for now - more sophisticated algorithms could be added
        coordinator = available_devices[0]  # Most capable device as coordinator
        
        return {
            'devices': available_devices,
            'coordinator': coordinator,
            'tensor_splits': tensor_splits
        }

class PerformanceMonitor:
    """Monitors and analyzes network performance"""
    
    def __init__(self):
        self.metrics_history = []
        self.optimization_threshold = 0.8  # Optimize when utilization > 80%
    
    def add_metrics(self, metrics: Dict[str, Any]):
        """Add performance metrics"""
        self.metrics_history.append(metrics)
        
        # Keep only last 24 hours of metrics
        cutoff_time = time.time() - 86400
        self.metrics_history = [m for m in self.metrics_history if m['timestamp'] > cutoff_time]
    
    def should_optimize(self, current_metrics: Dict[str, Any]) -> bool:
        """Determine if optimization is needed"""
        if not current_metrics.get('device_utilization'):
            return False
        
        avg_utilization = sum(current_metrics['device_utilization'].values()) / len(current_metrics['device_utilization'])
        return avg_utilization > self.optimization_threshold

# Testing function
async def test_network_coordinator():
    """Test the network coordinator"""
    
    # Create mock blockchain registry
    contract_abi = []  # Simplified for test
    registry = BlockchainModelRegistry(
        web3_provider="http://localhost:8545",
        contract_address="0x537e697c7AB75A26f9ECF0Ce810e3154dFcaaf44",
        contract_abi=contract_abi
    )
    
    # Create network coordinator
    coordinator = NetworkCoordinator(registry)
    
    print("🚀 Network Coordinator Test Started")
    print("   WebSocket server running on port 8888")
    print("   Connect devices and submit jobs to test")
    print("   Press Ctrl+C to stop")
    
    try:
        await coordinator.start()
    except KeyboardInterrupt:
        print("\n🛑 Test stopped by user")

if __name__ == "__main__":
    asyncio.run(test_network_coordinator())