#!/bin/bash

echo "🔄 Restarting Nexus Apollo services..."

# Stop and start backend (not restart)
echo "Stopping backend..."
pm2 stop apollo-nexus
echo "Starting backend..."
pm2 start apollo-nexus

# Kill any existing Next.js servers (PRODUCTION)
echo "Stopping frontend servers..."
pkill -f "next start" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true
# Kill any process using port 3000
lsof -ti:3000 | xargs kill -9 2>/dev/null || true

# Remove frontend from PM2 if it exists
echo "Removing frontend from PM2..."
pm2 delete apollo-ui 2>/dev/null || true

# Wait a moment
sleep 2

# Clean build artifacts
echo "Cleaning build cache..."
cd /home/Automata/mydata/apollo-nexus/apollo-ui
# Use sudo if needed for cleanup, or skip files with permission issues
sudo rm -rf .next 2>/dev/null || rm -rf .next 2>/dev/null || true
rm -rf .next-cache 2>/dev/null || true

echo "Rebuilding frontend..."
npm run build

echo "Starting frontend with PM2..."
pm2 start npm --name apollo-ui -- start

echo "✅ Nexus Apollo services restarted!"
echo "Backend: http://localhost:8001"
echo "Frontend: http://localhost:3000"
pm2 status