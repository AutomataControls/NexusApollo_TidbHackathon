#!/bin/bash
# Apollo Nexus™ Restart Script
# Kills PM2 services, cleans build cache, rebuilds, and restarts

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║               Apollo Nexus™ Restart Script                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_info() {
    echo -e "${YELLOW}[*]${NC} $1"
}

# Kill ONLY apollo-nexus PM2 process
print_info "Stopping apollo-nexus PM2 service..."
pm2 stop apollo-nexus 2>/dev/null
pm2 delete apollo-nexus 2>/dev/null

# Clean build directories
print_info "Cleaning build cache..."
cd /home/Automata/mydata/apollo-nexus/portal
rm -rf .next .next-cache node_modules/.cache build dist 2>/dev/null
print_status "Build cache cleaned"

# Rebuild the application
print_info "Building Apollo Nexus..."
npm run build
if [ $? -eq 0 ]; then
    print_status "Build completed successfully"
else
    print_error "Build failed!"
    exit 1
fi

# Start PM2 services
print_info "Starting PM2 services..."
pm2 start ecosystem.config.js
pm2 save
print_status "PM2 services started"

# Cloudflare tunnel is now managed by PM2 - no separate restart needed

# Show status
echo ""
print_status "Apollo Nexus restarted successfully!"
echo ""
pm2 status

# Get the port from .env
PORT=$(grep "^PORT=" /home/Automata/mydata/apollo-nexus/.env | cut -d'=' -f2 || echo "3000")

echo ""
echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║  🌐 Apollo Nexus is running on port $PORT                     ║"
echo "║  📊 View logs: pm2 logs apollo-nexus                          ║"
echo "║  🔍 Check status: pm2 status                                  ║"
echo "║  🌐 Portal URL: https://apollo-anc-3c7a20.automatacontrols.com               ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
