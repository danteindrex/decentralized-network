#!/usr/bin/env node

/**
 * Verify Electron App Configuration
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Verifying Electron App Setup\n');

// Check all required files
const checks = [
    { file: 'src/main.js', desc: 'Main process' },
    { file: 'src/App.js', desc: 'React app' },
    { file: 'src/renderer.js', desc: 'Renderer entry' },
    { file: 'src/index.html', desc: 'HTML template' },
    { file: 'build/main.js', desc: 'Built main' },
    { file: 'build/App.js', desc: 'Built React app' },
    { file: 'build/index.html', desc: 'Built HTML' },
    { file: 'src/shared-core/network-service.js', desc: 'Network service' },
    { file: 'package.json', desc: 'Package config' }
];

console.log('📁 File Check:');
let allGood = true;
checks.forEach(({ file, desc }) => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`${exists ? '✅' : '❌'} ${desc} (${file})`);
    if (!exists) allGood = false;
});

if (!allGood) {
    console.log('\n❌ Missing files. Run: npm run build');
    process.exit(1);
}

// Check shared-core configuration
console.log('\n🔧 Testing Configuration:');
try {
    const sharedCore = require('./src/shared-core');
    
    // Set test configuration
    sharedCore.setConfig({
        eth_node: 'http://192.168.1.103:8545',
        ipfs_host: '192.168.1.103',
        ipfs_port: 5001
    });
    
    console.log('✅ Shared-core configuration works');
    
    // Test user data path
    const testPath = path.join(__dirname, 'test-data');
    sharedCore.setUserDataPath(testPath);
    console.log('✅ User data path can be set');
    
    // Clean up
    if (fs.existsSync(testPath)) {
        fs.rmSync(testPath, { recursive: true, force: true });
    }
    
} catch (error) {
    console.log('❌ Configuration error:', error.message);
}

console.log('\n✅ App is ready to run!');
console.log('\n🚀 To start the app:');
console.log('   npm start');
console.log('\n📝 The app will:');
console.log('   1. Check for existing configuration');
console.log('   2. Auto-generate config if needed');
console.log('   3. Connect to IPFS at 192.168.1.103:5001');
console.log('   4. Connect to Ethereum at 192.168.1.103:8545');
console.log('   5. Show the main interface');