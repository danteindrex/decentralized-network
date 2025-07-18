# 📱 Mobile Node Setup (Phones)

For phones, we provide the **easiest possible setup** as light clients that can sign jobs and communicate with nearby workers.

## 🚀 Quick Setup Options

### Option 1: Progressive Web App (Recommended)
1. Open your phone browser
2. Go to: `https://your-bootstrap-ip:8080/mobile`
3. Add to home screen when prompted
4. The app will automatically:
   - Connect to nearby workers via WebRTC
   - Sign AI inference jobs
   - Earn tokens for participation

### Option 2: Native App (Coming Soon)
- iOS App Store / Google Play Store
- One-tap setup
- Background operation
- Push notifications for earnings

### Option 3: Termux (Android Power Users)
```bash
# Install Termux from F-Droid
pkg update && pkg upgrade
pkg install nodejs python git

# Clone and setup
git clone <your-repo>
cd contracts/nodes
chmod +x setup-worker.sh
./setup-worker.sh

# Start mobile node
NODE_TYPE=light node worker/worker-node.js
```

## 📋 Requirements

### Minimum:
- **Any smartphone** (iOS 12+ / Android 8+)
- **100MB free space**
- **WiFi or mobile data**
- **5 minutes setup time**

### Recommended:
- **2GB+ RAM** for better performance
- **Stable internet connection**
- **Power saving mode disabled** during active participation

## 🔧 How It Works

1. **Light Client**: Your phone runs a minimal blockchain client
2. **Task Signing**: Signs AI inference requests with your private key
3. **Reward Collection**: Automatically collects tokens for participation
4. **Peer Discovery**: Finds nearby full nodes via WebRTC/libp2p
5. **Battery Optimized**: Minimal CPU/battery usage

## 💰 Earning Potential

- **Passive Mode**: ~$0.10-0.50/day (just staying connected)
- **Active Mode**: ~$1-5/day (actively signing tasks)
- **Referral Bonus**: 10% of referred users' earnings

## 🛡️ Security

- **Private keys** stored locally on device
- **No personal data** transmitted
- **Open source** - audit the code yourself
- **Encrypted communication** with all peers

## 🔧 Troubleshooting

### Connection Issues:
```javascript
// Check connection status
window.nodeStatus.isConnected()

// Reconnect manually
window.nodeStatus.reconnect()

// View logs
window.nodeStatus.getLogs()
```

### Low Earnings:
- Ensure stable internet connection
- Keep app in foreground when possible
- Join during peak hours (9AM-5PM UTC)
- Refer friends for bonus earnings

### Battery Drain:
- Enable "Battery Optimization" in app settings
- Use WiFi instead of mobile data
- Close other apps while running

## 📞 Support

- **Telegram**: @ai-compute-support
- **Discord**: discord.gg/ai-compute
- **Email**: support@ai-compute.network

---

## 🔗 Quick Start Links

- **Web App**: https://your-bootstrap-ip:8080/mobile
- **Status Page**: https://your-bootstrap-ip:8080/status
- **Earnings Dashboard**: https://your-bootstrap-ip:8080/earnings