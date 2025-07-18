# 🚀 Production Setup Guide

Complete guide to deploy your AI compute network in production with different node types.

## 📋 Overview

Your network has **two node types**:
1. **Bootstrap Node** (1-2 servers with static IPs)
2. **Worker Nodes** (unlimited laptops, desktops, phones)

---

## 🏗️ Infrastructure Requirements

### Bootstrap Node (Server)
- **Cloud Provider**: AWS, GCP, Azure, DigitalOcean, or dedicated server
- **Instance Type**: 
  - AWS: `t3.medium` (2 vCPU, 4GB RAM) minimum
  - GCP: `e2-medium` (2 vCPU, 4GB RAM) minimum
- **Storage**: 20GB+ SSD
- **Network**: Static IP, port 30303 open
- **OS**: Ubuntu 20.04+ LTS

### Worker Nodes
- **Any device**: Windows, macOS, Linux
- **Minimum**: 4GB RAM, 2 CPU cores
- **Recommended**: 8GB+ RAM, 4+ CPU cores
- **Network**: Any internet connection

---

## 🎯 Step 1: Deploy Bootstrap Node

### Option A: AWS Deployment

```bash
# 1. Launch EC2 instance
aws ec2 run-instances \
  --image-id ami-0c02fb55956c7d316 \
  --instance-type t3.medium \
  --key-name your-key-pair \
  --security-group-ids sg-xxxxxxxxx \
  --subnet-id subnet-xxxxxxxxx \
  --associate-public-ip-address

# 2. Configure security group
aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 30303 \
  --cidr 0.0.0.0/0

aws ec2 authorize-security-group-ingress \
  --group-id sg-xxxxxxxxx \
  --protocol tcp \
  --port 8545 \
  --cidr 0.0.0.0/0

# 3. SSH into instance
ssh -i your-key.pem ubuntu@your-public-ip
```

### Option B: DigitalOcean Deployment

```bash
# 1. Create droplet
doctl compute droplet create ai-bootstrap \
  --size s-2vcpu-4gb \
  --image ubuntu-20-04-x64 \
  --region nyc1 \
  --ssh-keys your-ssh-key-id

# 2. Configure firewall
doctl compute firewall create ai-network \
  --inbound-rules "protocol:tcp,ports:22,source_addresses:0.0.0.0/0,source_droplet_ids:" \
  --inbound-rules "protocol:tcp,ports:30303,source_addresses:0.0.0.0/0,source_droplet_ids:" \
  --inbound-rules "protocol:tcp,ports:8545,source_addresses:0.0.0.0/0,source_droplet_ids:"

# 3. SSH into droplet
ssh root@your-droplet-ip
```

### Bootstrap Node Setup

```bash
# 1. Update system
sudo apt update && sudo apt upgrade -y

# 2. Install Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# 3. Install Geth
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum

# 4. Install Git and other tools
sudo apt-get install -y git curl wget htop

# 5. Clone your project
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network/nodes

# 6. Install dependencies
npm install

# 7. Get your static IP
export STATIC_IP=$(curl -s ifconfig.me)
echo "Static IP: $STATIC_IP"

# 8. Setup bootstrap node
chmod +x setup-bootstrap.sh
STATIC_IP=$STATIC_IP ./setup-bootstrap.sh

# 9. Create systemd service
sudo tee /etc/systemd/system/ai-bootstrap.service > /dev/null <<EOF
[Unit]
Description=AI Compute Bootstrap Node
After=network.target

[Service]
Type=simple
User=ubuntu
WorkingDirectory=/home/ubuntu/ai-compute-network/nodes
Environment=STATIC_IP=$STATIC_IP
ExecStart=/usr/bin/node bootstrap/bootstrap-node.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-bootstrap

[Install]
WantedBy=multi-user.target
EOF

# 10. Start and enable service
sudo systemctl daemon-reload
sudo systemctl enable ai-bootstrap
sudo systemctl start ai-bootstrap

# 11. Check status
sudo systemctl status ai-bootstrap
sudo journalctl -u ai-bootstrap -f
```

---

## 🖥️ Step 2: Deploy Worker Nodes

### Desktop/Laptop Setup (Windows)

```powershell
# 1. Install Node.js from https://nodejs.org/
# 2. Install Git from https://git-scm.com/

# 3. Open PowerShell as Administrator
# Install Chocolatey
Set-ExecutionPolicy Bypass -Scope Process -Force
[System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072
iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

# 4. Install Geth
choco install geth

# 5. Clone project
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network\nodes

# 6. Install dependencies
npm install

# 7. Setup worker node
.\setup-worker.sh  # Use Git Bash or WSL

# 8. Configure resources
node configure-resources.js

# 9. Start worker node
node worker/worker-node.js
```

### Desktop/Laptop Setup (macOS)

```bash
# 1. Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# 2. Install dependencies
brew install node git ethereum

# 3. Clone project
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network/nodes

# 4. Install dependencies
npm install

# 5. Setup worker node
chmod +x setup-worker.sh
./setup-worker.sh

# 6. Configure resources
node configure-resources.js

# 7. Start worker node
node worker/worker-node.js

# 8. Optional: Create launchd service for auto-start
cat > ~/Library/LaunchAgents/com.ai-compute.worker.plist << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.ai-compute.worker</string>
    <key>ProgramArguments</key>
    <array>
        <string>/usr/local/bin/node</string>
        <string>worker/worker-node.js</string>
    </array>
    <key>WorkingDirectory</key>
    <string>$(pwd)</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
</dict>
</plist>
EOF

launchctl load ~/Library/LaunchAgents/com.ai-compute.worker.plist
```

### Desktop/Laptop Setup (Linux)

```bash
# 1. Install Node.js (Ubuntu/Debian)
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs git

# Install Geth
sudo add-apt-repository -y ppa:ethereum/ethereum
sudo apt-get update
sudo apt-get install ethereum

# 2. Clone project
git clone https://github.com/your-org/ai-compute-network.git
cd ai-compute-network/nodes

# 3. Install dependencies
npm install

# 4. Setup worker node
chmod +x setup-worker.sh
./setup-worker.sh

# 5. Configure resources
node configure-resources.js

# 6. Start worker node
node worker/worker-node.js

# 7. Optional: Create systemd service
sudo tee /etc/systemd/system/ai-worker.service > /dev/null <<EOF
[Unit]
Description=AI Compute Worker Node
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$(pwd)
ExecStart=/usr/bin/node worker/worker-node.js
Restart=always
RestartSec=10
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=ai-worker

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ai-worker
sudo systemctl start ai-worker
```

---

## 📱 Step 3: Mobile Node Setup

### Progressive Web App Deployment

```bash
# 1. On your bootstrap server, setup mobile server
cd /home/ubuntu/ai-compute-network/nodes

# 2. Install nginx for better mobile serving
sudo apt install nginx

# 3. Configure nginx
sudo tee /etc/nginx/sites-available/ai-mobile > /dev/null <<EOF
server {
    listen 80;
    server_name your-domain.com;
    
    location /mobile {
        alias /home/ubuntu/ai-compute-network/nodes/mobile;
        index mobile-client.html;
        try_files \$uri \$uri/ =404;
    }
    
    location /api {
        proxy_pass http://localhost:8545;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/ai-mobile /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# 4. Setup SSL with Let's Encrypt
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 5. Mobile users can now access:
# https://your-domain.com/mobile
```

### Mobile App Distribution

Create QR codes and share links:

```bash
# Generate QR code for easy mobile access
npm install -g qrcode-terminal
echo "https://your-domain.com/mobile" | qrcode-terminal
```

---

## 🔧 Step 4: Network Configuration

### Update Bootstrap Info

```bash
# 1. On bootstrap server, check the generated enode
cat /home/ubuntu/ai-compute-network/nodes/bootstrap-info.json

# 2. Update worker nodes with bootstrap info
# Edit nodes/bootstrap-info.json on each worker:
{
  "enode": "enode://your-public-key@your-static-ip:30303",
  "staticIP": "your-static-ip",
  "port": 30303,
  "rpcPort": 8545,
  "wsPort": 8546,
  "chainId": 1337,
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### Network Monitoring

```bash
# 1. Install monitoring tools on bootstrap server
sudo apt install prometheus grafana

# 2. Create monitoring dashboard
# Access Grafana at http://your-ip:3000

# 3. Monitor network health
curl http://your-bootstrap-ip:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}'

# 4. Check mining status
curl http://your-bootstrap-ip:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}'
```

---

## 🚀 Step 5: Scaling and Management

### Load Balancer Setup (Multiple Bootstrap Nodes)

```bash
# 1. Deploy second bootstrap node (same process as Step 1)
# 2. Setup load balancer (nginx)

sudo tee /etc/nginx/sites-available/ai-loadbalancer > /dev/null <<EOF
upstream bootstrap_nodes {
    server bootstrap1-ip:30303;
    server bootstrap2-ip:30303;
}

server {
    listen 30303;
    proxy_pass bootstrap_nodes;
}
EOF
```

### Auto-Scaling Worker Nodes

```bash
# 1. Create Docker image for easy deployment
cat > Dockerfile << EOF
FROM node:18-alpine
WORKDIR /app
COPY nodes/ .
RUN npm install
CMD ["node", "worker/worker-node.js"]
EOF

# 2. Build and push to registry
docker build -t your-registry/ai-worker:latest .
docker push your-registry/ai-worker:latest

# 3. Deploy with Docker Compose
cat > docker-compose.yml << EOF
version: '3.8'
services:
  ai-worker:
    image: your-registry/ai-worker:latest
    restart: always
    environment:
      - NODE_TYPE=auto
      - BOOTSTRAP_NODES=enode://...@your-bootstrap-ip:30303
    volumes:
      - ./data:/app/data
EOF

docker-compose up -d --scale ai-worker=5
```

### Management Scripts

```bash
# 1. Create management script
cat > manage-network.sh << EOF
#!/bin/bash

case "\$1" in
  "status")
    echo "Checking network status..."
    curl -s http://your-bootstrap-ip:8545 -X POST -H "Content-Type: application/json" \
      --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq .
    ;;
  "add-worker")
    echo "Adding new worker node..."
    # Deploy new worker instance
    ;;
  "update")
    echo "Updating all nodes..."
    # Rolling update script
    ;;
  *)
    echo "Usage: \$0 {status|add-worker|update}"
    ;;
esac
EOF

chmod +x manage-network.sh
```

---

## 📊 Step 6: Production Monitoring

### Health Checks

```bash
# 1. Create health check script
cat > health-check.sh << EOF
#!/bin/bash

# Check bootstrap node
PEERS=\$(curl -s http://your-bootstrap-ip:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"net_peerCount","params":[],"id":1}' | jq -r .result)

echo "Connected peers: \$((16#\${PEERS#0x}))"

# Check if mining
MINING=\$(curl -s http://your-bootstrap-ip:8545 -X POST -H "Content-Type: application/json" \
  --data '{"jsonrpc":"2.0","method":"eth_mining","params":[],"id":1}' | jq -r .result)

echo "Mining active: \$MINING"

# Alert if issues
if [ \$((16#\${PEERS#0x})) -lt 3 ]; then
  echo "WARNING: Low peer count"
  # Send alert (email, Slack, etc.)
fi
EOF

# 2. Add to crontab
echo "*/5 * * * * /path/to/health-check.sh" | crontab -
```

### Logging and Alerts

```bash
# 1. Setup centralized logging
sudo apt install rsyslog

# 2. Configure log forwarding
echo "*.* @@your-log-server:514" >> /etc/rsyslog.conf

# 3. Setup alerts (example with Slack)
cat > alert.sh << EOF
#!/bin/bash
curl -X POST -H 'Content-type: application/json' \
  --data '{"text":"AI Network Alert: \$1"}' \
  YOUR_SLACK_WEBHOOK_URL
EOF
```

---

## 🔐 Security Considerations

### Firewall Configuration

```bash
# Bootstrap node
sudo ufw allow 22/tcp    # SSH
sudo ufw allow 30303/tcp # P2P
sudo ufw allow 8545/tcp  # RPC (restrict to known IPs in production)
sudo ufw enable

# Worker nodes (more restrictive)
sudo ufw allow out 30303/tcp  # P2P outbound only
sudo ufw enable
```

### SSL/TLS Setup

```bash
# For mobile access
sudo certbot --nginx -d your-domain.com

# For RPC endpoints (if exposing publicly)
# Use nginx proxy with SSL termination
```

---

## 📈 Performance Optimization

### Bootstrap Node Tuning

```bash
# 1. Increase file limits
echo "* soft nofile 65536" >> /etc/security/limits.conf
echo "* hard nofile 65536" >> /etc/security/limits.conf

# 2. Optimize Geth settings
# Add to bootstrap node startup:
--cache 2048 --maxpeers 100 --nat extip:your-static-ip
```

### Worker Node Optimization

```bash
# 1. Set resource limits based on system
node configure-resources.js

# 2. Monitor and adjust
node dynamic-adjuster.js

# 3. Use web interface for fine-tuning
npm run web-adjust
```

---

## 🎯 Quick Production Checklist

- [ ] Bootstrap node deployed with static IP
- [ ] Port 30303 open on bootstrap node
- [ ] SSL certificate installed for mobile access
- [ ] Worker nodes connected and mining
- [ ] Mobile PWA accessible via HTTPS
- [ ] Monitoring and alerts configured
- [ ] Backup and recovery procedures in place
- [ ] Security hardening completed
- [ ] Performance optimization applied
- [ ] Documentation updated with your specific IPs/domains

---

## 🆘 Troubleshooting

### Common Issues

1. **Nodes can't connect to bootstrap**
   ```bash
   # Check if port is open
   telnet your-bootstrap-ip 30303
   
   # Check bootstrap node logs
   sudo journalctl -u ai-bootstrap -f
   ```

2. **Mobile app won't load**
   ```bash
   # Check nginx status
   sudo systemctl status nginx
   
   # Check SSL certificate
   sudo certbot certificates
   ```

3. **Low mining performance**
   ```bash
   # Adjust resource allocation
   node dynamic-adjuster.js
   
   # Check system resources
   htop
   ```

Your AI compute network is now ready for production! 🚀