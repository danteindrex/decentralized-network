"""
Peer Discovery System for Tensor Parallelism Network
Implements DHT-based peer discovery and WebRTC signaling
"""

import asyncio
import json
import time
import hashlib
import random
import requests
from typing import Dict, List, Optional, Set, Tuple
from datetime import datetime, timedelta
import socket
import threading
from dataclasses import dataclass, asdict
from enum import Enum

class NodeType(Enum):
    BOOTSTRAP = "bootstrap"
    COMPUTE = "compute" 
    MOBILE = "mobile"
    EDGE = "edge"

@dataclass
class PeerInfo:
    peer_id: str
    address: str
    port: int
    node_type: NodeType
    capabilities: Dict
    last_seen: str
    reputation: float = 1.0
    uptime: float = 0.0
    
    def to_dict(self):
        return {
            **asdict(self),
            'node_type': self.node_type.value
        }
    
    @classmethod
    def from_dict(cls, data: Dict):
        data['node_type'] = NodeType(data['node_type'])
        return cls(**data)

class DistributedHashTable:
    """Simple DHT implementation for peer discovery"""
    
    def __init__(self, node_id: str, bootstrap_nodes: List[str] = None):
        self.node_id = node_id
        self.routing_table: Dict[str, PeerInfo] = {}
        self.bootstrap_nodes = bootstrap_nodes or []
        self.k_bucket_size = 20  # Maximum peers per bucket
        self.alpha = 3  # Parallelism parameter
        
    def distance(self, id1: str, id2: str) -> int:
        """Calculate XOR distance between two node IDs"""
        return int(id1, 16) ^ int(id2, 16)
    
    def add_peer(self, peer: PeerInfo):
        """Add a peer to the routing table"""
        if len(self.routing_table) < self.k_bucket_size:
            self.routing_table[peer.peer_id] = peer
            return True
        
        # Replace least recently seen peer if table is full
        oldest_peer_id = min(
            self.routing_table.keys(),
            key=lambda pid: self.routing_table[pid].last_seen
        )
        
        if peer.reputation > self.routing_table[oldest_peer_id].reputation:
            del self.routing_table[oldest_peer_id]
            self.routing_table[peer.peer_id] = peer
            return True
        
        return False
    
    def find_closest_peers(self, target_id: str, count: int = None) -> List[PeerInfo]:
        """Find closest peers to a target ID"""
        if count is None:
            count = self.alpha
            
        peers = list(self.routing_table.values())
        peers.sort(key=lambda p: self.distance(p.peer_id, target_id))
        return peers[:count]
    
    def get_peers_by_capability(self, required_capability: str) -> List[PeerInfo]:
        """Find peers with specific capabilities"""
        return [
            peer for peer in self.routing_table.values()
            if required_capability in peer.capabilities.get('supported_models', [])
            or required_capability in peer.capabilities.get('provider_types', [])
        ]

class WebRTCSignaler:
    """WebRTC signaling for direct peer connections"""
    
    def __init__(self, signaling_server: str):
        self.signaling_server = signaling_server
        self.pending_connections: Dict[str, Dict] = {}
        
    async def create_offer(self, peer_id: str) -> Dict:
        """Create WebRTC offer for peer connection"""
        offer = {
            'type': 'offer',
            'peer_id': self.node_id,
            'target_peer': peer_id,
            'timestamp': datetime.now().isoformat(),
            'sdp': self._generate_mock_sdp('offer')
        }
        
        self.pending_connections[peer_id] = offer
        return offer
    
    async def create_answer(self, offer: Dict) -> Dict:
        """Create WebRTC answer to an offer"""
        answer = {
            'type': 'answer',
            'peer_id': self.node_id,
            'target_peer': offer['peer_id'],
            'timestamp': datetime.now().isoformat(),
            'sdp': self._generate_mock_sdp('answer')
        }
        
        return answer
    
    def _generate_mock_sdp(self, type: str) -> str:
        """Generate mock SDP for demonstration"""
        return f"""v=0
o=- 123456789 987654321 IN IP4 127.0.0.1
s=-
t=0 0
a=group:BUNDLE 0
m=application 9 UDP/DTLS/SCTP webrtc-datachannel
c=IN IP4 0.0.0.0
a=candidate:1 1 UDP 2113667326 192.168.1.100 54400 typ host
a={type}
"""

class PeerDiscoveryService:
    """Main peer discovery service"""
    
    def __init__(self, 
                 node_id: str = None,
                 node_type: NodeType = NodeType.COMPUTE,
                 bootstrap_urls: List[str] = None,
                 capabilities: Dict = None):
        
        self.node_id = node_id or self._generate_node_id()
        self.node_type = node_type
        self.bootstrap_urls = bootstrap_urls or [
            'https://bootstrap-node.onrender.com',
            'wss://bootstrap-node.onrender.com/ws'
        ]
        
        self.capabilities = capabilities or {
            'supported_models': ['llama-7b', 'gpt-j-6b'],
            'provider_types': ['local'],
            'gpu_memory': '16GB',
            'compute_score': 7.5,
            'tensor_parallel_size': 2
        }
        
        # Initialize components
        self.dht = DistributedHashTable(self.node_id)
        self.signaler = WebRTCSignaler(self.bootstrap_urls[0])
        
        # State management
        self.discovered_peers: Dict[str, PeerInfo] = {}
        self.active_connections: Dict[str, Dict] = {}
        self.is_running = False
        self.discovery_interval = 30  # seconds
        
        # Create our own peer info
        self.my_peer_info = PeerInfo(
            peer_id=self.node_id,
            address=self._get_local_ip(),
            port=8080,
            node_type=self.node_type,
            capabilities=self.capabilities,
            last_seen=datetime.now().isoformat(),
            reputation=1.0,
            uptime=0.0
        )
    
    def _generate_node_id(self) -> str:
        """Generate unique node ID"""
        timestamp = str(time.time())
        random_data = str(random.randint(10000, 99999))
        node_data = f"{timestamp}-{random_data}-{socket.gethostname()}"
        return hashlib.sha256(node_data.encode()).hexdigest()[:16]
    
    def _get_local_ip(self) -> str:
        """Get local IP address"""
        try:
            # Connect to a remote address to determine local IP
            with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
                s.connect(("8.8.8.8", 80))
                return s.getsockname()[0]
        except:
            return "127.0.0.1"
    
    async def start_discovery(self):
        """Start the peer discovery process"""
        self.is_running = True
        print(f"🔍 Starting peer discovery for node: {self.node_id}")
        
        # Bootstrap from known nodes
        await self._bootstrap_from_known_nodes()
        
        # Start periodic discovery
        discovery_task = asyncio.create_task(self._periodic_discovery())
        
        # Start heartbeat
        heartbeat_task = asyncio.create_task(self._heartbeat_loop())
        
        # Start cleanup
        cleanup_task = asyncio.create_task(self._cleanup_stale_peers())
        
        return discovery_task, heartbeat_task, cleanup_task
    
    async def _bootstrap_from_known_nodes(self):
        """Bootstrap discovery from known bootstrap nodes"""
        print("🚀 Bootstrapping from known nodes...")
        
        for bootstrap_url in self.bootstrap_urls:
            try:
                if bootstrap_url.startswith('http'):
                    await self._http_bootstrap(bootstrap_url)
                elif bootstrap_url.startswith('ws'):
                    await self._websocket_bootstrap(bootstrap_url)
            except Exception as e:
                print(f"⚠️ Bootstrap failed for {bootstrap_url}: {e}")
                continue
    
    async def _http_bootstrap(self, bootstrap_url: str):
        """Bootstrap via HTTP API"""
        try:
            # Register ourselves
            register_data = {
                'action': 'register',
                'peer_info': self.my_peer_info.to_dict()
            }
            
            response = requests.post(
                f"{bootstrap_url}/api/peers/register",
                json=register_data,
                timeout=10
            )
            
            if response.status_code == 200:
                print(f"✅ Registered with bootstrap node: {bootstrap_url}")
                
                # Get peer list
                peers_response = requests.get(
                    f"{bootstrap_url}/api/peers/list",
                    params={'node_type': 'all', 'limit': 50},
                    timeout=10
                )
                
                if peers_response.status_code == 200:
                    peers_data = peers_response.json()
                    await self._process_discovered_peers(peers_data.get('peers', []))
                    
        except requests.RequestException as e:
            print(f"⚠️ HTTP bootstrap error: {e}")
    
    async def _websocket_bootstrap(self, ws_url: str):
        """Bootstrap via WebSocket (simulated)"""
        # In a real implementation, this would establish WebSocket connection
        print(f"🔌 WebSocket bootstrap simulation for: {ws_url}")
        
        # Simulate receiving peer list
        mock_peers = [
            {
                'peer_id': f'peer_{i:03d}',
                'address': f'192.168.1.{100 + i}',
                'port': 8080 + i,
                'node_type': random.choice(['compute', 'mobile']),
                'capabilities': {
                    'supported_models': random.choice([
                        ['llama-7b'], ['gpt-j-6b'], ['mistral-7b']
                    ]),
                    'provider_types': ['local'],
                    'gpu_memory': random.choice(['16GB', '24GB', '32GB']),
                    'compute_score': random.uniform(5, 9)
                },
                'last_seen': datetime.now().isoformat(),
                'reputation': random.uniform(0.8, 1.0),
                'uptime': random.uniform(0.9, 0.99)
            }
            for i in range(random.randint(3, 8))
        ]
        
        await self._process_discovered_peers(mock_peers)
    
    async def _process_discovered_peers(self, peers_data: List[Dict]):
        """Process discovered peers and add to routing table"""
        for peer_data in peers_data:
            try:
                # Skip ourselves
                if peer_data['peer_id'] == self.node_id:
                    continue
                
                peer = PeerInfo.from_dict(peer_data)
                
                # Add to DHT
                self.dht.add_peer(peer)
                
                # Add to discovered peers
                self.discovered_peers[peer.peer_id] = peer
                
                print(f"📡 Discovered peer: {peer.peer_id} ({peer.node_type.value})")
                
            except Exception as e:
                print(f"⚠️ Error processing peer: {e}")
    
    async def _periodic_discovery(self):
        """Periodically discover new peers"""
        while self.is_running:
            try:
                await asyncio.sleep(self.discovery_interval)
                
                print(f"🔍 Periodic discovery - Known peers: {len(self.discovered_peers)}")
                
                # Perform iterative find_node for random targets
                for _ in range(3):
                    target_id = hashlib.sha256(
                        f"{random.randint(0, 999999)}".encode()
                    ).hexdigest()[:16]
                    
                    await self._find_node(target_id)
                
                # Try to connect to new peers
                await self._attempt_peer_connections()
                
            except Exception as e:
                print(f"⚠️ Periodic discovery error: {e}")
    
    async def _find_node(self, target_id: str):
        """Kademlia-style iterative find_node"""
        closest_peers = self.dht.find_closest_peers(target_id, self.dht.alpha)
        
        for peer in closest_peers:
            try:
                # In real implementation, this would send find_node RPC
                # For now, simulate finding more peers
                if random.random() < 0.3:  # 30% chance of finding new peers
                    await self._simulate_find_node_response(peer.peer_id)
                    
            except Exception as e:
                print(f"⚠️ Find node error for {peer.peer_id}: {e}")
    
    async def _simulate_find_node_response(self, queried_peer: str):
        """Simulate receiving find_node response with new peers"""
        # Generate 1-3 new simulated peers
        for i in range(random.randint(1, 3)):
            mock_peer = PeerInfo(
                peer_id=f"discovered_{random.randint(1000, 9999)}",
                address=f"192.168.{random.randint(1, 254)}.{random.randint(1, 254)}",
                port=8080 + random.randint(0, 1000),
                node_type=random.choice(list(NodeType)),
                capabilities={
                    'supported_models': random.choice([
                        ['llama-7b', 'gpt-j-6b'],
                        ['mistral-7b'],
                        ['bloom-7b']
                    ]),
                    'provider_types': ['local'],
                    'gpu_memory': random.choice(['8GB', '16GB', '24GB']),
                    'compute_score': random.uniform(4, 9)
                },
                last_seen=datetime.now().isoformat(),
                reputation=random.uniform(0.7, 1.0),
                uptime=random.uniform(0.8, 0.99)
            )
            
            if mock_peer.peer_id not in self.discovered_peers:
                self.dht.add_peer(mock_peer)
                self.discovered_peers[mock_peer.peer_id] = mock_peer
                print(f"🆕 Found new peer via {queried_peer}: {mock_peer.peer_id}")
    
    async def _attempt_peer_connections(self):
        """Attempt to establish connections with new peers"""
        unconnected_peers = [
            peer for peer in self.discovered_peers.values()
            if peer.peer_id not in self.active_connections
        ]
        
        # Try to connect to up to 3 new peers
        for peer in unconnected_peers[:3]:
            try:
                success = await self._establish_connection(peer)
                if success:
                    print(f"🔗 Connected to peer: {peer.peer_id}")
                    
            except Exception as e:
                print(f"⚠️ Connection failed to {peer.peer_id}: {e}")
    
    async def _establish_connection(self, peer: PeerInfo) -> bool:
        """Establish WebRTC connection with a peer"""
        try:
            # Create WebRTC offer
            offer = await self.signaler.create_offer(peer.peer_id)
            
            # Simulate sending offer and receiving answer
            # In real implementation, this would go through signaling server
            answer = await self._simulate_webrtc_handshake(offer, peer)
            
            if answer:
                # Store active connection
                self.active_connections[peer.peer_id] = {
                    'peer_info': peer,
                    'connection_time': datetime.now().isoformat(),
                    'status': 'connected',
                    'data_channel': True
                }
                return True
                
        except Exception as e:
            print(f"⚠️ WebRTC connection error: {e}")
        
        return False
    
    async def _simulate_webrtc_handshake(self, offer: Dict, peer: PeerInfo) -> Optional[Dict]:
        """Simulate WebRTC handshake process"""
        # Simulate network delay and success probability
        await asyncio.sleep(random.uniform(0.1, 0.5))
        
        if random.random() < 0.8:  # 80% success rate
            answer = await self.signaler.create_answer(offer)
            return answer
        
        return None
    
    async def _heartbeat_loop(self):
        """Send periodic heartbeats to maintain connections"""
        while self.is_running:
            try:
                await asyncio.sleep(15)  # Heartbeat every 15 seconds
                
                # Update our last_seen
                self.my_peer_info.last_seen = datetime.now().isoformat()
                
                # Send heartbeat to connected peers
                for peer_id, connection in self.active_connections.items():
                    try:
                        # Simulate heartbeat
                        heartbeat = {
                            'type': 'heartbeat',
                            'from': self.node_id,
                            'timestamp': datetime.now().isoformat(),
                            'uptime': time.time()
                        }
                        
                        # In real implementation, send via WebRTC data channel
                        print(f"💓 Heartbeat sent to {peer_id}")
                        
                    except Exception as e:
                        print(f"⚠️ Heartbeat failed for {peer_id}: {e}")
                        # Mark connection as stale
                        connection['status'] = 'stale'
                
            except Exception as e:
                print(f"⚠️ Heartbeat loop error: {e}")
    
    async def _cleanup_stale_peers(self):
        """Remove stale peers and connections"""
        while self.is_running:
            try:
                await asyncio.sleep(60)  # Cleanup every minute
                
                current_time = datetime.now()
                stale_threshold = timedelta(minutes=5)
                
                # Remove stale peers
                stale_peers = []
                for peer_id, peer in self.discovered_peers.items():
                    last_seen = datetime.fromisoformat(peer.last_seen)
                    if current_time - last_seen > stale_threshold:
                        stale_peers.append(peer_id)
                
                for peer_id in stale_peers:
                    del self.discovered_peers[peer_id]
                    if peer_id in self.dht.routing_table:
                        del self.dht.routing_table[peer_id]
                    if peer_id in self.active_connections:
                        del self.active_connections[peer_id]
                    print(f"🧹 Removed stale peer: {peer_id}")
                
            except Exception as e:
                print(f"⚠️ Cleanup error: {e}")
    
    # Public API methods
    
    def get_discovered_peers(self) -> List[PeerInfo]:
        """Get all discovered peers"""
        return list(self.discovered_peers.values())
    
    def get_active_connections(self) -> List[PeerInfo]:
        """Get peers with active connections"""
        return [
            self.discovered_peers[peer_id]
            for peer_id in self.active_connections.keys()
            if peer_id in self.discovered_peers
        ]
    
    def find_peers_by_capability(self, capability: str) -> List[PeerInfo]:
        """Find peers with specific capabilities"""
        return self.dht.get_peers_by_capability(capability)
    
    def get_network_stats(self) -> Dict:
        """Get network statistics"""
        return {
            'node_id': self.node_id,
            'node_type': self.node_type.value,
            'discovered_peers': len(self.discovered_peers),
            'active_connections': len(self.active_connections),
            'dht_size': len(self.dht.routing_table),
            'uptime': time.time(),
            'capabilities': self.capabilities
        }
    
    async def stop_discovery(self):
        """Stop the discovery service"""
        self.is_running = False
        print(f"🛑 Stopping peer discovery for node: {self.node_id}")

# Example usage and testing
async def main():
    """Example peer discovery usage"""
    
    # Create multiple nodes to simulate network
    nodes = []
    
    for i in range(3):
        node_type = random.choice(list(NodeType))
        capabilities = {
            'supported_models': random.choice([
                ['llama-7b'], ['gpt-j-6b'], ['mistral-7b']
            ]),
            'provider_types': ['local'],
            'gpu_memory': random.choice(['16GB', '24GB', '32GB']),
            'compute_score': random.uniform(5, 9)
        }
        
        discovery = PeerDiscoveryService(
            node_type=node_type,
            capabilities=capabilities
        )
        
        nodes.append(discovery)
    
    # Start discovery for all nodes
    tasks = []
    for node in nodes:
        discovery_tasks = await node.start_discovery()
        tasks.extend(discovery_tasks)
    
    # Let them discover each other
    print("\n🔍 Letting nodes discover each other...")
    await asyncio.sleep(10)
    
    # Print network stats for each node
    for i, node in enumerate(nodes):
        stats = node.get_network_stats()
        peers = node.get_discovered_peers()
        connections = node.get_active_connections()
        
        print(f"\n📊 Node {i+1} ({node.node_id}):")
        print(f"  Type: {stats['node_type']}")
        print(f"  Discovered peers: {len(peers)}")
        print(f"  Active connections: {len(connections)}")
        
        for peer in peers[:3]:  # Show first 3 peers
            print(f"    - {peer.peer_id} ({peer.node_type.value})")
    
    # Cleanup
    for node in nodes:
        await node.stop_discovery()
    
    # Cancel tasks
    for task in tasks:
        task.cancel()

if __name__ == "__main__":
    asyncio.run(main())