# 🚀 Quick Start - Decentralized Network

Get your **truly decentralized** AI compute network running in **under 30 minutes**.

## 🎯 Decentralized Overview

Your network is **peer-to-peer**:
1. **Community Bootstrap Nodes** (anyone's home computer/router)
2. **Worker Nodes** (everyone's devices)
3. **Mobile Access** (direct P2P connections)

**No cloud providers. No central servers. Pure decentralization.**

---

## 🏠 Option 1: Run Bootstrap Node (From Your Home)

### Setup Home Bootstrap Node

```bash
# 1. Setup free dynamic DNS
# Visit: duckdns.org, no-ip.com, or use your router's DDNS
# Example: your-name.duckdns.org

# 2. Configure your router
# Port forward 30303 → your computer's local IP
# Router admin → Port Forwarding → Add rule

# 3. Run bootstrap node
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network/nodes
STATIC_IP=your-name.duckdns.org node bootstrap/bootstrap-node.js

# 4. Share with friends
echo "Join my AI network: your-name.duckdns.org:30303"
```

### Alternative: Use Existing Computer

```bash
# If you have any always-on computer (even Raspberry Pi):
./deploy.sh bootstrap --static-ip=your-dynamic-dns.com
```

---

## 🔍 Option 2: Join Existing Network

### Auto-Discovery (Recommended)

```bash
# 1. Discover active bootstrap nodes
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network/nodes
node discover-bootstrap.js

# 2. Join automatically
./install-worker.sh
```

### Manual Join

```bash
# 1. Find active bootstrap nodes
curl https://raw.githubusercontent.com/your-org/ai-compute-network/main/bootstrap-nodes.json

# 2. Join specific node
BOOTSTRAP_NODE=active-node.duckdns.org ./install-worker.sh
```

---

## 💻 Add Worker Nodes

### One-Line Install (Any Device)

```bash
# Replace YOUR_BOOTSTRAP_IP with your bootstrap node's IP
curl -sSL https://raw.githubusercontent.com/your-org/ai-compute-network/main/install-worker.sh | BOOTSTRAP_IP=YOUR_BOOTSTRAP_IP bash
```

### Manual Install

```bash
# 1. Clone repository
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network

# 2. Run deployment script
./deploy.sh worker

# 3. Configure resources
cd nodes
node configure-resources.js

# 4. Start worker
node worker/worker-node.js
```

---

## 📱 Mobile Access

Mobile users can immediately access: `http://YOUR_BOOTSTRAP_IP/mobile`

### Share with QR Code

```bash
# Generate QR code for easy sharing
npm install -g qrcode-terminal
echo "http://YOUR_BOOTSTRAP_IP/mobile" | qrcode-terminal
```

---

## 🔧 Network Management

### Check Network Status

```bash
# Check connected peers
curl http://YOUR_BOOTSTRAP_IP:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Check mining status
curl http://YOUR_BOOTSTRAP_IP:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}'
```

### Adjust Worker Resources

```bash
# CLI interface
node dynamic-adjuster.js

# Web interface
npm run web-adjust  # Opens http://localhost:8081/web-adjuster.html
```

### Monitor Logs

```bash
# Bootstrap node
sudo journalctl -u ai-bootstrap -f

# Worker node
sudo journalctl -u ai-worker -f
```

---

## 📊 Production Checklist

### Bootstrap Node
- [ ] Deployed with static IP
- [ ] Port 30303 open (P2P)
- [ ] Port 8545 open (RPC)
- [ ] Port 80/443 open (Mobile)
- [ ] SSL certificate installed (optional)
- [ ] Monitoring configured

### Worker Nodes
- [ ] Connected to bootstrap
- [ ] Resource allocation configured
- [ ] Mining enabled
- [ ] AI compute services running

### Network
- [ ] Multiple peers connected
- [ ] Blocks being mined
- [ ] Mobile app accessible
- [ ] AI tasks processing

---

## 🎛️ Resource Management

### Presets Available

| Preset | CPU | RAM | Storage | GPU | Best For |
|--------|-----|-----|---------|-----|----------|
| **Conservative** | 5% | 10% | 2% | 5% | Cautious users |
| **Balanced** | 10% | 15% | 5% | 10% | Most users |
| **Generous** | 20% | 30% | 10% | 25% | Dedicated nodes |
| **Mobile** | 5% | 5% | 1% | 0% | Phones/tablets |

### Dynamic Adjustment

```bash
# Real-time adjustment while running
node dynamic-adjuster.js

# Quick commands:
# 1. Increase CPU contribution
# 2. Decrease CPU contribution
# 3. Apply preset (conservative/balanced/generous)
# 4. View current usage
# 5. Custom percentages
```

---

## 🔐 Security Best Practices

### Bootstrap Node
```bash
# Configure firewall
sudo ufw allow 22/tcp     # SSH
sudo ufw allow 30303/tcp  # P2P
sudo ufw allow 8545/tcp   # RPC (restrict in production)
sudo ufw allow 80/tcp     # HTTP
sudo ufw allow 443/tcp    # HTTPS
sudo ufw enable

# Setup SSL for mobile access
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

### Worker Nodes
```bash
# Minimal firewall (outbound only)
sudo ufw allow out 30303/tcp
sudo ufw enable
```

---

## 📈 Scaling Your Network

### Add More Bootstrap Nodes

```bash
# Deploy second bootstrap node
./aws-bootstrap.sh us-west-2 t3.medium

# Setup load balancer
# Configure nginx to distribute connections
```

### Auto-Scale Workers

```bash
# Docker deployment
docker build -t ai-worker .
docker-compose up -d --scale ai-worker=10

# Kubernetes deployment
kubectl apply -f k8s/worker-deployment.yaml
kubectl scale deployment ai-worker --replicas=20
```

---

## 🆘 Troubleshooting

### Bootstrap Node Issues

```bash
# Check if service is running
sudo systemctl status ai-bootstrap

# View logs
sudo journalctl -u ai-bootstrap -f

# Test connectivity
telnet YOUR_BOOTSTRAP_IP 30303

# Restart service
sudo systemctl restart ai-bootstrap
```

### Worker Node Issues

```bash
# Check connection to bootstrap
curl http://YOUR_BOOTSTRAP_IP:8545

# View worker logs
sudo journalctl -u ai-worker -f

# Restart worker
sudo systemctl restart ai-worker

# Adjust resources
node dynamic-adjuster.js
```

### Mobile Access Issues

```bash
# Check nginx status
sudo systemctl status nginx

# Test mobile endpoint
curl http://YOUR_BOOTSTRAP_IP/mobile

# Check SSL certificate
sudo certbot certificates
```

### Network Performance

```bash
# Check peer count (should be > 0)
curl http://YOUR_BOOTSTRAP_IP:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# Check mining status
curl http://YOUR_BOOTSTRAP_IP:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}'

# Monitor system resources
htop
```

---

## 🎯 Example Decentralized Setup

### Small Community (10-50 users)
- **1-2 Bootstrap Nodes**: Community members' home computers (free)
- **5-10 Worker Nodes**: Everyone's devices (free)
- **Mobile Users**: Unlimited (free)

### Medium Community (50-500 users)
- **3-5 Bootstrap Nodes**: Distributed across regions (free)
- **20-50 Worker Nodes**: Mix of dedicated + casual users
- **P2P Distribution**: No CDN needed

### Large Network (500+ users)
- **10+ Bootstrap Nodes**: Community-run, globally distributed (free)
- **100+ Worker Nodes**: Organic growth
- **Self-Monitoring**: Peer-to-peer health checks
- **Community SSL**: Let's Encrypt on volunteer nodes

---

## 📞 Support

- **Documentation**: [Full Production Setup Guide](PRODUCTION_SETUP.md)
- **Issues**: GitHub Issues
- **Community**: Discord/Telegram
- **Email**: support@ai-compute.network

---

## 🎉 Success!

Your AI compute network is now running in production! 

**Next steps:**
1. Share the mobile link: `http://YOUR_BOOTSTRAP_IP/mobile`
2. Monitor network growth
3. Scale as needed
4. Optimize resource allocation

**Network URLs:**
- **Mobile App**: `http://YOUR_BOOTSTRAP_IP/mobile`
- **RPC Endpoint**: `http://YOUR_BOOTSTRAP_IP:8545`
- **Resource Adjuster**: `http://localhost:8081/web-adjuster.html`

🚀 **Your decentralized AI compute network is live!**