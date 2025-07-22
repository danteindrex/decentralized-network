// MetaMask Integration for Bootstrap Node
const { ethers } = require('ethers');

class MetaMaskBootstrapNode {
    constructor(config = {}) {
        this.config = {
            useMetaMask: process.env.BOOTSTRAP_USE_METAMASK === 'true',
            fallbackAccount: process.env.BOOTSTRAP_FALLBACK_ACCOUNT,
            fallbackPrivateKey: process.env.BOOTSTRAP_FALLBACK_PRIVATE_KEY,
            chainId: parseInt(process.env.CHAIN_ID || '1337'),
            rpcUrl: process.env.ETH_NODE_URL || 'http://localhost:8545',
            ...config
        };
        
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    async init() {
        console.log('🦊 Initializing Bootstrap Node with MetaMask integration...');
        
        if (this.config.useMetaMask && typeof window !== 'undefined' && window.ethereum) {
            // Browser environment with MetaMask
            await this.initMetaMask();
        } else {
            // Node.js environment or MetaMask not available
            await this.initFallback();
        }
        
        console.log(`✅ Bootstrap Node initialized with account: ${this.account}`);
    }

    async initMetaMask() {
        try {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            
            // Request account access
            await window.ethereum.request({ method: 'eth_requestAccounts' });
            
            // Switch to correct network
            await this.switchNetwork();
            
            this.signer = this.provider.getSigner();
            this.account = await this.signer.getAddress();
            
        } catch (error) {
            console.warn('MetaMask initialization failed, falling back to private key:', error.message);
            await this.initFallback();
        }
    }

    async initFallback() {
        this.provider = new ethers.providers.JsonRpcProvider(this.config.rpcUrl);
        
        if (this.config.fallbackPrivateKey) {
            this.signer = new ethers.Wallet(this.config.fallbackPrivateKey, this.provider);
            this.account = this.signer.address;
        } else {
            throw new Error('No MetaMask available and no fallback private key provided');
        }
    }

    async switchNetwork() {
        const chainIdHex = `0x${this.config.chainId.toString(16)}`;
        
        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
            });
        } catch (switchError) {
            if (switchError.code === 4902) {
                // Network doesn't exist, add it
                await window.ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [{
                        chainId: chainIdHex,
                        chainName: process.env.CHAIN_NAME || 'Decentralized vLLM Network',
                        rpcUrls: [this.config.rpcUrl],
                        nativeCurrency: {
                            name: 'ETH',
                            symbol: 'ETH',
                            decimals: 18
                        }
                    }]
                });
            } else {
                throw switchError;
            }
        }
    }

    async signTransaction(transaction) {
        if (!this.signer) {
            throw new Error('No signer available');
        }
        
        return await this.signer.sendTransaction(transaction);
    }

    getAccount() {
        return this.account;
    }

    getSigner() {
        return this.signer;
    }
}

module.exports = { MetaMaskBootstrapNode };
