#!/bin/bash
# build-and-run.sh - Complete build and run script

set -e

echo "=========================================="
echo "Building and Running Action Tracker"
echo "=========================================="

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Step 1: Clean up old containers
echo -e "${YELLOW}Step 1: Cleaning up old containers...${NC}"
cd /home/chris/Chr/Apps/ECATMIS/docker
docker-compose down -v 2>/dev/null || true
docker rm -f ec_app ec_mysql 2>/dev/null || true

# Step 2: Build the Docker image
echo -e "${YELLOW}Step 2: Building Docker image...${NC}"
cd /home/chris/Chr/Apps/ECATMIS
docker build --no-cache -t ec-action-tracker:latest .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Image built successfully${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    exit 1
fi

# Step 3: Show image info
echo -e "${YELLOW}Step 3: Image information...${NC}"
docker images | grep ec-action-tracker

# Step 4: Start services with docker-compose
echo -e "${YELLOW}Step 4: Starting services...${NC}"
cd /home/chris/Chr/Apps/ECATMIS/docker
docker-compose up -d

# Step 5: Wait for services to start
echo -e "${YELLOW}Step 5: Waiting for services to start...${NC}"
sleep 10

# Step 6: Check container status
echo -e "${YELLOW}Step 6: Container status...${NC}"
docker-compose ps

# Step 7: Show logs
echo -e "${YELLOW}Step 7: Recent logs...${NC}"
docker-compose logs --tail=30

# Step 8: Test MySQL connection
echo -e "${YELLOW}Step 8: Testing MySQL connection...${NC}"
docker exec ec_mysql mysqladmin ping -h 127.0.0.1 -u root -p'aradmin!2723646' --silent && echo -e "${GREEN}✅ MySQL is running${NC}" || echo -e "${RED}❌ MySQL failed${NC}"

# Step 9: Test App connection
echo -e "${YELLOW}Step 9: Testing App connection...${NC}"
sleep 5
curl -f http://127.0.0.1:8006/health 2>/dev/null && echo -e "${GREEN}✅ App is running${NC}" || echo -e "${RED}❌ App not responding${NC}"

echo ""
echo -e "${GREEN}=========================================="
echo "✅ Setup Complete!"
echo "==========================================${NC}"
echo ""
echo "Access your application:"
echo "  - API: http://127.0.0.1:8006"
echo "  - API Docs: http://127.0.0.1:8006/docs"
echo "  - Health: http://127.0.0.1:8006/health"
echo ""
echo "Useful commands:"
echo "  - View logs: docker-compose logs -f"
echo "  - Stop: docker-compose down"
echo "  - Restart: docker-compose restart"
echo "  - MySQL: docker exec -it ec_mysql mysql -uroot -p'aradmin!2723646'"
echo "  - App shell: docker exec -it ec_app bash"