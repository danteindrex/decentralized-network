const { initWeb3, uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion, setConfig, formatFileSize, getMockStorageInfo, getMockFiles, saveChatMessageToIpfs, loadChatMessagesFromIpfs, getChatCids, addChatCid, getUserChatStats, setUserDataPath, generateAutoConfig, saveNetworkConfig, loadNetworkConfig, discoverBootstrapNodes, getNetworkInfo } = require('./network-service.cjs');
const { runInference } = require('./ai-service.cjs');
const OrganicPeerDiscovery = require('./organic-peer-discovery.cjs');
const { spawn } = require('child_process');
const os = require('os');

let nodeProcess = null;
let currentNodeType = null;
let outputCallback = null;
let peerDiscovery = null;

// Function to register a callback for sending output
exports.registerOutputCallback = (callback) => {
    outputCallback = callback;
};

// Helper to send output
function sendOutput(type, message) {
    if (outputCallback) {
        outputCallback(type, message);
    }
    console.log(`[${type}] ${message}`);
}

// Enhanced node startup with organic peer discovery
exports.startNode = async (nodeType, projectRoot, environment) => {
    console.log(`🚀 Starting ${nodeType} node with organic peer discovery...`);
    sendOutput('info', `💪 Starting ${nodeType.charAt(0).toUpperCase() + nodeType.slice(1)} Node...`);
    sendOutput('info', '==========================');

    if (nodeProcess) {
        sendOutput('warn', `A node (${currentNodeType}) is already running. Please stop it first.`);
        return { success: false, message: `A node (${currentNodeType}) is already running.` };
    }

    // Use the real bootstrap node with RPC proxy endpoint
    environment.eth_node = 'https://bootstrap-node.onrender.com/rpc';
    environment.ipfs_host = 'bootstrap-node.onrender.com';
    environment.ipfs_port = 443;

    // Set the configuration for network services
    setConfig(environment);

    try {
        // Initialize organic peer discovery first
        await initializePeerDiscovery(nodeType, environment);

        sendOutput('info', `🔄 Using real bootstrap node: ${environment.eth_node}`);

        // Test network connections
        sendOutput('info', '🔍 Testing connections...');
        
        // Test Web3 connection
        try {
            const { w3 } = initWeb3();
            if (w3) {
                // Try to get network ID instead of isListening (which might not work)
                const networkId = await w3.eth.net.getId();
                sendOutput('info', `✅ Blockchain connection: SUCCESS`);
                sendOutput('info', `🔗 Connected to: ${environment.eth_node} (Network ID: ${networkId})`);
            } else {
                sendOutput('warn', `❌ Blockchain connection: FAILED`);
                sendOutput('warn', `Trying to connect to: ${environment.eth_node}`);
            }
        } catch (error) {
            sendOutput('warn', `❌ Blockchain connection: FAILED - ${error.message}`);
            sendOutput('info', `🔄 Will continue with mock services`);
        }

        // Test IPFS connection
        try {
            // Just test if IPFS API is reachable
            const axios = require('axios');
            const response = await axios.get(`https://${environment.ipfs_host}/api/v0/version`, {
                timeout: 5000
            });
            
            if (response.status === 200) {
                sendOutput('info', `✅ IPFS connection: SUCCESS`);
                sendOutput('info', `📁 Connected to: ${environment.ipfs_host}:${environment.ipfs_port}`);
            } else {
                sendOutput('warn', `❌ IPFS connection: FAILED`);
                sendOutput('warn', `Trying to connect to: ${environment.ipfs_host}:${environment.ipfs_port}`);
            }
        } catch (error) {
            sendOutput('warn', `❌ IPFS connection: FAILED - ${error.message}`);
            sendOutput('info', `🔄 Will continue with mock services`);
        }

        // Display network info
        sendOutput('info', `📋 Network: ${environment.network_id || 'AI-Inference-Network'}`);
        sendOutput('info', `🔗 Bootstrap: ${environment.eth_node}`);
        
        // Display resource allocation
        const resourcePreset = getResourcePreset(nodeType);
        sendOutput('info', `📊 Resource preset: ${resourcePreset.name}`);
        sendOutput('info', `CPU: ${resourcePreset.cpu}% RAM: ${resourcePreset.ram}% GPU: ${resourcePreset.gpu}% Storage: ${resourcePreset.storage}%`);

        // Start the actual node process
        const platform = os.platform();
        let command, args;
        let startCommand;

        // Determine start command based on node type
        switch (nodeType) {
            case 'bootstrap':
                startCommand = `./start-bootstrap.sh`;
                break;
            case 'worker':
                startCommand = `./start-worker.sh`;
                break;
            case 'owner':
                startCommand = `./start-owner.sh`;
                break;
            case 'user':
                startCommand = `streamlit run streamlit_app.py --server.port 8501`;
                break;
            default:
                return { success: false, message: `Unknown node type: ${nodeType}` };
        }

        // Set up command for different platforms
        if (platform === 'win32') {
            command = 'cmd.exe';
            args = ['/c', startCommand];
        } else {
            command = 'bash';
            args = ['-c', startCommand];
        }

        // Create enhanced environment with peer discovery
        const enhancedEnv = {
            ...process.env,
            ...environment,
            PEER_DISCOVERY_ENABLED: 'true',
            NODE_TYPE: nodeType
        };

        // Start node process
        nodeProcess = spawn(command, args, {
            cwd: projectRoot,
            env: enhancedEnv,
            detached: false // Keep attached for better control
        });

        currentNodeType = nodeType;

        // Handle process output
        nodeProcess.stdout.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                sendOutput('stdout', output);
            }
        });

        nodeProcess.stderr.on('data', (data) => {
            const output = data.toString().trim();
            if (output) {
                sendOutput('stderr', output);
            }
        });

        nodeProcess.on('close', (code) => {
            sendOutput('info', `Node process exited with code ${code}`);
            nodeProcess = null;
            currentNodeType = null;
            sendOutput('status', 'stopped');
            
            // Stop peer discovery
            if (peerDiscovery) {
                peerDiscovery.stop();
                peerDiscovery = null;
            }
        });

        nodeProcess.on('error', (err) => {
            sendOutput('error', `Failed to start node process: ${err.message}`);
            nodeProcess = null;
            currentNodeType = null;
            sendOutput('status', 'stopped');
        });

        // Indicate successful startup
        sendOutput('status', 'running');
        sendOutput('info', `✅ ${nodeType} node started successfully.`);
        
        return { success: true, message: `${nodeType} node started with organic peer discovery.` };

    } catch (error) {
        sendOutput('error', `Error starting node: ${error.message}`);
        return { success: false, message: `Error starting node: ${error.message}` };
    }
};

async function initializePeerDiscovery(nodeType, environment) {
    try {
        sendOutput('info', '🌱 Initializing organic peer discovery...');
        
        // Create peer discovery instance
        peerDiscovery = new OrganicPeerDiscovery({
            nodeType: nodeType,
            bootstrapNodes: [
                'https://bootstrap-node.onrender.com'
            ],
            ipfsHost: environment.ipfs_host,
            ipfsPort: environment.ipfs_port,
            enableMDNS: true,
            enableDHT: true,
            enableGossip: true
        });

        // Set up event listeners
        peerDiscovery.on('started', () => {
            sendOutput('info', '✅ Peer discovery started');
        });

        peerDiscovery.on('peerAdded', (peer) => {
            sendOutput('info', `🤝 New peer discovered: ${peer.type || 'unknown'} at ${peer.endpoint}`);
        });

        peerDiscovery.on('discoveryRound', (result) => {
            if (result.totalNewPeers > 0) {
                sendOutput('info', `🔍 Discovery round: found ${result.totalNewPeers} new peers`);
            }
        });

        peerDiscovery.on('healthCheck', (status) => {
            sendOutput('info', `💓 Network health: ${status.healthyPeers}/${status.totalPeers} peers healthy`);
        });

        // Start peer discovery
        await peerDiscovery.start();
        
        sendOutput('info', '🌐 Organic peer discovery initialized');
        
    } catch (error) {
        sendOutput('warn', `⚠️ Peer discovery initialization failed: ${error.message}`);
        // Continue without peer discovery - not critical for basic operation
    }
}

function getResourcePreset(nodeType) {
    const presets = {
        bootstrap: { name: 'coordinator', cpu: 20, ram: 30, gpu: 0, storage: 50 },
        worker: { name: 'balanced', cpu: 10, ram: 15, gpu: 10, storage: 5 },
        owner: { name: 'minimal', cpu: 5, ram: 10, gpu: 0, storage: 2 },
        user: { name: 'light', cpu: 3, ram: 5, gpu: 0, storage: 1 }
    };
    
    return presets[nodeType] || presets.user;
}

exports.stopNode = () => {
    if (nodeProcess) {
        try {
            // Stop peer discovery first
            if (peerDiscovery) {
                peerDiscovery.stop();
                peerDiscovery = null;
            }
            
            // Kill the node process
            if (process.platform === 'win32') {
                spawn('taskkill', ['/pid', nodeProcess.pid, '/f', '/t']);
            } else {
                nodeProcess.kill('SIGTERM');
            }
            
            nodeProcess = null;
            currentNodeType = null;
            sendOutput('info', 'Node process stopped.');
            sendOutput('status', 'stopped');
            return { success: true, message: 'Node stopped.' };
        } catch (error) {
            sendOutput('error', `Error stopping node: ${error.message}`);
            return { success: false, message: `Error stopping node: ${error.message}` };
        }
    } else {
        sendOutput('info', 'No node process is running.');
        return { success: true, message: 'No node is running.' };
    }
};

exports.getNodeStatus = () => {
    const status = {
        running: nodeProcess !== null,
        nodeType: currentNodeType,
        peerDiscovery: peerDiscovery !== null
    };
    
    // Add peer discovery stats if available
    if (peerDiscovery) {
        const stats = peerDiscovery.getNetworkStats();
        status.networkStats = stats;
    }
    
    return status;
};

// Enhanced network stats
exports.getNetworkStats = () => {
    if (peerDiscovery) {
        return peerDiscovery.getNetworkStats();
    }
    return null;
};

// Get discovered peers
exports.getDiscoveredPeers = (type = null) => {
    if (peerDiscovery) {
        return peerDiscovery.getPeers(type);
    }
    return [];
};

// Export network service functions for direct use by frontends
exports.initWeb3 = initWeb3;
exports.uploadToIpfs = uploadToIpfs;
exports.fetchFromIpfs = fetchFromIpfs;
exports.submitInferenceJob = submitInferenceJob;
exports.monitorJobCompletion = monitorJobCompletion;
exports.setConfig = setConfig;
exports.formatFileSize = formatFileSize;
exports.getMockStorageInfo = getMockStorageInfo;
exports.getMockFiles = getMockFiles;
exports.runInference = runInference;
exports.saveChatMessageToIpfs = saveChatMessageToIpfs;
exports.loadChatMessagesFromIpfs = loadChatMessagesFromIpfs;
exports.getChatCids = getChatCids;
exports.addChatCid = addChatCid;
exports.getUserChatStats = getUserChatStats;
exports.setUserDataPath = setUserDataPath;
exports.generateAutoConfig = generateAutoConfig;
exports.saveNetworkConfig = saveNetworkConfig;
exports.loadNetworkConfig = loadNetworkConfig;
exports.discoverBootstrapNodes = discoverBootstrapNodes;
exports.getNetworkInfo = getNetworkInfo;