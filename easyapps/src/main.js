const { app, BrowserWindow, ipcMain, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const os = require('os');
const sharedCore = require('./shared-core'); // Import the shared core module

// Register output callback from sharedCore to send messages to renderer
sharedCore.registerOutputCallback((type, message) => {
    if (mainWindow) {
        mainWindow.webContents.send('node-output', { type, message });
    }
});

// Keep a global reference of the window object
let mainWindow;

const CONFIG_FILE = path.join(app.getPath('userData'), 'node-config.json');

function createWindow() {
    // Create the browser window
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true
        },
        icon: path.join(__dirname, '../assets/icon.png'),
        titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
        show: false // Don't show until ready
    });

    // Load the app
    mainWindow.loadFile(path.join(__dirname, '../build/index.html'));

    // Show window when ready
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
        mainWindow.webContents.openDevTools(); // Open DevTools
        
        // Load existing configuration
        loadConfiguration();
    });

    // Handle window closed
    mainWindow.on('closed', () => {
        mainWindow = null;
        stopNode();
    });

    // Open external links in browser
    mainWindow.webContents.setWindowOpenHandler(({ url }) => {
        shell.openExternal(url);
        return { action: 'deny' };
    });
}

// App event listeners
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

app.on('before-quit', () => {
    stopNode();
});

// Load configuration
function loadConfiguration() {
    try {
        let config = {};
        if (fs.existsSync(CONFIG_FILE)) {
            config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
        mainWindow.webContents.send('config-loaded', config);
    } catch (error) {
        console.error('Error loading configuration:', error);
        mainWindow.webContents.send('show-setup');
    }
}

// Save configuration
function saveConfiguration(config) {
    try {
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving configuration:', error);
        return false;
    }
}

// Start node process


// IPC handlers
ipcMain.handle('get-platform', () => {
    return {
        platform: os.platform(),
        arch: os.arch(),
        version: os.version()
    };
});

ipcMain.handle('save-config', (event, config) => {
    return saveConfiguration(config);
});

ipcMain.handle('load-config', () => {
    try {
        if (fs.existsSync(CONFIG_FILE)) {
            return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
        }
        return null;
    } catch (error) {
        return null;
    }
});

ipcMain.handle('start-node', async (event, config) => {
    const projectRoot = path.join(__dirname, '../../'); // This should be /home/lambda/contracts
    return await sharedCore.startNode(config.nodeType, projectRoot, config.environment);
});

ipcMain.handle('stop-node', async () => {
    return await sharedCore.stopNode();
});

ipcMain.handle('get-node-status', async () => {
    return await sharedCore.getNodeStatus();
});

ipcMain.handle('select-directory', async () => {
    const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openDirectory']
    });
    return result.filePaths[0] || null;
});

ipcMain.handle('show-message', async (event, options) => {
    return await dialog.showMessageBox(mainWindow, options);
});

// Network discovery
ipcMain.handle('discover-bootstrap-nodes', async () => {
    // Implement bootstrap node discovery logic
    return [
        { ip: '127.0.0.1', port: 30303, name: 'Local Node' },
        // Add more discovery methods here
    ];
});
