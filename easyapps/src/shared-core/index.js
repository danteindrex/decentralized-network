const { initWeb3, uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion, setConfig, formatFileSize, getMockStorageInfo, getMockFiles, uploadFileInChunks } = require('./network-service');
const { runInference } = require('./ai-service');
const { spawn } = require('child_process');
const os = require('os');

let nodeProcess = null;
let currentNodeType = null;
let outputCallback = null; // Callback to send output to the main process

// Function to register a callback for sending output
exports.registerOutputCallback = (callback) => {
    outputCallback = callback;
};

// Helper to send output
function sendOutput(type, message) {
    if (outputCallback) {
        outputCallback(type, message);
    }
}

exports.startNode = async (nodeType, projectRoot, environment) => {
    console.log(`Shared Core: Attempting to start ${nodeType} node in ${projectRoot}`);

    if (nodeProcess) {
        sendOutput('warn', `A node (${currentNodeType}) is already running. Please stop it first.`);
        return { success: false, message: `A node (${currentNodeType}) is already running.` };
    }

    // Set the configuration for network services
    setConfig(environment); // Assuming environment contains eth_node, ipfs_host, etc.

    try {
        // Example: Initialize Web3 and check connection (optional, can be done in UI)
        const { w3 } = initWeb3();
        if (w3 && await w3.eth.net.isListening()) {
            sendOutput('info', `Web3 connected to ${environment.eth_node}`);
        } else {
            sendOutput('warn', `Web3 not connected to ${environment.eth_node}. Node might not function correctly.`);
            // return { success: false, message: `Failed to connect to Ethereum node: ${environment.eth_node}` };
        }

        const platform = os.platform();
        let command, args;
        let startCommand;

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
                // Assuming streamlit is installed and in PATH
                startCommand = `streamlit run streamlit_app.py --server.port 8501`;
                break;
            default:
                return { success: false, message: `Unknown node type: ${nodeType}` };
        }

        if (platform === 'win32') {
            command = 'cmd.exe';
            args = ['/c', startCommand];
        } else {
            command = 'bash';
            args = ['-c', startCommand];
        }

        nodeProcess = spawn(command, args, {
            cwd: projectRoot, // Run from the project root
            env: { ...process.env, ...environment },
            detached: true // Detach the child process
        });

        currentNodeType = nodeType;

        nodeProcess.stdout.on('data', (data) => {
            sendOutput('stdout', data.toString());
        });

        nodeProcess.stderr.on('data', (data) => {
            sendOutput('stderr', data.toString());
        });

        nodeProcess.on('close', (code) => {
            sendOutput('info', `Node process exited with code ${code}`);
            nodeProcess = null;
            currentNodeType = null;
            sendOutput('status', 'stopped');
        });

        nodeProcess.on('error', (err) => {
            sendOutput('error', `Failed to start node process: ${err.message}`);
            nodeProcess = null;
            currentNodeType = null;
            sendOutput('status', 'stopped');
        });

        sendOutput('status', 'running');
        sendOutput('info', `${nodeType} node started successfully.`);
        return { success: true, message: `${nodeType} node started.` };

    } catch (error) {
        sendOutput('error', `Error starting node: ${error.message}`);
        return { success: false, message: `Error starting node: ${error.message}` };
    }
};

exports.stopNode = () => {
    if (nodeProcess) {
        try {
            process.kill(-nodeProcess.pid); // Kill the process group
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
    return {
        running: nodeProcess !== null,
        nodeType: currentNodeType
    };
};

// Export network service functions for direct use by frontends if needed
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
exports.uploadFileInChunks = uploadFileInChunks;
