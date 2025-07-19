/**
 * MetaMask and Web3 Wallet Integration for Decentralized vLLM Network
 * Supports desktop MetaMask, mobile MetaMask, and WalletConnect
 */

class WalletManager {
    constructor(config = {}) {
        this.config = {
            chainId: '0x539', // 1337 in hex for your private network
            chainName: 'Decentralized vLLM Network',
            rpcUrl: 'http://localhost:8545',
            blockExplorerUrl: null,
            ...config
        };
        
        this.provider = null;
        this.signer = null;
        this.account = null;
        this.isConnected = false;
        
        // Event listeners
        this.onAccountChange = null;
        this.onChainChange = null;
        this.onConnect = null;
        this.onDisconnect = null;
    }

    /**
     * Initialize wallet connection
     */
    async init() {
        try {
            // Check if MetaMask is available
            if (typeof window !== 'undefined' && window.ethereum) {
                this.provider = window.ethereum;
                await this.setupEventListeners();
                
                // Check if already connected
                const accounts = await this.provider.request({ method: 'eth_accounts' });
                if (accounts.length > 0) {
                    await this.handleAccountsChanged(accounts);
                }
                
                return true;
            } else {
                console.warn('MetaMask not detected. Please install MetaMask.');
                return false;
            }
        } catch (error) {
            console.error('Failed to initialize wallet:', error);
            return false;
        }
    }

    /**
     * Connect to MetaMask wallet
     */
    async connect() {
        try {
            if (!this.provider) {
                throw new Error('MetaMask not available');
            }

            // Request account access
            const accounts = await this.provider.request({
                method: 'eth_requestAccounts'
            });

            if (accounts.length === 0) {
                throw new Error('No accounts found');
            }

            // Switch to correct network
            await this.switchToPrivateNetwork();

            // Set up Web3 provider
            if (typeof ethers !== 'undefined') {
                const web3Provider = new ethers.providers.Web3Provider(this.provider);
                this.signer = web3Provider.getSigner();
            }

            this.account = accounts[0];
            this.isConnected = true;

            console.log('✅ Connected to wallet:', this.account);
            
            if (this.onConnect) {
                this.onConnect(this.account);
            }

            return {
                account: this.account,
                provider: this.provider,
                signer: this.signer
            };

        } catch (error) {
            console.error('Failed to connect wallet:', error);
            throw error;
        }
    }

    /**
     * Switch to private network or add it if not exists
     */
    async switchToPrivateNetwork() {
        try {
            // Try to switch to the network
            await this.provider.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: this.config.chainId }],
            });
        } catch (switchError) {
            // Network doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await this.provider.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: this.config.chainId,
                            chainName: this.config.chainName,
                            rpcUrls: [this.config.rpcUrl],
                            blockExplorerUrls: this.config.blockExplorerUrl ? [this.config.blockExplorerUrl] : null,
                            nativeCurrency: {
                                name: 'ETH',
                                symbol: 'ETH',
                                decimals: 18
                            }
                        }]
                    });
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                    throw addError;
                }
            } else {
                console.error('Failed to switch network:', switchError);
                throw switchError;
            }
        }
    }

    /**
     * Setup event listeners for wallet events
     */
    async setupEventListeners() {
        if (!this.provider) return;

        // Account changes
        this.provider.on('accountsChanged', (accounts) => {
            this.handleAccountsChanged(accounts);
        });

        // Chain changes
        this.provider.on('chainChanged', (chainId) => {
            this.handleChainChanged(chainId);
        });

        // Connection events
        this.provider.on('connect', (connectInfo) => {
            console.log('Wallet connected:', connectInfo);
        });

        this.provider.on('disconnect', (error) => {
            console.log('Wallet disconnected:', error);
            this.handleDisconnect();
        });
    }

    /**
     * Handle account changes
     */
    async handleAccountsChanged(accounts) {
        if (accounts.length === 0) {
            this.handleDisconnect();
        } else {
            this.account = accounts[0];
            this.isConnected = true;
            
            if (this.onAccountChange) {
                this.onAccountChange(this.account);
            }
        }
    }

    /**
     * Handle chain changes
     */
    handleChainChanged(chainId) {
        console.log('Chain changed to:', chainId);
        
        if (chainId !== this.config.chainId) {
            console.warn('Wrong network detected. Please switch to the correct network.');
        }
        
        if (this.onChainChange) {
            this.onChainChange(chainId);
        }
    }

    /**
     * Handle disconnect
     */
    handleDisconnect() {
        this.account = null;
        this.isConnected = false;
        this.signer = null;
        
        if (this.onDisconnect) {
            this.onDisconnect();
        }
    }

    /**
     * Sign a transaction
     */
    async signTransaction(transaction) {
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }

        try {
            return await this.signer.sendTransaction(transaction);
        } catch (error) {
            console.error('Transaction failed:', error);
            throw error;
        }
    }

    /**
     * Sign a message
     */
    async signMessage(message) {
        if (!this.signer) {
            throw new Error('Wallet not connected');
        }

        try {
            return await this.signer.signMessage(message);
        } catch (error) {
            console.error('Message signing failed:', error);
            throw error;
        }
    }

    /**
     * Get account balance
     */
    async getBalance() {
        if (!this.account || !this.provider) {
            throw new Error('Wallet not connected');
        }

        try {
            const balance = await this.provider.request({
                method: 'eth_getBalance',
                params: [this.account, 'latest']
            });
            
            return parseInt(balance, 16) / Math.pow(10, 18); // Convert to ETH
        } catch (error) {
            console.error('Failed to get balance:', error);
            throw error;
        }
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.handleDisconnect();
        console.log('Wallet disconnected');
    }

    /**
     * Check if on correct network
     */
    async isOnCorrectNetwork() {
        if (!this.provider) return false;

        try {
            const chainId = await this.provider.request({ method: 'eth_chainId' });
            return chainId === this.config.chainId;
        } catch (error) {
            console.error('Failed to check network:', error);
            return false;
        }
    }
}

/**
 * Mobile-specific wallet integration using WalletConnect
 */
class MobileWalletManager extends WalletManager {
    constructor(config = {}) {
        super(config);
        this.walletConnect = null;
    }

    /**
     * Initialize mobile wallet connection
     */
    async init() {
        try {
            // Check if MetaMask mobile is available
            if (this.isMobileMetaMask()) {
                return await super.init();
            }
            
            // Fallback to WalletConnect for other mobile browsers
            return await this.initWalletConnect();
        } catch (error) {
            console.error('Failed to initialize mobile wallet:', error);
            return false;
        }
    }

    /**
     * Check if MetaMask mobile is available
     */
    isMobileMetaMask() {
        return typeof window !== 'undefined' && 
               window.ethereum && 
               window.ethereum.isMetaMask;
    }

    /**
     * Initialize WalletConnect for mobile browsers
     */
    async initWalletConnect() {
        try {
            // This would require WalletConnect library
            console.log('Initializing WalletConnect for mobile...');
            
            // For now, redirect to MetaMask mobile
            this.redirectToMetaMaskMobile();
            
            return false;
        } catch (error) {
            console.error('WalletConnect initialization failed:', error);
            return false;
        }
    }

    /**
     * Redirect to MetaMask mobile app
     */
    redirectToMetaMaskMobile() {
        const currentUrl = window.location.href;
        const metamaskUrl = `https://metamask.app.link/dapp/${currentUrl}`;
        
        // Show user instructions
        this.showMobileInstructions(metamaskUrl);
    }

    /**
     * Show mobile connection instructions
     */
    showMobileInstructions(metamaskUrl) {
        const instructions = `
            <div id="mobile-wallet-instructions" style="
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0,0,0,0.8); z-index: 10000;
                display: flex; align-items: center; justify-content: center;
                color: white; font-family: Arial, sans-serif;
            ">
                <div style="
                    background: white; color: black; padding: 20px;
                    border-radius: 10px; max-width: 400px; text-align: center;
                ">
                    <h3>🦊 Connect with MetaMask</h3>
                    <p>To connect your wallet on mobile:</p>
                    <ol style="text-align: left;">
                        <li>Install MetaMask mobile app</li>
                        <li>Open MetaMask and tap "Browser"</li>
                        <li>Navigate to this website</li>
                        <li>Or tap the button below</li>
                    </ol>
                    <button onclick="window.open('${metamaskUrl}', '_blank')" style="
                        background: #f6851b; color: white; border: none;
                        padding: 10px 20px; border-radius: 5px; margin: 10px;
                        cursor: pointer; font-size: 16px;
                    ">
                        Open in MetaMask
                    </button>
                    <button onclick="document.getElementById('mobile-wallet-instructions').remove()" style="
                        background: #ccc; color: black; border: none;
                        padding: 10px 20px; border-radius: 5px; margin: 10px;
                        cursor: pointer;
                    ">
                        Cancel
                    </button>
                </div>
            </div>
        `;
        
        document.body.insertAdjacentHTML('beforeend', instructions);
    }
}

/**
 * Utility functions for wallet integration
 */
const WalletUtils = {
    /**
     * Detect device type
     */
    isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    },

    /**
     * Create appropriate wallet manager
     */
    createWalletManager(config = {}) {
        if (this.isMobile()) {
            return new MobileWalletManager(config);
        } else {
            return new WalletManager(config);
        }
    },

    /**
     * Format address for display
     */
    formatAddress(address) {
        if (!address) return '';
        return `${address.slice(0, 6)}...${address.slice(-4)}`;
    },

    /**
     * Format balance for display
     */
    formatBalance(balance) {
        return parseFloat(balance).toFixed(4);
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { WalletManager, MobileWalletManager, WalletUtils };
}

// Global access for browser
if (typeof window !== 'undefined') {
    window.WalletManager = WalletManager;
    window.MobileWalletManager = MobileWalletManager;
    window.WalletUtils = WalletUtils;
}