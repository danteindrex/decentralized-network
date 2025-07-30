"""
Integration module for blockchain-based IPFS model storage
Connects the Python orchestrator with the Node.js model storage system
"""

import os
import json
import subprocess
import tempfile
import asyncio
from pathlib import Path
from typing import Dict, List, Optional, Tuple
import logging

logger = logging.getLogger(__name__)

class BlockchainModelStorage:
    """Python interface for the blockchain-based IPFS model storage system"""
    
    def __init__(self, config_path: Optional[str] = None):
        self.config_path = config_path or os.path.join(
            os.path.dirname(__file__), 
            '../ipfs/model-storage/config.json'
        )
        self.cli_path = os.path.join(
            os.path.dirname(__file__), 
            '../ipfs/model-storage/cli.js'
        )
        self.temp_dir = tempfile.mkdtemp(prefix='model_storage_')
        
        # Ensure CLI is executable
        if os.path.exists(self.cli_path):
            os.chmod(self.cli_path, 0o755)
    
    def _run_cli_command(self, command: List[str]) -> Dict:
        """Run a CLI command and return the result"""
        try:
            # Set environment variables for configuration
            env = os.environ.copy()
            if os.path.exists(self.config_path):
                env['CONFIG_PATH'] = self.config_path
            
            # Run the command
            result = subprocess.run(
                ['node', self.cli_path] + command,
                capture_output=True,
                text=True,
                env=env,
                cwd=os.path.dirname(self.cli_path)
            )
            
            if result.returncode != 0:
                raise Exception(f"CLI command failed: {result.stderr}")
            
            return {
                'success': True,
                'stdout': result.stdout,
                'stderr': result.stderr
            }
            
        except Exception as e:
            logger.error(f"CLI command failed: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def store_model(self, model_path: str, model_id: str, name: str = None, description: str = None) -> Dict:
        """
        Store a model using the blockchain IPFS storage system
        
        Args:
            model_path: Path to the model file or directory
            model_id: Unique identifier for the model
            name: Human-readable model name
            description: Model description
            
        Returns:
            Dictionary with storage results including CIDs and transaction hash
        """
        try:
            logger.info(f"Storing model {model_id} from {model_path}")
            
            # Prepare command
            command = ['store', model_path, model_id]
            
            if name:
                command.extend(['--name', name])
            if description:
                command.extend(['--description', description])
            
            # Add output file for JSON result
            result_file = os.path.join(self.temp_dir, f'{model_id}_store_result.json')
            command.extend(['--output', result_file])
            
            # Run the command
            cli_result = self._run_cli_command(command)
            
            if not cli_result['success']:
                raise Exception(f"Storage failed: {cli_result.get('error', 'Unknown error')}")
            
            # Read the detailed result from file
            if os.path.exists(result_file):
                with open(result_file, 'r') as f:
                    detailed_result = json.load(f)
                os.unlink(result_file)  # Cleanup
                return detailed_result
            else:
                # Parse from stdout if no file was created
                return {
                    'success': True,
                    'modelId': model_id,
                    'output': cli_result['stdout']
                }
                
        except Exception as e:
            logger.error(f"Error storing model {model_id}: {e}")
            raise
    
    def retrieve_model(self, model_id: str, output_path: str, extract: bool = True) -> Dict:
        """
        Retrieve a model from the blockchain IPFS storage system
        
        Args:
            model_id: Model identifier
            output_path: Where to save the retrieved model
            extract: Whether to extract if it's an archive
            
        Returns:
            Dictionary with retrieval results
        """
        try:
            logger.info(f"Retrieving model {model_id} to {output_path}")
            
            # Prepare command
            command = ['retrieve', model_id, output_path]
            
            if extract:
                command.append('--extract')
            
            # Run the command
            cli_result = self._run_cli_command(command)
            
            if not cli_result['success']:
                raise Exception(f"Retrieval failed: {cli_result.get('error', 'Unknown error')}")
            
            return {
                'success': True,
                'modelId': model_id,
                'outputPath': output_path,
                'output': cli_result['stdout']
            }
            
        except Exception as e:
            logger.error(f"Error retrieving model {model_id}: {e}")
            raise
    
    def list_models(self) -> List[Dict]:
        """
        List all models in the storage system
        
        Returns:
            List of model information dictionaries
        """
        try:
            logger.info("Listing all models")
            
            # Prepare command with output file
            result_file = os.path.join(self.temp_dir, 'models_list.json')
            command = ['list', '--output', result_file]
            
            # Run the command
            cli_result = self._run_cli_command(command)
            
            if not cli_result['success']:
                raise Exception(f"List failed: {cli_result.get('error', 'Unknown error')}")
            
            # Read the result from file
            if os.path.exists(result_file):
                with open(result_file, 'r') as f:
                    models = json.load(f)
                os.unlink(result_file)  # Cleanup
                return models
            else:
                return []
                
        except Exception as e:
            logger.error(f"Error listing models: {e}")
            raise
    
    def verify_model(self, model_id: str) -> Dict:
        """
        Verify model integrity
        
        Args:
            model_id: Model identifier
            
        Returns:
            Dictionary with verification results
        """
        try:
            logger.info(f"Verifying model {model_id}")
            
            # Prepare command with output file
            result_file = os.path.join(self.temp_dir, f'{model_id}_verify_result.json')
            command = ['verify', model_id, '--output', result_file]
            
            # Run the command
            cli_result = self._run_cli_command(command)
            
            if not cli_result['success']:
                raise Exception(f"Verification failed: {cli_result.get('error', 'Unknown error')}")
            
            # Read the detailed result from file
            if os.path.exists(result_file):
                with open(result_file, 'r') as f:
                    verify_result = json.load(f)
                os.unlink(result_file)  # Cleanup
                return verify_result
            else:
                return {
                    'success': True,
                    'modelId': model_id,
                    'output': cli_result['stdout']
                }
                
        except Exception as e:
            logger.error(f"Error verifying model {model_id}: {e}")
            raise
    
    def get_model_info(self, model_id: str, include_chunks: bool = False) -> Dict:
        """
        Get detailed model information
        
        Args:
            model_id: Model identifier
            include_chunks: Whether to include chunk details
            
        Returns:
            Dictionary with model information
        """
        try:
            logger.info(f"Getting info for model {model_id}")
            
            # Prepare command with output file
            result_file = os.path.join(self.temp_dir, f'{model_id}_info.json')
            command = ['info', model_id, '--output', result_file]
            
            if include_chunks:
                command.append('--chunks')
            
            # Run the command
            cli_result = self._run_cli_command(command)
            
            if not cli_result['success']:
                raise Exception(f"Info retrieval failed: {cli_result.get('error', 'Unknown error')}")
            
            # Read the detailed result from file
            if os.path.exists(result_file):
                with open(result_file, 'r') as f:
                    info_result = json.load(f)
                os.unlink(result_file)  # Cleanup
                return info_result
            else:
                return {
                    'success': True,
                    'modelId': model_id,
                    'output': cli_result['stdout']
                }
                
        except Exception as e:
            logger.error(f"Error getting model info {model_id}: {e}")
            raise
    
    def get_model_cid(self, model_id: str) -> str:
        """
        Get the manifest CID for a model
        
        Args:
            model_id: Model identifier
            
        Returns:
            Manifest CID string
        """
        try:
            info = self.get_model_info(model_id)
            return info.get('manifestCID', '')
        except Exception as e:
            logger.error(f"Error getting CID for model {model_id}: {e}")
            raise
    
    def cleanup(self):
        """Clean up temporary files"""
        try:
            import shutil
            if os.path.exists(self.temp_dir):
                shutil.rmtree(self.temp_dir)
        except Exception as e:
            logger.warning(f"Error cleaning up temp directory: {e}")


# Integration functions for the main orchestrator
def setup_model_storage(config: Dict) -> BlockchainModelStorage:
    """
    Setup the blockchain model storage system
    
    Args:
        config: Configuration dictionary
        
    Returns:
        Configured BlockchainModelStorage instance
    """
    # Create config file for the Node.js CLI
    storage_config = {
        "ipfs": {
            "host": config.get('ipfs_host', 'localhost'),
            "port": config.get('ipfs_port', 5001),
            "protocol": config.get('ipfs_protocol', 'http')
        },
        "blockchain": {
            "rpcUrl": config.get('eth_node', 'https://bootstrap-node.onrender.com/rpc'),
            "privateKey": config.get('private_key'),
            "contractAddress": config.get('chunked_model_registry_address')
        },
        "storage": {
            "chunkSize": config.get('chunk_size', 1024 * 1024),
            "tempDir": config.get('temp_dir', './temp')
        }
    }
    
    # Write config file
    config_path = os.path.join(
        os.path.dirname(__file__), 
        '../ipfs/model-storage/config.json'
    )
    
    os.makedirs(os.path.dirname(config_path), exist_ok=True)
    with open(config_path, 'w') as f:
        json.dump(storage_config, f, indent=2)
    
    return BlockchainModelStorage(config_path)


async def store_model_async(storage: BlockchainModelStorage, model_path: str, model_id: str, **kwargs) -> Dict:
    """Async wrapper for model storage"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, storage.store_model, model_path, model_id, **kwargs)


async def retrieve_model_async(storage: BlockchainModelStorage, model_id: str, output_path: str, **kwargs) -> Dict:
    """Async wrapper for model retrieval"""
    loop = asyncio.get_event_loop()
    return await loop.run_in_executor(None, storage.retrieve_model, model_id, output_path, **kwargs)


# Example usage and testing
if __name__ == "__main__":
    import sys
    
    # Simple test configuration
    test_config = {
        'ipfs_host': 'localhost',
        'ipfs_port': 5001,
        'eth_node': 'https://bootstrap-node.onrender.com/rpc',
        'private_key': os.getenv('PRIVATE_KEY'),
        'chunked_model_registry_address': os.getenv('CONTRACT_ADDRESS')
    }
    
    try:
        # Setup storage
        storage = setup_model_storage(test_config)
        
        if len(sys.argv) > 1:
            command = sys.argv[1]
            
            if command == 'list':
                models = storage.list_models()
                print(f"Found {len(models)} models:")
                for model in models:
                    print(f"  - {model['modelId']}: {model['name']}")
            
            elif command == 'store' and len(sys.argv) > 3:
                model_path = sys.argv[2]
                model_id = sys.argv[3]
                result = storage.store_model(model_path, model_id)
                print(f"Stored model {model_id}: {result['manifestCID']}")
            
            elif command == 'retrieve' and len(sys.argv) > 3:
                model_id = sys.argv[2]
                output_path = sys.argv[3]
                result = storage.retrieve_model(model_id, output_path)
                print(f"Retrieved model {model_id} to {output_path}")
            
            else:
                print("Usage: python model_storage_integration.py [list|store <path> <id>|retrieve <id> <path>]")
        else:
            print("Model storage integration module loaded successfully")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'storage' in locals():
            storage.cleanup()