// Blockchain interaction utilities
const { Web3 } = require('web3');
const fs = require('fs');
const path = require('path');

class BlockchainClient {
    constructor(nodeUrl, privateKey, defaultAccount) {
        this.web3 = new Web3(nodeUrl);
        this.nodeUrl = nodeUrl;
        
        if (privateKey) {
            this.account = this.web3.eth.accounts.privateKeyToAccount(privateKey);
            this.web3.eth.accounts.wallet.add(this.account);
            this.web3.eth.defaultAccount = this.account.address;
        } else if (defaultAccount) {
            this.web3.eth.defaultAccount = defaultAccount;
        }
    }

    async loadContract(contractName, address) {
        try {
            const abiPath = path.join(__dirname, '../../orchestrator/abis', `${contractName}.json`);
            if (!fs.existsSync(abiPath)) {
                throw new Error(`ABI file not found: ${abiPath}`);
            }
            
            const abi = JSON.parse(fs.readFileSync(abiPath, 'utf8'));
            return new this.web3.eth.Contract(abi, address);
        } catch (error) {
            console.error(`Error loading contract ${contractName}:`, error);
            throw error;
        }
    }

    async getBalance(address) {
        try {
            const balance = await this.web3.eth.getBalance(address || this.web3.eth.defaultAccount);
            return this.web3.utils.fromWei(balance, 'ether');
        } catch (error) {
            console.error('Error getting balance:', error);
            return '0';
        }
    }

    async sendTransaction(to, data, value = '0') {
        try {
            const tx = {
                from: this.web3.eth.defaultAccount,
                to: to,
                data: data,
                value: this.web3.utils.toWei(value, 'ether'),
                gas: 500000
            };

            const result = await this.web3.eth.sendTransaction(tx);
            return result;
        } catch (error) {
            console.error('Error sending transaction:', error);
            throw error;
        }
    }

    async isConnected() {
        try {
            await this.web3.eth.getBlockNumber();
            return true;
        } catch (error) {
            return false;
        }
    }
}

module.exports = {
    BlockchainClient
};