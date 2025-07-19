#!/usr/bin/env node
/**
 * Mobile PWA Server
 * Serves Progressive Web App for mobile users
 * Runs on bootstrap nodes to provide mobile access
 */

const express = require('express');
const path = require('path');
const fs = require('fs');
const WebSocket = require('ws');
const QRCode = require('qrcode');

class MobileServer {
    constructor() {
        this.app = express();
        this.port = process.env.MOBILE_PORT || 8080;
        this.bootstrapNode = process.env.BOOTSTRAP_NODE || 'localhost:30303';
        this.ethNodeUrl = process.env.ETH_NODE_URL || 'http://localhost:8545';
        
        this.setupMiddleware();
        this.setupRoutes();
        this.setupWebSocket();
    }
    
    setupMiddleware() {
        // Serve static files
        this.app.use(express.static(path.join(__dirname)));
        this.app.use(express.json());
        
        // CORS for mobile browsers
        this.app.use((req, res, next) => {
            res.header('Access-Control-Allow-Origin', '*');
            res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
            res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
            
            if (req.method === 'OPTIONS') {
                res.sendStatus(200);
            } else {
                next();
            }
        });
        
        // PWA headers
        this.app.use((req, res, next) => {
            if (req.url.endsWith('.js')) {
                res.setHeader('Service-Worker-Allowed', '/');
            }
            next();
        });
    }
    
    setupRoutes() {
        // Main mobile app
        this.app.get('/mobile', (req, res) => {
            res.sendFile(path.join(__dirname, 'mobile-client.html'));
        });
        
        // PWA manifest
        this.app.get('/manifest.json', (req, res) => {
            res.json({
                name: "AI Compute Mobile Node",
                short_name: "AI Node",
                description: "Mobile light client for AI compute network",
                start_url: "/mobile",
                display: "standalone",
                background_color: "#667eea",
                theme_color: "#2196F3",
                orientation: "portrait",
                icons: [
                    {
                        src: "/icon-192.png",
                        sizes: "192x192",
                        type: "image/png"
                    },
                    {
                        src: "/icon-512.png",
                        sizes: "512x512",
                        type: "image/png"
                    }
                ],
                categories: ["productivity", "utilities"],
                lang: "en",
                scope: "/",
                prefer_related_applications: false
            });
        });
        
        // Service worker
        this.app.get('/sw.js', (req, res) => {
            res.setHeader('Content-Type', 'application/javascript');
            res.send(this.generateServiceWorker());
        });
        
        // Network status API
        this.app.get('/api/status', async (req, res) => {
            try {
                const status = await this.getNetworkStatus();
                res.json(status);
            } catch (error) {
                res.status(500).json({ error: error.message });
            }
        });
        
        // Bootstrap node info
        this.app.get('/api/bootstrap', (req, res) => {
            res.json({
                node: this.bootstrapNode,
                ethNode: this.ethNodeUrl,
                timestamp: Date.now()
            });
        });
        
        // QR code for easy mobile access
        this.app.get('/qr', async (req, res) => {
            try {
                const url = `http://${req.get('host')}/mobile`;
                const qr = await QRCode.toDataURL(url);
                
                res.send(`
                    <html>
                        <head><title>Mobile Access QR Code</title></head>
                        <body style="text-align: center; font-family: Arial;">
                            <h2>📱 Mobile Access</h2>
                            <p>Scan this QR code with your phone to access the mobile app:</p>
                            <img src="${qr}" alt="QR Code" style="max-width: 300px;">
                            <p><strong>URL:</strong> <a href="${url}">${url}</a></p>
                            <p><em>Or visit this URL directly in your mobile browser</em></p>
                        </body>
                    </html>
                `);
            } catch (error) {
                res.status(500).send('Error generating QR code');
            }
        });
        
        // Mobile setup instructions
        this.app.get('/setup', (req, res) => {
            res.send(`
                <html>
                    <head>
                        <title>Mobile Setup Instructions</title>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0">
                        <style>
                            body { font-family: Arial; margin: 20px; line-height: 1.6; }
                            .step { background: #f5f5f5; padding: 15px; margin: 10px 0; border-radius: 5px; }
                            .qr { text-align: center; margin: 20px 0; }
                        </style>
                    </head>
                    <body>
                        <h1>📱 Mobile Setup Instructions</h1>
                        
                        <div class="step">
                            <h3>Step 1: Open Mobile App</h3>
                            <p>Visit: <a href="/mobile">${req.get('host')}/mobile</a></p>
                        </div>
                        
                        <div class="step">
                            <h3>Step 2: Install App</h3>
                            <p><strong>iPhone:</strong> Tap Share (📤) → "Add to Home Screen"</p>
                            <p><strong>Android:</strong> Tap Menu (⋮) → "Add to Home screen"</p>
                        </div>
                        
                        <div class="step">
                            <h3>Step 3: Start Earning</h3>
                            <p>The app will automatically connect and start earning tokens!</p>
                        </div>
                        
                        <div class="qr">
                            <p><a href="/qr">📱 Get QR Code for Easy Access</a></p>
                        </div>
                        
                        <p><strong>Need help?</strong> Join our <a href="https://discord.gg/ai-compute">Discord</a> or <a href="https://t.me/ai-compute-support">Telegram</a></p>
                    </body>
                </html>
            `);
        });
        
        // Health check
        this.app.get('/health', (req, res) => {
            res.json({ 
                status: 'healthy', 
                timestamp: Date.now(),
                service: 'mobile-server'
            });
        });
        
        // Redirect root to mobile app
        this.app.get('/', (req, res) => {
            res.redirect('/mobile');
        });
    }
    
    setupWebSocket() {
        this.wss = new WebSocket.Server({ port: this.port + 1 });
        
        this.wss.on('connection', (ws, req) => {
            console.log(`📱 Mobile client connected from ${req.socket.remoteAddress}`);
            
            // Send welcome message
            ws.send(JSON.stringify({
                type: 'welcome',
                data: {
                    bootstrapNode: this.bootstrapNode,
                    ethNode: this.ethNodeUrl,
                    timestamp: Date.now()
                }
            }));
            
            // Handle messages from mobile clients
            ws.on('message', (message) => {
                try {
                    const data = JSON.parse(message);
                    this.handleMobileMessage(ws, data);
                } catch (error) {
                    console.error('Invalid message from mobile client:', error);
                }
            });
            
            ws.on('close', () => {
                console.log('📱 Mobile client disconnected');
            });
        });
    }
    
    handleMobileMessage(ws, data) {
        switch (data.type) {
            case 'ping':
                ws.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
                break;
                
            case 'getStatus':
                this.getNetworkStatus().then(status => {
                    ws.send(JSON.stringify({ type: 'status', data: status }));
                });
                break;
                
            case 'signTask':
                // Handle task signing from mobile client
                this.handleTaskSigning(ws, data.data);
                break;
                
            default:
                console.log('Unknown message type from mobile client:', data.type);
        }
    }
    
    async handleTaskSigning(ws, taskData) {
        try {
            // Validate task
            if (!taskData.taskId || !taskData.signature) {
                throw new Error('Invalid task data');
            }
            
            // Process task signing
            console.log(`📝 Mobile client signed task: ${taskData.taskId}`);
            
            // Send confirmation
            ws.send(JSON.stringify({
                type: 'taskSigned',
                data: {
                    taskId: taskData.taskId,
                    reward: 0.01 + Math.random() * 0.05, // Random reward
                    timestamp: Date.now()
                }
            }));
            
        } catch (error) {
            ws.send(JSON.stringify({
                type: 'error',
                data: { message: error.message }
            }));
        }
    }
    
    async getNetworkStatus() {
        // Simulate network status check
        return {
            connected: true,
            peers: Math.floor(Math.random() * 50) + 10,
            activeTasks: Math.floor(Math.random() * 20),
            totalEarnings: (Math.random() * 100).toFixed(4),
            networkHealth: 'good',
            timestamp: Date.now()
        };
    }
    
    generateServiceWorker() {
        return `
            const CACHE_NAME = 'ai-compute-mobile-v1';
            const urlsToCache = [
                '/mobile',
                '/manifest.json',
                '/icon-192.png',
                '/icon-512.png'
            ];
            
            self.addEventListener('install', (event) => {
                event.waitUntil(
                    caches.open(CACHE_NAME)
                        .then((cache) => cache.addAll(urlsToCache))
                );
            });
            
            self.addEventListener('fetch', (event) => {
                event.respondWith(
                    caches.match(event.request)
                        .then((response) => {
                            if (response) {
                                return response;
                            }
                            return fetch(event.request);
                        })
                );
            });
            
            // Handle background sync for offline task signing
            self.addEventListener('sync', (event) => {
                if (event.tag === 'background-sync') {
                    event.waitUntil(doBackgroundSync());
                }
            });
            
            async function doBackgroundSync() {
                // Sync pending tasks when back online
                console.log('Background sync triggered');
            }
        `;
    }
    
    start() {
        this.app.listen(this.port, () => {
            console.log(`📱 Mobile server running on port ${this.port}`);
            console.log(`🌐 Mobile app: http://localhost:${this.port}/mobile`);
            console.log(`📱 QR code: http://localhost:${this.port}/qr`);
            console.log(`🔧 Setup guide: http://localhost:${this.port}/setup`);
            console.log(`🔌 WebSocket: ws://localhost:${this.port + 1}`);
        });
    }
}

// Start server if run directly
if (require.main === module) {
    const server = new MobileServer();
    server.start();
}

module.exports = MobileServer;
        