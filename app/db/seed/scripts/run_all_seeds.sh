#!/bin/bash
# run_all_seeds.sh
# Run all seed scripts in the correct order
# Usage: ./run_all_seeds.sh [BASE_URL] [USERNAME] [PASSWORD]

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_header() { echo -e "${CYAN}📌 $1${NC}"; }
print_separator() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ==================== CONFIGURATION ====================
DEFAULT_BASE_URL="http://localhost:8000"
DEFAULT_USERNAME="admin"
DEFAULT_PASSWORD="Admin123"

# Get parameters
BASE_URL="${1:-$DEFAULT_BASE_URL}"
USERNAME="${2:-$DEFAULT_USERNAME}"
PASSWORD="${3:-$DEFAULT_PASSWORD}"

print_separator
print_header "Action Tracker - COMPLETE SEED SETUP"
print_separator
echo ""
print_info "Configuration:"
print_info "  API URL: ${BASE_URL}"
print_info "  Username: ${USERNAME}"
print_info "  Password: ${PASSWORD}"
print_separator

# Check if server is running
print_info "Checking server connection..."
if ! curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    print_error "Server not running at ${BASE_URL}"
    exit 1
fi
print_success "Server is running"

# ==================== RUN DATABASE INITIALIZATION ====================
print_header "Step 1: Database Initialization"
print_info "Creating database tables..."

cd "$(dirname "$0")/.." || exit 1

python app/db/seed/seed_data.py

if [ $? -ne 0 ]; then
    print_error "Database initialization failed"
    exit 1
fi
print_success "Database tables created"

# ==================== RUN SEED SCRIPTS ====================
SCRIPT_DIR="app/db/seed/scripts"

# Check if scripts directory exists
if [ ! -d "$SCRIPT_DIR" ]; then
    print_error "Scripts directory not found: $SCRIPT_DIR"
    exit 1
fi

# Array of seed scripts in correct order
SEED_SCRIPTS=(
    "seed_currencies.sh"
    "seed_billing_types.sh"
    "seed_structure_attributes.sh"
    "seed_tenant_attributes.sh"
    "seed_lease_attributes.sh"
    "seed_sample_structures.sh"
    "create_sample_tenant_lease.sh"
)

# Run each seed script
for script in "${SEED_SCRIPTS[@]}"; do
    SCRIPT_PATH="${SCRIPT_DIR}/${script}"
    
    if [ -f "$SCRIPT_PATH" ]; then
        echo ""
        print_separator
        print_header "Running: $script"
        print_separator
        echo ""
        
        # Make script executable if not already
        chmod +x "$SCRIPT_PATH"
        
        # Run the script
        "$SCRIPT_PATH" "$BASE_URL" "$USERNAME" "$PASSWORD"
        
        if [ $? -eq 0 ]; then
            print_success "Completed: $script"
        else
            print_error "Failed: $script"
            exit 1
        fi
        
        # Small delay between scripts
        sleep 1
    else
        print_warning "Script not found: $SCRIPT_PATH"
    fi
done

# ==================== FINAL SUMMARY ====================
echo ""
print_separator
print_success "ALL SEED SCRIPTS COMPLETED SUCCESSFULLY!"
print_separator
echo ""
echo -e "${CYAN}📊 System Overview:${NC}"
echo "  ✓ Database tables created"
echo "  ✓ Currencies seeded"
echo "  ✓ Billing types seeded"
echo "  ✓ Structure types seeded"
echo "  ✓ Building attributes seeded"
echo "  ✓ Unit attributes seeded"
echo "  ✓ Room attributes seeded"
echo "  ✓ Tenant attributes seeded"
echo "  ✓ Lease attributes seeded"
echo "  ✓ Sample structures created"
echo "  ✓ Sample tenant created"
echo "  ✓ Sample lease created"
echo ""
echo -e "${CYAN}🔑 Login Credentials:${NC}"
echo "  URL: ${BASE_URL}/docs"
echo "  Username: ${USERNAME}"
echo "  Password: ${PASSWORD}"
echo ""
echo -e "${CYAN}📝 Test Commands:${NC}"
echo ""
echo "  # Get all currencies"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/CURRENCY/attributes\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"
echo ""
echo "  # Get all structures"
echo "  curl -X GET \"${BASE_URL}/api/v1/structures/\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"
echo ""
echo "  # Get structure hierarchy"
echo "  curl -X GET \"${BASE_URL}/api/v1/structures/hierarchy/\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"
echo ""
echo "  # Get all tenants"
echo "  curl -X GET \"${BASE_URL}/api/v1/tenants/\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"
echo ""
echo "  # Get all leases"
echo "  curl -X GET \"${BASE_URL}/api/v1/leases/\" \\"
echo "    -H \"Authorization: Bearer \$TOKEN\" | jq '.'"
echo ""
print_separator