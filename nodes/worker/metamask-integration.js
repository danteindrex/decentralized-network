// MetaMask Integration for Worker Node
const { ethers } = require('ethers');

class MetaMaskWorkerNode {
    constructor(config = {}) {
        this.config = {
            useMetaMask: process.env.WORKER_USE_METAMASK === 'true',
            fallbackAccount: process.env.WORKER_FALLBACK_ACCOUNT,
            fallbackPrivateKey: process.env.WORKER_FALLBACK_PRIVATE_KEY,
            chainId: parseInt(process.env.CHAIN_ID || '1337'),
            rpcUrl: process.env.ETH_NODE_URL || 'https://bootstrap-node.onrender.com/rpc',
            ...config
        };
        
        this.provider = null;
        this.signer = null;
        this.account = null;
    }

    async init() {
        console.log('🦊 Initializing Worker Node with MetaMask integration...');
        
        if (this.config.useMetaMask && typeof window !== 'undefined' && window.ethereum) {
            await this.initMetaMask();
        } else {
            await this.initFallback();
        }
        
        console.log(`✅ Worker Node initialized with account: ${this.account}`);
    }

    async initMetaMask() {
        try {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            await window.ethereum.request({ method: 'eth_requestAccounts' });
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

    async submitTaskResponse(jobId, responseCID) {
        if (!this.signer) {
            throw new Error('No signer available');
        }
        
        // Implementation would interact with smart contract
        console.log(`Submitting response for job ${jobId}: ${responseCID}`);
    }

    getAccount() {
        return this.account;
    }

    getSigner() {
        return this.signer;
    }
}

module.exports = { MetaMaskWorkerNode };
