#!/usr/bin/env node

/**
 * Test Electron App Connection to Live Bootstrap Node
 */

const axios = require('axios');
const path = require('path');

// Configuration
const BOOTSTRAP_NODE = 'https://bootstrap-node.onrender.com';
const LOCAL_ETH_NODE = 'http://192.168.1.103:8545';
const LOCAL_IPFS = 'http://192.168.1.103:5001';

async function testBootstrapConnection() {
    console.log('🔍 Testing Bootstrap Node Connection...\n');
    
    try {
        // Test health endpoint
        console.log('1. Testing health endpoint...');
        const healthResponse = await axios.get(`${BOOTSTRAP_NODE}/health`);
        console.log('✅ Bootstrap node is healthy:', healthResponse.data);
        
        // Test network config endpoint
        console.log('\n2. Testing network config endpoint...');
        const configResponse = await axios.get(`${BOOTSTRAP_NODE}/api/network-config`);
        console.log('✅ Network configuration:', configResponse.data);
        
        // Test peers endpoint
        console.log('\n3. Testing peers endpoint...');
        const peersResponse = await axios.get(`${BOOTSTRAP_NODE}/peers`);
        console.log('✅ Connected peers:', peersResponse.data);
        
        // Test workers endpoint
        console.log('\n4. Testing workers endpoint...');
        const workersResponse = await axios.get(`${BOOTSTRAP_NODE}/workers`);
        console.log('✅ Available workers:', workersResponse.data);
        
        return true;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function testElectronAppConfig() {
    console.log('\n📱 Testing Electron App Configuration...\n');
    
    try {
        // Load network service
        const networkService = require('./easyapps/src/shared-core/network-service.js');
        
        // Test auto-config generation
        console.log('5. Testing auto-config generation...');
        const autoConfig = await networkService.generateAutoConfig();
        console.log('✅ Auto-generated config:', {
            ...autoConfig,
            private_key: '[REDACTED]'
        });
        
        // Test bootstrap discovery
        console.log('\n6. Testing bootstrap node discovery...');
        const discoveredNodes = await networkService.discoverBootstrapNodes();
        console.log('✅ Discovered nodes:', discoveredNodes);
        
        return true;
    } catch (error) {
        console.error('❌ Error:', error.message);
        return false;
    }
}

async function updateElectronEnv() {
    console.log('\n📝 Creating Electron App Environment...\n');
    
    const fs = require('fs');
    
    // Create .env for Electron app
    const envContent = `# AI Inference Network Configuration
BOOTSTRAP_URL=${BOOTSTRAP_NODE}
DOCKER_BOOTSTRAP_URL=${BOOTSTRAP_NODE}
ETH_NODE=${LOCAL_ETH_NODE}
IPFS_HOST=192.168.1.103
IPFS_PORT=5001
`;
    
    const envPath = path.join(__dirname, 'easyapps', '.env');
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file at:', envPath);
    
    // Load deployment info if available
    const deploymentPath = path.join(__dirname, 'deployment.json');
    if (fs.existsSync(deploymentPath)) {
        const deployment = JSON.parse(fs.readFileSync(deploymentPath, 'utf8'));
        console.log('✅ Found deployment info:', deployment);
    }
}

async function main() {
    console.log('🚀 Electron App Connection Test');
    console.log('=' .repeat(60));
    
    // Test bootstrap connection
    const bootstrapOk = await testBootstrapConnection();
    
    // Test Electron config
    const electronOk = await testElectronAppConfig();
    
    // Update environment
    await updateElectronEnv();
    
    // Summary
    console.log('\n📊 Test Summary');
    console.log('=' .repeat(60));
    console.log(`Bootstrap Node: ${bootstrapOk ? '✅ Connected' : '❌ Failed'}`);
    console.log(`Electron Config: ${electronOk ? '✅ Working' : '❌ Failed'}`);
    
    console.log('\n💡 Next Steps:');
    console.log('1. Start the Electron app:');
    console.log('   cd easyapps && npm start');
    console.log('\n2. The app will automatically:');
    console.log('   - Connect to the live bootstrap node');
    console.log('   - Generate wallet if needed');
    console.log('   - Discover network configuration');
    console.log('   - Enable AI inference when workers are available');
}

main().catch(console.error);