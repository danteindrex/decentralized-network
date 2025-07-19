#!/usr/bin/env python3
"""
Script to automatically update orchestrator configuration with deployed contract addresses
"""

import json
import yaml
import os
import sys
from pathlib import Path

def load_deployment_info():
    """Load deployment information from deployment.json"""
    deployment_path = Path(__file__).parent.parent / "deployment.json"
    
    if not deployment_path.exists():
        print("❌ deployment.json not found. Please deploy contracts first.")
        return None
    
    try:
        with open(deployment_path, 'r') as f:
            return json.load(f)
    except Exception as e:
        print(f"❌ Failed to load deployment.json: {e}")
        return None

def update_config_file(deployment_info):
    """Update orchestrator config.yaml with deployment information"""
    config_dir = Path(__file__).parent.parent / "orchestrator"
    config_path = config_dir / "config.yaml"
    template_path = config_dir / "config.template.yaml"
    
    # Create config.yaml from template if it doesn't exist
    if not config_path.exists():
        if template_path.exists():
            print("📋 Creating config.yaml from template...")
            try:
                with open(template_path, 'r') as f:
                    config_content = f.read()
                
                with open(config_path, 'w') as f:
                    f.write(config_content)
                
                print("✅ Created config.yaml from template")
            except Exception as e:
                print(f"❌ Failed to create config.yaml from template: {e}")
                return False
        else:
            print("❌ Neither config.yaml nor config.template.yaml found")
            return False
    
    # Load existing config
    try:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
    except Exception as e:
        print(f"❌ Failed to load config.yaml: {e}")
        return False
    
    # Update contract addresses
    config['contract_address'] = deployment_info['inferenceCoordinator']
    config['model_registry_address'] = deployment_info['modelRegistry']
    config['node_profile_registry_address'] = deployment_info['nodeProfileRegistry']
    
    # Update deployer address if not set
    if not config.get('default_account') or config['default_account'] == "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266":
        config['default_account'] = deployment_info['deployer']
    
    # Save updated config
    try:
        with open(config_path, 'w') as f:
            yaml.dump(config, f, default_flow_style=False, indent=2)
        
        print("✅ Updated config.yaml with contract addresses")
        return True
    except Exception as e:
        print(f"❌ Failed to save config.yaml: {e}")
        return False

def update_env_file(deployment_info):
    """Update .env file with contract addresses"""
    env_path = Path(__file__).parent.parent / ".env"
    
    if not env_path.exists():
        print("⚠️  .env file not found, skipping env update")
        return True
    
    try:
        # Read existing .env content
        with open(env_path, 'r') as f:
            lines = f.readlines()
        
        # Update or add contract addresses
        updated_lines = []
        found_contract = False
        found_model_registry = False
        
        for line in lines:
            if line.startswith('CONTRACT_ADDRESS='):
                updated_lines.append(f'CONTRACT_ADDRESS={deployment_info["inferenceCoordinator"]}\n')
                found_contract = True
            elif line.startswith('MODEL_REGISTRY_ADDRESS='):
                updated_lines.append(f'MODEL_REGISTRY_ADDRESS={deployment_info["modelRegistry"]}\n')
                found_model_registry = True
            else:
                updated_lines.append(line)
        
        # Add missing entries
        if not found_contract:
            updated_lines.append(f'CONTRACT_ADDRESS={deployment_info["inferenceCoordinator"]}\n')
        if not found_model_registry:
            updated_lines.append(f'MODEL_REGISTRY_ADDRESS={deployment_info["modelRegistry"]}\n')
        
        # Write back to file
        with open(env_path, 'w') as f:
            f.writelines(updated_lines)
        
        print("✅ Updated .env file with contract addresses")
        return True
    except Exception as e:
        print(f"❌ Failed to update .env file: {e}")
        return False

def main():
    """Main function"""
    print("🔧 Updating configuration with deployed contract addresses...")
    print("=" * 60)
    
    # Load deployment information
    deployment_info = load_deployment_info()
    if not deployment_info:
        sys.exit(1)
    
    print("📋 Deployment Information:")
    print(f"   Network: {deployment_info.get('network', 'unknown')}")
    print(f"   Deployer: {deployment_info.get('deployer', 'unknown')}")
    print(f"   InferenceCoordinator: {deployment_info.get('inferenceCoordinator', 'unknown')}")
    print(f"   ModelRegistry: {deployment_info.get('modelRegistry', 'unknown')}")
    print(f"   NodeProfileRegistry: {deployment_info.get('nodeProfileRegistry', 'unknown')}")
    print()
    
    # Update config file
    success = True
    if not update_config_file(deployment_info):
        success = False
    
    # Update env file
    if not update_env_file(deployment_info):
        success = False
    
    if success:
        print("\n🎉 Configuration update completed successfully!")
        print("\n📋 Next steps:")
        print("1. Review orchestrator/config.yaml and update any other settings as needed")
        print("2. Set your wallet credentials:")
        print("   export DEFAULT_ACCOUNT=0xYourAddress")
        print("   export PRIVATE_KEY=0xYourPrivateKey")
        print("3. Start the orchestrator:")
        print("   cd orchestrator && python main.py")
    else:
        print("\n❌ Configuration update failed. Please check the errors above.")
        sys.exit(1)

if __name__ == "__main__":
    main()