#!/usr/bin/env node

/**
 * Test startup script for Electron app
 * Helps diagnose startup issues
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('🚀 Starting Electron App Test...\n');

// Check environment
console.log('Environment Check:');
console.log('  Node version:', process.version);
console.log('  Platform:', process.platform);
console.log('  Current directory:', __dirname);
console.log('  DISPLAY:', process.env.DISPLAY || 'Not set (GUI will fail)');

// Check if build exists
const buildExists = fs.existsSync(path.join(__dirname, 'build'));
if (!buildExists) {
    console.log('\n❌ Build directory not found!');
    console.log('   Running build process...');
    
    const build = spawn('npm', ['run', 'build'], { 
        stdio: 'inherit',
        cwd: __dirname 
    });
    
    build.on('exit', (code) => {
        if (code === 0) {
            console.log('✅ Build completed successfully');
            startElectron();
        } else {
            console.log('❌ Build failed');
            process.exit(1);
        }
    });
} else {
    console.log('✅ Build directory exists');
    startElectron();
}

function startElectron() {
    console.log('\n🎯 Starting Electron...');
    
    // For headless systems
    if (!process.env.DISPLAY) {
        console.log('\n⚠️  No DISPLAY variable set!');
        console.log('For headless systems, you can:');
        console.log('1. Use Xvfb: xvfb-run -a npm start');
        console.log('2. Set DISPLAY: export DISPLAY=:0');
        console.log('3. Use SSH with X11 forwarding: ssh -X user@host');
        
        // Try to start with xvfb if available
        console.log('\nAttempting to start with xvfb-run...');
        const xvfb = spawn('xvfb-run', ['-a', 'npm', 'start'], {
            stdio: 'inherit',
            cwd: __dirname
        });
        
        xvfb.on('error', (err) => {
            console.log('\n❌ xvfb-run not available');
            console.log('Install with: sudo apt-get install xvfb');
            startWithoutDisplay();
        });
        
        xvfb.on('exit', (code) => {
            console.log(`\nElectron exited with code: ${code}`);
        });
    } else {
        // Normal start
        const electron = spawn('npm', ['start'], {
            stdio: 'inherit',
            cwd: __dirname,
            env: { ...process.env }
        });
        
        electron.on('error', (err) => {
            console.error('❌ Failed to start:', err);
        });
        
        electron.on('exit', (code) => {
            console.log(`\nElectron exited with code: ${code}`);
        });
    }
}

function startWithoutDisplay() {
    console.log('\n📝 Alternative: Testing core functionality without GUI...\n');
    
    // Test the core modules
    try {
        const sharedCore = require('./src/shared-core');
        console.log('✅ Shared-core loaded successfully');
        console.log('   Available functions:', Object.keys(sharedCore).length);
        
        // Test auto-config
        sharedCore.generateAutoConfig().then(config => {
            console.log('\n✅ Auto-configuration test successful:');
            console.log('   Generated wallet:', config.default_account);
            console.log('   Network ID:', config.network_id);
            console.log('\n✅ Core functionality is working!');
            console.log('\n📱 To run the GUI app:');
            console.log('   1. Ensure you have a display (physical or virtual)');
            console.log('   2. Run: npm start');
            console.log('   3. Or use: xvfb-run -a npm start');
        }).catch(err => {
            console.error('❌ Auto-config test failed:', err.message);
        });
        
    } catch (error) {
        console.error('❌ Failed to load shared-core:', error.message);
    }
}