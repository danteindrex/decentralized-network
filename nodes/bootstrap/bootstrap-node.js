#!/usr/bin/env node

/**
 * Bootstrap/Rendez-vous Node
 * - Exactly 1 (or 2 for redundancy)
 * - Must have static IP + port 30303 open
 * - Runs a pruned full node (no mining)
 * - Job: give every new device a first peer
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class BootstrapNode {
    constructor(config = {}) {
        this.config = {
            chainId: 1337,
            networkId: 1337,
            port: 30303,
            rpcPort: 8545,
            wsPort: 8546,
            dataDir: './data/bootstrap',
            staticIP: config.staticIP || 'localhost',
            bootnodes: config.bootnodes || [],
            ...config
        };
        
        this.nodeKey = this.generateNodeKey();
        this.enode = this.generateEnode();
    }

    generateNodeKey() {
        // Generate or load existing node key
        const keyPath = path.join(this.config.dataDir, 'nodekey');
        if (fs.existsSync(keyPath)) {
            return fs.readFileSync(keyPath, 'utf8').trim();
        }
        
        // Generate new key (simplified - in production use proper crypto)
        const crypto = require('crypto');
        const key = crypto.randomBytes(32).toString('hex');
        
        // Ensure data directory exists
        if (!fs.existsSync(this.config.dataDir)) {
            fs.mkdirSync(this.config.dataDir, { recursive: true });
        }
        
        fs.writeFileSync(keyPath, key);
        return key;
    }

    generateEnode() {
        // Generate enode URL for this bootstrap node
        const publicKey = this.derivePublicKey(this.nodeKey);
        return `enode://${publicKey}@${this.config.staticIP}:${this.config.port}`;
    }

    derivePublicKey(privateKey) {
        // Simplified public key derivation (use proper secp256k1 in production)
        const crypto = require('crypto');
        return crypto.createHash('sha256').update(privateKey).digest('hex');
    }

    async start() {
        console.log('🚀 Starting Bootstrap Node...');
        console.log(`📍 Static IP: ${this.config.staticIP}`);
        console.log(`🔗 Enode: ${this.enode}`);
        console.log(`⛓️  Chain ID: ${this.config.chainId}`);
        
        const gethArgs = [
            '--datadir', this.config.dataDir,
            '--networkid', this.config.networkId.toString(),
            '--port', this.config.port.toString(),
            '--http',
            '--http.addr', '0.0.0.0',
            '--http.port', this.config.rpcPort.toString(),
            '--http.api', 'eth,net,web3,personal,txpool',
            '--ws',
            '--ws.addr', '0.0.0.0',
            '--ws.port', this.config.wsPort.toString(),
            '--ws.api', 'eth,net,web3',
            '--nodekey', path.join(this.config.dataDir, 'nodekey'),
            '--nat', 'extip:' + this.config.staticIP,
            '--maxpeers', '100',
            '--gcmode', 'archive', // Keep full state for bootstrap
            '--syncmode', 'full',
            '--mine', // Enable mining for block production
            '--miner.threads', '1',
            '--miner.etherbase', '0x71562b71999873db5b286df957af199ec94617f7',
            '--unlock', '0x71562b71999873db5b286df957af199ec94617f7',
            '--password', '/dev/null',
            '--allow-insecure-unlock'
        ];

        // Add bootnodes if any
        if (this.config.bootnodes.length > 0) {
            gethArgs.push('--bootnodes', this.config.bootnodes.join(','));
        }

        // Initialize genesis if needed
        await this.initGenesis();

        const geth = spawn('geth', gethArgs, {
            stdio: 'inherit',
            env: { ...process.env }
        });

        geth.on('error', (err) => {
            console.error('❌ Failed to start geth:', err);
            process.exit(1);
        });

        geth.on('exit', (code) => {
            console.log(`🛑 Bootstrap node exited with code ${code}`);
            process.exit(code);
        });

        // Handle graceful shutdown
        process.on('SIGINT', () => {
            console.log('\n🛑 Shutting down bootstrap node...');
            geth.kill('SIGTERM');
        });

        // Save enode info for other nodes
        this.saveBootstrapInfo();
    }

    async initGenesis() {
        const genesisPath = path.join(__dirname, '../../genesis.json');
        if (!fs.existsSync(genesisPath)) {
            console.error('❌ Genesis file not found');
            process.exit(1);
        }

        const initArgs = ['init', '--datadir', this.config.dataDir, genesisPath];
        
        return new Promise((resolve, reject) => {
            const init = spawn('geth', initArgs, { stdio: 'pipe' });
            
            init.on('exit', (code) => {
                if (code === 0) {
                    console.log('✅ Genesis initialized');
                    resolve();
                } else {
                    reject(new Error(`Genesis init failed with code ${code}`));
                }
            });
        });
    }

    saveBootstrapInfo() {
        const info = {
            enode: this.enode,
            staticIP: this.config.staticIP,
            port: this.config.port,
            rpcPort: this.config.rpcPort,
            wsPort: this.config.wsPort,
            chainId: this.config.chainId,
            timestamp: new Date().toISOString()
        };

        const infoPath = path.join(__dirname, '../bootstrap-info.json');
        fs.writeFileSync(infoPath, JSON.stringify(info, null, 2));
        console.log(`📝 Bootstrap info saved to ${infoPath}`);
    }
}

// CLI usage
if (require.main === module) {
    const config = {
        staticIP: process.env.STATIC_IP || 'localhost'
    };

    const bootstrap = new BootstrapNode(config);
    bootstrap.start().catch(console.error);
}

module.exports = BootstrapNode;