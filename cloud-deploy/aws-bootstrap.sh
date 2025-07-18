#!/bin/bash

# AWS Bootstrap Node Deployment Script
# Usage: ./aws-bootstrap.sh [region] [instance-type]

set -e

REGION=${1:-"us-east-1"}
INSTANCE_TYPE=${2:-"t3.medium"}
KEY_NAME=${3:-"ai-compute-key"}

echo "🚀 Deploying AI Compute Bootstrap Node on AWS"
echo "Region: $REGION"
echo "Instance Type: $INSTANCE_TYPE"
echo "Key Name: $KEY_NAME"

# Check if AWS CLI is installed
if ! command -v aws >/dev/null 2>&1; then
    echo "❌ AWS CLI not found. Please install it first:"
    echo "https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
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

# Create security group
echo "📡 Creating security group..."
SG_ID=$(aws ec2 create-security-group \
    --group-name ai-compute-bootstrap \
    --description "AI Compute Bootstrap Node Security Group" \
    --region $REGION \
    --query 'GroupId' \
    --output text)

echo "Security Group ID: $SG_ID"

# Add security group rules
aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 22 \
    --cidr 0.0.0.0/0 \
    --region $REGION

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 30303 \
    --cidr 0.0.0.0/0 \
    --region $REGION

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 8545 \
    --cidr 0.0.0.0/0 \
    --region $REGION

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 80 \
    --cidr 0.0.0.0/0 \
    --region $REGION

aws ec2 authorize-security-group-ingress \
    --group-id $SG_ID \
    --protocol tcp \
    --port 443 \
    --cidr 0.0.0.0/0 \
    --region $REGION

# Get latest Ubuntu AMI
echo "🔍 Finding latest Ubuntu AMI..."
AMI_ID=$(aws ec2 describe-images \
    --owners 099720109477 \
    --filters "Name=name,Values=ubuntu/images/hvm-ssd/ubuntu-focal-20.04-amd64-server-*" \
    --query 'Images | sort_by(@, &CreationDate) | [-1].ImageId' \
    --region $REGION \
    --output text)

echo "AMI ID: $AMI_ID"

# Create key pair if it doesn't exist
if ! aws ec2 describe-key-pairs --key-names $KEY_NAME --region $REGION >/dev/null 2>&1; then
    echo "🔑 Creating key pair..."
    aws ec2 create-key-pair \
        --key-name $KEY_NAME \
        --region $REGION \
        --query 'KeyMaterial' \
        --output text > ${KEY_NAME}.pem
    chmod 400 ${KEY_NAME}.pem
    echo "Key pair saved to: ${KEY_NAME}.pem"
else
    echo "Key pair $KEY_NAME already exists"
fi

# Create user data script
cat > user-data.sh << 'EOF'
#!/bin/bash
set -e

# Update system
apt-get update && apt-get upgrade -y

# Install dependencies
apt-get install -y curl wget git htop nginx

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install Geth
add-apt-repository -y ppa:ethereum/ethereum
apt-get update
apt-get install -y ethereum

# Clone project (replace with your actual repo)
cd /home/ubuntu
git clone https://github.com/your-org/ai-compute-network.git
chown -R ubuntu:ubuntu ai-compute-network

# Setup bootstrap node
cd ai-compute-network
sudo -u ubuntu bash -c 'cd nodes && npm install'

# Get static IP and setup
STATIC_IP=$(curl -s ifconfig.me)
sudo -u ubuntu bash -c "cd nodes && STATIC_IP=$STATIC_IP ./setup-bootstrap.sh"

# Create systemd service
cat > /etc/systemd/system/ai-bootstrap.service << EOL
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
EOL

# Enable and start service
systemctl daemon-reload
systemctl enable ai-bootstrap
systemctl start ai-bootstrap

# Setup nginx for mobile
cat > /etc/nginx/sites-available/ai-mobile << EOL
server {
    listen 80 default_server;
    server_name _;
    
    location /mobile {
        alias /home/ubuntu/ai-compute-network/nodes/mobile;
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

rm /etc/nginx/sites-enabled/default
ln -s /etc/nginx/sites-available/ai-mobile /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Create status page
echo "Bootstrap node deployed successfully at $(date)" > /var/log/deployment.log
EOF

# Launch EC2 instance
echo "🚀 Launching EC2 instance..."
INSTANCE_ID=$(aws ec2 run-instances \
    --image-id $AMI_ID \
    --count 1 \
    --instance-type $INSTANCE_TYPE \
    --key-name $KEY_NAME \
    --security-group-ids $SG_ID \
    --user-data file://user-data.sh \
    --region $REGION \
    --tag-specifications 'ResourceType=instance,Tags=[{Key=Name,Value=AI-Compute-Bootstrap}]' \
    --query 'Instances[0].InstanceId' \
    --output text)

echo "Instance ID: $INSTANCE_ID"

# Wait for instance to be running
echo "⏳ Waiting for instance to be running..."
aws ec2 wait instance-running --instance-ids $INSTANCE_ID --region $REGION

# Get public IP
PUBLIC_IP=$(aws ec2 describe-instances \
    --instance-ids $INSTANCE_ID \
    --region $REGION \
    --query 'Reservations[0].Instances[0].PublicIpAddress' \
    --output text)

echo "✅ Bootstrap node deployed successfully!"
echo ""
echo "📋 Deployment Summary:"
echo "======================"
echo "Instance ID: $INSTANCE_ID"
echo "Public IP: $PUBLIC_IP"
echo "SSH Command: ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
echo "Mobile App: http://$PUBLIC_IP/mobile"
echo "RPC Endpoint: http://$PUBLIC_IP:8545"
echo ""
echo "🔧 Management Commands:"
echo "sudo systemctl status ai-bootstrap    # Check status"
echo "sudo journalctl -u ai-bootstrap -f    # View logs"
echo "curl http://$PUBLIC_IP:8545 -X POST -H 'Content-Type: application/json' --data '{\"jsonrpc\":\"2.0\",\"method\":\"net_peerCount\",\"params\":[],\"id\":1}'"
echo ""
echo "⏳ Note: Initial setup may take 5-10 minutes. Check deployment status:"
echo "ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP 'tail -f /var/log/cloud-init-output.log'"

# Save deployment info
cat > aws-deployment-info.json << EOF
{
  "instanceId": "$INSTANCE_ID",
  "publicIp": "$PUBLIC_IP",
  "region": "$REGION",
  "securityGroupId": "$SG_ID",
  "keyName": "$KEY_NAME",
  "deploymentTime": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "mobileUrl": "http://$PUBLIC_IP/mobile",
  "rpcEndpoint": "http://$PUBLIC_IP:8545",
  "sshCommand": "ssh -i ${KEY_NAME}.pem ubuntu@$PUBLIC_IP"
}
EOF

echo "📄 Deployment info saved to: aws-deployment-info.json"

# Cleanup
rm user-data.sh