#!/usr/bin/env python3
"""
Simple MCP client test
"""

import asyncio
import sys
import os

# Add the orchestrator directory to the path
sys.path.insert(0, os.path.dirname(__file__))

from mcp_client import MCPEnhancedInference

async def test_mcp_initialization():
    """Test MCP client initialization"""
    print("🧪 Testing MCP Enhanced Inference initialization...")
    
    try:
        # Create MCP client
        mcp_client = MCPEnhancedInference()
        print("✅ MCP client created successfully")
        
        # Test initialization (this will try to connect to MCP servers)
        print("🔗 Attempting to initialize MCP connections...")
        await mcp_client.initialize()
        print("✅ MCP initialization completed")
        
        # Test a simple inference
        print("🧠 Testing inference with tools...")
        response = await mcp_client.run_inference_with_tools(
            "Hello, can you help me test the MCP system?",
            max_iterations=2
        )
        print(f"📝 Response: {response}")
        
        # Cleanup
        await mcp_client.close()
        print("✅ MCP client closed successfully")
        
        return True
        
    except Exception as e:
        print(f"❌ MCP test failed: {e}")
        return False

async def main():
    """Main test function"""
    print("🚀 Starting MCP Enhanced Inference Test")
    print("=" * 50)
    
    success = await test_mcp_initialization()
    
    print("=" * 50)
    if success:
        print("🎉 All MCP tests passed!")
    else:
        print("💥 Some MCP tests failed!")
    
    return success

if __name__ == "__main__":
    result = asyncio.run(main())
    sys.exit(0 if result else 1)