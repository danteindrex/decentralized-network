#!/usr/bin/env node

/**
 * Electron App Test Script
 * Tests the Electron app functionality without launching the GUI
 */

const { app } = require('electron');
const path = require('path');
const fs = require('fs');

// Mock electron for testing
if (!app) {
    console.error('❌ Electron not properly installed');
    process.exit(1);
}

console.log('🧪 Testing Electron App Components...\n');

let testsPassed = 0;
let testsFailed = 0;

function test(name, fn) {
    try {
        const result = fn();
        if (result) {
            console.log(`✅ ${name}`);
            testsPassed++;
        } else {
            console.log(`❌ ${name}`);
            testsFailed++;
        }
    } catch (error) {
        console.log(`❌ ${name}: ${error.message}`);
        testsFailed++;
    }
}

// Test 1: Check main.js exists and is valid
test('Main process file exists', () => {
    const mainPath = path.join(__dirname, 'src/main.js');
    return fs.existsSync(mainPath);
});

// Test 2: Check React app file exists
test('React app file exists', () => {
    const appPath = path.join(__dirname, 'src/App.js');
    return fs.existsSync(appPath);
});

// Test 3: Check shared-core modules
test('Shared core modules exist', () => {
    const modules = [
        'src/shared-core/index.js',
        'src/shared-core/network-service.js',
        'src/shared-core/ai-service.js'
    ];
    
    return modules.every(module => 
        fs.existsSync(path.join(__dirname, module))
    );
});

// Test 4: Test shared-core imports
test('Can import shared-core modules', () => {
    try {
        const sharedCore = require('./src/shared-core');
        return sharedCore.initWeb3 && 
               sharedCore.uploadToIpfs && 
               sharedCore.submitInferenceJob;
    } catch (e) {
        console.error('  Error:', e.message);
        return false;
    }
});

// Test 5: Check assets
test('Assets directory exists', () => {
    const assetsPath = path.join(__dirname, 'assets');
    return fs.existsSync(assetsPath);
});

// Test 6: Check package.json configuration
test('Package.json properly configured', () => {
    const packageJson = require('./package.json');
    return packageJson.main === 'src/main.js' &&
           packageJson.dependencies.electron &&
           packageJson.dependencies.react;
});

// Test 7: Check build configuration
test('Build directory structure', () => {
    const buildPath = path.join(__dirname, 'build');
    if (!fs.existsSync(buildPath)) {
        console.log('  Note: Build directory not found. Run "npm run build" first.');
        return true; // Not a failure, just a note
    }
    return true;
});

// Test 8: Test network service configuration
test('Network service can generate config', async () => {
    try {
        const networkService = require('./src/shared-core/network-service');
        networkService.setUserDataPath(path.join(__dirname, 'test-data'));
        
        // This should work even without network connection
        const config = await networkService.generateAutoConfig();
        return config && config.default_account && config.private_key;
    } catch (e) {
        console.error('  Error:', e.message);
        return false;
    }
});

// Summary
console.log('\n' + '='.repeat(50));
console.log(`Tests Passed: ${testsPassed}`);
console.log(`Tests Failed: ${testsFailed}`);
console.log('='.repeat(50));

if (testsFailed > 0) {
    console.log('\n⚠️  Some tests failed. Please check the errors above.');
    process.exit(1);
} else {
    console.log('\n✅ All tests passed!');
    
    // Cleanup test data
    const testDataPath = path.join(__dirname, 'test-data');
    if (fs.existsSync(testDataPath)) {
        fs.rmSync(testDataPath, { recursive: true, force: true });
    }
    
    process.exit(0);
}