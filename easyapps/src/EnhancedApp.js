import React, { useState, useEffect, useRef } from 'react';
const { ipcRenderer } = window.require('electron');

// Enhanced App with all Streamlit features
const EnhancedApp = () => {
    // State management
    const [activeTab, setActiveTab] = useState('chat');
    const [config, setConfig] = useState(null);
    const [loading, setLoading] = useState(true);
    
    // Chat state
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [isProcessing, setIsProcessing] = useState(false);
    
    // Model state
    const [models, setModels] = useState([]);
    const [selectedModel, setSelectedModel] = useState('');
    const [uploadingModel, setUploadingModel] = useState(false);
    
    // Job history state
    const [jobHistory, setJobHistory] = useState([]);
    
    // Storage state
    const [storageInfo, setStorageInfo] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);
    
    // Network state
    const [networkStatus, setNetworkStatus] = useState({
        ethConnected: false,
        ipfsConnected: false,
        bootstrapConnected: false,
        currentBlock: 0,
        peerCount: 0
    });
    
    // Node control state
    const [nodeStatus, setNodeStatus] = useState({
        bootstrap: false,
        worker: false,
        owner: false,
        user: false
    });
    
    // Auto-configuration on first load
    useEffect(() => {
        initializeApp();
    }, []);

    const initializeApp = async () => {
        try {
            // Load or generate configuration
            let appConfig = await ipcRenderer.invoke('load-config');
            
            if (!appConfig || !appConfig.default_account) {
                // Auto-generate configuration
                console.log('No configuration found, auto-generating...');
                appConfig = await ipcRenderer.invoke('auto-configure');
                await ipcRenderer.invoke('save-config', appConfig);
            }
            
            setConfig(appConfig);
            
            // Initialize connections
            await initializeConnections(appConfig);
            
            // Load persistent data
            await loadPersistentData();
            
            // Load models from blockchain
            await loadModels();
            
            setLoading(false);
        } catch (error) {
            console.error('Initialization error:', error);
            setLoading(false);
        }
    };

    const initializeConnections = async (config) => {
        try {
            // Set bootstrap URL from environment or config
            const bootstrapUrl = config.bootstrap_url || process.env.BOOTSTRAP_URL || 'http://localhost:8080';
            
            // Check connections
            const status = await ipcRenderer.invoke('check-connections', {
                ethNode: config.eth_node,
                ipfsHost: config.ipfs_host,
                ipfsPort: config.ipfs_port,
                bootstrapUrl
            });
            
            setNetworkStatus(status);
        } catch (error) {
            console.error('Connection error:', error);
        }
    };

    const loadPersistentData = async () => {
        try {
            // Load chat history
            const chatHistory = await ipcRenderer.invoke('load-chat-history');
            setMessages(chatHistory || []);
            
            // Load job history
            const jobs = await ipcRenderer.invoke('load-job-history');
            setJobHistory(jobs || []);
            
            // Load uploaded files
            const files = await ipcRenderer.invoke('load-uploaded-files');
            setUploadedFiles(files || []);
            
            // Load storage info
            const storage = await ipcRenderer.invoke('get-storage-info');
            setStorageInfo(storage);
        } catch (error) {
            console.error('Error loading persistent data:', error);
        }
    };

    const loadModels = async () => {
        try {
            const modelList = await ipcRenderer.invoke('get-models');
            setModels(modelList || []);
            if (modelList && modelList.length > 0) {
                setSelectedModel(modelList[0].cid);
            }
        } catch (error) {
            console.error('Error loading models:', error);
        }
    };

    // Model upload functionality
    const handleModelUpload = async (file) => {
        setUploadingModel(true);
        try {
            const result = await ipcRenderer.invoke('upload-model', {
                filePath: file.path,
                modelName: file.name,
                modelType: 'llm'
            });
            
            if (result.success) {
                await loadModels();
                showNotification('Model uploaded successfully!', 'success');
            } else {
                showNotification('Model upload failed', 'error');
            }
        } catch (error) {
            console.error('Model upload error:', error);
            showNotification('Model upload error', 'error');
        }
        setUploadingModel(false);
    };

    // Enhanced chat with model selection
    const handleSendMessage = async () => {
        if (!inputMessage.trim() || isProcessing) return;

        const userMessage = {
            role: 'user',
            content: inputMessage,
            timestamp: new Date().toISOString()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setIsProcessing(true);

        try {
            // Create job entry
            const job = {
                id: Date.now(),
                prompt: inputMessage,
                model: selectedModel,
                status: 'pending',
                timestamp: new Date().toISOString()
            };
            setJobHistory(prev => [job, ...prev]);

            // Submit inference job
            const result = await ipcRenderer.invoke('submit-inference', {
                prompt: inputMessage,
                modelCid: selectedModel,
                account: config.default_account,
                privateKey: config.private_key
            });

            if (result.success) {
                // Update job status
                updateJobStatus(job.id, 'completed', result);
                
                // Add AI response
                const aiMessage = {
                    role: 'assistant',
                    content: result.response,
                    timestamp: new Date().toISOString(),
                    jobId: result.jobId,
                    worker: result.worker
                };
                setMessages(prev => [...prev, aiMessage]);
                
                // Save chat history
                await ipcRenderer.invoke('save-chat-history', [...messages, userMessage, aiMessage]);
            } else {
                updateJobStatus(job.id, 'failed', result);
                showNotification('Inference failed: ' + result.message, 'error');
            }
        } catch (error) {
            console.error('Inference error:', error);
            showNotification('Error processing request', 'error');
        }
        
        setIsProcessing(false);
    };

    const updateJobStatus = (jobId, status, result) => {
        setJobHistory(prev => prev.map(job => 
            job.id === jobId 
                ? { ...job, status, result, completedAt: new Date().toISOString() }
                : job
        ));
        // Save job history
        ipcRenderer.invoke('save-job-history', jobHistory);
    };

    // File storage functions
    const handleFileUpload = async (file) => {
        try {
            const result = await ipcRenderer.invoke('upload-file-to-ipfs', {
                filePath: file.path,
                fileName: file.name
            });
            
            if (result.success) {
                const newFile = {
                    name: file.name,
                    cid: result.cid,
                    size: file.size,
                    uploadedAt: new Date().toISOString()
                };
                setUploadedFiles(prev => [...prev, newFile]);
                await loadPersistentData();
                showNotification('File uploaded successfully!', 'success');
            }
        } catch (error) {
            console.error('File upload error:', error);
            showNotification('File upload failed', 'error');
        }
    };

    const handleFileDownload = async (file) => {
        try {
            const result = await ipcRenderer.invoke('download-file-from-ipfs', {
                cid: file.cid,
                fileName: file.name
            });
            
            if (result.success) {
                showNotification('File downloaded successfully!', 'success');
            }
        } catch (error) {
            console.error('File download error:', error);
            showNotification('File download failed', 'error');
        }
    };

    // Node control functions
    const toggleNode = async (nodeType) => {
        try {
            const isRunning = nodeStatus[nodeType];
            const result = await ipcRenderer.invoke(isRunning ? 'stop-node' : 'start-node', {
                nodeType,
                config
            });
            
            if (result.success) {
                setNodeStatus(prev => ({ ...prev, [nodeType]: !isRunning }));
            }
        } catch (error) {
            console.error('Node control error:', error);
        }
    };

    // Notification helper
    const showNotification = (message, type) => {
        // Implement notification UI
        console.log(`[${type}] ${message}`);
    };

    // Render functions for each tab
    const renderChatInterface = () => (
        <div className="chat-container">
            <div className="model-selector">
                <label>Select Model:</label>
                <select 
                    value={selectedModel} 
                    onChange={(e) => setSelectedModel(e.target.value)}
                    disabled={models.length === 0}
                >
                    {models.length === 0 ? (
                        <option>No models available</option>
                    ) : (
                        models.map(model => (
                            <option key={model.cid} value={model.cid}>
                                {model.name} ({model.type})
                            </option>
                        ))
                    )}
                </select>
                <button 
                    onClick={() => document.getElementById('model-upload').click()}
                    disabled={uploadingModel}
                >
                    {uploadingModel ? 'Uploading...' : 'Upload Model'}
                </button>
                <input
                    id="model-upload"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => handleModelUpload(e.target.files[0])}
                />
            </div>
            
            <div className="messages">
                {messages.map((msg, idx) => (
                    <div key={idx} className={`message ${msg.role}`}>
                        <strong>{msg.role === 'user' ? 'You' : 'AI'}:</strong>
                        <p>{msg.content}</p>
                        {msg.jobId && (
                            <small>Job ID: {msg.jobId} | Worker: {msg.worker}</small>
                        )}
                    </div>
                ))}
            </div>
            
            <div className="input-container">
                <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                    placeholder="Ask me anything..."
                    disabled={isProcessing}
                />
                <button onClick={handleSendMessage} disabled={isProcessing}>
                    {isProcessing ? 'Processing...' : 'Send'}
                </button>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div className="dashboard">
            <h2>Network Dashboard</h2>
            
            <div className="status-grid">
                <div className="status-card">
                    <h3>Ethereum</h3>
                    <p>Status: {networkStatus.ethConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                    <p>Block: {networkStatus.currentBlock}</p>
                    <p>Peers: {networkStatus.peerCount}</p>
                </div>
                
                <div className="status-card">
                    <h3>IPFS</h3>
                    <p>Status: {networkStatus.ipfsConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                </div>
                
                <div className="status-card">
                    <h3>Bootstrap</h3>
                    <p>Status: {networkStatus.bootstrapConnected ? '🟢 Connected' : '🔴 Disconnected'}</p>
                </div>
                
                <div className="status-card">
                    <h3>Account</h3>
                    <p>{config?.default_account?.substring(0, 10)}...</p>
                    <button onClick={() => navigator.clipboard.writeText(config.default_account)}>
                        Copy Address
                    </button>
                </div>
            </div>
            
            <div className="node-control">
                <h3>Node Control</h3>
                {Object.entries(nodeStatus).map(([type, running]) => (
                    <div key={type} className="node-item">
                        <span>{type.charAt(0).toUpperCase() + type.slice(1)} Node</span>
                        <button onClick={() => toggleNode(type)}>
                            {running ? 'Stop' : 'Start'}
                        </button>
                        <span className={running ? 'status-on' : 'status-off'}>
                            {running ? '🟢' : '🔴'}
                        </span>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderStorageInterface = () => (
        <div className="storage">
            <h2>Decentralized Storage</h2>
            
            {storageInfo && (
                <div className="storage-info">
                    <p>Used: {formatBytes(storageInfo.used)}</p>
                    <p>Available: {formatBytes(storageInfo.available)}</p>
                    <div className="storage-bar">
                        <div 
                            className="storage-used" 
                            style={{ width: `${(storageInfo.used / storageInfo.total) * 100}%` }}
                        />
                    </div>
                </div>
            )}
            
            <div className="file-upload">
                <button onClick={() => document.getElementById('file-upload').click()}>
                    Upload File
                </button>
                <input
                    id="file-upload"
                    type="file"
                    style={{ display: 'none' }}
                    onChange={(e) => handleFileUpload(e.target.files[0])}
                />
            </div>
            
            <div className="file-list">
                <h3>Uploaded Files</h3>
                {uploadedFiles.map((file, idx) => (
                    <div key={idx} className="file-item">
                        <span>{file.name}</span>
                        <span>{formatBytes(file.size)}</span>
                        <button onClick={() => handleFileDownload(file)}>Download</button>
                        <button onClick={() => navigator.clipboard.writeText(file.cid)}>
                            Copy CID
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );

    const renderAnalytics = () => (
        <div className="analytics">
            <h2>Analytics & History</h2>
            
            <div className="job-history">
                <h3>Inference Job History</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Time</th>
                            <th>Prompt</th>
                            <th>Model</th>
                            <th>Status</th>
                            <th>Duration</th>
                        </tr>
                    </thead>
                    <tbody>
                        {jobHistory.map((job, idx) => (
                            <tr key={idx}>
                                <td>{new Date(job.timestamp).toLocaleString()}</td>
                                <td>{job.prompt.substring(0, 50)}...</td>
                                <td>{job.model.substring(0, 8)}...</td>
                                <td className={`status-${job.status}`}>{job.status}</td>
                                <td>
                                    {job.completedAt 
                                        ? `${(new Date(job.completedAt) - new Date(job.timestamp)) / 1000}s`
                                        : '-'
                                    }
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            
            <div className="stats">
                <div className="stat-card">
                    <h4>Total Jobs</h4>
                    <p>{jobHistory.length}</p>
                </div>
                <div className="stat-card">
                    <h4>Success Rate</h4>
                    <p>
                        {jobHistory.length > 0 
                            ? Math.round(jobHistory.filter(j => j.status === 'completed').length / jobHistory.length * 100)
                            : 0
                        }%
                    </p>
                </div>
                <div className="stat-card">
                    <h4>Avg Response Time</h4>
                    <p>
                        {jobHistory.filter(j => j.completedAt).length > 0
                            ? (jobHistory
                                .filter(j => j.completedAt)
                                .reduce((sum, j) => sum + (new Date(j.completedAt) - new Date(j.timestamp)), 0) 
                                / jobHistory.filter(j => j.completedAt).length / 1000).toFixed(1)
                            : 0
                        }s
                    </p>
                </div>
            </div>
        </div>
    );

    const renderSettings = () => (
        <div className="settings">
            <h2>Settings</h2>
            
            <div className="settings-section">
                <h3>Network Configuration</h3>
                <div className="setting-item">
                    <label>Bootstrap URL:</label>
                    <input 
                        value={config?.bootstrap_url || ''} 
                        onChange={(e) => updateConfig('bootstrap_url', e.target.value)}
                    />
                </div>
                <div className="setting-item">
                    <label>Ethereum Node:</label>
                    <input 
                        value={config?.eth_node || ''} 
                        onChange={(e) => updateConfig('eth_node', e.target.value)}
                    />
                </div>
                <div className="setting-item">
                    <label>IPFS Host:</label>
                    <input 
                        value={config?.ipfs_host || ''} 
                        onChange={(e) => updateConfig('ipfs_host', e.target.value)}
                    />
                </div>
            </div>
            
            <div className="settings-section">
                <h3>Account</h3>
                <div className="setting-item">
                    <label>Address:</label>
                    <input value={config?.default_account || ''} readOnly />
                    <button onClick={() => navigator.clipboard.writeText(config.default_account)}>
                        Copy
                    </button>
                </div>
                <button onClick={exportConfig}>Export Configuration</button>
                <button onClick={generateNewAccount}>Generate New Account</button>
            </div>
        </div>
    );

    // Helper functions
    const formatBytes = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    const updateConfig = async (key, value) => {
        const newConfig = { ...config, [key]: value };
        setConfig(newConfig);
        await ipcRenderer.invoke('save-config', newConfig);
    };

    const exportConfig = async () => {
        const result = await ipcRenderer.invoke('export-config');
        if (result.success) {
            showNotification('Configuration exported successfully!', 'success');
        }
    };

    const generateNewAccount = async () => {
        if (confirm('This will replace your current account. Continue?')) {
            const newConfig = await ipcRenderer.invoke('generate-new-account');
            setConfig(newConfig);
            showNotification('New account generated!', 'success');
        }
    };

    // Loading screen
    if (loading) {
        return (
            <div className="loading">
                <h1>Initializing Decentralized AI Network...</h1>
                <p>Auto-configuring your node...</p>
            </div>
        );
    }

    // Main app render
    return (
        <div className="enhanced-app">
            <header>
                <h1>Decentralized AI Network</h1>
                <div className="account-info">
                    {config?.default_account?.substring(0, 10)}...
                </div>
            </header>
            
            <nav>
                <button 
                    className={activeTab === 'chat' ? 'active' : ''} 
                    onClick={() => setActiveTab('chat')}
                >
                    AI Chat
                </button>
                <button 
                    className={activeTab === 'dashboard' ? 'active' : ''} 
                    onClick={() => setActiveTab('dashboard')}
                >
                    Dashboard
                </button>
                <button 
                    className={activeTab === 'storage' ? 'active' : ''} 
                    onClick={() => setActiveTab('storage')}
                >
                    Storage
                </button>
                <button 
                    className={activeTab === 'analytics' ? 'active' : ''} 
                    onClick={() => setActiveTab('analytics')}
                >
                    Analytics
                </button>
                <button 
                    className={activeTab === 'settings' ? 'active' : ''} 
                    onClick={() => setActiveTab('settings')}
                >
                    Settings
                </button>
            </nav>
            
            <main>
                {activeTab === 'chat' && renderChatInterface()}
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'storage' && renderStorageInterface()}
                {activeTab === 'analytics' && renderAnalytics()}
                {activeTab === 'settings' && renderSettings()}
            </main>
        </div>
    );
};

export default EnhancedApp;