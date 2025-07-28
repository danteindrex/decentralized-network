#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');

class SecureKeyManager {
    constructor() {
        this.keyDir = path.join(os.homedir(), '.decentralized-vllm', 'keys');
        this.configDir = path.join(os.homedir(), '.decentralized-vllm', 'config');
    }

    ensureDirectories() {
        // Create key directory with secure permissions
        if (!fs.existsSync(this.keyDir)) {
            fs.mkdirSync(this.keyDir, { recursive: true, mode: 0o700 });
        }
        
        if (!fs.existsSync(this.configDir)) {
            fs.mkdirSync(this.configDir, { recursive: true, mode: 0o700 });
        }
        
        // Ensure proper permissions
        fs.chmodSync(this.keyDir, 0o700);
        fs.chmodSync(this.configDir, 0o700);
    }

    generateSecureKey() {
        return '0x' + crypto.randomBytes(32).toString('hex');
    }

    saveKey(role, privateKey) {
        const keyFile = path.join(this.keyDir, `${role}.key`);
        fs.writeFileSync(keyFile, privateKey, { mode: 0o600 });
        console.log(`✅ Secure key generated for ${role}: ${keyFile}`);
        return keyFile;
    }

    loadKey(role) {
        const keyFile = path.join(this.keyDir, `${role}.key`);
        if (!fs.existsSync(keyFile)) {
            throw new Error(`Key file not found for role: ${role}`);
        }
        
        // Verify permissions
        const stats = fs.statSync(keyFile);
        const perms = (stats.mode & parseInt('777', 8)).toString(8);
        if (perms !== '600') {
            console.warn(`⚠️ Insecure permissions on ${keyFile}: ${perms} (should be 600)`);
        }
        
        return fs.readFileSync(keyFile, 'utf8').trim();
    }

    keyExists(role) {
        const keyFile = path.join(this.keyDir, `${role}.key`);
        return fs.existsSync(keyFile);
    }

    validateKeyFormat(privateKey) {
        return privateKey && 
               typeof privateKey === 'string' && 
               privateKey.startsWith('0x') && 
               privateKey.length === 66 &&
               /^0x[a-fA-F0-9]{64}$/.test(privateKey);
    }

    setupRoleKeys() {
        const roles = ['bootstrap', 'worker', 'owner', 'user', 'orchestrator'];
        const keyPaths = {};
        
        this.ensureDirectories();
        
        for (const role of roles) {
            if (!this.keyExists(role)) {
                const privateKey = this.generateSecureKey();
                const keyPath = this.saveKey(role, privateKey);
                keyPaths[role] = keyPath;
                
                // Derive address for reference
                const { Web3 } = require('web3');
                const web3 = new Web3();
                const account = web3.eth.accounts.privateKeyToAccount(privateKey);
                console.log(`   📍 ${role} address: ${account.address}`);
            } else {
                const keyPath = path.join(this.keyDir, `${role}.key`);
                keyPaths[role] = keyPath;
                console.log(`✅ Using existing key for ${role}: ${keyPath}`);
            }
        }
        
        return keyPaths;
    }

    createSecureEnvTemplate() {
        const envTemplate = `# Secure Environment Configuration
# Keys are stored in secure files, not in this file
# Generated on ${new Date().toISOString()}

# Key file paths (secure)
BOOTSTRAP_KEY_FILE=${path.join(this.keyDir, 'bootstrap.key')}
WORKER_KEY_FILE=${path.join(this.keyDir, 'worker.key')}
OWNER_KEY_FILE=${path.join(this.keyDir, 'owner.key')}
USER_KEY_FILE=${path.join(this.keyDir, 'user.key')}
ORCHESTRATOR_KEY_FILE=${path.join(this.keyDir, 'orchestrator.key')}

# Network Configuration
STATIC_IP=localhost
BOOTSTRAP_PORT=30303
ETH_NODE_URL=http://localhost:8545
IPFS_HOST=127.0.0.1
IPFS_PORT=5001

# Resource Configuration
CPU_CONTRIBUTION=10
RAM_CONTRIBUTION=15
GPU_CONTRIBUTION=10
STORAGE_CONTRIBUTION=5

# Security Settings
ENABLE_HTTPS=false
API_RATE_LIMIT=100
REQUEST_TIMEOUT=300

# Monitoring
HEALTH_CHECK_PORT=9090
METRICS_PORT=9091
LOG_LEVEL=INFO
`;
        
        const envFile = path.join(process.cwd(), '.env.secure');
        fs.writeFileSync(envFile, envTemplate);
        console.log(`✅ Secure environment template created: ${envFile}`);
        
        return envFile;
    }

    validateKeySetup() {
        const roles = ['bootstrap', 'worker', 'owner', 'user', 'orchestrator'];
        let allValid = true;
        
        console.log('\n🔍 Validating key setup...');
        
        for (const role of roles) {
            try {
                const key = this.loadKey(role);
                if (key && key.startsWith('0x') && key.length === 66) {
                    console.log(`✅ ${role}: Valid key found`);
                } else {
                    console.log(`❌ ${role}: Invalid key format`);
                    allValid = false;
                }
            } catch (err) {
                console.log(`❌ ${role}: ${err.message}`);
                allValid = false;
            }
        }
        
        return allValid;
    }
}

// CLI functionality
if (require.main === module) {
    const keyManager = new SecureKeyManager();
    
    const action = process.argv[2] || 'setup';
    
    switch (action) {
        case 'setup':
            console.log('🔐 Setting up secure key management...');
            const keyPaths = keyManager.setupRoleKeys();
            keyManager.createSecureEnvTemplate();
            
            if (keyManager.validateKeySetup()) {
                console.log('\n✅ Secure key setup completed successfully!');
                console.log('\n📋 Next steps:');
                console.log('1. Copy .env.secure to .env and customize as needed');
                console.log('2. Never commit key files to version control');
                console.log('3. Backup your key directory securely');
                console.log(`4. Key directory: ${keyManager.keyDir}`);
            } else {
                console.log('\n❌ Key setup validation failed!');
                process.exit(1);
            }
            break;
            
        case 'validate':
            if (keyManager.validateKeySetup()) {
                console.log('\n✅ All keys are valid');
                process.exit(0);
            } else {
                console.log('\n❌ Key validation failed');
                process.exit(1);
            }
            break;
            
        case 'generate':
            const role = process.argv[3];
            if (!role) {
                console.log('Usage: node setup_secure_keys.js generate <role>');
                process.exit(1);
            }
            keyManager.ensureDirectories();
            const newKey = keyManager.generateSecureKey();
            keyManager.saveKey(role, newKey);
            break;
            
        default:
            console.log('Usage: node setup_secure_keys.js [setup|validate|generate]');
            break;
    }
}

module.exports = SecureKeyManager;