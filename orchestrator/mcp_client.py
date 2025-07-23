"""
MCP-Enhanced Inference Client
Integrates Model Context Protocol tools with vLLM inference
"""

import asyncio
import json
import logging
import re
from typing import Dict, List, Optional, Any
import httpx
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

logger = logging.getLogger(__name__)

class MCPEnhancedInference:
    """Enhanced inference engine with MCP tool support"""
    
    def __init__(self, vllm_base_url: str = "http://localhost:8000/v1", model_name: str = "default"):
        self.vllm_base_url = vllm_base_url
        self.model_name = model_name
        self.mcp_sessions: Dict[str, ClientSession] = {}
        self.available_tools: Dict[str, Dict] = {}
        self.http_client = httpx.AsyncClient(timeout=300.0)
        
    async def initialize(self):
        """Initialize MCP connections and discover available tools"""
        try:
            # Load MCP configuration
            mcp_config = self._load_mcp_config()
            
            # Connect to MCP servers
            for server_name, server_config in mcp_config.get('mcpServers', {}).items():
                if server_config.get('disabled', False):
                    continue
                    
                await self._connect_to_mcp_server(server_name, server_config)
            
            # Discover available tools
            await self._discover_tools()
            
            logger.info(f"MCP initialization complete. Available tools: {list(self.available_tools.keys())}")
            
        except Exception as e:
            logger.error(f"MCP initialization failed: {e}")
            raise
    
    def _load_mcp_config(self) -> Dict:
        """Load MCP configuration from workspace or user settings"""
        import os
        import yaml
        
        # Try workspace config first
        workspace_config_path = os.path.join(os.path.dirname(__file__), '../.kiro/settings/mcp.json')
        if os.path.exists(workspace_config_path):
            with open(workspace_config_path, 'r') as f:
                return json.load(f)
        
        # Try user config
        user_config_path = os.path.expanduser('~/.kiro/settings/mcp.json')
        if os.path.exists(user_config_path):
            with open(user_config_path, 'r') as f:
                return json.load(f)
        
        # Default configuration with common MCP servers
        return {
            "mcpServers": {
                "filesystem": {
                    "command": "uvx",
                    "args": ["mcp-server-filesystem", "/tmp"],
                    "env": {},
                    "disabled": False,
                    "autoApprove": ["read_file", "list_directory"]
                },
                "web-search": {
                    "command": "uvx", 
                    "args": ["mcp-server-web-search"],
                    "env": {},
                    "disabled": False,
                    "autoApprove": ["web_search"]
                }
            }
        }
    
    async def _connect_to_mcp_server(self, server_name: str, server_config: Dict):
        """Connect to an MCP server"""
        try:
            server_params = StdioServerParameters(
                command=server_config['command'],
                args=server_config.get('args', []),
                env=server_config.get('env', {})
            )
            
            stdio_transport = await stdio_client(server_params)
            session = ClientSession(stdio_transport[0], stdio_transport[1])
            
            await session.initialize()
            self.mcp_sessions[server_name] = session
            
            logger.info(f"Connected to MCP server: {server_name}")
            
        except Exception as e:
            logger.error(f"Failed to connect to MCP server {server_name}: {e}")
    
    async def _discover_tools(self):
        """Discover available tools from all connected MCP servers"""
        for server_name, session in self.mcp_sessions.items():
            try:
                tools_response = await session.list_tools()
                
                for tool in tools_response.tools:
                    tool_key = f"{server_name}:{tool.name}"
                    self.available_tools[tool_key] = {
                        'server': server_name,
                        'session': session,
                        'tool': tool,
                        'name': tool.name,
                        'description': tool.description,
                        'schema': tool.inputSchema
                    }
                    
                logger.info(f"Discovered {len(tools_response.tools)} tools from {server_name}")
                
            except Exception as e:
                logger.error(f"Failed to discover tools from {server_name}: {e}")
    
    async def run_inference_with_tools(self, prompt: str, max_iterations: int = 5) -> str:
        """Run inference with MCP tool support"""
        try:
            # Initial system prompt with tool descriptions
            system_prompt = self._build_system_prompt()
            
            # Start conversation
            messages = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            for iteration in range(max_iterations):
                logger.info(f"Inference iteration {iteration + 1}/{max_iterations}")
                
                # Get model response
                response = await self._call_vllm(messages)
                
                if not response:
                    break
                
                messages.append({"role": "assistant", "content": response})
                
                # Check if model wants to use tools
                tool_calls = self._extract_tool_calls(response)
                
                if not tool_calls:
                    # No tool calls, return final response
                    return self._extract_final_response(response)
                
                # Execute tool calls
                tool_results = []
                for tool_call in tool_calls:
                    result = await self._execute_tool_call(tool_call)
                    tool_results.append(result)
                
                # Add tool results to conversation
                tool_results_text = "\n".join([f"Tool {r['tool']}: {r['result']}" for r in tool_results])
                messages.append({"role": "user", "content": f"Tool results:\n{tool_results_text}"})
            
            # If we've reached max iterations, return the last response
            return self._extract_final_response(messages[-1]["content"] if messages else "No response generated")
            
        except Exception as e:
            logger.error(f"MCP-enhanced inference failed: {e}")
            raise
    
    def _build_system_prompt(self) -> str:
        """Build system prompt with available tools"""
        tools_description = []
        
        for tool_key, tool_info in self.available_tools.items():
            tools_description.append(
                f"- {tool_info['name']}: {tool_info['description']}"
            )
        
        system_prompt = f"""You are an AI assistant with access to the following tools:

{chr(10).join(tools_description)}

To use a tool, format your request as:
<tool_call>
<tool_name>tool_name</tool_name>
<parameters>
{{"param1": "value1", "param2": "value2"}}
</parameters>
</tool_call>

You can use multiple tools in sequence to complete complex tasks. Always provide a final answer after using tools.
"""
        
        return system_prompt
    
    async def _call_vllm(self, messages: List[Dict]) -> Optional[str]:
        """Call vLLM API for inference"""
        try:
            # Convert messages to prompt format for vLLM
            prompt = self._messages_to_prompt(messages)
            
            payload = {
                "model": self.model_name,
                "prompt": prompt,
                "max_tokens": 1024,
                "temperature": 0.7,
                "top_p": 0.9,
                "stop": ["<tool_call>", "</tool_call>"]
            }
            
            response = await self.http_client.post(
                f"{self.vllm_base_url}/completions",
                json=payload
            )
            
            if response.status_code == 200:
                result = response.json()
                return result["choices"][0]["text"].strip()
            else:
                logger.error(f"vLLM API error: {response.status_code} - {response.text}")
                return None
                
        except Exception as e:
            logger.error(f"vLLM API call failed: {e}")
            return None
    
    def _messages_to_prompt(self, messages: List[Dict]) -> str:
        """Convert messages to prompt format"""
        prompt_parts = []
        
        for message in messages:
            role = message["role"]
            content = message["content"]
            
            if role == "system":
                prompt_parts.append(f"System: {content}")
            elif role == "user":
                prompt_parts.append(f"User: {content}")
            elif role == "assistant":
                prompt_parts.append(f"Assistant: {content}")
        
        prompt_parts.append("Assistant:")
        return "\n\n".join(prompt_parts)
    
    def _extract_tool_calls(self, response: str) -> List[Dict]:
        """Extract tool calls from model response"""
        tool_calls = []
        
        # Look for tool call patterns
        pattern = r'<tool_call>\s*<tool_name>(.*?)</tool_name>\s*<parameters>(.*?)</parameters>\s*</tool_call>'
        matches = re.findall(pattern, response, re.DOTALL)
        
        for tool_name, parameters_str in matches:
            try:
                parameters = json.loads(parameters_str.strip())
                tool_calls.append({
                    'tool_name': tool_name.strip(),
                    'parameters': parameters
                })
            except json.JSONDecodeError as e:
                logger.error(f"Failed to parse tool parameters: {e}")
        
        return tool_calls
    
    async def _execute_tool_call(self, tool_call: Dict) -> Dict:
        """Execute a tool call"""
        tool_name = tool_call['tool_name']
        parameters = tool_call['parameters']
        
        # Find the tool in available tools
        matching_tools = [
            (key, info) for key, info in self.available_tools.items() 
            if info['name'] == tool_name
        ]
        
        if not matching_tools:
            return {
                'tool': tool_name,
                'result': f"Error: Tool '{tool_name}' not found",
                'success': False
            }
        
        # Use the first matching tool
        tool_key, tool_info = matching_tools[0]
        session = tool_info['session']
        
        try:
            # Execute the tool
            result = await session.call_tool(tool_name, parameters)
            
            return {
                'tool': tool_name,
                'result': str(result.content[0].text if result.content else "No result"),
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Tool execution failed for {tool_name}: {e}")
            return {
                'tool': tool_name,
                'result': f"Error: {str(e)}",
                'success': False
            }
    
    def _extract_final_response(self, response: str) -> str:
        """Extract final response, removing tool call markup"""
        # Remove any remaining tool call markup
        cleaned = re.sub(r'<tool_call>.*?</tool_call>', '', response, flags=re.DOTALL)
        
        # Clean up extra whitespace
        cleaned = re.sub(r'\n\s*\n', '\n\n', cleaned.strip())
        
        return cleaned
    
    async def close(self):
        """Close all MCP connections"""
        for server_name, session in self.mcp_sessions.items():
            try:
                await session.close()
                logger.info(f"Closed MCP session: {server_name}")
            except Exception as e:
                logger.error(f"Error closing MCP session {server_name}: {e}")
        
        await self.http_client.aclose()
        self.mcp_sessions.clear()
        self.available_tools.clear()