#!/bin/bash

# DigitalOcean Bootstrap Node Deployment Script
# Usage: ./digitalocean-bootstrap.sh [region] [size]

set -e

REGION=${1:-"nyc1"}
SIZE=${2:-"s-2vcpu-4gb"}
DROPLET_NAME="ai-compute-bootstrap"

echo "🚀 Deploying AI Compute Bootstrap Node on DigitalOcean"
echo "Region: $REGION"
echo "Size: $SIZE"
echo "Droplet Name: $DROPLET_NAME"

# Check if doctl is installed
if ! command -v doctl >/dev/null 2>&1; then
    echo "❌ doctl not found. Please install it first:"
    echo "https://docs.digitalocean.com/reference/doctl/how-to/install/"
    exit 1
fi

# Check if jq is installed
if ! command -v jq >/dev/null 2>&1; then
    echo "Installing jq..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        brew install jq
    else
        sudo apt-get update && sudo apt-get install -y jq
    fi
fi

# Check authentication
if ! doctl account get >/dev/null 2>&1; then
    echo "❌ Please authenticate with DigitalOcean first:"
    echo "doctl auth init"
    exit 1
fi

# Create SSH key if it doesn't exist
SSH_KEY_NAME="ai-compute-key"
if ! doctl compute ssh-key list --format Name --no-header | grep -q "^$SSH_KEY_NAME$"; then
    echo "🔑 Creating SSH key..."
    
    # Generate SSH key if it doesn't exist locally
    if [[ ! -f ~/.ssh/id_rsa ]]; then
        ssh-keygen -t rsa -b 4096 -f ~/.ssh/id_rsa -N ""
    fi
    
    # Upload SSH key to DigitalOcean
    doctl compute ssh-key import $SSH_KEY_NAME --public-key-file ~/.ssh/id_rsa.pub
    echo "SSH key uploaded to DigitalOcean"
else
    echo "SSH key $SSH_KEY_NAME already exists"
fi

# Get SSH key ID
SSH_KEY_ID=$(doctl compute ssh-key list --format ID,Name --no-header | grep "$SSH_KEY_NAME" | awk '{print $1}')

# Create cloud-init script
cat > cloud-init.yaml << 'EOF'
#cloud-config
package_update: true
package_upgrade: true

packages:
  - curl
  - wget
  - git
  - htop
  - nginx

runcmd:
  # Install Node.js 18
  - curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
  - apt-get install -y nodejs
  
  # Install Geth
  - add-apt-repository -y ppa:ethereum/ethereum
  - apt-get update
  - apt-get install -y ethereum
  
  # Clone project (replace with your actual repo)
  - cd /home/root
  - git clone https://github.com/your-org/ai-compute-network.git
  - chown -R root:root ai-compute-network
  
  # Setup bootstrap node
  - cd ai-compute-network/nodes
  - npm install
  
  # Get static IP and setup
  - STATIC_IP=$(curl -s ifconfig.me)
  - STATIC_IP=$STATIC_IP ./setup-bootstrap.sh
  
  # Create systemd service
  - |
    cat > /etc/systemd/system/ai-bootstrap.service << EOL
    [Unit]
    Description=AI Compute Bootstrap Node
    After=network.target

    [Service]
    Type=simple
    User=root
    WorkingDirectory=/home/root/ai-compute-network/nodes
    Environment=STATIC_IP=$(curl -s ifconfig.me)
    ExecStart=/usr/bin/node bootstrap/bootstrap-node.js
    Restart=always
    RestartSec=10
    StandardOutput=syslog
    StandardError=syslog
    SyslogIdentifier=ai-bootstrap

    [Install]
    WantedBy=multi-user.target
    EOL
  
  # Enable and start service
  - systemctl daemon-reload
  - systemctl enable ai-bootstrap
  - systemctl start ai-bootstrap
  
  # Setup nginx for mobile
  - |
    cat > /etc/nginx/sites-available/ai-mobile << EOL
    server {
        listen 80 default_server;
        server_name _;
        
        location /mobile {
            alias /home/root/ai-compute-network/nodes/mobile;
            index mobile-client.html;
            try_files \$uri \$uri/ =404;
            
            add_header Cache-Control "public, max-age=3600";
            add_header Service-Worker-Allowed "/";
        }
        
        location /api {
            proxy_pass http://localhost:8545;
            proxy_set_header Host \$host;
            proxy_set_header X-Real-IP \$remote_addr;
            
            add_header Access-Control-Allow-Origin "*";
            add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";
            add_header Access-Control-Allow-Headers "Content-Type";
        }
        
        location / {
            return 301 /mobile;
        }
    }
    EOL
  
  - rm /etc/nginx/sites-enabled/default
  - ln -s /etc/nginx/sites-available/ai-mobile /etc/nginx/sites-enabled/
  - nginx -t && systemctl reload nginx
  
  # Create status file
  - echo "Bootstrap node deployed successfully at $(date)" > /var/log/deployment.log

write_files:
  - path: /etc/ufw/applications.d/ai-compute
    content: |
      [AI-Compute]
      title=AI Compute Network
      description=AI Compute Bootstrap Node
      ports=30303,8545/tcp
EOF

# Create firewall
echo "🔥 Creating firewall..."
FIREWALL_ID=$(doctl compute firewall create ai-compute-firewall \
    --inbound-rules "protocol:tcp,ports:22,source_addresses:0.0.0.0/0" \
    --inbound-rules "protocol:tcp,ports:30303,source_addresses:0.0.0.0/0" \
    --inbound-rules "protocol:tcp,ports:8545,source_addresses:0.0.0.0/0" \
    --inbound-rules "protocol:tcp,ports:80,source_addresses:0.0.0.0/0" \
    --inbound-rules "protocol:tcp,ports:443,source_addresses:0.0.0.0/0" \
    --outbound-rules "protocol:tcp,ports:all,destination_addresses:0.0.0.0/0" \
    --outbound-rules "protocol:udp,ports:all,destination_addresses:0.0.0.0/0" \
    --format ID --no-header)

echo "Firewall ID: $FIREWALL_ID"

# Create droplet
echo "🚀 Creating droplet..."
DROPLET_ID=$(doctl compute droplet create $DROPLET_NAME \
    --size $SIZE \
    --image ubuntu-20-04-x64 \
    --region $REGION \
    --ssh-keys $SSH_KEY_ID \
    --user-data-file cloud-init.yaml \
    --format ID --no-header)

echo "Droplet ID: $DROPLET_ID"

# Wait for droplet to be active
echo "⏳ Waiting for droplet to be active..."
doctl compute droplet get $DROPLET_ID --format Status --no-header
while [[ "$(doctl compute droplet get $DROPLET_ID --format Status --no-header)" != "active" ]]; do
    sleep 10
    echo -n "."
done
echo ""

# Assign firewall to droplet
doctl compute firewall add-droplets $FIREWALL_ID --droplet-ids $DROPLET_ID

# Get droplet IP
PUBLIC_IP=$(doctl compute droplet get $DROPLET_ID --format PublicIPv4 --no-header)

echo "✅ Bootstrap node deployed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "Droplet ID: $DROPLET_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Command: ssh root@$PUBLIC_IP"
echo "Mobile App: http://$PUBLIC_IP/mobile"
echo "RPC Endpoint: http://$PUBLIC_IP:8545"
echo ""
echo "🔧 Management Commands:"
echo "systemctl status ai-bootstrap    # Check status"
echo "journalctl -u ai-bootstrap -f    # View logs"
echo "curl http://$PUBLIC_IP:8545 -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"net_peerCount\",\"params\":[],\"id\":1}'"
echo ""
echo "⏳ Note: Initial setup may take 5-10 minutes. Check deployment status:"
echo "ssh root@$PUBLIC_IP 'tail -f /var/log/cloud-init-output.log'"

# Save deployment info
cat > digitalocean-deployment-info.json << EOF
{
  "dropletId": "$DROPLET_ID",
  "publicIp": "$PUBLIC_IP",
  "region": "$REGION",
  "size": "$SIZE",
  "firewallId": "$FIREWALL_ID",
  "sshKeyId": "$SSH_KEY_ID",
  "deploymentTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mobileUrl": "http://$PUBLIC_IP/mobile",
  "rpcEndpoint": "http://$PUBLIC_IP:8545",
  "sshCommand": "ssh root@$PUBLIC_IP"
}
EOF

echo "📄 Deployment info saved to: digitalocean-deployment-info.json"

# Cleanup
rm cloud-init.yaml

# Generate QR code for mobile access
if command -v qrcode-terminal >/dev/null 2>&1; then
    echo ""
    echo "📱 Mobile QR Code:"
    echo "http://$PUBLIC_IP/mobile" | qrcode-terminal
else
    echo ""
    echo "💡 Install qrcode-terminal for mobile QR code:"
    echo "npm install -g qrcode-terminal"
    echo "echo 'http://$PUBLIC_IP/mobile' | qrcode-terminal"
fi