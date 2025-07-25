import os
import time
import gc
import torch
from collections import OrderedDict
from typing import Optional, Dict, Any
import threading
import psutil

class ModelCache:
    """
    Thread-safe model cache with LRU eviction and memory management
    """
    
    def __init__(self, max_models: int = 3, max_memory_gb: float = 16.0, 
                 eviction_strategy: str = 'lru'):
        self.max_models = max_models
        self.max_memory_gb = max_memory_gb
        self.eviction_strategy = eviction_strategy
        
        # Thread-safe cache storage
        self._cache = OrderedDict()
        self._cache_lock = threading.RLock()
        self._memory_usage = {}  # Track memory usage per model
        
        # Statistics
        self.stats = {
            'hits': 0,
            'misses': 0,
            'evictions': 0,
            'loads': 0
        }
    
    def get_model(self, model_id: str) -> Optional[Any]:
        """Get model from cache, updating LRU order"""
        with self._cache_lock:
            if model_id in self._cache:
                # Move to end (most recently used)
                model_info = self._cache.pop(model_id)
                self._cache[model_id] = model_info
                self.stats['hits'] += 1
                return model_info['model']
            
            self.stats['misses'] += 1
            return None
    
    def put_model(self, model_id: str, model: Any, model_path: str = None) -> bool:
        """Add model to cache, evicting if necessary"""
        with self._cache_lock:
            # Calculate memory usage of the model
            memory_mb = self._estimate_model_memory(model)
            memory_gb = memory_mb / 1024.0
            
            # Check if model fits in memory constraints
            if memory_gb > self.max_memory_gb:
                return False  # Model too large
            
            # Evict models if necessary
            self._evict_if_needed(memory_gb)
            
            # Store model with metadata
            model_info = {
                'model': model,
                'model_path': model_path,
                'load_time': time.time(),
                'access_count': 0,
                'memory_mb': memory_mb
            }
            
            self._cache[model_id] = model_info
            self._memory_usage[model_id] = memory_gb
            self.stats['loads'] += 1
            
            return True
    
    def remove_model(self, model_id: str) -> bool:
        """Remove specific model from cache"""
        with self._cache_lock:
            if model_id in self._cache:
                model_info = self._cache.pop(model_id)
                self._memory_usage.pop(model_id, 0)
                
                # Clean up GPU memory if applicable
                self._cleanup_model(model_info['model'])
                return True
            return False
    
    def clear(self):
        """Clear entire cache"""
        with self._cache_lock:
            for model_info in self._cache.values():
                self._cleanup_model(model_info['model'])
            
            self._cache.clear()
            self._memory_usage.clear()
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
    
    def get_cache_info(self) -> Dict[str, Any]:
        """Get cache statistics and current state"""
        with self._cache_lock:
            total_memory = sum(self._memory_usage.values())
            
            return {
                'size': len(self._cache),
                'max_size': self.max_models,
                'memory_usage_gb': total_memory,
                'max_memory_gb': self.max_memory_gb,
                'memory_utilization': (total_memory / self.max_memory_gb) * 100,
                'stats': self.stats.copy(),
                'hit_rate': self.stats['hits'] / max(self.stats['hits'] + self.stats['misses'], 1) * 100,
                'models': list(self._cache.keys())
            }
    
    def _evict_if_needed(self, new_model_memory_gb: float):
        """Evict models based on strategy until there's enough space"""
        while (len(self._cache) >= self.max_models or 
               sum(self._memory_usage.values()) + new_model_memory_gb > self.max_memory_gb):
            
            if not self._cache:
                break
            
            if self.eviction_strategy == 'lru':
                # Remove least recently used (first item)
                model_id = next(iter(self._cache))
            elif self.eviction_strategy == 'largest':
                # Remove largest model first
                model_id = max(self._memory_usage, key=self._memory_usage.get)
            else:
                # Default to LRU
                model_id = next(iter(self._cache))
            
            model_info = self._cache.pop(model_id)
            self._memory_usage.pop(model_id)
            self._cleanup_model(model_info['model'])
            self.stats['evictions'] += 1
    
    def _estimate_model_memory(self, model) -> float:
        """Estimate memory usage of a model in MB"""
        try:
            # For vLLM models, try to get memory usage
            if hasattr(model, 'llm_engine'):
                # Estimate based on model parameters (rough approximation)
                # This is a simplified estimation - in practice you'd want more sophisticated methods
                return 1024.0  # Default 1GB estimation
            
            # For PyTorch models
            if hasattr(model, 'parameters'):
                total_params = sum(p.numel() for p in model.parameters())
                # Assume 4 bytes per parameter (float32)
                return (total_params * 4) / (1024 * 1024)
            
            # Fallback estimation based on system memory usage
            process = psutil.Process()
            return process.memory_info().rss / (1024 * 1024)
            
        except Exception:
            # Conservative estimate if we can't determine actual usage
            return 2048.0  # 2GB default
    
    def _cleanup_model(self, model):
        """Clean up model resources"""
        try:
            # For vLLM models
            if hasattr(model, 'llm_engine'):
                # vLLM cleanup would go here if available
                pass
            
            # For PyTorch models
            if hasattr(model, 'cpu'):
                model.cpu()
            
            del model
            gc.collect()
            
            if torch.cuda.is_available():
                torch.cuda.empty_cache()
                
        except Exception as e:
            # Log error but don't fail
            print(f"Warning: Error cleaning up model: {e}")


# Global model cache instance
_global_cache = None
_cache_lock = threading.Lock()

def get_global_cache(**kwargs) -> ModelCache:
    """Get or create global model cache instance"""
    global _global_cache
    
    with _cache_lock:
        if _global_cache is None:
            # Get configuration from environment
            max_models = int(os.getenv('MODEL_CACHE_SIZE', '3'))
            max_memory = float(os.getenv('MODEL_CACHE_MEMORY_GB', '16.0'))
            eviction_strategy = os.getenv('MODEL_CACHE_EVICTION', 'lru')
            
            _global_cache = ModelCache(
                max_models=max_models,
                max_memory_gb=max_memory,
                eviction_strategy=eviction_strategy,
                **kwargs
            )
        
        return _global_cache

def clear_global_cache():
    """Clear the global model cache"""
    global _global_cache
    
    with _cache_lock:
        if _global_cache:
            _global_cache.clear()

# Convenience functions
def cache_model(model_id: str, model: Any, model_path: str = None) -> bool:
    """Cache a model in the global cache"""
    cache = get_global_cache()
    return cache.put_model(model_id, model, model_path)

def get_cached_model(model_id: str) -> Optional[Any]:
    """Get a model from the global cache"""
    cache = get_global_cache()
    return cache.get_model(model_id)

def get_cache_stats() -> Dict[str, Any]:
    """Get global cache statistics"""
    cache = get_global_cache()
    return cache.get_cache_info()