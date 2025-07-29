import React, { useState, useEffect, useCallback } from 'react';
import { initWeb3, uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion, setConfig, formatFileSize, getMockStorageInfo, getMockFiles, runInference } from './shared-core';

const App = () => {
    const [activeTab, setActiveTab] = useState('chat');
    const [chatHistory, setChatHistory] = useState([]);
    const [userInput, setUserInput] = useState('');
    const [config, setAppConfig] = useState({
        eth_node: '',
        ipfs_host: '',
        ipfs_port: 5001,
        contract_address: '',
        model_registry_address: '',
        default_account: '',
        private_key: ''
    });
    const [web3Status, setWeb3Status] = useState('Disconnected');
    const [ipfsStatus, setIpfsStatus] = useState('Disconnected');
    const [storageInfo, setStorageInfo] = useState(getMockStorageInfo());
    const [files, setFiles] = useState(getMockFiles());

    // Node management states
    const [selectedNodeType, setSelectedNodeType] = useState('worker');
    const [nodeStatus, setNodeStatus] = useState({ running: false, nodeType: null });
    const [nodeOutput, setNodeOutput] = useState([]);

    // File upload states
    const [selectedFile, setSelectedFile] = useState(null);
    const [uploadedFiles, setUploadedFiles] = useState([]);

    // Combined storage items for display
    const [storageItems, setStorageItems] = useState([]);

    // Function to check network status
    const checkNetworkStatus = useCallback(async () => {
        try {
            // Ensure shared-core has the latest config before initializing Web3
            setConfig(config);
            const { w3 } = initWeb3();
            if (w3 && await w3.eth.net.isListening()) {
                setWeb3Status('Connected');
            }
            else {
                setWeb3Status('Disconnected');
            }
        }
        catch (e) {
            setWeb3Status('Disconnected');
        }

        // Mock IPFS status for now, will be updated with actual check later
        setIpfsStatus('Connected');
    }, [config]); // Re-run if config changes

    useEffect(() => {
        // Load configuration from Electron main process
        ipcRenderer.invoke('load-config').then(async (loadedConfig) => {
            if (loadedConfig && loadedConfig.eth_node && loadedConfig.contract_address !== '0xYourInferenceCoordinatorContractAddress') {
                setAppConfig(prevConfig => ({ ...prevConfig, ...loadedConfig }));
            } else {
                // Try to load network config first
                const networkConfig = await ipcRenderer.invoke('load-network-config');
                if (networkConfig) {
                    setAppConfig(prevConfig => ({ ...prevConfig, ...networkConfig }));
                } else {
                    // Auto-generate config for new users
                    console.log('No configuration found, generating auto-config...');
                    const autoConfig = await ipcRenderer.invoke('generate-auto-config');
                    if (autoConfig) {
                        setAppConfig(prevConfig => ({ ...prevConfig, ...autoConfig }));
                        // Save the auto-generated config
                        await ipcRenderer.invoke('save-network-config', autoConfig);
                        await ipcRenderer.invoke('save-config', autoConfig);
                        
                        // Show welcome message
                        setChatHistory([{
                            role: 'assistant',
                            content: `🎉 Welcome to the Decentralized AI Network! 

I've automatically generated a new wallet for you:
• Address: ${autoConfig.default_account}
• Network: ${autoConfig.network_id}

⚠️ **Important**: Your wallet currently has 0 ETH. To use AI inference, you'll need some ETH for gas fees. You can:
1. Get test ETH from a faucet if on testnet
2. Transfer ETH from another wallet
3. Join as a worker node to earn ETH

Your configuration has been saved. You can view it in the Settings tab.`,
                            timestamp: new Date()
                        }]);
                    }
                }
            }
        });

        // Initial network status check (will run after config is loaded due to dependency)
        checkNetworkStatus();

        // Load chat history from IPFS
        ipcRenderer.invoke('load-chat-messages').then(messages => {
            if (messages) {
                setChatHistory(messages.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp)));
            } else {
                // Initial chat message if no history
                setChatHistory([
                    {
                        role: 'assistant',
                        content: 'Hello! I\'m your IPFS and AI assistant. I can help you upload files, run AI inference, and manage your decentralized storage. What would you like to do today?',
                        timestamp: new Date()
                    }
                ]);
            }
        });

        // Update storage info and files (mock for now)
        setStorageInfo(getMockStorageInfo());
        setFiles(getMockFiles());

        // Listen for node output from main process
        ipcRenderer.on('node-output', (event, data) => {
            setNodeOutput(prev => [...prev, data]);
        });

        // Get initial node status
        ipcRenderer.invoke('get-node-status').then(status => {
            setNodeStatus(status);
        });

        return () => {
            ipcRenderer.removeAllListeners('node-output');
        };

    }, [checkNetworkStatus]); // Dependency on checkNetworkStatus

    // Combined storage items for display
    useEffect(() => {
        const combined = [
            ...uploadedFiles.map(file => ({ ...file, type: 'file' })),
            ...chatHistory.filter(msg => msg.role === 'user' && msg.cid).map(msg => ({
                id: msg.cid,
                name: `Chat Message (${msg.timestamp.toLocaleString()})`,
                size: new TextEncoder().encode(JSON.stringify(msg)).length, // Approximate size
                hash: msg.cid,
                uploaded_at: msg.timestamp,
                mime_type: 'application/json',
                type: 'chat_message',
                content: msg.content
            }))
        ];
        setStorageItems(combined.sort((a, b) => new Date(a.uploaded_at) - new Date(b.uploaded_at)));
    }, [uploadedFiles, chatHistory]);

    const handleSendMessage = async () => {
        if (!userInput.trim()) return;

        const newUserMessage = {
            role: 'user',
            content: userInput,
            timestamp: new Date()
        };
        setChatHistory(prev => [...prev, newUserMessage]);
        setUserInput('');

        // Save user message to IPFS
        const messageCid = await ipcRenderer.invoke('save-chat-message', newUserMessage);
        if (messageCid) {
            console.log("Chat message saved to IPFS with CID:", messageCid);
            // Update the message with its CID for display in storage tab
            setChatHistory(prev => prev.map(msg => msg === newUserMessage ? { ...msg, cid: messageCid } : msg));
        } else {
            console.error("Failed to save chat message to IPFS.");
        }

        const response = await processChatRequest(userInput);

        const assistantResponse = {
            role: 'assistant',
            content: response,
            timestamp: new Date()
        };
        setChatHistory(prev => [...prev, assistantResponse]);
    };

    const processChatRequest = async (input) => {
        const inputLower = input.toLowerCase();

        if (inputLower.includes('inference') || inputLower.includes('run')) {
            const prompt = input.split(':', 1)[1]?.trim() || input;
            // Replace with actual account and private key from config
            const account = config.default_account;
            const privateKey = config.private_key;

            if (!account || !privateKey) {
                return "Please configure your account and private key in settings to run inference.";
            }

            const result = await runInference(prompt, account, privateKey);
            if (result.success) {
                return `🎉 **Inference Complete!**\n\n**Response:** ${result.response}\n\n*Job ID: ${result.jobId}*`;
            }
            else {
                return `❌ ${result.message}`;
            }
        }
        else if (inputLower.includes('upload') || inputLower.includes('file')) {
            return "I can help you upload files! Please use the Storage tab to upload files to IPFS.";
        }
        else if (inputLower.includes('storage') || inputLower.includes('stats')) {
            const info = getMockStorageInfo(); // Use actual storage info later
            return `📊 Storage Stats:\n• Used: ${formatFileSize(info.used_space)}\n• Available: ${formatFileSize(info.available_space)}\n• Files: ${info.file_count}\n• Usage: ${(info.used_space / info.total_space * 100).toFixed(1)}%`;
        }
        else if (inputLower.includes('help')) {
            return `🤖 I can help you with:\n\n• **AI Inference**: Say "run inference on: [your prompt]" to get AI responses\n• **File Management**: Upload, download, and manage files on IPFS\n• **Storage Stats**: Check your storage usage and file information\n• **Network Status**: Monitor blockchain and IPFS connectivity\n\nTry asking me something like:\n- "run inference on: Explain quantum computing"\n- "show my storage stats"\n- "upload a file"`;
        }
        else {
            return `I understand you said: '${input}'. I can help with AI inference, file management, and storage. Type 'help' to see what I can do!`;
        }
    };

    const handleStartNode = async () => {
        setNodeOutput([]); // Clear previous output
        const result = await ipcRenderer.invoke('start-node', { nodeType: selectedNodeType, environment: config });
        if (result.success) {
            setNodeStatus({ running: true, nodeType: selectedNodeType });
        } else {
            setNodeOutput(prev => [...prev, { type: 'error', message: result.message }]);
        }
    };

    const handleStopNode = async () => {
        const result = await ipcRenderer.invoke('stop-node');
        if (result.success) {
            setNodeStatus({ running: false, nodeType: null });
        } else {
            setNodeOutput(prev => [...prev, { type: 'error', message: result.message }]);
        }
    };

    const handleConfigChange = (e) => {
        const { name, value } = e.target;
        setAppConfig(prevConfig => ({
            ...prevConfig,
            [name]: value
        }));
    };

    const handleSaveConfig = async () => {
        const result = await ipcRenderer.invoke('save-config', config);
        if (result) {
            alert('Configuration saved successfully!');
            setConfig(config); // Update shared-core with new config
            checkNetworkStatus(); // Re-check status after saving config
        } else {
            alert('Failed to save configuration.');
        }
    };

    const handleFileChange = (event) => {
        if (event.target.files.length > 0) {
            setSelectedFile(event.target.files[0]);
        } else {
            setSelectedFile(null);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) {
            alert('Please select a file to upload.');
            return;
        }

        // Read file content
        const reader = new FileReader();
        reader.onload = async (e) => {
            const fileContent = e.target.result; // This will be an ArrayBuffer
            const fileName = selectedFile.name;

            alert(`Uploading ${fileName}...`);
            const result = await uploadToIpfs(fileContent, fileName);

            if (result) {
                const newFile = {
                    id: Date.now().toString(), // Simple unique ID
                    name: fileName,
                    size: selectedFile.size,
                    hash: result,
                    uploaded_at: new Date().toISOString(),
                    mime_type: selectedFile.type || 'application/octet-stream'
                };
                setUploadedFiles(prev => [...prev, newFile]);
                alert(`File ${fileName} uploaded successfully! CID: ${result}`);
            } else {
                alert(`Failed to upload ${fileName}.`);
            }
            setSelectedFile(null);
        };
        reader.readAsArrayBuffer(selectedFile); // Read file as ArrayBuffer
    };

    const renderChatInterface = () => (
        <div>
            <h2>AI Assistant Chat</h2>
            <div style={{ height: '400px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px' }}>
                {chatHistory.map((msg, index) => (
                    <div key={index} style={{ textAlign: msg.role === 'user' ? 'right' : 'left', margin: '10px 0' }}>
                        <div style={{
                            display: 'inline-block',
                            padding: '8px 12px',
                            borderRadius: '15px',
                            backgroundColor: msg.role === 'user' ? '#007bff' : '#f0f0f0',
                            color: msg.role === 'user' ? 'white' : 'black'
                        }}>
                            {msg.content}
                        </div>
                        <div style={{ fontSize: '0.8em', color: '#666' }}>{msg.timestamp.toLocaleTimeString()}</div>
                    </div>
                ))}
            </div>
            <div style={{ display: 'flex', marginTop: '10px' }}>
                <input
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyPress={(e) => { if (e.key === 'Enter') handleSendMessage(); }}
                    placeholder="Type your message..."
                    style={{ flexGrow: 1, padding: '8px' }}
                />
                <button onClick={handleSendMessage} style={{ marginLeft: '10px', padding: '8px 15px' }}>Send</button>
            </div>
        </div>
    );

    const renderDashboard = () => (
        <div>
            <h2>Network Dashboard</h2>
            <p>Blockchain Status: {web3Status}</p>
            <p>IPFS Status: {ipfsStatus}</p>
            <button onClick={checkNetworkStatus} style={{ marginBottom: '10px' }}>Refresh Status</button>
            <h3>Node Control</h3>
            <div>
                <label>
                    <input
                        type="radio"
                        value="bootstrap"
                        checked={selectedNodeType === 'bootstrap'}
                        onChange={(e) => setSelectedNodeType(e.target.value)}
                    /> Bootstrap Node
                </label>
                <label>
                    <input
                        type="radio"
                        value="worker"
                        checked={selectedNodeType === 'worker'}
                        onChange={(e) => setSelectedNodeType(e.target.value)}
                    /> Worker Node
                </label>
                <label>
                    <input
                        type="radio"
                        value="owner"
                        checked={selectedNodeType === 'owner'}
                        onChange={(e) => setSelectedNodeType(e.target.value)}
                    /> Owner Node
                </label>
                <label>
                    <input
                        type="radio"
                        value="user"
                        checked={selectedNodeType === 'user'}
                        onChange={(e) => setSelectedNodeType(e.target.value)}
                    /> User Node (Streamlit)
                </label>
            </div>
            <p>Current Node: {nodeStatus.running ? `${nodeStatus.nodeType} (Running)` : 'None'}</p>
            <button onClick={handleStartNode} disabled={nodeStatus.running}>Start Selected Node</button>
            <button onClick={handleStopNode} disabled={!nodeStatus.running} style={{ marginLeft: '10px' }}>Stop Node</button>

            <h3>Node Output</h3>
            <div style={{ height: '200px', overflowY: 'scroll', border: '1px solid #ccc', padding: '10px', backgroundColor: '#333', color: '#0f0' }}>
                {nodeOutput.map((line, index) => (
                    <p key={index} style={{ margin: 0, color: line.type === 'error' ? 'red' : (line.type === 'warn' ? 'yellow' : '#0f0') }}>
                        {line.message}
                    </p>
                ))}
            </div>
        </div>
    );

    const renderStorageInterface = () => (
        <div>
            <h2>IPFS Storage Management</h2>
            <p>Used Space: {formatFileSize(storageInfo.used_space)}</p>
            <p>Available Space: {formatFileSize(storageInfo.available_space)}</p>
            <p>Files Stored: {storageItems.length}</p>

            <h3>Upload File to IPFS</h3>
            <input type="file" onChange={handleFileChange} />
            <button onClick={handleFileUpload} disabled={!selectedFile}>Upload File</button>

            <h3>Your Stored Items</h3>
            {storageItems.length > 0 ? (
                <ul>
                    {storageItems.map((item) => (
                        <li key={item.id}>
                            <strong>{item.name}</strong> ({formatFileSize(item.size)}) - CID: {item.hash}
                            {item.type === 'chat_message' && <p style={{ margin: '5px 0 0 0', fontSize: '0.9em', color: '#666' }}>Content: {item.content}</p>}
                            <br />
                            <small>Uploaded: {new Date(item.uploaded_at).toLocaleString()}</small>
                        </li>
                    ))}
                </ul>
            ) : (
                <p>No items stored yet.</p>
            )}
        </div>
    );

    const renderAnalytics = () => (
        <div>
            <h2>Network Analytics</h2>
            <p>Analytics data will be displayed here.</p>
        </div>
    );

    const renderSettings = () => (
        <div>
            <h2>Settings & Configuration</h2>
            <div>
                <label>Ethereum Node URL:</label>
                <input
                    type="text"
                    name="eth_node"
                    value={config.eth_node}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>IPFS Host:</label>
                <input
                    type="text"
                    name="ipfs_host"
                    value={config.ipfs_host}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>IPFS Port:</label>
                <input
                    type="number"
                    name="ipfs_port"
                    value={config.ipfs_port}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>Contract Address (InferenceCoordinator):</label>
                <input
                    type="text"
                    name="contract_address"
                    value={config.contract_address}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>Model Registry Address:</label>
                <input
                    type="text"
                    name="model_registry_address"
                    value={config.model_registry_address}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>Default Account Address:</label>
                <input
                    type="text"
                    name="default_account"
                    value={config.default_account}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <div>
                <label>Private Key (Use with caution!):</label>
                <input
                    type="password"
                    name="private_key"
                    value={config.private_key}
                    onChange={handleConfigChange}
                    style={{ width: '100%', padding: '8px', margin: '5px 0' }}
                />
            </div>
            <button onClick={handleSaveConfig} style={{ marginTop: '10px' }}>Save Configuration</button>
        </div>
    );

    return (
        <div>
            <nav>
                <button onClick={() => setActiveTab('chat')}>AI Chat</button>
                <button onClick={() => setActiveTab('dashboard')}>Dashboard</button>
                <button onClick={() => setActiveTab('storage')}>Storage</button>
                <button onClick={() => setActiveTab('analytics')}>Analytics</button>
                <button onClick={() => setActiveTab('settings')}>Settings</button>
            </nav>
            <div style={{ padding: '20px' }}>
                {activeTab === 'chat' && renderChatInterface()}
                {activeTab === 'dashboard' && renderDashboard()}
                {activeTab === 'storage' && renderStorageInterface()}
                {activeTab === 'analytics' && renderAnalytics()}
                {activeTab === 'settings' && renderSettings()}
            </div>
        </div>
    );
};

export default App;
