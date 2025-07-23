#!/usr/bin/env python3
"""
Comprehensive pytest test suite for the entire main.py workflow
Tests: Model uploading -> IPFS storage -> MCP integration -> Inference -> Response handling
"""

import pytest
import asyncio
import json
import os
import tempfile
import shutil
from unittest.mock import Mock, AsyncMock, patch, MagicMock
from pathlib import Path
import yaml

# Import the modules we're testing
import sys
sys.path.append(os.path.dirname(__file__))

from mcp_client import MCPEnhancedInference
import main


# MCPClientManager tests removed - class no longer exists in current implementation


class TestMCPEnhancedInference:
    """Test the MCP-enhanced inference engine"""
    
    @pytest.fixture
    def mock_openai_client(self):
        """Mock OpenAI client"""
        with patch('mcp_client.openai.AsyncOpenAI') as mock_client_class:
            mock_client = AsyncMock()
            mock_client_class.return_value = mock_client
            yield mock_client
    
    @pytest.mark.asyncio
    async def test_initialize(self, mock_openai_client):
        """Test inference engine initialization"""
        engine = MCPEnhancedInference()
        # Test basic initialization - no MCP manager in current implementation
        result = await engine.initialize()
        assert result is None
    
    @pytest.mark.asyncio
    async def test_run_inference_basic(self, mock_openai_client):
        """Test basic inference functionality"""
        engine = MCPEnhancedInference()
        
        # Mock standard inference response
        mock_response = Mock()
        mock_choice = Mock()
        mock_message = Mock()
        mock_message.content = "Standard response"
        mock_choice.message = mock_message
        mock_response.choices = [mock_choice]
        
        mock_openai_client.chat.completions.create.return_value = mock_response
        
        # Test basic inference without tools
        with patch.object(engine, 'client', mock_openai_client):
            result = await engine.run_inference("Test prompt")
            assert result == "Standard response"


class TestMainWorkflow:
    """Test the main.py workflow components"""
    
    @pytest.fixture
    def mock_config(self):
        """Mock configuration"""
        return {
            'eth_node': 'http://localhost:8545',
            'contract_address': '0x1234567890123456789012345678901234567890',
            'default_account': '0x1234567890123456789012345678901234567890',
            'private_key': '0x1234567890123456789012345678901234567890123456789012345678901234',
            'min_free_ram': 1000000000,
            'min_free_vram': 1000000000,
            'max_cpu': 80,
            'ray_port': 10001,
            'enable_mcp': True,
            'vllm_base_url': 'http://localhost:8000/v1',
            'model_name': 'test-model',
            'temperature': 0.7,
            'top_p': 0.9,
            'max_tokens': 512
        }
    
    @pytest.fixture
    def temp_model_dir(self):
        """Create a temporary model directory"""
        temp_dir = tempfile.mkdtemp()
        
        # Create mock model files
        config_path = os.path.join(temp_dir, 'config.json')
        with open(config_path, 'w') as f:
            json.dump({"model_type": "test"}, f)
        
        weights_path = os.path.join(temp_dir, 'model.safetensors')
        with open(weights_path, 'w') as f:
            f.write("mock weights")
        
        yield temp_dir
        shutil.rmtree(temp_dir)
    
    def test_validate_model_format_valid(self, temp_model_dir):
        """Test model format validation with valid model"""
        assert main.validate_model_format(temp_model_dir) is True
    
    def test_validate_model_format_invalid(self):
        """Test model format validation with invalid model"""
        with tempfile.TemporaryDirectory() as temp_dir:
            # Create directory without required files
            assert main.validate_model_format(temp_dir) is False
    
    def test_validate_model_format_not_directory(self):
        """Test model format validation with non-directory"""
        with tempfile.NamedTemporaryFile() as temp_file:
            assert main.validate_model_format(temp_file.name) is False
    
    @patch('main.get_ipfs_client')
    def test_upload_response_to_ipfs_success(self, mock_get_ipfs):
        """Test successful response upload to IPFS"""
        mock_client = Mock()
        mock_client.add_json.return_value = "QmTestCID123"
        mock_get_ipfs.return_value = mock_client
        
        with patch('main.w3') as mock_w3:
            mock_w3.eth.defaultAccount = "0x123"
            
            result = main.upload_response_to_ipfs("Test response", 123)
            
            assert result == "QmTestCID123"
            mock_client.add_json.assert_called_once()
    
    @patch('main.get_ipfs_client')
    def test_upload_response_to_ipfs_failure(self, mock_get_ipfs):
        """Test failed response upload to IPFS"""
        mock_get_ipfs.return_value = None
        
        result = main.upload_response_to_ipfs("Test response", 123)
        
        assert result is None
    
    @patch('main.subprocess.run')
    def test_start_ray_head(self, mock_run):
        """Test Ray head node startup"""
        with patch('main.cfg', {'ray_port': 10001}):
            main.start_ray_head()
            mock_run.assert_called_once_with(['ray', 'start', '--head', '--port=10001'])
    
    @patch('main.subprocess.run')
    def test_join_ray(self, mock_run):
        """Test joining Ray cluster"""
        with patch('main.cfg', {'ray_port': 10001}):
            main.join_ray("192.168.1.100")
            mock_run.assert_called_once_with(['ray', 'start', '--address', '192.168.1.100:10001'])
    
    @patch('main.ipfshttpclient.connect')
    def test_get_ipfs_client_success(self, mock_connect):
        """Test successful IPFS client connection"""
        mock_client = Mock()
        mock_connect.return_value = mock_client
        
        result = main.get_ipfs_client()
        
        assert result == mock_client
        mock_connect.assert_called_once_with('/ip4/127.0.0.1/tcp/5001')
    
    @patch('main.ipfshttpclient.connect')
    def test_get_ipfs_client_failure(self, mock_connect):
        """Test failed IPFS client connection"""
        mock_connect.side_effect = Exception("Connection failed")
        
        result = main.get_ipfs_client()
        
        assert result is None
    
    def test_read_prompt_from_file_success(self):
        """Test successful prompt reading"""
        with tempfile.NamedTemporaryFile(mode='w', delete=False) as f:
            f.write("Test prompt content")
            temp_path = f.name
        
        try:
            result = main.read_prompt_from_file(temp_path)
            assert result == "Test prompt content"
        finally:
            os.unlink(temp_path)
    
    def test_read_prompt_from_file_failure(self):
        """Test failed prompt reading"""
        result = main.read_prompt_from_file("/nonexistent/file.txt")
        assert result is None


class TestIntegrationWorkflow:
    """Integration tests for the complete workflow"""
    
    @pytest.fixture
    def mock_environment(self):
        """Setup mock environment for integration tests"""
        with patch('main.cfg') as mock_cfg, \
             patch('main.w3') as mock_w3, \
             patch('main.contract') as mock_contract:
            
            mock_cfg.update({
                'enable_mcp': True,
                'vllm_base_url': 'http://localhost:8000/v1',
                'model_name': 'test-model',
                'mcp_max_iterations': 3
            })
            
            mock_w3.eth.defaultAccount = "0x123"
            
            yield {
                'cfg': mock_cfg,
                'w3': mock_w3,
                'contract': mock_contract
            }
    
    @pytest.mark.asyncio
    async def test_initialize_mcp_inference_engine_success(self, mock_environment):
        """Test successful MCP inference engine initialization"""
        with patch.object(MCPEnhancedInference, 'initialize', new_callable=AsyncMock) as mock_init:
            mock_init.return_value = None
            
            result = await main.initialize_mcp_inference_engine()
            
            assert result is True
            mock_init.assert_called_once()
    
    @pytest.mark.asyncio
    async def test_initialize_mcp_inference_engine_failure(self, mock_environment):
        """Test failed MCP inference engine initialization"""
        with patch.object(MCPEnhancedInference, 'initialize', new_callable=AsyncMock) as mock_init:
            mock_init.side_effect = Exception("Initialization failed")
            
            result = await main.initialize_mcp_inference_engine()
            
            assert result is False
    
    @pytest.mark.asyncio
    async def test_run_mcp_enhanced_inference_success(self, mock_environment):
        """Test successful MCP-enhanced inference"""
        # Setup global mcp_inference_engine
        mock_engine = AsyncMock()
        mock_engine.run_inference_with_tools.return_value = "MCP enhanced response"
        
        with patch('main.mcp_inference_engine', mock_engine):
            result = await main.run_mcp_enhanced_inference("Test prompt", 123)
            
            assert result == "MCP enhanced response"
            mock_engine.run_inference_with_tools.assert_called_once_with("Test prompt", 3)
    
    @pytest.mark.asyncio
    async def test_run_mcp_enhanced_inference_fallback(self, mock_environment):
        """Test MCP inference fallback to local inference"""
        with patch('main.mcp_inference_engine', None), \
             patch('main.run_local_inference') as mock_local:
            mock_local.return_value = "Local inference response"
            
            result = await main.run_mcp_enhanced_inference("Test prompt", 123)
            
            assert result == "Local inference response"
            mock_local.assert_called_once_with("Test prompt", 123)
    
    @pytest.mark.asyncio
    async def test_handle_job_async_complete_workflow(self, mock_environment):
        """Test complete job handling workflow"""
        # Mock event
        mock_event = {
            'args': {
                'jobId': 123,
                'promptCID': 'QmPromptCID',
                'modelCID': 'QmModelCID',
                'controller': '0x123'
            }
        }
        
        with patch('main.start_ray_head') as mock_ray, \
             patch('main.fetch_from_ipfs') as mock_fetch, \
             patch('main.read_prompt_from_file') as mock_read, \
             patch('main.validate_model_format') as mock_validate, \
             patch('main.initialize_mcp_inference_engine') as mock_init_mcp, \
             patch('main.load_local_model') as mock_load, \
             patch('main.run_mcp_enhanced_inference') as mock_mcp_inference, \
             patch('main.upload_response_to_ipfs') as mock_upload, \
             patch('main.submit_response_to_contract') as mock_submit, \
             patch('main.unload_model') as mock_unload, \
             patch('main.subprocess.run') as mock_subprocess, \
             patch('main.Thread'):
            
            # Setup mocks
            mock_fetch.return_value = True
            mock_read.return_value = "Test prompt"
            mock_validate.return_value = True
            mock_init_mcp.return_value = True
            mock_load.return_value = True
            mock_mcp_inference.return_value = "Test response"
            mock_upload.return_value = "QmResponseCID"
            mock_submit.return_value = "0xTxHash"
            
            # Run the workflow
            await main.handle_job_async(mock_event)
            
            # Verify the workflow steps
            mock_ray.assert_called_once()
            assert mock_fetch.call_count == 2  # model and prompt
            mock_read.assert_called_once()
            mock_validate.assert_called_once()
            mock_init_mcp.assert_called_once()
            mock_load.assert_called_once()
            mock_mcp_inference.assert_called_once()
            mock_upload.assert_called_once()
            mock_submit.assert_called_once()
            mock_unload.assert_called_once()


class TestSampleMCPServer:
    """Test a sample MCP server for integration testing"""
    
    @pytest.fixture
    def sample_server_script(self):
        """Create a sample MCP server script"""
        server_code = '''#!/usr/bin/env python3
import asyncio
import json
from mcp.server import Server
from mcp.server.stdio import stdio_server
from mcp.types import Tool, TextContent

app = Server("test-server")

@app.list_tools()
async def list_tools():
    return [
        Tool(
            name="echo",
            description="Echo the input text",
            inputSchema={
                "type": "object",
                "properties": {
                    "text": {"type": "string", "description": "Text to echo"}
                },
                "required": ["text"]
            }
        )
    ]

@app.call_tool()
async def call_tool(name: str, arguments: dict):
    if name == "echo":
        text = arguments.get("text", "")
        return [TextContent(type="text", text=f"Echo: {text}")]
    return [TextContent(type="text", text="Unknown tool")]

async def main():
    async with stdio_server() as (read_stream, write_stream):
        await app.run(read_stream, write_stream, app.create_initialization_options())

if __name__ == "__main__":
    asyncio.run(main())
'''
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.py', delete=False) as f:
            f.write(server_code)
            yield f.name
        
        os.unlink(f.name)
    
    @pytest.mark.asyncio
    async def test_mcp_client_with_sample_server(self, sample_server_script):
        """Test MCP client with a real sample server"""
        # This test is skipped as MCPClientManager no longer exists in current implementation
        pytest.skip("MCPClientManager no longer exists in current implementation")


# Pytest configuration
@pytest.fixture(scope="session")
def event_loop():
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


if __name__ == "__main__":
    # Run tests with coverage
    pytest.main([
        __file__,
        "-v",
        "--cov=main",
        "--cov=mcp_client",
        "--cov-report=html",
        "--cov-report=term-missing"
    ])