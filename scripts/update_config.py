#!/usr/bin/env python3
"""
Script to automatically update config.yaml with deployed contract addresses
"""

import json
import os
import sys
import yaml

def load_deployment_info():
    """Load deployment information from deployment.json"""
    deployment_path = os.path.join(os.path.dirname(__file__), '..', 'deployment.json')
    
    if not os.path.exists(deployment_path):
        print("❌ deployment.json not found. Please deploy contracts first.")
        return None
    
    with open(deployment_path, 'r') as f:
        return json.load(f)

def update_config(deployment_info, account_address=None, private_key=None):
    """Update config.yaml with deployment information"""
    
    config_path = os.path.join(os.path.dirname(__file__), '..', 'orchestrator', 'config.yaml')
    template_path = os.path.join(os.path.dirname(__file__), '..', 'orchestrator', 'config.template.yaml')
    
    # Load template if config doesn't exist
    if not os.path.exists(config_path):
        if os.path.exists(template_path):
            print("📋 Creating config.yaml from template...")
            with open(template_path, 'r') as f:
                config = yaml.safe_load(f)
        else:
            print("❌ Neither config.yaml nor config.template.yaml found")
            return False
    else:
        with open(config_path, 'r') as f:
            config = yaml.safe_load(f)
    
    # Update contract addresses
    config['contract_address'] = deployment_info['inferenceCoordinator']
    config['model_registry_address'] = deployment_info['modelRegistry']
    
    # Update account info if provided
    if account_address:
        config['default_account'] = account_address
    elif config.get('default_account') == 'REPLACE_WITH_YOUR_ACCOUNT_ADDRESS':
        config['default_account'] = deployment_info['deployer']
        print(f"🔑 Using deployer address as default account: {deployment_info['deployer']}")
    
    if private_key:
        config['private_key'] = private_key
    elif config.get('private_key') == 'REPLACE_WITH_YOUR_PRIVATE_KEY':
        print("⚠️  Please set your private key in config.yaml")
    
    # Write updated config
    with open(config_path, 'w') as f:
        yaml.dump(config, f, default_flow_style=False, sort_keys=False)
    
    print("✅ config.yaml updated successfully!")
    print(f"   InferenceCoordinator: {deployment_info['inferenceCoordinator']}")
    print(f"   ModelRegistry: {deployment_info['modelRegistry']}")
    print(f"   Default Account: {config['default_account']}")
    
    if config.get('private_key') == 'REPLACE_WITH_YOUR_PRIVATE_KEY':
        print("\n⚠️  Don't forget to set your private key in orchestrator/config.yaml")
    
    return True

def main():
    """Main function"""
    import argparse
    
    parser = argparse.ArgumentParser(description='Update config.yaml with deployed contract addresses')
    parser.add_argument('--account', help='Account address to use')
    parser.add_argument('--private-key', help='Private key to use')
    
    args = parser.parse_args()
    
    # Load deployment info
    deployment_info = load_deployment_info()
    if not deployment_info:
        sys.exit(1)
    
    # Update config
    success = update_config(deployment_info, args.account, args.private_key)
    if not success:
        sys.exit(1)
    
    print("\n🎉 Configuration updated! You can now:")
    print("1. Upload models: cd orchestrator && python owner_upload.py --help")
    print("2. Start orchestrator: cd orchestrator && python main.py")
    print("3. Manage models: npx hardhat run scripts/owner_tools.js list")

if __name__ == "__main__":
    main()