const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const axios = require('axios');

// Import shared core modules
const sharedCore = require('./shared-core');
const { Web3 } = require('web3');

// Configuration paths
const userDataPath = app.getPath('userData');
const CONFIG_FILE = path.join(userDataPath, 'config.json');
const NETWORK_CONFIG_FILE = path.join(userDataPath, 'network_config.json');
const CHAT_HISTORY_FILE = path.join(userDataPath, 'chat_history.json');
const JOB_HISTORY_FILE = path.join(userDataPath, 'job_history.json');
const UPLOADED_FILES_FILE = path.join(userDataPath, 'uploaded_files.json');

// Set user data path for shared core
sharedCore.setUserDataPath(userDataPath);

let mainWindow;
let nodeProcess = null;

// Enhanced auto-configuration
async function autoConfigureApp() {
    console.log('Auto-configuring application...');
    
    try {
        // Check for Docker deployment URL
        const bootstrapUrl = process.env.BOOTSTRAP_URL || 
                           process.env.DOCKER_BOOTSTRAP_URL || 
                           'http://localhost:8080';
        
        // Try to get configuration from bootstrap node
        let config = null;
        try {
            const response = await axios.get(`${bootstrapUrl}/api/network-config`, { timeout: 5000 });
            if (response.data) {
                config = {
                    bootstrap_url: bootstrapUrl,
                    eth_node: response.data.bootstrap_nodes[0]?.url || 'http://localhost:8545',
                    ipfs_host: response.data.bootstrap_nodes[0]?.ipfs?.split(':')[0] || 'localhost',
                    ipfs_port: parseInt(response.data.bootstrap_nodes[0]?.ipfs?.split(':')[1] || 5001),
                    contract_address: response.data.contract_address,
                    model_registry_address: response.data.model_registry_address,
                    network_id: response.data.network_id,
                    bootstrap_nodes: response.data.bootstrap_nodes
                };
            }
        } catch (error) {
            console.log('Bootstrap node not available, using fallback configuration');
        }
        
        // Generate new account
        const web3 = new Web3();
        const account = web3.eth.accounts.create();
        
        // Merge with generated account
        const finalConfig = {
            ...config,
            default_account: account.address,
            private_key: account.privateKey,
            generated_at: new Date().toISOString()
        };
        
        // Save configuration
        fs.writeFileSync(NETWORK_CONFIG_FILE, JSON.stringify(finalConfig, null, 2));
        
        // Set shared core configuration
        sharedCore.setConfig(finalConfig);
        
        return finalConfig;
    } catch (error) {
        console.error('Auto-configuration error:', error);
        // Return minimal config
        const web3 = new Web3();
        const account = web3.eth.accounts.create();
        return {
            bootstrap_url: 'http://localhost:8080',
            eth_node: 'http://localhost:8545',
            ipfs_host: 'localhost',
            ipfs_port: 5001,
            default_account: account.address,
            private_key: account.privateKey,
            network_id: 'decentralized-ai-network'
        };
    }
}

// Create main window
async function createWindow() {
    // Auto-configure on first launch
    let config = null;
    if (!fs.existsSync(NETWORK_CONFIG_FILE)) {
        config = await autoConfigureApp();
        console.log('Auto-configuration completed:', config.default_account);
    } else {
        config = JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
        sharedCore.setConfig(config);
    }
    
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            webSecurity: false
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: 'default',
        frame: true
    });

    // Load the enhanced app
    mainWindow.loadFile(path.join(__dirname, 'index.html'));

    mainWindow.on('closed', () => {
        mainWindow = null;
        if (nodeProcess) {
            nodeProcess.kill();
        }
    });
}

// IPC Handlers

// Configuration management
ipcMain.handle('load-config', async () => {
    try {
        if (fs.existsSync(NETWORK_CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
        }
        return await autoConfigureApp();
    } catch (error) {
        console.error('Error loading config:', error);
        return null;
    }
});

ipcMain.handle('save-config', async (event, config) => {
    try {
        fs.writeFileSync(NETWORK_CONFIG_FILE, JSON.stringify(config, null, 2));
        sharedCore.setConfig(config);
        return { success: true };
    } catch (error) {
        console.error('Error saving config:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('auto-configure', async () => {
    return await autoConfigureApp();
});

ipcMain.handle('generate-new-account', async () => {
    const web3 = new Web3();
    const account = web3.eth.accounts.create();
    const currentConfig = JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
    const newConfig = {
        ...currentConfig,
        default_account: account.address,
        private_key: account.privateKey
    };
    fs.writeFileSync(NETWORK_CONFIG_FILE, JSON.stringify(newConfig, null, 2));
    return newConfig;
});

// Connection checking
ipcMain.handle('check-connections', async (event, params) => {
    const status = {
        ethConnected: false,
        ipfsConnected: false,
        bootstrapConnected: false,
        currentBlock: 0,
        peerCount: 0
    };
    
    // Check Ethereum
    try {
        const web3 = new Web3(params.ethNode);
        const blockNumber = await web3.eth.getBlockNumber();
        const peerCount = await web3.eth.net.getPeerCount();
        status.ethConnected = true;
        status.currentBlock = Number(blockNumber);
        status.peerCount = Number(peerCount);
    } catch (error) {
        console.error('Ethereum connection error:', error);
    }
    
    // Check IPFS
    try {
        const response = await axios.post(
            `http://${params.ipfsHost}:${params.ipfsPort}/api/v0/version`,
            null,
            { timeout: 3000 }
        );
        status.ipfsConnected = response.status === 200;
    } catch (error) {
        console.error('IPFS connection error:', error);
    }
    
    // Check Bootstrap
    try {
        const response = await axios.get(`${params.bootstrapUrl}/health`, { timeout: 3000 });
        status.bootstrapConnected = response.data.status === 'healthy';
    } catch (error) {
        console.error('Bootstrap connection error:', error);
    }
    
    return status;
});

// Model management
ipcMain.handle('get-models', async () => {
    try {
        const config = JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
        
        // Try to get models from blockchain
        if (config.model_registry_address) {
            // TODO: Implement blockchain model registry query
            // For now, return mock data
            return [
                { cid: 'QmExampleModel1', name: 'GPT-J 6B', type: 'text-generation' },
                { cid: 'QmExampleModel2', name: 'LLaMA 7B', type: 'text-generation' }
            ];
        }
        
        return [];
    } catch (error) {
        console.error('Error getting models:', error);
        return [];
    }
});

ipcMain.handle('upload-model', async (event, params) => {
    try {
        const result = await sharedCore.uploadLargeFileToIPFS(params.filePath, {
            chunkSize: 5 * 1024 * 1024, // 5MB chunks
            compress: true,
            encrypt: false
        });
        
        if (result.success) {
            // TODO: Register model in blockchain
            return { success: true, cid: result.manifestCid };
        }
        
        return { success: false, error: result.error };
    } catch (error) {
        console.error('Model upload error:', error);
        return { success: false, error: error.message };
    }
});

// Inference
ipcMain.handle('submit-inference', async (event, params) => {
    try {
        const result = await sharedCore.submitInferenceJob(
            params.prompt,
            params.modelCid,
            params.account,
            params.privateKey
        );
        
        if (result.txHash && result.jobId) {
            // Monitor completion
            const completion = await sharedCore.monitorJobCompletion(result.jobId, 300);
            
            if (completion.responseCid) {
                const response = await sharedCore.fetchFromIpfs(completion.responseCid);
                return {
                    success: true,
                    response: response,
                    jobId: result.jobId,
                    worker: completion.worker
                };
            }
        }
        
        return { success: false, message: result.error || 'Inference failed' };
    } catch (error) {
        console.error('Inference error:', error);
        return { success: false, message: error.message };
    }
});

// Persistent storage handlers
ipcMain.handle('load-chat-history', async () => {
    try {
        if (fs.existsSync(CHAT_HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(CHAT_HISTORY_FILE, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error loading chat history:', error);
        return [];
    }
});

ipcMain.handle('save-chat-history', async (event, messages) => {
    try {
        fs.writeFileSync(CHAT_HISTORY_FILE, JSON.stringify(messages, null, 2));
        // Also save to IPFS
        await sharedCore.saveChatMessageToIpfs(messages[messages.length - 1]);
        return { success: true };
    } catch (error) {
        console.error('Error saving chat history:', error);
        return { success: false };
    }
});

ipcMain.handle('load-job-history', async () => {
    try {
        if (fs.existsSync(JOB_HISTORY_FILE)) {
            return JSON.parse(fs.readFileSync(JOB_HISTORY_FILE, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error loading job history:', error);
        return [];
    }
});

ipcMain.handle('save-job-history', async (event, jobs) => {
    try {
        fs.writeFileSync(JOB_HISTORY_FILE, JSON.stringify(jobs, null, 2));
        return { success: true };
    } catch (error) {
        console.error('Error saving job history:', error);
        return { success: false };
    }
});

// File management
ipcMain.handle('upload-file-to-ipfs', async (event, params) => {
    try {
        const cid = await sharedCore.uploadToIpfs(
            fs.readFileSync(params.filePath),
            params.fileName
        );
        
        if (cid) {
            // Update uploaded files list
            const files = fs.existsSync(UPLOADED_FILES_FILE) 
                ? JSON.parse(fs.readFileSync(UPLOADED_FILES_FILE, 'utf8'))
                : [];
            files.push({
                name: params.fileName,
                cid: cid,
                size: fs.statSync(params.filePath).size,
                uploadedAt: new Date().toISOString()
            });
            fs.writeFileSync(UPLOADED_FILES_FILE, JSON.stringify(files, null, 2));
            
            return { success: true, cid };
        }
        
        return { success: false };
    } catch (error) {
        console.error('File upload error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('download-file-from-ipfs', async (event, params) => {
    try {
        const data = await sharedCore.fetchFromIpfs(params.cid);
        if (data) {
            const downloadPath = path.join(app.getPath('downloads'), params.fileName);
            fs.writeFileSync(downloadPath, data);
            shell.showItemInFolder(downloadPath);
            return { success: true };
        }
        return { success: false };
    } catch (error) {
        console.error('File download error:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('load-uploaded-files', async () => {
    try {
        if (fs.existsSync(UPLOADED_FILES_FILE)) {
            return JSON.parse(fs.readFileSync(UPLOADED_FILES_FILE, 'utf8'));
        }
        return [];
    } catch (error) {
        console.error('Error loading uploaded files:', error);
        return [];
    }
});

ipcMain.handle('get-storage-info', async () => {
    try {
        const stats = await sharedCore.getMockStorageInfo();
        return {
            used: stats.used_space,
            available: stats.available_space,
            total: stats.total_space
        };
    } catch (error) {
        console.error('Error getting storage info:', error);
        return { used: 0, available: 0, total: 0 };
    }
});

// Node control
ipcMain.handle('start-node', async (event, params) => {
    try {
        const result = await sharedCore.startNode(params.nodeType, params.config);
        return { success: true, ...result };
    } catch (error) {
        console.error('Error starting node:', error);
        return { success: false, error: error.message };
    }
});

ipcMain.handle('stop-node', async () => {
    try {
        await sharedCore.stopNode();
        return { success: true };
    } catch (error) {
        console.error('Error stopping node:', error);
        return { success: false, error: error.message };
    }
});

// Export configuration
ipcMain.handle('export-config', async () => {
    try {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: 'ai-network-config.json',
            filters: [{ name: 'JSON', extensions: ['json'] }]
        });
        
        if (!result.canceled && result.filePath) {
            const config = JSON.parse(fs.readFileSync(NETWORK_CONFIG_FILE, 'utf8'));
            // Remove private key for security
            const exportConfig = { ...config };
            delete exportConfig.private_key;
            fs.writeFileSync(result.filePath, JSON.stringify(exportConfig, null, 2));
            return { success: true };
        }
        
        return { success: false };
    } catch (error) {
        console.error('Error exporting config:', error);
        return { success: false, error: error.message };
    }
});

// App event handlers
app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow();
    }
});

// Graceful shutdown
app.on('before-quit', () => {
    if (nodeProcess) {
        nodeProcess.kill();
    }
});