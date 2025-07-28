#!/usr/bin/env python3
"""
ETH Funding Script
Adds ETH to accounts on the local development blockchain
"""

import sys
from web3 import Web3

def main():
    # Connect to local blockchain
    w3 = Web3(Web3.HTTPProvider('http://localhost:8545'))
    
    if not w3.is_connected():
        print("❌ Failed to connect to blockchain at http://localhost:8545")
        print("💡 Make sure your local blockchain is running")
        sys.exit(1)
    
    print("✅ Connected to local blockchain")
    print(f"📦 Current block: {w3.eth.block_number}")
    
    # Pre-funded account (has lots of ETH)
    funded_account = '0x71562b71999873DB5b286dF957af199Ec94617F7'
    
    # Check if we have command line arguments
    if len(sys.argv) < 2:
        print("\n🔍 Usage:")
        print(f"  python3 {sys.argv[0]} <recipient_address> [amount_in_eth]")
        print(f"  python3 {sys.argv[0]} 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266 1.0")
        print("\n📋 Common accounts:")
        print("  User account:   0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266")
        print("  Worker account: 0x70997970C51812dc3A010C7d01b50e0d17dc79C8")
        print("  Owner account:  0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")
        
        # Show current balances
        print("\n💰 Current balances:")
        accounts = [
            ("User", "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
            ("Worker", "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"),
            ("Owner", "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC")
        ]
        
        for name, addr in accounts:
            try:
                balance = w3.from_wei(w3.eth.get_balance(addr), 'ether')
                print(f"  {name:8}: {balance:>10.4f} ETH")
            except:
                print(f"  {name:8}: Error getting balance")
        
        sys.exit(0)
    
    # Get recipient and amount
    recipient = sys.argv[1]
    amount_eth = float(sys.argv[2]) if len(sys.argv) > 2 else 1.0
    
    # Validate recipient address
    try:
        recipient = w3.to_checksum_address(recipient)
    except:
        print(f"❌ Invalid address: {recipient}")
        sys.exit(1)
    
    # Check current balances
    try:
        funded_balance = w3.from_wei(w3.eth.get_balance(funded_account), 'ether')
        recipient_balance = w3.from_wei(w3.eth.get_balance(recipient), 'ether')
        
        print(f"\n💰 Current balances:")
        print(f"  Funded account:    {funded_balance:>10.4f} ETH")
        print(f"  Recipient account: {recipient_balance:>10.4f} ETH")
        
        if funded_balance < amount_eth:
            print(f"❌ Insufficient funds in funded account")
            sys.exit(1)
            
    except Exception as e:
        print(f"❌ Error checking balances: {e}")
        sys.exit(1)
    
    # Send ETH
    try:
        print(f"\n📤 Sending {amount_eth} ETH to {recipient}...")
        
        tx_hash = w3.eth.send_transaction({
            'from': funded_account,
            'to': recipient,
            'value': w3.to_wei(amount_eth, 'ether'),
            'gas': 21000,
            'gasPrice': w3.to_wei('20', 'gwei')
        })
        
        print(f"📋 Transaction hash: {tx_hash.hex()}")
        
        # Wait for confirmation
        print("⏳ Waiting for confirmation...")
        receipt = w3.eth.wait_for_transaction_receipt(tx_hash)
        print(f"✅ Transaction confirmed in block: {receipt.blockNumber}")
        
        # Check new balance
        new_balance = w3.from_wei(w3.eth.get_balance(recipient), 'ether')
        print(f"💰 New balance: {new_balance:.4f} ETH")
        
        # Calculate gas cost
        gas_used = receipt.gasUsed
        gas_price = w3.to_wei('20', 'gwei')
        gas_cost = w3.from_wei(gas_used * gas_price, 'ether')
        print(f"⛽ Gas cost: {gas_cost:.6f} ETH")
        
    except Exception as e:
        print(f"❌ Transaction failed: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()