#!/usr/bin/env node

/**
 * Test Bootstrap Integration for Electron App
 * Tests if the app properly integrates with bootstrap node settings
 */

const path = require('path');
const fs = require('fs');
const axios = require('axios');

console.log('🧪 Testing Bootstrap Integration\n');

// Load bootstrap environment settings
const bootstrapEnv = {
    NODE_TYPE: 'bootstrap',
    NETWORK_NAME: 'AI-Inference-Network',
    CHAIN_ID: 1337,
    BOOTSTRAP_IP: '192.168.1.103',
    ETH_NODE_URL: 'http://192.168.1.103:8545',
    BOOTSTRAP_ACCOUNT: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    IPFS_HOST: '192.168.1.103',
    IPFS_PORT: 5001
};

console.log('📋 Bootstrap Configuration:');
Object.entries(bootstrapEnv).forEach(([key, value]) => {
    console.log(`  ${key}: ${value}`);
});

// Test shared-core with bootstrap settings
console.log('\n🔧 Testing Shared-Core with Bootstrap Settings...\n');

try {
    const sharedCore = require('./src/shared-core');
    
    // Set bootstrap configuration
    sharedCore.setConfig({
        eth_node: bootstrapEnv.ETH_NODE_URL,
        ipfs_host: bootstrapEnv.IPFS_HOST,
        ipfs_port: bootstrapEnv.IPFS_PORT,
        contract_address: '',
        model_registry_address: '',
        default_account: bootstrapEnv.BOOTSTRAP_ACCOUNT,
        network_id: bootstrapEnv.NETWORK_NAME
    });
    
    console.log('✅ Shared-core configured with bootstrap settings');
    
    // Test IPFS connection
    console.log('\n🌐 Testing IPFS Connection...');
    testIPFSConnection();
    
    // Test Ethereum connection
    console.log('\n⛓️  Testing Ethereum Connection...');
    testEthConnection();
    
    // Test Bootstrap API
    console.log('\n🔗 Testing Bootstrap Node API...');
    testBootstrapAPI();
    
} catch (error) {
    console.error('❌ Error:', error.message);
}

async function testIPFSConnection() {
    try {
        const response = await axios.post(
            `http://${bootstrapEnv.IPFS_HOST}:${bootstrapEnv.IPFS_PORT}/api/v0/version`,
            null,
            { timeout: 5000 }
        );
        console.log('✅ IPFS is accessible');
        console.log(`   Version: ${response.data.Version}`);
    } catch (error) {
        console.log('❌ IPFS not accessible at', `${bootstrapEnv.IPFS_HOST}:${bootstrapEnv.IPFS_PORT}`);
        console.log('   Make sure IPFS daemon is running');
    }
}

async function testEthConnection() {
    try {
        const response = await axios.post(
            bootstrapEnv.ETH_NODE_URL,
            {
                jsonrpc: '2.0',
                method: 'eth_blockNumber',
                params: [],
                id: 1
            },
            { timeout: 5000 }
        );
        if (response.data.result) {
            const blockNumber = parseInt(response.data.result, 16);
            console.log('✅ Ethereum node is accessible');
            console.log(`   Current block: ${blockNumber}`);
        }
    } catch (error) {
        console.log('❌ Ethereum node not accessible at', bootstrapEnv.ETH_NODE_URL);
        console.log('   Make sure geth is running');
    }
}

async function testBootstrapAPI() {
    try {
        const response = await axios.get(
            `http://${bootstrapEnv.BOOTSTRAP_IP}:8080/api/network-config`,
            { timeout: 5000 }
        );
        if (response.data && response.data.network_id) {
            console.log('✅ Bootstrap API is accessible');
            console.log(`   Network ID: ${response.data.network_id}`);
            console.log(`   Bootstrap nodes: ${response.data.bootstrap_nodes.length}`);
        }
    } catch (error) {
        console.log('❌ Bootstrap API not accessible at', `${bootstrapEnv.BOOTSTRAP_IP}:8080`);
        console.log('   Make sure bootstrap node is running');
    }
}

// Create proper configuration for the app
console.log('\n📝 Creating App Configuration...');

const appConfig = {
    nodeType: 'user',
    ethNode: bootstrapEnv.ETH_NODE_URL,
    ipfsHost: bootstrapEnv.IPFS_HOST,
    ipfsPort: bootstrapEnv.IPFS_PORT,
    bootstrapNode: `http://${bootstrapEnv.BOOTSTRAP_IP}:8080`,
    account: bootstrapEnv.BOOTSTRAP_ACCOUNT,
    networkName: bootstrapEnv.NETWORK_NAME,
    chainId: bootstrapEnv.CHAIN_ID
};

const configPath = path.join(__dirname, 'bootstrap-config.json');
fs.writeFileSync(configPath, JSON.stringify(appConfig, null, 2));
console.log('✅ Configuration saved to:', configPath);

console.log('\n🚀 Next Steps:');
console.log('1. Make sure IPFS is running: ipfs daemon');
console.log('2. Make sure Ethereum node is running: geth');
console.log('3. Make sure bootstrap node is running');
console.log('4. Run the app: npm start');
console.log('5. The app should auto-configure using bootstrap settings');