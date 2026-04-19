#!/bin/bash
# install.sh - Complete installation script for Action Tracker

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Print colored output
print_status() {
    echo -e "${GREEN}[✓]${NC} $1"
}

print_error() {
    echo -e "${RED}[✗]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[!]${NC} $1"
}

print_info() {
    echo -e "${BLUE}[i]${NC} $1"
}

print_header() {
    echo ""
    echo "============================================================"
    echo -e "${BLUE}$1${NC}"
    echo "============================================================"
}

# Check if Docker is running
check_docker() {
    print_info "Checking Docker..."
    if ! docker info > /dev/null 2>&1; then
        print_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    print_status "Docker is running"
}

# Start services
start_services() {
    print_header "Starting Docker services"
    docker-compose up -d mysql
    print_status "MySQL started"
}

# Wait for MySQL to be ready
wait_for_mysql() {
    print_info "Waiting for MySQL to be ready..."
    MAX_RETRIES=30
    RETRY_COUNT=0
    
    while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
        if docker-compose exec -T mysql mysqladmin ping -h 127.0.0.1 -u root -paradmin!2723646 --silent 2>/dev/null; then
            print_status "MySQL is ready"
            return 0
        fi
        RETRY_COUNT=$((RETRY_COUNT + 1))
        echo -n "."
        sleep 2
    done
    
    print_error "MySQL failed to start"
    exit 1
}

# Start the app
start_app() {
    print_header "Starting Application"
    docker-compose up -d app
    print_status "Application started"
}

# Run database seed
run_seed() {
    print_header "Running Database Seed"
    
    # Wait a bit for app to be ready
    sleep 5
    
    # Run the seed command
    if docker exec -it ec_app python app/db/seed/seed_data.py --force 2>/dev/null; then
        print_status "Database seeded successfully"
    else
        # Try without -it if the above fails
        if docker exec ec_app python app/db/seed/seed_data.py --force; then
            print_status "Database seeded successfully"
        else
            print_error "Database seeding failed"
            exit 1
        fi
    fi
}

# Verify installation
verify_installation() {
    print_header "Verifying Installation"
    
    # Check if app is running
    if docker-compose ps | grep -q "app.*running"; then
        print_status "Application is running"
    else
        print_error "Application is not running"
        exit 1
    fi
    
    # Test API endpoint
    print_info "Testing API endpoint..."
    sleep 3
    if curl -s -f http://127.0.0.1:8006/api/v1/health > /dev/null 2>&1; then
        print_status "API is responding"
    else
        print_warning "API not responding yet (might still be starting)"
    fi
    
    # Check if admin user exists
    print_info "Checking admin user..."
    ADMIN_CHECK=$(docker exec ec_mysql mysql -uroot -paradmin!2723646 ecacttrack -sN -e "SELECT COUNT(*) FROM users WHERE username='admin'" 2>/dev/null)
    if [ "$ADMIN_CHECK" -gt 0 ]; then
        print_status "Admin user exists"
    else
        print_warning "Admin user not found (may need to be created)"
    fi
}

# Show access information
show_info() {
    print_header "Installation Complete!"
    echo ""
    echo -e "${GREEN}✅ Action Tracker has been successfully installed!${NC}"
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo -e "${BLUE}Access Information:${NC}"
    echo "  • API URL:      http://127.0.0.1:8006"
    echo "  • API Docs:     http://127.0.0.1:8006/docs"
    echo "  • Admin Login:  username: admin"
    echo "  • Admin Password: Admin123!"
    echo ""
    echo -e "${BLUE}Useful Commands:${NC}"
    echo "  • View logs:     docker-compose logs -f"
    echo "  • Stop services: docker-compose down"
    echo "  • Restart:       docker-compose restart"
    echo "  • Re-seed DB:    docker exec -it ec_app python app/db/seed/seed_data.py --force"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
}

# Main installation flow
main() {
    print_header "Action Tracker Installation"
    
    check_docker
    start_services
    wait_for_mysql
    start_app
    run_seed
    verify_installation
    show_info
}

# Run main function
main
