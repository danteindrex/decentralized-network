#!/usr/bin/env python3
"""
Standalone test for MCP client functionality
Tests the consolidated mcp_client.py in both library and standalone modes
"""

import pytest
import asyncio
import tempfile
import os
import subprocess
import sys
from unittest.mock import Mock, AsyncMock, patch
import yaml

# Import the MCP client
from mcp_client import MCPEnhancedInference


class TestStandaloneMode:
    """Test the standalone interactive mode"""
    
    def test_main_with_invalid_args(self, capsys):
        """Test main function with invalid arguments"""
        # Test with no arguments
        sys.argv = ['mcp_client.py']
        main()
        captured = capsys.readouterr()
        assert "MCP Client Usage:" in captured.out
        
        # Test with invalid transport
        sys.argv = ['mcp_client.py', 'invalid', 'target']
        with pytest.raises(SystemExit):
            main()
    
    def test_main_help_message(self, capsys):
        """Test help message display"""
        sys.argv = ['mcp_client.py']
        main()
        captured = capsys.readouterr()
        
        assert "Standalone mode:" in captured.out
        assert "Library test:" in captured.out
        assert "Library import:" in captured.out
    
    @patch('mcp_client.asyncio.run')
    def test_main_standalone_mode(self, mock_run):
        """Test main function in standalone mode"""
        sys.argv = ['mcp_client.py', 'stdio', 'test_server.py']
        
        main()
        
        mock_run.assert_called_once()
    
    @patch('mcp_client.asyncio.run')
    def test_main_test_mode(self, mock_run):
        """Test main function in test mode"""
        sys.argv = ['mcp_client.py', 'test']
        
        main()
        
        mock_run.assert_called_once()


class TestMCPClientConsolidation:
    """Test that the consolidated client works for both use cases"""
    
    @pytest.mark.asyncio
    async def test_single_server_initialization(self):
        """Test single server initialization (standalone mode)"""
        manager = MCPClientManager()
        
        with patch('mcp_client.stdio_client') as mock_stdio, \
             patch('mcp_client.ClientSession') as mock_session_class:
            
            # Setup mocks
            mock_transport = AsyncMock()
            mock_stdio.return_value = mock_transport
            mock_transport.__aenter__.return_value = (Mock(), Mock())
            
            mock_session = AsyncMock()
            mock_session_class.return_value = mock_session
            
            # Mock tools response
            mock_tools_result = Mock()
            mock_tool = Mock()
            mock_tool.name = "test_tool"
            mock_tool.description = "Test tool"
            mock_tool.inputSchema = {"type": "object"}
            mock_tools_result.tools = [mock_tool]
            mock_session.list_tools.return_value = mock_tools_result
            
            await manager.initialize_single_server("stdio", "test_server.py")
            
            # Verify single server mode (no namespace prefix)
            assert "test_tool" in manager.available_tools
            assert manager.available_tools["test_tool"]["server"] == "single"
    
    @pytest.mark.asyncio
    async def test_multi_server_initialization(self):
        """Test multi-server initialization (library mode)"""
        # Create temporary config
        config_data = {
            "mcp_servers": {
                "server1": {
                    "transport": "stdio",
                    "command": "python",
                    "args": ["server1.py"],
                    "enabled": True
                },
                "server2": {
                    "transport": "stdio", 
                    "command": "python",
                    "args": ["server2.py"],
                    "enabled": True
                }
            },
            "mcp_client": {"enabled": True}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            temp_config = f.name
        
        try:
            manager = MCPClientManager(temp_config)
            
            with patch.object(manager, '_connect_server', new_callable=AsyncMock) as mock_connect:
                await manager.initialize()
                
                # Should try to connect to both servers
                assert mock_connect.call_count == 2
                
        finally:
            os.unlink(temp_config)
    
    @pytest.mark.asyncio
    async def test_inference_engine_single_server_mode(self):
        """Test inference engine with single server initialization"""
        with patch('mcp_client.openai.AsyncOpenAI') as mock_openai:
            engine = MCPEnhancedInference()
            
            with patch.object(engine.mcp_manager, 'initialize_single_server', new_callable=AsyncMock) as mock_init:
                await engine.initialize_with_single_server("stdio", "test_server.py")
                
                mock_init.assert_called_once_with("stdio", "test_server.py")
    
    def test_openai_tools_format_single_vs_multi(self):
        """Test OpenAI tools format differs between single and multi-server modes"""
        manager = MCPClientManager()
        
        # Single server mode (no namespace)
        mock_tool = Mock()
        mock_tool.name = "test_tool"
        mock_tool.description = "Test tool"
        mock_tool.inputSchema = {"type": "object"}
        
        manager.available_tools["test_tool"] = {
            "server": "single",
            "tool": mock_tool
        }
        
        tools = manager.get_openai_tools()
        assert len(tools) == 1
        assert tools[0]["function"]["name"] == "test_tool"  # No namespace prefix
        
        # Multi-server mode (with namespace)
        manager.available_tools.clear()
        manager.available_tools["server1.test_tool"] = {
            "server": "server1",
            "tool": mock_tool
        }
        
        tools = manager.get_openai_tools()
        assert len(tools) == 1
        assert tools[0]["function"]["name"] == "server1.test_tool"  # With namespace prefix


class TestErrorHandling:
    """Test error handling in the consolidated client"""
    
    @pytest.mark.asyncio
    async def test_invalid_transport_type(self):
        """Test handling of invalid transport type"""
        manager = MCPClientManager()
        
        with pytest.raises(ValueError, match="Unsupported transport type"):
            await manager.initialize_single_server("invalid", "target")
    
    @pytest.mark.asyncio
    async def test_sse_without_url(self):
        """Test SSE transport without URL in config"""
        config_data = {
            "mcp_servers": {
                "sse_server": {
                    "transport": "sse",
                    # Missing 'url' field
                    "enabled": True
                }
            },
            "mcp_client": {"enabled": True}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            temp_config = f.name
        
        try:
            manager = MCPClientManager(temp_config)
            
            # Should handle the error gracefully
            await manager.initialize()
            
            # No servers should be connected due to the error
            assert len(manager.sessions) == 0
            
        finally:
            os.unlink(temp_config)
    
    @pytest.mark.asyncio
    async def test_tool_execution_error_handling(self):
        """Test error handling during tool execution"""
        manager = MCPClientManager()
        
        # Setup mock session that raises an error
        mock_session = AsyncMock()
        mock_session.call_tool.side_effect = Exception("Tool execution failed")
        
        mock_tool = Mock(name="test_tool")
        
        manager.sessions["test_server"] = {
            "session": mock_session,
            "transport_cm": Mock(),
            "tools": [mock_tool],
            "config": {}
        }
        
        manager.available_tools["test_tool"] = {
            "server": "test_server",
            "tool": mock_tool
        }
        
        with pytest.raises(Exception, match="Tool execution failed"):
            await manager.call_tool("test_tool", {"arg": "value"})


class TestConfigurationHandling:
    """Test configuration loading and validation"""
    
    def test_config_with_environment_variables(self):
        """Test configuration with environment variable expansion"""
        config_data = {
            "mcp_servers": {
                "api_server": {
                    "transport": "stdio",
                    "command": "python",
                    "args": ["api_server.py"],
                    "enabled": True,
                    "env": {
                        "API_KEY": "${TEST_API_KEY}"
                    }
                }
            },
            "mcp_client": {"enabled": True}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            temp_config = f.name
        
        try:
            # Set environment variable
            os.environ["TEST_API_KEY"] = "test_key_value"
            
            manager = MCPClientManager(temp_config)
            
            # Check that environment variable is in the config
            server_config = manager.config["mcp_servers"]["api_server"]
            assert "env" in server_config
            assert server_config["env"]["API_KEY"] == "${TEST_API_KEY}"
            
        finally:
            os.unlink(temp_config)
            if "TEST_API_KEY" in os.environ:
                del os.environ["TEST_API_KEY"]
    
    def test_config_disabled_servers(self):
        """Test that disabled servers are skipped"""
        config_data = {
            "mcp_servers": {
                "enabled_server": {
                    "transport": "stdio",
                    "command": "python",
                    "args": ["enabled.py"],
                    "enabled": True
                },
                "disabled_server": {
                    "transport": "stdio",
                    "command": "python", 
                    "args": ["disabled.py"],
                    "enabled": False
                }
            },
            "mcp_client": {"enabled": True}
        }
        
        with tempfile.NamedTemporaryFile(mode='w', suffix='.yaml', delete=False) as f:
            yaml.dump(config_data, f)
            temp_config = f.name
        
        try:
            manager = MCPClientManager(temp_config)
            
            with patch.object(manager, '_connect_server', new_callable=AsyncMock) as mock_connect:
                asyncio.run(manager.initialize())
                
                # Should only try to connect to enabled server
                mock_connect.assert_called_once()
                call_args = mock_connect.call_args[0]
                assert call_args[0] == "enabled_server"
                
        finally:
            os.unlink(temp_config)


if __name__ == "__main__":
    # Run the standalone tests
    pytest.main([__file__, "-v"])