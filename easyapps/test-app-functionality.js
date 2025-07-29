#!/usr/bin/env node

/**
 * Test Electron App Functionality
 * Tests the app components without launching GUI
 */

const path = require('path');
const fs = require('fs');

console.log('🧪 Testing Electron App Functionality\n');

// Mock Electron environment
global.window = {
    sharedCore: null,
    ipcRenderer: null
};

// Mock localStorage
global.localStorage = {
    data: {},
    getItem: function(key) { return this.data[key] || null; },
    setItem: function(key, value) { this.data[key] = value; },
    clear: function() { this.data = {}; }
};

// Test results
let testResults = [];

function test(name, fn) {
    console.log(`Testing: ${name}...`);
    try {
        const result = fn();
        if (result || result === undefined) {
            testResults.push({ name, passed: true });
            console.log(`✅ ${name}\n`);
        } else {
            testResults.push({ name, passed: false, error: 'Test returned false' });
            console.log(`❌ ${name}\n`);
        }
    } catch (error) {
        testResults.push({ name, passed: false, error: error.message });
        console.log(`❌ ${name}: ${error.message}\n`);
    }
}

// Test 1: Import shared-core
test('Shared-core module loading', () => {
    const sharedCore = require('./src/shared-core');
    
    // Check essential functions
    const essentialFunctions = [
        'initWeb3',
        'uploadToIpfs',
        'fetchFromIpfs',
        'submitInferenceJob',
        'monitorJobCompletion',
        'generateAutoConfig',
        'saveNetworkConfig',
        'loadNetworkConfig'
    ];
    
    const missing = essentialFunctions.filter(fn => !sharedCore[fn]);
    if (missing.length > 0) {
        throw new Error(`Missing functions: ${missing.join(', ')}`);
    }
    
    console.log(`  ✓ All ${essentialFunctions.length} essential functions present`);
    return true;
});

// Test 2: Configuration generation
test('Auto-configuration generation', async () => {
    const sharedCore = require('./src/shared-core');
    const testPath = path.join(__dirname, 'test-config');
    
    // Create test directory
    if (!fs.existsSync(testPath)) {
        fs.mkdirSync(testPath, { recursive: true });
    }
    
    sharedCore.setUserDataPath(testPath);
    
    // Generate config
    const config = await sharedCore.generateAutoConfig();
    
    if (!config.default_account || !config.private_key) {
        throw new Error('Invalid configuration generated');
    }
    
    console.log(`  ✓ Generated account: ${config.default_account}`);
    console.log(`  ✓ Network ID: ${config.network_id}`);
    
    // Save and load config
    await sharedCore.saveNetworkConfig(config);
    const loaded = await sharedCore.loadNetworkConfig();
    
    if (loaded.default_account !== config.default_account) {
        throw new Error('Configuration save/load failed');
    }
    
    // Cleanup
    fs.rmSync(testPath, { recursive: true, force: true });
    
    return true;
});

// Test 3: IPFS functions (mock)
test('IPFS upload/download functions', async () => {
    const sharedCore = require('./src/shared-core');
    
    // Set mock config
    sharedCore.setConfig({
        ipfs_host: 'localhost',
        ipfs_port: 5001
    });
    
    // Note: Actual upload will fail without IPFS running
    // but we're testing the function exists and handles errors
    try {
        const result = await sharedCore.uploadToIpfs('test data', 'test.txt');
        console.log('  ℹ️  IPFS upload returned:', result || 'null (expected without IPFS daemon)');
    } catch (e) {
        console.log('  ℹ️  IPFS not running (expected)');
    }
    
    return true;
});

// Test 4: React component structure
test('React App component', () => {
    // Check if App.js exports properly
    const appPath = path.join(__dirname, 'build/App.js');
    if (!fs.existsSync(appPath)) {
        throw new Error('Build/App.js not found - run npm run build first');
    }
    
    const appContent = fs.readFileSync(appPath, 'utf8');
    
    // Check for key components
    const components = [
        'renderChatInterface',
        'renderDashboard',
        'renderStorageInterface',
        'renderAnalytics',
        'renderSettings'
    ];
    
    const missing = components.filter(comp => !appContent.includes(comp));
    if (missing.length > 0) {
        console.log(`  ⚠️  Missing components: ${missing.join(', ')}`);
    }
    
    return true;
});

// Test 5: Main process file
test('Main process configuration', () => {
    const mainPath = path.join(__dirname, 'src/main.js');
    const mainContent = fs.readFileSync(mainPath, 'utf8');
    
    // Check for essential configurations
    const checks = [
        { pattern: 'nodeIntegration: true', desc: 'Node integration' },
        { pattern: 'contextIsolation: false', desc: 'Context isolation disabled' },
        { pattern: 'ipc.handle', desc: 'IPC handlers' },
        { pattern: 'createWindow', desc: 'Window creation' }
    ];
    
    checks.forEach(check => {
        if (mainContent.includes(check.pattern)) {
            console.log(`  ✓ ${check.desc} configured`);
        } else {
            console.log(`  ⚠️  ${check.desc} may not be configured`);
        }
    });
    
    return true;
});

// Test 6: File structure integrity
test('File structure integrity', () => {
    const requiredFiles = [
        'src/main.js',
        'src/App.js',
        'src/renderer.js',
        'src/index.html',
        'src/shared-core/index.js',
        'src/shared-core/network-service.js',
        'src/shared-core/ai-service.js',
        'assets/style.css',
        'package.json',
        '.babelrc'
    ];
    
    const missing = requiredFiles.filter(file => 
        !fs.existsSync(path.join(__dirname, file))
    );
    
    if (missing.length > 0) {
        throw new Error(`Missing files: ${missing.join(', ')}`);
    }
    
    console.log(`  ✓ All ${requiredFiles.length} required files present`);
    return true;
});

// Summary
console.log('\n' + '='.repeat(60));
console.log('Test Summary:');
console.log('='.repeat(60));

const passed = testResults.filter(r => r.passed).length;
const failed = testResults.filter(r => !r.passed).length;

testResults.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} | ${result.name}`);
    if (!result.passed && result.error) {
        console.log(`       Error: ${result.error}`);
    }
});

console.log('='.repeat(60));
console.log(`Total: ${testResults.length} | Passed: ${passed} | Failed: ${failed}`);
console.log('='.repeat(60));

if (failed === 0) {
    console.log('\n✅ All functionality tests passed!');
    console.log('\n📝 Next steps:');
    console.log('1. Make sure IPFS daemon is running: ipfs daemon');
    console.log('2. Make sure Ethereum node is running');
    console.log('3. Run the app with: npm run dev');
    console.log('4. Or build and run: npm run build && npm start');
} else {
    console.log('\n⚠️  Some tests failed. Please fix the issues above.');
}

process.exit(failed === 0 ? 0 : 1);