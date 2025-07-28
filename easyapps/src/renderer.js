const { ipcRenderer } = require('electron');
const React = require('react');
const ReactDOM = require('react-dom/client');
const App = require('./App').default; // Import the new App.js

document.addEventListener('DOMContentLoaded', () => {
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(
        React.createElement(App, null)
    );

    // Existing IPC handlers (keep them if they are still relevant for Electron main process communication)
    ipcRenderer.on('node-started', (event, data) => {
        console.log(`Node ${data.nodeType} started successfully!`);
    });

    ipcRenderer.on('node-output', (event, data) => {
        console.log('Node Output:', data);
    });

    ipcRenderer.on('node-error', (event, data) => {
        console.error('Node Error:', data);
    });

    ipcRenderer.on('node-stopped', (event, data) => {
        console.log(`Node stopped. Code: ${data}`);
    });
});
