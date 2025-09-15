# Nexus Apollo Hardware Setup Guide

## System Overview

The Nexus Apollo platform runs on a Raspberry Pi 5 with specialized I/O boards and AI acceleration hardware for real-time HVAC monitoring and control.

## Hardware Components

### Core System
- **Raspberry Pi 5 (8GB RAM)**
  - 2.4GHz quad-core ARM Cortex-A76 CPU
  - 8GB LPDDR4X-4267 SDRAM
  - Dual-band 802.11ac Wi-Fi
  - Bluetooth 5.0 / BLE
  - Gigabit Ethernet with PoE+ support

### Storage
- **256GB NVMe SSD**
  - Connected via PCIe M.2 HAT
  - Houses OS, databases, and models
  - 3500MB/s read, 2500MB/s write speeds

### AI Acceleration
- **Hailo-8 AI Accelerator**
  - 26 TOPS performance
  - PCIe Gen 3.0 interface
  - Sub-100ms inference for all models
  - 2.5W typical power consumption

### I/O Expansion
- **Sequent Microsystems MegaBAS-V4**
  - 8x relay outputs (10A @ 250VAC)
  - 8x digital inputs (3-24V)
  - 4x analog inputs (0-10V or 4-20mA)
  - RS485 Modbus RTU interface
  - I2C communication with Pi

- **Sequent Microsystems MegaIND-V4**
  - 4x analog inputs (0-10V/4-20mA)
  - 4x analog outputs (0-10V/4-20mA)
  - 8x digital I/O configurable
  - Industrial temperature range

### Power Supply
- **Mean Well DIN Rail Power Supply**
  - 24VDC, 5A output
  - 85-264VAC input range
  - DIN rail mounting
  - Over-voltage/current protection

### Cooling
- **Active Cooling System**
  - 40mm PWM fan for Pi 5
  - Heatsinks for CPU and Hailo-8
  - Temperature-controlled operation
  - Target: <65°C under load

## Physical Installation

### 1. Mounting Configuration

```
DIN Rail Layout (left to right):
[Power Supply] [Circuit Breaker] [MegaBAS] [MegaIND] [Pi5+Hailo]
     150mm          35mm           90mm      90mm       120mm
```

### 2. Wiring Diagram

```
Power Distribution:
AC Mains ──► Circuit Breaker ──► Power Supply
                                       │
                                       ├──► 24V to MegaBAS
                                       ├──► 24V to MegaIND
                                       └──► 5V to Pi5 (via buck converter)

I2C Bus:
Pi5 GPIO ──► MegaBAS (addr: 0x48) ──► MegaIND (addr: 0x50)
   SDA: Pin 3
   SCL: Pin 5
   GND: Pin 9
   3.3V: Pin 1

Modbus Network:
Equipment ──► RS485 A/B ──► MegaBAS RS485 ──► USB-RS485 ──► Pi5
```

### 3. Sensor Connections

#### Temperature Sensors (RTD PT100)
- Connect to MegaBAS analog inputs
- Use 3-wire configuration
- Calibrate offset in software

#### Pressure Transducers (4-20mA)
- Connect to MegaIND analog inputs
- 250Ω shunt resistor for current-to-voltage
- Supply 24V from DIN rail PSU

#### Current Transformers
- Split-core CTs on compressor lines
- 0-5A secondary to 0-10V converter
- Connect to MegaBAS analog inputs

#### Digital Inputs
- Compressor status (24V)
- Fan status (24V)
- Alarm contacts (dry contact)
- Flow switches (dry contact)

## Software Installation

### 1. Operating System Setup

```bash
# Flash Raspberry Pi OS (64-bit) to NVMe
sudo rpi-imager

# Initial configuration
sudo raspi-config
# Enable: I2C, SPI, Serial, SSH
# Disable: Bluetooth (if not needed)
# Set: GPU memory split to 16MB

# Update system
sudo apt update && sudo apt upgrade -y
```

### 2. Install Dependencies

```bash
# System packages
sudo apt install -y \
  nodejs npm \
  postgresql postgresql-contrib \
  nginx \
  python3-pip python3-dev \
  i2c-tools \
  git curl wget \
  build-essential cmake

# Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# PM2 process manager
sudo npm install -g pm2
pm2 startup systemd -u pi --hp /home/pi
```

### 3. Hailo-8 Setup

```bash
# Install HailoRT
wget https://hailo.ai/downloads/hailort_4.17.0_arm64.deb
sudo dpkg -i hailort_4.17.0_arm64.deb

# Install PCIe driver
sudo apt install -y hailort-pcie-driver
sudo modprobe hailo_pcie

# Verify installation
hailortcli fw-control identify

# Expected output:
# Hailo-8 device found
# Device ID: 0000:01:00.0
# Firmware version: 4.17.0
```

### 4. Sequent Microsystems Drivers

```bash
# MegaBAS installation
git clone https://github.com/SequentMicrosystems/megabas-rpi.git
cd megabas-rpi
sudo make install

# MegaIND installation
git clone https://github.com/SequentMicrosystems/megaind-rpi.git
cd megaind-rpi
sudo make install

# Test I2C communication
i2cdetect -y 1
# Should show devices at 0x48 (MegaBAS) and 0x50 (MegaIND)

# Test relay control
megabas 0 relay write 1 on
sleep 1
megabas 0 relay write 1 off
```

### 5. Database Setup

```bash
# PostgreSQL configuration
sudo -u postgres psql
CREATE DATABASE apollo_nexus;
CREATE USER DevOps WITH ENCRYPTED PASSWORD 'Invertedskynet2$';
GRANT ALL PRIVILEGES ON DATABASE apollo_nexus TO DevOps;
\q

# Import schema
psql -U DevOps -d apollo_nexus < /home/pi/apollo-nexus/schema.sql

# SQLite for high-frequency data
mkdir -p /home/pi/apollo-nexus/data
sqlite3 /home/pi/apollo-nexus/data/sensor_data.db < sensor_schema.sql
```

### 6. Application Deployment

```bash
# Clone repository
cd /home/pi
git clone https://github.com/yourusername/apollo-nexus.git
cd apollo-nexus

# Install backend dependencies
cd portal
npm install --legacy-peer-deps
cp .env.example .env
# Edit .env with your configuration

# Install frontend dependencies
cd ../apollo-ui
npm install --legacy-peer-deps
npm run build

# Start services with PM2
pm2 start ecosystem.config.js
pm2 save
```

## Network Configuration

### 1. Ethernet Setup

```bash
# Static IP configuration
sudo nano /etc/dhcpcd.conf

interface eth0
static ip_address=192.168.1.100/24
static routers=192.168.1.1
static domain_name_servers=192.168.1.1 8.8.8.8
```

### 2. Cloudflare Tunnel

```bash
# Install cloudflared
wget https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64
sudo mv cloudflared-linux-arm64 /usr/local/bin/cloudflared
sudo chmod +x /usr/local/bin/cloudflared

# Configure tunnel
cloudflared tunnel login
cloudflared tunnel create nexus-apollo
cloudflared tunnel route dns nexus-apollo nexus.automatacontrols.com

# Create config file
nano ~/.cloudflared/config.yml
```

```yaml
tunnel: YOUR_TUNNEL_ID
credentials-file: /home/pi/.cloudflared/YOUR_TUNNEL_ID.json

ingress:
  - hostname: nexus.automatacontrols.com
    service: http://localhost:80
  - service: http_status:404
```

### 3. Nginx Configuration

```nginx
# /etc/nginx/sites-available/apollo
server {
    listen 80;
    server_name nexus.automatacontrols.com localhost;

    # Frontend
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # Backend API
    location /api {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header Host $host;
    }

    # WebSocket
    location /socket.io {
        proxy_pass http://localhost:8001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

## Calibration and Testing

### 1. Sensor Calibration

```javascript
// calibration.js
const { exec } = require('child_process');

// Read analog input
function readAnalog(channel) {
  return new Promise((resolve, reject) => {
    exec(`megabas 0 aread ${channel}`, (error, stdout) => {
      if (error) reject(error);
      resolve(parseFloat(stdout));
    });
  });
}

// Calibrate temperature sensor
async function calibrateTemp(channel, actualTemp) {
  const rawValue = await readAnalog(channel);
  const offset = actualTemp - rawValue;
  console.log(`Channel ${channel} offset: ${offset}`);
  // Save to database
}
```

### 2. Relay Testing

```bash
#!/bin/bash
# test_relays.sh

echo "Testing all relays..."
for i in {1..8}; do
  echo "Relay $i ON"
  megabas 0 relay write $i on
  sleep 0.5
  megabas 0 relay write $i off
  sleep 0.5
done
echo "Relay test complete"
```

### 3. Modbus Communication Test

```python
#!/usr/bin/env python3
# test_modbus.py

import minimalmodbus
import serial

# Configure instrument
instrument = minimalmodbus.Instrument('/dev/ttyUSB0', 1)
instrument.serial.baudrate = 9600
instrument.serial.timeout = 1

# Read holding registers
try:
    temp = instrument.read_register(0, 1)  # Address 0, 1 decimal
    print(f"Temperature: {temp}°F")
except Exception as e:
    print(f"Modbus error: {e}")
```

## Monitoring and Maintenance

### 1. System Health Monitoring

```bash
# Create monitoring script
nano /home/pi/scripts/health_check.sh
```

```bash
#!/bin/bash

# CPU Temperature
cpu_temp=$(vcgencmd measure_temp | cut -d'=' -f2 | cut -d"'" -f1)

# Hailo-8 Status
hailo_status=$(hailortcli fw-control identify 2>&1)

# Memory usage
mem_usage=$(free -m | awk 'NR==2{printf "%.1f%%", $3*100/$2}')

# Disk usage
disk_usage=$(df -h / | awk 'NR==2{print $5}')

# Service status
pm2_status=$(pm2 status --no-color)

echo "System Health Report - $(date)"
echo "CPU Temp: ${cpu_temp}°C"
echo "Memory: ${mem_usage}"
echo "Disk: ${disk_usage}"
echo "Hailo-8: ${hailo_status}"
echo "Services: ${pm2_status}"
```

### 2. Automated Backups

```bash
# Daily backup script
nano /home/pi/scripts/backup.sh
```

```bash
#!/bin/bash

BACKUP_DIR="/media/backup"
DATE=$(date +%Y%m%d)

# Backup databases
pg_dump -U DevOps apollo_nexus > ${BACKUP_DIR}/postgres_${DATE}.sql
cp /home/pi/apollo-nexus/data/sensor_data.db ${BACKUP_DIR}/sqlite_${DATE}.db

# Backup configuration
tar -czf ${BACKUP_DIR}/config_${DATE}.tar.gz \
  /home/pi/apollo-nexus/.env \
  /home/pi/.cloudflared/config.yml \
  /etc/nginx/sites-available/

# Keep only last 30 days
find ${BACKUP_DIR} -name "*.sql" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.db" -mtime +30 -delete
find ${BACKUP_DIR} -name "*.tar.gz" -mtime +30 -delete
```

### 3. Log Rotation

```bash
# Configure logrotate
sudo nano /etc/logrotate.d/apollo
```

```
/home/pi/apollo-nexus/logs/*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    create 644 pi pi
    sharedscripts
    postrotate
        pm2 reloadLogs
    endscript
}
```

## Troubleshooting

### Common Issues

1. **I2C Communication Failure**
   ```bash
   # Check I2C devices
   sudo i2cdetect -y 1
   # Reset I2C bus
   sudo rmmod i2c_bcm2835
   sudo modprobe i2c_bcm2835
   ```

2. **Hailo-8 Not Detected**
   ```bash
   # Check PCIe
   lspci | grep Hailo
   # Reload driver
   sudo rmmod hailo_pcie
   sudo modprobe hailo_pcie
   ```

3. **High Temperature**
   ```bash
   # Check thermal throttling
   vcgencmd get_throttled
   # Increase fan speed
   echo 255 > /sys/class/hwmon/hwmon2/pwm1
   ```

4. **Database Connection Issues**
   ```bash
   # Check PostgreSQL status
   sudo systemctl status postgresql
   # Check connections
   sudo -u postgres psql -c "SELECT * FROM pg_stat_activity;"
   ```

## Performance Optimization

### 1. CPU Governor

```bash
# Set to performance mode
echo performance | sudo tee /sys/devices/system/cpu/cpu*/cpufreq/scaling_governor
```

### 2. Memory Management

```bash
# Increase shared memory for PostgreSQL
sudo sysctl -w kernel.shmmax=268435456
echo "kernel.shmmax=268435456" | sudo tee -a /etc/sysctl.conf
```

### 3. Network Optimization

```bash
# Increase network buffers
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

## Security Hardening

### 1. Firewall Configuration

```bash
# Install and configure UFW
sudo apt install ufw
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp  # SSH
sudo ufw allow 80/tcp  # HTTP
sudo ufw allow 443/tcp # HTTPS
sudo ufw enable
```

### 2. SSH Hardening

```bash
# Disable password authentication
sudo nano /etc/ssh/sshd_config
# Set: PasswordAuthentication no
# Set: PermitRootLogin no
sudo systemctl restart sshd
```

### 3. Fail2ban Setup

```bash
sudo apt install fail2ban
sudo cp /etc/fail2ban/jail.conf /etc/fail2ban/jail.local
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Support Resources

- Hardware documentation: `/home/pi/docs/hardware/`
- Sequent Microsystems support: https://sequentmicrosystems.com
- Hailo support: https://hailo.ai/developer-zone/
- System logs: `journalctl -u apollo-nexus`
- Application logs: `pm2 logs`