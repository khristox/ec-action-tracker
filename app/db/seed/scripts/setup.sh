#!/bin/bash
# setup.sh
# One-command setup for the entire Action Tracker

set -e

GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}  Action Tracker - COMPLETE SETUP${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""

# Step 1: Install Python dependencies
echo "📦 Installing Python dependencies..."
pip install -r requirements.txt

# Step 2: Create .env file if it doesn't exist
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
# Database
DATABASE_URL=sqlite+aiosqlite:///./rental_management.db

# Security
SECRET_KEY=$(python -c "import secrets; print(secrets.token_urlsafe(32))")
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Admin User
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin123

# API
BACKEND_URL=http://localhost:8000
EOF
    echo "✅ .env file created"
fi

# Step 3: Run database initialization and seeding
echo "🚀 Initializing database and seeding data..."
chmod +x run_all_seeds.sh
./run_all_seeds.sh

# Step 4: Start the server
echo ""
echo -e "${GREEN}✅ Setup complete!${NC}"
echo ""
echo "To start the server:"
echo "  uvicorn app.main:app --reload"
echo ""
echo "To view API documentation:"
echo "  http://localhost:8000/docs"
echo ""