#!/usr/bin/env python3
"""
Simple test script for the main workflow components
"""

import sys
import os
sys.path.append(os.path.dirname(__file__))

def test_imports():
    """Test that all imports work correctly"""
    print("🧪 Testing imports...")
    
    try:
        from mcp_client import MCPEnhancedInference
        print("✅ MCP client imported successfully")
    except Exception as e:
        print(f"❌ MCP client import failed: {e}")
        return False
    
    try:
        import main
        print("✅ Main module imported successfully")
    except Exception as e:
        print(f"❌ Main module import failed: {e}")
        return False
    
    return True

def test_job_handling():
    """Test job handling functions"""
    print("\n🧪 Testing job handling...")
    
    try:
        from main import handle_job, submit_response_to_contract, upload_response_to_ipfs
        print("✅ Job handling functions imported successfully")
        return True
    except Exception as e:
        print(f"❌ Job handling functions import failed: {e}")
        return False

def test_mcp_inference():
    """Test MCP inference engine"""
    print("\n🧪 Testing MCP inference engine...")
    
    try:
        from mcp_client import MCPEnhancedInference
        engine = MCPEnhancedInference()
        print("✅ MCP inference engine created successfully")
        return True
    except Exception as e:
        print(f"❌ MCP inference engine creation failed: {e}")
        return False

def main():
    """Run all tests"""
    print("🚀 Running Simple Test Suite")
    print("=" * 40)
    
    tests = [
        test_imports,
        test_job_handling,
        test_mcp_inference
    ]
    
    passed = 0
    total = len(tests)
    
    for test in tests:
        if test():
            passed += 1
    
    print("\n" + "=" * 40)
    print(f"📊 Test Results: {passed}/{total} tests passed")
    
    if passed == total:
        print("✅ All tests passed!")
        return True
    else:
        print("❌ Some tests failed!")
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)