#!/usr/bin/env python3
"""
Test runner script for the orchestrator workflow
Provides different test execution modes and environment setup
"""

import os
import sys
import subprocess
import argparse
import tempfile
import yaml
from pathlib import Path


def setup_test_environment():
    """Setup test environment variables and mock services"""
    
    # Set test environment variables
    test_env = {
        'ETH_NODE_URL': 'http://localhost:8545',
        'CONTRACT_ADDRESS': '0x1234567890123456789012345678901234567890',
        'MODEL_REGISTRY_ADDRESS': '0x1234567890123456789012345678901234567890',
        'DEFAULT_ACCOUNT': '0x1234567890123456789012345678901234567890',
        'PRIVATE_KEY': '0x1234567890123456789012345678901234567890123456789012345678901234',
        'VLLM_BASE_URL': 'http://localhost:8000/v1',
        'MODEL_NAME': 'test-model',
        'PYTHONPATH': os.path.dirname(__file__)
    }
    
    for key, value in test_env.items():
        os.environ[key] = value
    
    print("✅ Test environment variables set")


def create_test_config():
    """Create test configuration files"""
    
    # Create test config.yaml
    test_config = {
        'eth_node': 'http://localhost:8545',
        'contract_address': '0x1234567890123456789012345678901234567890',
        'model_registry_address': '0x1234567890123456789012345678901234567890',
        'default_account': '0x1234567890123456789012345678901234567890',
        'private_key': '0x1234567890123456789012345678901234567890123456789012345678901234',
        'contract_abi': [],
        'min_free_ram': 1000000000,
        'min_free_vram': 1000000000,
        'max_cpu': 80,
        'ray_port': 10001,
        'enable_mcp': True,
        'vllm_base_url': 'http://localhost:8000/v1',
        'model_name': 'test-model',
        'mcp_max_iterations': 3,
        'temperature': 0.7,
        'top_p': 0.9,
        'max_tokens': 512,
        'gpu_memory_utilization': 0.8,
        'max_model_len': 2048,
        'enforce_eager': False,
        'trust_remote_code': True,
        'head_min_ram': 2000000000,
        'head_min_vram': 1000000000
    }
    
    config_path = Path(__file__).parent / 'config.yaml'
    with open(config_path, 'w') as f:
        yaml.dump(test_config, f)
    
    print(f"✅ Test config created: {config_path}")
    
    # Create test MCP config
    mcp_config = {
        'mcp_servers': {
            'test_server': {
                'transport': 'stdio',
                'command': 'python',
                'args': ['-c', 'print("test")'],
                'description': 'Test server',
                'enabled': True
            }
        },
        'mcp_client': {
            'enabled': True,
            'timeout': 30,
            'max_connections': 5,
            'retry': {
                'max_attempts': 3,
                'delay': 1.0,
                'backoff_factor': 2.0
            },
            'logging': {
                'level': 'INFO',
                'log_mcp_calls': True,
                'log_tool_results': False
            }
        }
    }
    
    mcp_config_path = Path(__file__).parent / 'mcp_config.yaml'
    with open(mcp_config_path, 'w') as f:
        yaml.dump(mcp_config, f)
    
    print(f"✅ Test MCP config created: {mcp_config_path}")


def run_unit_tests():
    """Run unit tests only"""
    cmd = [
        'python', '-m', 'pytest',
        'test_main_workflow.py::TestMCPClientManager',
        'test_main_workflow.py::TestMCPEnhancedInference',
        'test_main_workflow.py::TestMainWorkflow',
        '-v', '--tb=short'
    ]
    
    print("🧪 Running unit tests...")
    return subprocess.run(cmd, cwd=os.path.dirname(__file__))


def run_integration_tests():
    """Run integration tests"""
    cmd = [
        'python', '-m', 'pytest',
        'test_main_workflow.py::TestIntegrationWorkflow',
        '-v', '--tb=short', '-m', 'not slow'
    ]
    
    print("🔗 Running integration tests...")
    return subprocess.run(cmd, cwd=os.path.dirname(__file__))


def run_mcp_tests():
    """Run MCP-specific tests"""
    cmd = [
        'python', '-m', 'pytest',
        'test_main_workflow.py::TestSampleMCPServer',
        '-v', '--tb=short'
    ]
    
    print("🔧 Running MCP tests...")
    return subprocess.run(cmd, cwd=os.path.dirname(__file__))


def run_all_tests():
    """Run all tests with coverage"""
    cmd = [
        'python', '-m', 'pytest',
        'test_main_workflow.py',
        '-v',
        '--cov=main',
        '--cov=mcp_client',
        '--cov-report=html',
        '--cov-report=term-missing',
        '--cov-report=xml'
    ]
    
    print("🚀 Running all tests with coverage...")
    return subprocess.run(cmd, cwd=os.path.dirname(__file__))


def run_quick_tests():
    """Run quick tests (excluding slow ones)"""
    cmd = [
        'python', '-m', 'pytest',
        'test_main_workflow.py',
        '-v', '--tb=short',
        '-m', 'not slow',
        '--durations=5'
    ]
    
    print("⚡ Running quick tests...")
    return subprocess.run(cmd, cwd=os.path.dirname(__file__))


def check_dependencies():
    """Check if required dependencies are installed"""
    required_packages = [
        'pytest',
        'pytest-asyncio',
        'pytest-mock',
        'pytest-cov',
        'pyyaml'
    ]
    
    missing_packages = []
    
    for package in required_packages:
        try:
            __import__(package.replace('-', '_'))
        except ImportError:
            missing_packages.append(package)
    
    if missing_packages:
        print(f"❌ Missing required packages: {', '.join(missing_packages)}")
        print("Install them with: pip install " + " ".join(missing_packages))
        return False
    
    print("✅ All required test dependencies are installed")
    return True


def main():
    """Main test runner"""
    parser = argparse.ArgumentParser(description='Run orchestrator workflow tests')
    parser.add_argument(
        'mode',
        choices=['unit', 'integration', 'mcp', 'all', 'quick', 'check'],
        help='Test mode to run'
    )
    parser.add_argument(
        '--setup-only',
        action='store_true',
        help='Only setup test environment, don\'t run tests'
    )
    parser.add_argument(
        '--no-setup',
        action='store_true',
        help='Skip test environment setup'
    )
    
    args = parser.parse_args()
    
    print("🔬 Orchestrator Workflow Test Runner")
    print("=" * 40)
    
    # Check dependencies first
    if not check_dependencies():
        sys.exit(1)
    
    # Setup test environment unless skipped
    if not args.no_setup:
        setup_test_environment()
        create_test_config()
    
    if args.setup_only:
        print("✅ Test environment setup complete")
        return
    
    # Run tests based on mode
    if args.mode == 'check':
        print("✅ Dependency check complete")
        return
    elif args.mode == 'unit':
        result = run_unit_tests()
    elif args.mode == 'integration':
        result = run_integration_tests()
    elif args.mode == 'mcp':
        result = run_mcp_tests()
    elif args.mode == 'all':
        result = run_all_tests()
    elif args.mode == 'quick':
        result = run_quick_tests()
    
    # Print results
    if result.returncode == 0:
        print("\n✅ All tests passed!")
    else:
        print(f"\n❌ Tests failed with exit code: {result.returncode}")
        sys.exit(result.returncode)


if __name__ == "__main__":
    main()