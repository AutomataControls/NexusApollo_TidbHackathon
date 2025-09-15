#!/bin/bash
# Apollo Nexus Installation Script

echo "======================================"
echo "   Apollo Nexus™ Installation"
echo "   © 2025 AutomataNexus, LLC"
echo "======================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This installer must be run as root"
   exit 1
fi

# Update system
echo "Updating system packages..."
apt-get update

# Install system dependencies
echo "Installing system dependencies..."
apt-get install -y \
    postgresql \
    postgresql-contrib \
    build-essential \
    python3 \
    python3-pip \
    git \
    curl \
    i2c-tools \
    usbutils

# Install Node.js 18.x
echo "Installing Node.js..."
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Enable I2C
echo "Enabling I2C interface..."
if ! grep -q "i2c-dev" /etc/modules; then
    echo "i2c-dev" >> /etc/modules
fi
modprobe i2c-dev

# Install Sequent Microsystems CLI tools
echo "Installing Sequent Microsystems tools..."
cd /tmp

# MegaBAS
git clone https://github.com/SequentMicrosystems/megabas-rpi.git
cd megabas-rpi
make install
cd ..

# MegaIND
git clone https://github.com/SequentMicrosystems/megaind-rpi.git
cd megaind-rpi
make install
cd ..

# 16-UNIV-IN
git clone https://github.com/SequentMicrosystems/16univin-rpi.git
cd 16univin-rpi
make install
cd ..

# Clean up
rm -rf /tmp/megabas-rpi /tmp/megaind-rpi /tmp/16univin-rpi

# Return to portal directory
cd -

# Install Node.js dependencies
echo "Installing Node.js dependencies..."
cd /mnt/d/apollo-nexus/portal
npm install

# Build frontend
echo "Building frontend..."
npm run build

# Setup PostgreSQL
echo "Setting up PostgreSQL..."
sudo -u postgres psql <<EOF
CREATE USER apollo WITH PASSWORD 'apollopass123';
ALTER USER apollo CREATEDB;
EOF

# Initialize database
echo "Initializing database..."
cd scripts
node init-db.js
cd ..

# Create systemd service
echo "Creating systemd service..."
cat > /etc/systemd/system/apollo-nexus.service <<EOF
[Unit]
Description=Apollo Nexus HVAC System
After=network.target postgresql.service

[Service]
Type=simple
User=root
WorkingDirectory=/mnt/d/apollo-nexus/portal
ExecStart=/usr/bin/node server.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Enable service
systemctl daemon-reload
systemctl enable apollo-nexus

echo "======================================"
echo "Installation complete!"
echo ""
echo "To start Apollo Nexus:"
echo "  systemctl start apollo-nexus"
echo ""
echo "To view logs:"
echo "  journalctl -u apollo-nexus -f"
echo ""
echo "Default login:"
echo "  Username: admin"
echo "  Password: admin123"
echo ""
echo "Access the web interface at:"
echo "  http://localhost:3000"
echo "======================================"