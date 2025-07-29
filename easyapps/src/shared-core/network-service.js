const { Web3, HttpProvider } = require('web3');
const axios = require('axios');
const fs = require('fs'); // For Node.js file system operations
const path = require('path');

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

let userDataPath = ''; // This will be set by the main process
const CHAT_CIDS_FILE = 'chat_cids.json';

// Function to set configuration (e.g., from Electron main process or React Native)
function setConfig(newConfig) {
    config = { ...config, ...newConfig };
}

// Function to set the user data path (called from main process)
function setUserDataPath(path) {
    userDataPath = path;
}

// Initialize Web3 connection
function initWeb3() {
    try {
        console.log('Initializing Web3 with:', config.eth_node);
        const w3 = new Web3(new HttpProvider(config.eth_node));

        // Load contract ABI from artifacts if available, otherwise use simplified ABI
        let contractAbi;
        try {
            const artifactPath = path.join(__dirname, '../../../../artifacts/contracts/InferenceCoordinator.sol/InferenceCoordinator.json');
            if (fs.existsSync(artifactPath)) {
                const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
                contractAbi = artifact.abi;
                console.log('Loaded contract ABI from artifacts');
            } else {
                throw new Error('Artifact not found');
            }
        } catch (e) {
            console.log('Using simplified ABI');
            contractAbi = [
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
                        {"name": "modelId", "type": "string"},
                        {"name": "modelCID", "type": "string"},
                        {"name": "payment", "type": "uint256"}
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
        }

        if (!config.contract_address || config.contract_address === '0xYourInferenceCoordinatorContractAddress') {
            console.warn('Contract address not properly configured');
            return { w3, contract: null };
        }

        const contractAddress = w3.utils.toChecksumAddress(config.contract_address);
        const contract = new w3.eth.Contract(contractAbi, contractAddress);
        console.log('Contract initialized at:', contractAddress);

        return { w3, contract };
    } catch (e) {
        console.error("Failed to initialize Web3:", e);
        return { w3: null, contract: null };
    }
}

// IPFS HTTP client functions
async function uploadToIpfs(fileContent, fileName = 'file.txt', isJson = false) {
    try {
        const ipfsUrl = `http://${config.ipfs_host}:${config.ipfs_port}/api/v0/add`;
        console.log('Uploading to IPFS:', ipfsUrl);
        
        // Use form-data package for Node.js
        const FormData = require('form-data');
        const formData = new FormData();
        
        let data;
        if (isJson || typeof fileContent === 'object') {
            data = Buffer.from(JSON.stringify(fileContent));
            formData.append('file', data, {
                filename: fileName,
                contentType: 'application/json'
            });
        } else if (Buffer.isBuffer(fileContent)) {
            formData.append('file', fileContent, fileName);
        } else if (typeof fileContent === 'string') {
            formData.append('file', Buffer.from(fileContent), fileName);
        } else if (fileContent instanceof ArrayBuffer) {
            formData.append('file', Buffer.from(fileContent), fileName);
        } else if (typeof Blob !== 'undefined' && fileContent instanceof Blob) {
            // Handle Blob in browser environment
            formData.append('file', fileContent, fileName);
        } else {
            throw new Error('Unsupported file content type');
        }

        const response = await axios.post(ipfsUrl, formData, {
            headers: formData.getHeaders ? formData.getHeaders() : { 'Content-Type': 'multipart/form-data' },
            timeout: 30000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity
        });

        if (response.status === 200 && response.data && response.data.Hash) {
            console.log('IPFS upload successful:', response.data.Hash);
            return response.data.Hash;
        } else {
            console.error("IPFS upload failed:", response.status, response.data);
            return null;
        }
    } catch (e) {
        console.error("Failed to upload to IPFS:", e.message);
        if (e.response) {
            console.error("Response data:", e.response.data);
        }
        return null;
    }
}

async function fetchFromIpfs(cid) {
    try {
        const ipfsUrl = `http://${config.ipfs_host}:${config.ipfs_port}/api/v0/cat?arg=${cid}`;
        console.log('Fetching from IPFS:', ipfsUrl);
        
        const response = await axios.post(ipfsUrl, null, { 
            timeout: 30000,
            responseType: 'text'
        });

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
        console.error("Failed to fetch from IPFS:", e.message);
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

        // Verify account has balance
        const balance = await w3.eth.getBalance(account);
        console.log("Account balance:", w3.utils.fromWei(balance, 'ether'), "ETH");
        
        if (balance === '0') {
            throw new Error("Account has no ETH balance for gas fees");
        }

        console.log("Fetching nonce and gas price...");
        const nonce = await w3.eth.getTransactionCount(account);
        const gasPrice = await w3.eth.getGasPrice();
        console.log("Nonce:", nonce, "Gas Price:", gasPrice.toString());

        console.log("Preparing transaction...");
        const method = contract.methods.submitPromptWithCID(promptCid, modelCid);
        
        // Estimate gas
        let estimatedGas;
        try {
            estimatedGas = await method.estimateGas({ from: account, value: w3.utils.toWei('0.01', 'ether') });
            console.log("Estimated gas:", estimatedGas);
        } catch (e) {
            console.warn("Gas estimation failed, using default:", e.message);
            estimatedGas = 300000;
        }

        const transaction = {
            from: account,
            to: contract.options.address,
            gas: estimatedGas,
            gasPrice: gasPrice,
            nonce: nonce,
            data: method.encodeABI(),
            value: w3.utils.toWei('0.01', 'ether') // Payment for inference
        };
        console.log("Transaction object:", { ...transaction, data: transaction.data.substring(0, 20) + '...' });

        console.log("Signing transaction...");
        const signedTx = await w3.eth.accounts.signTransaction(transaction, privateKey);
        console.log("Transaction signed. Sending raw transaction...");
        const receipt = await w3.eth.sendSignedTransaction(signedTx.rawTransaction);
        console.log("Transaction sent. Receipt:", receipt);

        let jobId = null;
        if (receipt.logs && receipt.logs.length > 0) {
            console.log("Checking logs for InferenceRequested event...");
            const eventAbi = contract.options.jsonInterface.find(i => i.name === 'InferenceRequested' && i.type === 'event');
            
            for (const log of receipt.logs) {
                try {
                    // Check if this log matches our contract address
                    if (log.address.toLowerCase() === contract.options.address.toLowerCase()) {
                        const decodedLog = w3.eth.abi.decodeLog(
                            eventAbi.inputs,
                            log.data,
                            log.topics.slice(1)
                        );
                        if (decodedLog.jobId) {
                            jobId = decodedLog.jobId;
                            console.log("InferenceRequested event found. Job ID:", jobId);
                            break;
                        }
                    }
                } catch (e) {
                    console.log("Failed to decode log:", e.message);
                }
            }
        }
        
        return { txHash: receipt.transactionHash, jobId, error: null };
    } catch (e) {
        console.error("Failed to submit job:", e);
        return { txHash: null, jobId: null, error: e.message };
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
                console.warn(`Job ${jobId} timed out after ${timeout} seconds`);
                resolve({ responseCid: null, worker: null, timeout: true });
                return;
            }

            try {
                // Get latest block number for more efficient querying
                const latestBlock = await w3.eth.getBlockNumber();
                const fromBlock = Math.max(0, latestBlock - 1000); // Look back 1000 blocks
                
                console.log(`Checking for job ${jobId} completion in blocks ${fromBlock} to ${latestBlock}`);
                
                const events = await contract.getPastEvents('InferenceCompleted', {
                    filter: { jobId: jobId.toString() },
                    fromBlock: fromBlock,
                    toBlock: 'latest'
                });

                if (events.length > 0) {
                    const event = events.find(e => {
                        // Handle both string and BigInt job IDs
                        const eventJobId = e.returnValues.jobId.toString();
                        const targetJobId = jobId.toString();
                        return eventJobId === targetJobId;
                    });
                    
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
                console.error(`Error monitoring job ${jobId}:`, e.message);
                // Continue checking instead of failing
            }
        }, interval);
    });
}

// Chat message storage functions
async function saveChatMessageToIpfs(message) {
    try {
        const cid = await uploadToIpfs(JSON.stringify(message), `chat_message_${Date.now()}.json`, true);
        if (cid) {
            await addChatCid(cid);
            return cid;
        }
        return null;
    } catch (error) {
        console.error("Error saving chat message to IPFS:", error);
        return null;
    }
}

async function loadChatMessagesFromIpfs() {
    try {
        const cids = await getChatCids();
        const messages = [];
        for (const cid of cids) {
            const message = await fetchFromIpfs(cid);
            if (message) {
                messages.push(message);
            }
        }
        return messages;
    } catch (error) {
        console.error("Error loading chat messages from IPFS:", error);
        return [];
    }
}

// Persistent storage for chat CIDs
function getChatCidsFilePath() {
    if (!userDataPath) {
        console.error("User data path not set for chat CIDs.");
        return null;
    }
    return path.join(userDataPath, CHAT_CIDS_FILE);
}

async function getChatCids() {
    const filePath = getChatCidsFilePath();
    if (!filePath) return [];

    try {
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
        return [];
    } catch (error) {
        console.error("Error reading chat CIDs file:", error);
        return [];
    }
}

async function addChatCid(cid) {
    const filePath = getChatCidsFilePath();
    if (!filePath) return false;

    try {
        const cids = await getChatCids();
        cids.push(cid);
        fs.writeFileSync(filePath, JSON.stringify(cids, null, 2));
        return true;
    } catch (error) {
        console.error("Error adding chat CID:", error);
        return false;
    }
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

// Automatic configuration generation for new users
async function generateAutoConfig(bootstrapNode = null) {
    console.log('Generating automatic configuration...');
    
    // Generate new Ethereum account
    const Web3 = require('web3');
    const web3 = new Web3();
    const account = web3.eth.accounts.create();
    
    // Default bootstrap nodes (can be expanded)
    const defaultBootstrapNodes = [
        { url: 'http://localhost:8545', ipfs: 'localhost:5001' },
        // Add more public bootstrap nodes here as network grows
        { url: 'http://bootstrap1.decentralized-ai.network:8545', ipfs: 'bootstrap1.decentralized-ai.network:5001' },
        { url: 'http://bootstrap2.decentralized-ai.network:8545', ipfs: 'bootstrap2.decentralized-ai.network:5001' }
    ];
    
    // Try to discover bootstrap nodes
    let bootstrapNodes = bootstrapNode ? [bootstrapNode] : defaultBootstrapNodes;
    
    // Try to connect to bootstrap nodes and get network config
    for (const node of bootstrapNodes) {
        try {
            console.log(`Trying to get config from ${node.url}`);
            const response = await axios.get(`${node.url.replace(':8545', ':8080')}/api/network-config`, { 
                timeout: 5000,
                validateStatus: () => true 
            });
            
            if (response.status === 200 && response.data) {
                console.log('Successfully retrieved network config from bootstrap node');
                return {
                    eth_node: node.url,
                    ipfs_host: node.ipfs.split(':')[0],
                    ipfs_port: parseInt(node.ipfs.split(':')[1] || 5001),
                    contract_address: response.data.contract_address,
                    model_registry_address: response.data.model_registry_address,
                    default_account: account.address,
                    private_key: account.privateKey,
                    network_id: response.data.network_id || 'decentralized-ai-network',
                    bootstrap_nodes: response.data.bootstrap_nodes || bootstrapNodes
                };
            }
        } catch (e) {
            console.log(`Failed to get config from ${node.url}:`, e.message);
        }
    }
    
    // Fallback configuration
    console.log('Using fallback configuration');
    return {
        eth_node: 'http://localhost:8545',
        ipfs_host: 'localhost',
        ipfs_port: 5001,
        contract_address: '',
        model_registry_address: '',
        default_account: account.address,
        private_key: account.privateKey,
        network_id: 'decentralized-ai-network',
        bootstrap_nodes: bootstrapNodes
    };
}

// Save network configuration
async function saveNetworkConfig(config) {
    const configPath = path.join(userDataPath, 'network_config.json');
    try {
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
        console.log('Network config saved to:', configPath);
        return true;
    } catch (error) {
        console.error("Error saving network config:", error);
        return false;
    }
}

// Load network configuration
async function loadNetworkConfig() {
    const configPath = path.join(userDataPath, 'network_config.json');
    try {
        if (fs.existsSync(configPath)) {
            const data = fs.readFileSync(configPath, 'utf8');
            console.log('Network config loaded from:', configPath);
            return JSON.parse(data);
        }
        return null;
    } catch (error) {
        console.error("Error loading network config:", error);
        return null;
    }
}

// Bootstrap node discovery via various methods
async function discoverBootstrapNodes() {
    const discoveredNodes = [];
    
    // Method 1: mDNS/Bonjour for local network discovery
    try {
        // This would require additional npm package like 'bonjour'
        console.log('mDNS discovery not implemented yet');
    } catch (e) {
        console.log('mDNS discovery failed');
    }
    
    // Method 2: IPFS peer discovery
    try {
        const ipfsUrl = `http://${config.ipfs_host}:${config.ipfs_port}/api/v0/swarm/peers`;
        const response = await axios.post(ipfsUrl, null, { timeout: 5000 });
        if (response.data && response.data.Peers) {
            // Parse IPFS peers and try to identify bootstrap nodes
            for (const peer of response.data.Peers) {
                // Bootstrap nodes might advertise a specific protocol
                if (peer.Streams && peer.Streams.includes('/decentralized-ai/1.0.0')) {
                    const addr = peer.Addr.split('/');
                    const ip = addr[2];
                    discoveredNodes.push({
                        url: `http://${ip}:8545`,
                        ipfs: `${ip}:5001`
                    });
                }
            }
        }
    } catch (e) {
        console.log('IPFS peer discovery failed:', e.message);
    }
    
    // Method 3: Known public nodes (hardcoded fallback)
    discoveredNodes.push(
        { url: 'http://localhost:8545', ipfs: 'localhost:5001' }
    );
    
    return discoveredNodes;
}

// Get network info for sharing
async function getNetworkInfo() {
    try {
        const { w3, contract } = initWeb3();
        if (!w3 || !contract) {
            throw new Error('Web3 not initialized');
        }
        
        const networkId = await w3.eth.net.getId();
        const blockNumber = await w3.eth.getBlockNumber();
        const peerCount = await w3.eth.net.getPeerCount();
        
        return {
            network_id: config.network_id,
            chain_id: networkId,
            contract_address: config.contract_address,
            model_registry_address: config.model_registry_address,
            current_block: blockNumber,
            peer_count: peerCount,
            bootstrap_nodes: config.bootstrap_nodes || []
        };
    } catch (e) {
        console.error('Failed to get network info:', e);
        return null;
    }
}

// Advanced file chunking for large files
async function uploadLargeFileToIPFS(filePath, options = {}) {
    try {
        const { AdvancedFileChunker } = require('../../../ipfs/block-cahin/utils/advanced-chunker');
        
        const chunker = new AdvancedFileChunker({
            chunkSize: options.chunkSize || 1024 * 1024, // 1MB default
            enableEncryption: options.encrypt || false,
            encryptionKey: options.encryptionKey || config.private_key,
            enableCompression: options.compress || true,
            outputDir: path.join(userDataPath, 'chunks')
        });
        
        console.log('Chunking large file:', filePath);
        const { manifest, chunks, sessionId } = await chunker.chunkFile(filePath, {
            metadata: {
                uploadedBy: config.default_account,
                timestamp: Date.now()
            }
        });
        
        // Upload manifest to IPFS
        const manifestCid = await uploadToIpfs(manifest, `${sessionId}_manifest.json`, true);
        console.log('Manifest uploaded to IPFS:', manifestCid);
        
        // Upload chunks to IPFS
        const uploadedChunks = [];
        for (const chunk of chunks) {
            const chunkData = fs.readFileSync(chunk.path);
            const chunkCid = await uploadToIpfs(chunkData, chunk.name);
            if (chunkCid) {
                uploadedChunks.push({
                    ...chunk,
                    cid: chunkCid
                });
                console.log(`Chunk ${chunk.index} uploaded:`, chunkCid);
            }
        }
        
        // Clean up local chunks if requested
        if (options.cleanupAfterUpload) {
            chunker.cleanupChunks(sessionId);
        }
        
        return {
            success: true,
            manifestCid,
            manifest,
            chunks: uploadedChunks,
            sessionId,
            stats: chunker.getChunkStats(manifest)
        };
    } catch (error) {
        console.error('Failed to upload large file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

// Download and reassemble large file from IPFS
async function downloadLargeFileFromIPFS(manifestCid, outputPath, options = {}) {
    try {
        // Fetch manifest
        const manifest = await fetchFromIpfs(manifestCid);
        if (!manifest) {
            throw new Error('Failed to fetch manifest');
        }
        
        const { AdvancedFileChunker } = require('../../../ipfs/block-cahin/utils/advanced-chunker');
        const chunker = new AdvancedFileChunker({
            enableEncryption: manifest.encrypted,
            encryptionKey: options.encryptionKey || config.private_key
        });
        
        // Download chunks
        const chunks = [];
        for (const chunkInfo of manifest.chunks) {
            console.log(`Downloading chunk ${chunkInfo.index}...`);
            const chunkData = await fetchFromIpfs(chunkInfo.cid);
            if (chunkData) {
                chunks.push({
                    index: chunkInfo.index,
                    data: Buffer.from(chunkData)
                });
            }
        }
        
        // Sort chunks by index
        chunks.sort((a, b) => a.index - b.index);
        
        // Reassemble file
        const fileChunks = [];
        for (const chunk of chunks) {
            let data = chunk.data;
            
            // Decrypt if needed
            if (manifest.encrypted) {
                data = chunker.decryptChunk(data);
            }
            
            // Decompress if needed
            if (manifest.compressed) {
                data = await chunker.decompressChunk(data);
            }
            
            fileChunks.push(data);
        }
        
        const fileData = Buffer.concat(fileChunks);
        
        // Verify integrity
        const actualHash = require('crypto').createHash('sha256').update(fileData).digest('hex');
        if (actualHash !== manifest.originalHash) {
            throw new Error('File integrity check failed');
        }
        
        // Write to output
        fs.writeFileSync(outputPath, fileData);
        
        return {
            success: true,
            outputPath,
            originalFile: manifest.originalFile,
            size: fileData.length,
            verified: true
        };
    } catch (error) {
        console.error('Failed to download large file:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = {
    setConfig,
    setUserDataPath,
    initWeb3,
    uploadToIpfs,
    fetchFromIpfs,
    submitInferenceJob,
    monitorJobCompletion,
    formatFileSize,
    getMockStorageInfo,
    getMockFiles,
    saveChatMessageToIpfs,
    loadChatMessagesFromIpfs,
    getChatCids,
    generateAutoConfig,
    saveNetworkConfig,
    loadNetworkConfig,
    discoverBootstrapNodes,
    getNetworkInfo,
    uploadLargeFileToIPFS,
    downloadLargeFileFromIPFS
};