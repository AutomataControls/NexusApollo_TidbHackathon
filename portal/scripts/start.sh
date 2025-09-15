#!/bin/bash
# Apollo Nexus Startup Script

echo "==================================="
echo "   Apollo Nexus™ HVAC System"
echo "   © 2025 AutomataNexus, LLC"
echo "==================================="

# Check if running as root (needed for hardware access)
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root for hardware access"
   echo "Use: sudo ./start.sh"
   exit 1
fi

# Load environment variables
export $(cat ../.env | grep -v '^#' | xargs)

# Check if PostgreSQL is running
echo "Checking PostgreSQL..."
if ! pg_isready -h $POSTGRES_HOST -p $POSTGRES_PORT; then
    echo "PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Initialize databases if needed
echo "Checking database initialization..."
node init-db.js

# Check hardware permissions
echo "Setting hardware permissions..."
chmod 666 /dev/i2c-* 2>/dev/null || true
chmod 666 /dev/ttyUSB* 2>/dev/null || true

# Create required directories
mkdir -p ../logs ../data ../backups

# Start the server
echo "Starting Apollo Nexus server..."
cd ..
NODE_ENV=production node server.js