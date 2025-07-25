const fs = require('fs');
const path = require('path');
const os = require('os');

class KeyUtils {
    constructor() {
        this.keyDir = path.join(os.homedir(), '.decentralized-vllm', 'keys');
    }

    loadPrivateKey(role) {
        // Try to load from secure key file first
        const keyFile = path.join(this.keyDir, `${role}.key`);
        
        if (fs.existsSync(keyFile)) {
            const stats = fs.statSync(keyFile);
            const perms = (stats.mode & parseInt('777', 8)).toString(8);
            
            if (perms !== '600') {
                console.warn(`⚠️ Insecure permissions on ${keyFile}: ${perms} (should be 600)`);
            }
            
            const key = fs.readFileSync(keyFile, 'utf8').trim();
            console.log(`🔐 Loaded secure key for ${role}`);
            return key;
        }
        
        // Fallback to environment variables (for backward compatibility)
        const envVars = {
            bootstrap: ['BOOTSTRAP_PRIVATE_KEY', 'BOOTSTRAP_FALLBACK_PRIVATE_KEY'],
            worker: ['WORKER_PRIVATE_KEY', 'WORKER_FALLBACK_PRIVATE_KEY'],
            owner: ['OWNER_PRIVATE_KEY', 'OWNER_FALLBACK_PRIVATE_KEY'],
            user: ['USER_PRIVATE_KEY', 'USER_FALLBACK_PRIVATE_KEY'],
            orchestrator: ['ORCHESTRATOR_PRIVATE_KEY', 'PRIVATE_KEY']
        };
        
        const possibleEnvVars = envVars[role] || ['PRIVATE_KEY'];
        
        for (const envVar of possibleEnvVars) {
            const key = process.env[envVar];
            if (key && key.startsWith('0x') && key.length === 66) {
                console.warn(`⚠️ Using private key from environment variable ${envVar}. Consider using secure key files.`);
                return key;
            }
        }
        
        throw new Error(`No valid private key found for role: ${role}. Run 'node scripts/setup_secure_keys.js setup' to generate secure keys.`);
    }

    loadAccount(role) {
        const privateKey = this.loadPrivateKey(role);
        
        // Derive account address
        const Web3 = require('web3');
        const web3 = new Web3();
        const account = web3.eth.accounts.privateKeyToAccount(privateKey);
        
        return {
            privateKey,
            address: account.address,
            account: account
        };
    }

    validateKeyFormat(privateKey) {
        return privateKey && 
               typeof privateKey === 'string' && 
               privateKey.startsWith('0x') && 
               privateKey.length === 66 &&
               /^0x[a-fA-F0-9]{64}$/.test(privateKey);
    }

    secureKeyExists(role) {
        const keyFile = path.join(this.keyDir, `${role}.key`);
        return fs.existsSync(keyFile);
    }

    getAllRoleKeys() {
        const roles = ['bootstrap', 'worker', 'owner', 'user', 'orchestrator'];
        const keys = {};
        
        for (const role of roles) {
            try {
                keys[role] = this.loadAccount(role);
            } catch (err) {
                console.warn(`⚠️ Could not load key for ${role}: ${err.message}`);
            }
        }
        
        return keys;
    }
}

module.exports = KeyUtils;