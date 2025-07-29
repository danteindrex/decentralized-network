#!/usr/bin/env node

/**
 * Diagnose Electron App Issues
 */

const path = require('path');
const fs = require('fs');

console.log('🔍 Diagnosing Electron App...\n');

// Check Node.js version
console.log('Node.js version:', process.version);

// Check if running in Electron
console.log('Running in Electron:', !!process.versions.electron);

// Check main files
const files = [
    'src/main.js',
    'src/App.js',
    'src/index.html',
    'src/shared-core/index.js',
    'src/shared-core/network-service.js',
    'src/shared-core/ai-service.js',
    'build/main.js',
    'build/App.js',
    'build/index.html'
];

console.log('\n📁 File Check:');
files.forEach(file => {
    const exists = fs.existsSync(path.join(__dirname, file));
    console.log(`${exists ? '✅' : '❌'} ${file}`);
});

// Check dependencies
console.log('\n📦 Key Dependencies:');
try {
    const pkg = require('./package.json');
    const deps = ['electron', 'react', 'web3', 'axios', 'ipfs-http-client'];
    deps.forEach(dep => {
        const version = pkg.dependencies[dep] || pkg.devDependencies[dep];
        console.log(`${version ? '✅' : '❌'} ${dep}: ${version || 'NOT FOUND'}`);
    });
} catch (e) {
    console.error('❌ Could not read package.json');
}

// Test imports
console.log('\n🧪 Testing Imports:');

// Test React import
try {
    require('./build/App.js');
    console.log('✅ React app can be imported');
} catch (e) {
    console.log('❌ React app import failed:', e.message);
}

// Test shared-core
try {
    const sharedCore = require('./src/shared-core');
    const functions = Object.keys(sharedCore);
    console.log(`✅ Shared-core exports ${functions.length} functions`);
    console.log('   Functions:', functions.slice(0, 5).join(', '), '...');
} catch (e) {
    console.log('❌ Shared-core import failed:', e.message);
}

// Check for common issues
console.log('\n⚠️  Common Issues:');

// Check if babel is configured
if (!fs.existsSync(path.join(__dirname, '.babelrc'))) {
    console.log('❌ .babelrc not found - Babel may not transpile correctly');
} else {
    const babelrc = JSON.parse(fs.readFileSync(path.join(__dirname, '.babelrc'), 'utf8'));
    console.log('✅ Babel configured with presets:', babelrc.presets.join(', '));
}

// Check if index.html references correct scripts
if (fs.existsSync(path.join(__dirname, 'src/index.html'))) {
    const html = fs.readFileSync(path.join(__dirname, 'src/index.html'), 'utf8');
    if (html.includes('App.js')) {
        console.log('✅ index.html references App.js');
    } else {
        console.log('❌ index.html does not reference App.js');
    }
}

// Check main.js for common issues
if (fs.existsSync(path.join(__dirname, 'src/main.js'))) {
    const mainJs = fs.readFileSync(path.join(__dirname, 'src/main.js'), 'utf8');
    
    if (mainJs.includes('nodeIntegration: true')) {
        console.log('✅ Node integration enabled');
    } else {
        console.log('❌ Node integration not enabled');
    }
    
    if (mainJs.includes('contextIsolation: false')) {
        console.log('✅ Context isolation disabled (required for shared-core)');
    } else {
        console.log('❌ Context isolation not disabled');
    }
}

console.log('\n💡 Recommendations:');
console.log('1. Run "npm install" to ensure all dependencies are installed');
console.log('2. Run "npm run build" before "npm start"');
console.log('3. For development, use "npm run dev" instead of "npm start"');
console.log('4. Check console errors when the app starts');
console.log('5. Use "export DISPLAY=:0" if running on a headless system');