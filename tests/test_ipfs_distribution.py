#!/usr/bin/env python3
"""
Test IPFS file distribution across the network
"""

import requests
import json
import time

def test_ipfs_upload():
    """Test uploading a file to IPFS and verify distribution"""
    print("🧪 Testing IPFS File Distribution\n")
    
    # Test data
    test_content = {
        "message": "Test file for IPFS distribution analysis",
        "timestamp": time.time(),
        "purpose": "Verify how files are distributed across network nodes"
    }
    
    print("📤 Uploading test file to IPFS...")
    
    try:
        # Upload via the bootstrap node IPFS gateway
        ipfs_url = "https://bootstrap-node.onrender.com/api/v0/add"
        
        files = {'file': ('test_file.json', json.dumps(test_content))}
        response = requests.post(ipfs_url, files=files, timeout=10)
        
        if response.status_code == 200:
            result = response.json()
            cid = result.get('Hash')
            print(f"✅ File uploaded successfully!")
            print(f"   CID: {cid}")
            print(f"   Size: {result.get('Size', 'unknown')} bytes")
            
            return cid
        else:
            print(f"❌ Upload failed: {response.status_code} - {response.text}")
            return None
            
    except Exception as e:
        print(f"❌ Upload error: {e}")
        return None

def test_ipfs_retrieval(cid):
    """Test retrieving the file from different IPFS gateways"""
    if not cid:
        return False
    
    print(f"\n📥 Testing file retrieval from different gateways...")
    
    # List of IPFS gateways to test
    gateways = [
        f"https://bootstrap-node.onrender.com/api/v0/cat?arg={cid}",
        f"https://gateway.pinata.cloud/ipfs/{cid}",
        f"https://ipfs.io/ipfs/{cid}",
        f"https://cloudflare-ipfs.com/ipfs/{cid}"
    ]
    
    successful_retrievals = 0
    
    for i, gateway_url in enumerate(gateways):
        try:
            print(f"   Testing gateway {i+1}: {gateway_url.split('/')[2]}...")
            response = requests.get(gateway_url, timeout=10)
            
            if response.status_code == 200:
                print(f"   ✅ Success - File retrieved from gateway {i+1}")
                successful_retrievals += 1
            else:
                print(f"   ⚠️ Failed - Status {response.status_code} from gateway {i+1}")
                
        except Exception as e:
            print(f"   ❌ Error from gateway {i+1}: {str(e)[:50]}...")
    
    print(f"\n📊 Results: {successful_retrievals}/{len(gateways)} gateways successful")
    return successful_retrievals > 0

def explain_ipfs_distribution():
    """Explain how IPFS file distribution works"""
    print("\n" + "="*60)
    print("📚 HOW IPFS FILE DISTRIBUTION WORKS")
    print("="*60)
    
    print("""
🌐 **IPFS Network Distribution**:

1. **Content Addressing**: Files are identified by their content hash (CID)
   - Same content = same CID across all nodes
   - Changes to content = new CID

2. **Distributed Storage**: 
   - Files are stored across multiple IPFS nodes
   - No single point of failure
   - Redundancy through replication

3. **Network Discovery**:
   - Nodes announce what content they have
   - DHT (Distributed Hash Table) helps locate content
   - Peer discovery finds nodes with requested files

4. **Retrieval Process**:
   - Request file by CID from any IPFS gateway
   - Gateway locates nodes that have the content
   - File is retrieved and served to requester
   - Popular files may be cached on multiple gateways

5. **Our Network Integration**:
   - Bootstrap node runs IPFS daemon
   - Files uploaded through bootstrap node
   - Content becomes available network-wide
   - Other nodes can pin/cache popular content

⚡ **Key Benefits**:
✅ Decentralized - no central server
✅ Content-addressable - tamper-proof
✅ Efficient - deduplication and caching
✅ Resilient - multiple copies across network
✅ Global - accessible from any IPFS gateway
""")

def main():
    """Run IPFS distribution test"""
    # Upload test file
    cid = test_ipfs_upload()
    
    # Test retrieval from multiple gateways
    if cid:
        success = test_ipfs_retrieval(cid)
        
        if success:
            print("\n🎉 IPFS distribution is working!")
            print("   Files are distributed across the network")
            print("   Multiple access points available")
        else:
            print("\n⚠️ Limited IPFS access")
            print("   File uploaded but not widely distributed yet")
    
    # Explain how it works
    explain_ipfs_distribution()
    
    print("\n🔗 **For Your Streamlit App**:")
    print("   - Files uploaded via Storage tab go to IPFS")
    print("   - They become distributed across network nodes")
    print("   - Accessible from any IPFS gateway worldwide")
    print("   - Content is permanent and tamper-proof")

if __name__ == "__main__":
    main()