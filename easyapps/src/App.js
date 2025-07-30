const React = require('react');
const { useState, useEffect, useCallback } = React;
const { ipcRenderer } = require('electron');
const { initWeb3, uploadToIpfs, fetchFromIpfs, submitInferenceJob, monitorJobCompletion, setConfig, formatFileSize, getMockStorageInfo, getMockFiles, runInference, getNetworkStats, getDiscoveredPeers, saveChatMessageToIpfs, loadChatMessagesFromIpfs, getUserChatStats } = require('./shared-core');

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
    const [networkStats, setNetworkStats] = useState(null);
    const [discoveredPeers, setDiscoveredPeers] = useState([]);

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
                            content: `🎉 Welcome to the Tensor Parallelism Network! 

✅ **Auto-Configuration Complete:**
• Wallet: ${autoConfig.default_account.substring(0, 8)}...
• Network: ${autoConfig.network_id}
• Bootstrap: ${autoConfig.eth_node}
• IPFS: ${autoConfig.ipfs_host}:${autoConfig.ipfs_port}

🧠 **Tensor Parallelism Active:**
Your device joins with phones, laptops & servers for distributed AI processing!

💡 **Try these commands:**
• "run inference: What is quantum computing?"
• "help" - See all available commands
• "upload a file" - Store files on IPFS

🆓 **FREE AI Processing!** All inference is completely free thanks to tensor parallelism!
📱 **Mobile-First:** Your phone contributes to large model processing!`,
                            timestamp: new Date()
                        }]);
                    }
                }
            }
        });

        // Initial network status check (will run after config is loaded due to dependency)
        checkNetworkStatus();

        // Load user-specific chat history from IPFS
        const loadUserChatHistory = async () => {
            try {
                if (config.default_account && config.default_account !== '0xYourDefaultAccountAddress') {
                    const messages = await loadChatMessagesFromIpfs(config.default_account);
                    if (messages && Array.isArray(messages) && messages.length > 0) {
                        setChatHistory(messages);
                        return;
                    }
                }
                
                // Initial chat message if no history or no user account
                setChatHistory([
                    {
                        role: 'assistant',
                        content: `Hello! I'm your tensor parallelism AI assistant for the decentralized network.${config.default_account ? ` Your address: ${config.default_account.substring(0, 8)}...` : ''}\n\n• 🧠 **FREE AI inference** - completely free processing!\n• 📁 IPFS file management with CID tracking\n• 📊 Network status monitoring\n• 📱 **Mobile-first processing** - your phone contributes!\n• ⚡ **Tensor parallelism** - models distributed across devices\n\n🆓 **All AI inference is FREE!** Your message history is stored on IPFS with unique CIDs.`,
                        timestamp: new Date()
                    }
                ]);
            } catch (error) {
                console.error('Failed to load user chat messages:', error);
                setChatHistory([
                    {
                        role: 'assistant',
                        content: 'Hello! I\'m your tensor parallelism AI assistant. Please configure your wallet to enable message history tracking.',
                        timestamp: new Date()
                    }
                ]);
            }
        };
        
        loadUserChatHistory();

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

        // Save user message to IPFS with user address tracking
        try {
            const messageCid = await saveChatMessageToIpfs(newUserMessage, config.default_account);
            if (messageCid) {
                console.log(`Chat message saved to IPFS with CID: ${messageCid} for user: ${config.default_account}`);
                // Update the message with its CID for display in storage tab
                setChatHistory(prev => prev.map(msg => msg === newUserMessage ? { ...msg, cid: messageCid } : msg));
            } else {
                console.error("Failed to save chat message to IPFS.");
            }
        } catch (error) {
            console.error("Error saving chat message:", error);
        }

        const response = await processChatRequest(userInput);

        const assistantResponse = {
            role: 'assistant',
            content: response,
            timestamp: new Date()
        };
        
        // Save assistant response to IPFS with user address tracking
        try {
            const responseCid = await saveChatMessageToIpfs(assistantResponse, config.default_account);
            if (responseCid) {
                console.log(`Assistant response saved to IPFS with CID: ${responseCid}`);
                assistantResponse.cid = responseCid;
            }
        } catch (error) {
            console.error("Error saving assistant response:", error);
        }
        
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

            try {
                const result = await runInference(prompt, account, privateKey);
                return `🎉 **Tensor Parallel Inference Complete!**\n\n**Response:** ${result.response}\n\n*Job ID: ${result.jobId} • Worker: ${result.worker} • Cost: FREE 🆓*`;
            } catch (error) {
                return `❌ Tensor parallelism inference failed: ${error.message}\n\nPlease check your network configuration and wallet setup.`;
            }
        }
        else if (inputLower.includes('upload') || inputLower.includes('file')) {
            return "I can help you upload files! Please use the Storage tab to upload files to IPFS.";
        }
        else if (inputLower.includes('storage') || inputLower.includes('stats') || inputLower.includes('history')) {
            try {
                const userStats = await getUserChatStats(config.default_account);
                const storageInfo = getMockStorageInfo();
                
                return `📊 **Your Tensor Parallelism Stats:**\n\n**Chat History:**\n• Address: ${userStats?.userAddress?.substring(0, 8)}...\n• Total Messages: ${userStats?.totalMessages || 0}\n• Inference Jobs: ${userStats?.totalInferenceJobs || 0}\n• First Message: ${userStats?.firstMessageDate ? new Date(userStats.firstMessageDate).toLocaleDateString() : 'None'}\n\n**IPFS Storage:**\n• Used: ${formatFileSize(storageInfo.used_space)}\n• Available: ${formatFileSize(storageInfo.available_space)}\n• Files: ${storageInfo.file_count}\n• Message Storage: ${formatFileSize(userStats?.storageUsed || 0)}`;
            } catch (error) {
                return `❌ Error loading stats: ${error.message}`;
            }
        }
        else if (inputLower.includes('help')) {
            return `🤖 **Tensor Parallelism AI Assistant Help:**\n\n• **FREE AI Inference**: Say "run inference on: [your prompt]" - completely free!\n• **File Management**: Upload, download, and manage files on IPFS\n• **Storage Stats**: Check your storage usage and file information\n• **Network Status**: Monitor blockchain and IPFS connectivity\n\nTry asking me something like:\n- "run inference on: Explain quantum computing"\n- "show my storage stats"\n- "upload a file"\n\n🆓 **FREE Processing:** All AI inference is completely free!\n📱 **Mobile-First:** Your phone contributes to large model processing!\n⚡ **Tensor Parallelism:** Models distributed across multiple devices!`;
        }
        else {
            // For general conversation, try to run inference on the input
            const account = config.default_account;
            const privateKey = config.private_key;

            if (!account || !privateKey || account === '0xYourDefaultAccountAddress') {
                return `I understand you said: '${input}'. To enable AI conversation, please configure your wallet in the Settings tab.`;
            }

            try {
                const result = await runInference(input, account, privateKey);
                return `🧠 **Tensor Parallelism Response:**\n\n${result.response}\n\n*Job ID: ${result.jobId} • Worker: ${result.worker} • Cost: FREE 🆓*`;
            } catch (error) {
                return `❌ I couldn't process that through tensor parallelism: ${error.message}\n\nTry 'help' to see available commands.`;
            }
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

module.exports = { default: App };
