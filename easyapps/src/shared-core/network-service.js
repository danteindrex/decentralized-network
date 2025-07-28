const { Web3, HttpProvider } = require('web3');
const axios = require('axios');
const fs = require('fs'); // For Node.js file system operations

// Placeholder for configuration loading. In a real app, this would come from app settings.
let config = {
    eth_node: 'http://192.168.1.103:8545',
    ipfs_host: '192.168.1.103',
    ipfs_port: 5001,
    contract_address: '0xYourInferenceCoordinatorContractAddress', // Replace with actual address
    model_registry_address: '0xYourModelRegistryContractAddress', // Replace with actual address
    default_account: '0xYourDefaultAccountAddress', // Replace with actual account
    private_key: '0xYourPrivateKey' // Replace with actual private key (handle securely!)
};

// Function to set configuration (e.g., from Electron main process or React Native)
function setConfig(newConfig) {
    config = { ...config, ...newConfig };
}

// Initialize Web3 connection
function initWeb3() {
    try {
        const w3 = new Web3(new HttpProvider(config.eth_node));

        // Load contract ABI (simplified for demo, use actual ABI from your contracts)
        const contractAbi = [
            {
                "inputs": [{"name": "promptCID", "type": "string"}, {"name": "modelCID", "type": "string"}],
                "name": "submitPromptWithCID",
                "outputs": [{"name": "", "type": "uint256"}],
                "stateMutability": "payable",
                "type": "function"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "jobId", "type": "uint256"},
                    {"indexed": true, "name": "controller", "type": "address"},
                    {"name": "promptCID", "type": "string"},
                    {"indexed": true, "name": "modelId", "type": "string"},
                    {"indexed": true, "name": "modelCID", "type": "string"}
                ],
                "name": "InferenceRequested",
                "type": "event"
            },
            {
                "anonymous": false,
                "inputs": [
                    {"indexed": true, "name": "jobId", "type": "uint256"},
                    {"indexed": true, "name": "worker", "type": "address"},
                    {"name": "responseCID", "type": "string"}
                ],
                "name": "InferenceCompleted",
                "type": "event"
            }
        ];

        const contractAddress = w3.utils.toChecksumAddress(config.contract_address);
        const contract = new w3.eth.Contract(contractAbi, contractAddress);

        return { w3, contract };
    } catch (e) {
        console.error("Failed to initialize Web3:", e);
        return { w3: null, contract: null };
    }
}

// IPFS HTTP client functions
async function uploadToIpfs(fileContent, fileName, isJson = false) {
    try {
        const ipfsUrl = `http://${config.ipfs_host}:${config.ipfs_port}/api/v0/add`;
        
        let data = fileContent;
        if (isJson) {
            data = JSON.stringify(fileContent);
        }

        const formData = new FormData();
        // If fileContent is a Blob/File (from browser/Electron renderer),
        // append it directly. Otherwise, assume it's a Buffer/string.
        if (typeof Blob !== 'undefined' && fileContent instanceof Blob) {
            formData.append('file', fileContent, fileName);
        } else {
            formData.append('file', new Blob([data]), fileName);
        }

        const response = await axios.post(ipfsUrl, formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            },
            timeout: 30000 // 30 seconds timeout
        });

        if (response.status === 200 && response.data && response.data.Hash) {
            return response.data.Hash;
        } else {
            console.error("IPFS upload failed:", response.status, response.data);
            return null;
        }
    } catch (e) {
        console.error("Failed to upload to IPFS:", e);
        return null;
    }
}

async function fetchFromIpfs(cid) {
    try {
        const ipfsUrl = `http://${config.ipfs_host}:${config.ipfs_port}/api/v0/cat?arg=${cid}`;
        const response = await axios.post(ipfsUrl, null, { timeout: 30000 }); // IPFS cat is often a POST request

        if (response.status === 200) {
            try {
                return JSON.parse(response.data);
            } catch {
                return response.data;
            }
        } else {
            console.error("IPFS fetch failed:", response.status, response.data);
            return null;
        }
    } catch (e) {
        console.error("Failed to fetch from IPFS:", e);
        return null;
    }
}

async function submitInferenceJob(promptCid, modelCid, account, privateKey) {
    console.log("submitInferenceJob called with:", { promptCid, modelCid, account, privateKey: privateKey ? '[REDACTED]' : '[NONE]' });
    try {
        const { w3, contract } = initWeb3();
        if (!w3 || !contract) {
            console.error("Web3 or contract not initialized in submitInferenceJob.");
            throw new Error("Web3 or contract not initialized.");
        }

        console.log("Fetching nonce and gas price...");
        const nonce = await w3.eth.getTransactionCount(account);
        const gasPrice = await w3.eth.getGasPrice();
        console.log("Nonce:", nonce, "Gas Price:", gasPrice.toString());

        console.log("Encoding ABI...");
        const tx = contract.methods.submitPromptWithCID(promptCid, modelCid).encodeABI();
        console.log("ABI Encoded.");

        const transaction = {
            from: account,
            to: contract.options.address,
            gas: 200000, // Adjust gas limit as needed
            gasPrice: gasPrice,
            nonce: nonce,
            data: tx,
            value: '0x0'
        };
        console.log("Transaction object:", transaction);

        console.log("Signing transaction...");
        const signedTx = await w3.eth.accounts.signTransaction(transaction, privateKey);
        console.log("Transaction signed. Sending raw transaction...");
        const receipt = await w3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log("Transaction sent. Receipt:", receipt);

        let jobId = null;
        if (receipt.logs) {
            console.log("Checking logs for InferenceRequested event...");
            for (const log of receipt.logs) {
                try {
                    const decodedLog = w3.eth.abi.decodeLog(
                        contract.options.jsonInterface.find(i => i.name === 'InferenceRequested' && i.type === 'event').inputs,
                        log.data,
                        log.topics.slice(1)
                    );
                    if (decodedLog.jobId) {
                        jobId = decodedLog.jobId;
                        console.log("InferenceRequested event found. Job ID:", jobId);
                        break;
                    }
                } catch (e) {
                    // Not the event we are looking for, or decoding failed
                }
            }
        }
        
        return { txHash: receipt.transactionHash, jobId };
    } catch (e) {
        console.error("Failed to submit job:", e);
        return { txHash: null, jobId: null };
    }
}

async function monitorJobCompletion(jobId, timeout = 300) {
    console.log("monitorJobCompletion called for Job ID:", jobId);
    const { w3, contract } = initWeb3();
    if (!w3 || !contract) {
        console.error("Web3 or contract not initialized in monitorJobCompletion.");
        return { responseCid: null, worker: null };
    }

    const startTime = Date.now();
    const interval = 2000; // Check every 2 seconds

    return new Promise((resolve) => {
        const checkInterval = setInterval(async () => {
            if (Date.now() - startTime > timeout * 1000) {
                clearInterval(checkInterval);
                console.warn(`Job ${jobId} timed out.`);
                resolve({ responseCid: null, worker: null });
                return;
            }

            try {
                const events = await contract.getPastEvents('InferenceCompleted', {
                    filter: { jobId: jobId },
                    fromBlock: 0, 
                    toBlock: 'latest'
                });

                if (events.length > 0) {
                    const event = events.find(e => e.returnValues.jobId.toString() === jobId.toString());
                    if (event) {
                        clearInterval(checkInterval);
                        console.log(`Job ${jobId} completed. Response CID: ${event.returnValues.responseCID}`);
                        resolve({
                            responseCid: event.returnValues.responseCID,
                            worker: event.returnValues.worker
                        });
                        return;
                    }
                }
            } catch (e) {
                console.error(`Error monitoring job ${jobId}:`, e);
            }
        }, interval);
    });
}

// Utility functions from Streamlit app
function formatFileSize(sizeBytes) {
    if (sizeBytes === 0) {
        return "0 Bytes";
    }
    const sizeNames = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = parseInt(Math.floor(Math.log(sizeBytes) / Math.log(1024)));
    const p = Math.pow(1024, i);
    const s = Math.round(sizeBytes / p, 2);
    return `${s} ${sizeNames[i]}`;
}

function getMockStorageInfo() {
    // This should eventually fetch real data
    return {
        used_space: 2049024,  // ~2MB
        total_space: 1073741824,  // 1GB
        file_count: 0, // This will be updated by the UI
        available_space: 1073741824 - 2049024
    };
}

function getMockFiles() {
    // This should eventually fetch real data
    return []; // This will be updated by the UI
}

module.exports = {
    setConfig,
    initWeb3,
    uploadToIpfs,
    fetchFromIpfs,
    submitInferenceJob,
    monitorJobCompletion,
    formatFileSize,
    getMockStorageInfo,
    getMockFiles
};
