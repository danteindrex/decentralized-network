import json
import logging
import sys
import time
from datetime import datetime
from typing import Any, Dict, Optional
import traceback
import os

class StructuredLogger:
    """
    Structured logger that outputs JSON formatted logs for better parsing and monitoring
    """
    
    def __init__(self, name: str, level: str = "INFO", output_file: Optional[str] = None):
        self.name = name
        self.logger = logging.getLogger(name)
        self.logger.setLevel(getattr(logging, level.upper()))
        
        # Remove existing handlers
        for handler in self.logger.handlers[:]:
            self.logger.removeHandler(handler)
        
        # Create formatter
        formatter = StructuredFormatter()
        
        # Console handler
        console_handler = logging.StreamHandler(sys.stdout)
        console_handler.setFormatter(formatter)
        self.logger.addHandler(console_handler)
        
        # File handler if specified
        if output_file:
            file_handler = logging.FileHandler(output_file)
            file_handler.setFormatter(formatter)
            self.logger.addHandler(file_handler)
    
    def _log(self, level: str, message: str, **kwargs):
        """Internal logging method with structured data"""
        extra_data = {
            'service': self.name,
            'timestamp': datetime.utcnow().isoformat(),
            'pid': os.getpid(),
            **kwargs
        }
        
        # Get calling function info
        frame = sys._getframe(2)
        extra_data.update({
            'file': os.path.basename(frame.f_code.co_filename),
            'function': frame.f_code.co_name,
            'line': frame.f_lineno
        })
        
        record = self.logger.makeRecord(
            name=self.logger.name,
            level=getattr(logging, level.upper()),
            fn=frame.f_code.co_filename,
            lno=frame.f_lineno,
            msg=message,
            args=(),
            exc_info=None
        )
        
        # Add structured data to record
        record.structured_data = extra_data
        self.logger.handle(record)
    
    def info(self, message: str, **kwargs):
        """Log info level message"""
        self._log("INFO", message, **kwargs)
    
    def warn(self, message: str, **kwargs):
        """Log warning level message"""
        self._log("WARNING", message, **kwargs)
    
    def warning(self, message: str, **kwargs):
        """Alias for warn"""
        self.warn(message, **kwargs)
    
    def error(self, message: str, error: Optional[Exception] = None, **kwargs):
        """Log error level message with optional exception details"""
        if error:
            kwargs.update({
                'error_type': type(error).__name__,
                'error_message': str(error),
                'traceback': traceback.format_exc()
            })
        self._log("ERROR", message, **kwargs)
    
    def debug(self, message: str, **kwargs):
        """Log debug level message"""
        self._log("DEBUG", message, **kwargs)
    
    def critical(self, message: str, **kwargs):
        """Log critical level message"""
        self._log("CRITICAL", message, **kwargs)
    
    def job_started(self, job_id: str, **kwargs):
        """Log job start event"""
        self.info("Job started", job_id=job_id, event_type="job_started", **kwargs)
    
    def job_completed(self, job_id: str, duration: float, **kwargs):
        """Log job completion event"""
        self.info("Job completed", job_id=job_id, duration_seconds=duration, 
                 event_type="job_completed", **kwargs)
    
    def job_failed(self, job_id: str, error: Exception, **kwargs):
        """Log job failure event"""
        self.error("Job failed", job_id=job_id, error=error, 
                  event_type="job_failed", **kwargs)
    
    def model_loaded(self, model_path: str, load_time: float, **kwargs):
        """Log model loading event"""
        self.info("Model loaded", model_path=model_path, load_time_seconds=load_time,
                 event_type="model_loaded", **kwargs)
    
    def blockchain_interaction(self, action: str, success: bool, **kwargs):
        """Log blockchain interaction"""
        level = "info" if success else "error"
        self._log(level.upper(), f"Blockchain {action}", action=action, success=success,
                 event_type="blockchain_interaction", **kwargs)
    
    def resource_usage(self, cpu_percent: float, ram_gb: float, **kwargs):
        """Log resource usage metrics"""
        self.info("Resource usage", cpu_percent=cpu_percent, ram_gb=ram_gb,
                 event_type="resource_usage", **kwargs)


class StructuredFormatter(logging.Formatter):
    """Custom formatter that outputs structured JSON logs"""
    
    def format(self, record):
        # Base log data
        log_data = {
            'timestamp': datetime.utcnow().isoformat(),
            'level': record.levelname,
            'message': record.getMessage(),
            'logger': record.name
        }
        
        # Add structured data if available
        if hasattr(record, 'structured_data'):
            log_data.update(record.structured_data)
        
        return json.dumps(log_data, default=str)


class CircuitBreaker:
    """
    Circuit breaker pattern implementation for external service calls
    """
    
    def __init__(self, failure_threshold: int = 5, recovery_timeout: int = 60, 
                 expected_exceptions: tuple = (Exception,)):
        self.failure_threshold = failure_threshold
        self.recovery_timeout = recovery_timeout
        self.expected_exceptions = expected_exceptions
        
        self.failure_count = 0
        self.last_failure_time = None
        self.state = 'closed'  # closed, open, half-open
        self.logger = StructuredLogger("circuit_breaker")
    
    def __call__(self, func):
        """Decorator to wrap functions with circuit breaker"""
        def wrapper(*args, **kwargs):
            return self.call(func, *args, **kwargs)
        return wrapper
    
    def call(self, func, *args, **kwargs):
        """Execute function with circuit breaker protection"""
        if self.state == 'open':
            if self._should_attempt_reset():
                self.state = 'half-open'
                self.logger.info("Circuit breaker attempting reset", 
                               function=func.__name__, state=self.state)
            else:
                raise Exception(f"Circuit breaker is open for {func.__name__}")
        
        try:
            result = func(*args, **kwargs)
            self._on_success(func.__name__)
            return result
        except self.expected_exceptions as e:
            self._on_failure(func.__name__, e)
            raise
    
    def _should_attempt_reset(self):
        """Check if we should attempt to reset the circuit breaker"""
        return (self.last_failure_time and 
                time.time() - self.last_failure_time >= self.recovery_timeout)
    
    def _on_success(self, func_name: str):
        """Handle successful function call"""
        if self.state == 'half-open':
            self.state = 'closed'
            self.failure_count = 0
            self.logger.info("Circuit breaker reset", function=func_name, state=self.state)
    
    def _on_failure(self, func_name: str, error: Exception):
        """Handle failed function call"""
        self.failure_count += 1
        self.last_failure_time = time.time()
        
        if self.failure_count >= self.failure_threshold:
            self.state = 'open'
            self.logger.error("Circuit breaker opened", function=func_name, 
                            failure_count=self.failure_count, error=error)


class RetryHandler:
    """
    Retry handler with exponential backoff
    """
    
    def __init__(self, max_retries: int = 3, base_delay: float = 1.0, 
                 max_delay: float = 60.0, backoff_factor: float = 2.0):
        self.max_retries = max_retries
        self.base_delay = base_delay
        self.max_delay = max_delay
        self.backoff_factor = backoff_factor
        self.logger = StructuredLogger("retry_handler")
    
    def __call__(self, func):
        """Decorator to add retry logic to functions"""
        def wrapper(*args, **kwargs):
            return self.retry(func, *args, **kwargs)
        return wrapper
    
    def retry(self, func, *args, **kwargs):
        """Execute function with retry logic"""
        last_exception = None
        
        for attempt in range(self.max_retries + 1):
            try:
                result = func(*args, **kwargs)
                if attempt > 0:
                    self.logger.info("Function succeeded after retry", 
                                   function=func.__name__, attempt=attempt)
                return result
            except Exception as e:
                last_exception = e
                
                if attempt < self.max_retries:
                    delay = min(self.base_delay * (self.backoff_factor ** attempt), 
                              self.max_delay)
                    
                    self.logger.warning("Function failed, retrying", 
                                      function=func.__name__, attempt=attempt + 1,
                                      delay_seconds=delay, error=str(e))
                    
                    time.sleep(delay)
                else:
                    self.logger.error("Function failed after all retries", 
                                    function=func.__name__, total_attempts=attempt + 1,
                                    error=e)
        
        raise last_exception


# Convenience functions for common patterns
def create_logger(service_name: str, level: str = "INFO", log_file: Optional[str] = None) -> StructuredLogger:
    """Create a structured logger instance"""
    return StructuredLogger(service_name, level, log_file)

def with_circuit_breaker(failure_threshold: int = 5, recovery_timeout: int = 60):
    """Decorator factory for circuit breaker"""
    return CircuitBreaker(failure_threshold, recovery_timeout)

def with_retry(max_retries: int = 3, base_delay: float = 1.0):
    """Decorator factory for retry logic"""
    return RetryHandler(max_retries, base_delay)

# Global logger instances for common use
blockchain_logger = create_logger("blockchain")
ipfs_logger = create_logger("ipfs")
inference_logger = create_logger("inference")
resource_logger = create_logger("resource_manager")