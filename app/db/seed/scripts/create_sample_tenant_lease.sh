#!/bin/bash
# app/db/seed/scripts/create_sample_tenant_lease.sh
# Create a sample tenant and lease with multi-currency
# Usage: ./create_sample_tenant_lease.sh [BASE_URL] [USERNAME] [PASSWORD]

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
DEFAULT_PASSWORD="Admin123!"

# ==================== PARAMETER HANDLING ====================
print_separator
print_header "SAMPLE TENANT & LEASE CREATION"
print_separator
echo ""

# Get BASE_URL
if [ -n "$1" ]; then
    BASE_URL="$1"
else
    read -p "Enter API base URL [${DEFAULT_BASE_URL}]: " input
    BASE_URL="${input:-$DEFAULT_BASE_URL}"
fi

# Get USERNAME
if [ -n "$2" ]; then
    USERNAME="$2"
else
    read -p "Enter admin username [${DEFAULT_USERNAME}]: " input
    USERNAME="${input:-$DEFAULT_USERNAME}"
fi

# Get PASSWORD
if [ -n "$3" ]; then
    PASSWORD="$3"
else
    read -sp "Enter admin password [${DEFAULT_PASSWORD}]: " input
    echo ""
    PASSWORD="${input:-$DEFAULT_PASSWORD}"
fi

print_info "Configuration:"
print_info "  API URL: ${BASE_URL}"
print_info "  Username: ${USERNAME}"
print_separator

# ==================== AUTHENTICATION ====================
print_info "Authenticating..."

API_URL="${BASE_URL}/api/v1"
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${USERNAME}&password=${PASSWORD}")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
    print_error "Authentication failed"
    exit 1
fi
print_success "Authenticated"

# ==================== GET CURRENCY ATTRIBUTES ====================
print_info "Fetching available currencies..."

CURRENCIES=$(curl -s -X GET "${API_URL}/attribute-groups/CURRENCY/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

# Get USD and KES currency attribute IDs
USD_ID=$(echo "$CURRENCIES" | jq -r '.items[] | select(.code == "USD") | .id')
KES_ID=$(echo "$CURRENCIES" | jq -r '.items[] | select(.code == "KES") | .id')

print_success "USD Currency ID: $USD_ID"
print_success "KES Currency ID: $KES_ID"

# ==================== CREATE TENANT ====================
print_info "Creating sample tenant..."

TENANT_JSON=$(cat <<EOF
{
    "first_name": "John",
    "last_name": "Doe",
    "email": "john.doe@example.com",
    "phone": "+254712345678",
    "alternative_phone": "+254723456789",
    "emergency_contact_name": "Jane Doe",
    "emergency_contact_phone": "+254734567890",
    "emergency_contact_relationship": "Spouse",
    "id_number": "12345678",
    "employer": "Tech Corp",
    "occupation": "Software Engineer",
    "monthly_income": 5000,
    "notes": "Sample tenant for testing"
}
EOF
)

TENANT_RESPONSE=$(curl -s -X POST "${API_URL}/tenants/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$TENANT_JSON")

TENANT_ID=$(echo "$TENANT_RESPONSE" | jq -r '.id')

if [ -z "$TENANT_ID" ] || [ "$TENANT_ID" == "null" ]; then
    print_error "Failed to create tenant"
    echo "Response: $TENANT_RESPONSE"
    exit 1
fi
print_success "Tenant created (ID: $TENANT_ID)"

# ==================== CREATE STRUCTURE/UNIT ====================
print_info "Creating sample unit..."

UNIT_JSON=$(cat <<EOF
{
    "name": "Unit 101",
    "code": "BLD-001-101",
    "structure_type": "unit",
    "parent_id": null,
    "owner_id": null,
    "attributes": {
        "unit_number": "101",
        "floor_number": 1,
        "size_sqft": 850,
        "bedrooms": 1,
        "bathrooms": 1,
        "base_rent": 750,
        "billing_mode": "monthly"
    }
}
EOF
)

UNIT_RESPONSE=$(curl -s -X POST "${API_URL}/structures/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$UNIT_JSON")

UNIT_ID=$(echo "$UNIT_RESPONSE" | jq -r '.id')

if [ -z "$UNIT_ID" ] || [ "$UNIT_ID" == "null" ]; then
    print_error "Failed to create unit"
    echo "Response: $UNIT_RESPONSE"
    exit 1
fi
print_success "Unit created (ID: $UNIT_ID)"

# ==================== CREATE LEASE ====================
print_info "Creating lease with multi-currency..."

LEASE_JSON=$(cat <<EOF
{
    "structure_id": "${UNIT_ID}",
    "tenant_id": "${TENANT_ID}",
    "currency_attribute_id": "${USD_ID}",
    "lease_number": "L-$(date +%Y%m%d)-001",
    "start_date": "2024-01-01",
    "end_date": "2024-12-31",
    "rent_amount": 750,
    "security_deposit": 750,
    "late_fee_amount": 50,
    "late_fee_days": 5,
    "billing_day": 1,
    "billing_cycle": "monthly",
    "utilities_included": true,
    "included_utilities": ["water", "trash"],
    "parking_included": true,
    "parking_spaces": 1,
    "is_active": true,
    "is_auto_renew": false,
    "terms_conditions": "Standard lease terms apply."
}
EOF
)

LEASE_RESPONSE=$(curl -s -X POST "${API_URL}/leases/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$LEASE_JSON")

LEASE_ID=$(echo "$LEASE_RESPONSE" | jq -r '.id')
LEASE_NUMBER=$(echo "$LEASE_RESPONSE" | jq -r '.lease_number')

if [ -z "$LEASE_ID" ] || [ "$LEASE_ID" == "null" ]; then
    print_error "Failed to create lease"
    echo "Response: $LEASE_RESPONSE"
    exit 1
fi
print_success "Lease created (ID: $LEASE_ID, Number: $LEASE_NUMBER)"

# ==================== GENERATE BILL ====================
print_info "Generating automated bill for lease..."

# Get billing type ID for automated billing
BILLING_TYPE_ID=$(curl -s -X GET "${API_URL}/attributes/?code=automated&group_code=BILLING_TYPES" \
    -H "Authorization: Bearer $ADMIN_TOKEN" | jq -r '.items[0].id')

BILL_JSON=$(cat <<EOF
{
    "lease_id": "${LEASE_ID}",
    "billing_type_id": "${BILLING_TYPE_ID}",
    "bill_number": "INV-${LEASE_NUMBER}-$(date +%Y%m)",
    "bill_date": "2024-01-01",
    "due_date": "2024-01-10",
    "period_start": "2024-01-01",
    "period_end": "2024-01-31",
    "def_currency_id": "${USD_ID}",
    "def_amount": 750,
    "currency_id": "${USD_ID}",
    "amount": 750,
    "exchange_rate": 1.0,
    "line_items": [
        {
            "type": "rent",
            "description": "January 2024 Rent",
            "quantity": 1,
            "unit_price": 750,
            "amount": 750,
            "currency": "USD",
            "tax_rate": 0,
            "tax_amount": 0
        }
    ],
    "subtotal": 750,
    "tax_amount": 0,
    "discount_amount": 0,
    "total_amount": 750,
    "paid_amount": 0,
    "balance_due": 750,
    "status": "pending",
    "description": "Monthly rent for January 2024"
}
EOF
)

BILL_RESPONSE=$(curl -s -X POST "${API_URL}/bills/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$BILL_JSON")

BILL_ID=$(echo "$BILL_RESPONSE" | jq -r '.id')
BILL_NUMBER=$(echo "$BILL_RESPONSE" | jq -r '.bill_number')

if [ -z "$BILL_ID" ] || [ "$BILL_ID" == "null" ]; then
    print_error "Failed to generate bill"
    echo "Response: $BILL_RESPONSE"
    exit 1
fi
print_success "Bill generated (ID: $BILL_ID, Number: $BILL_NUMBER)"

# ==================== CREATE PAYMENT ====================
print_info "Creating payment for bill..."

PAYMENT_JSON=$(cat <<EOF
{
    "bill_id": "${BILL_ID}",
    "payment_number": "PAY-${LEASE_NUMBER}-$(date +%Y%m)",
    "payment_date": "2024-01-05",
    "def_currency_id": "${USD_ID}",
    "def_amount": 750,
    "currency_id": "${KES_ID}",
    "amount": 108750,
    "exchange_rate": 145,
    "payment_method": "bank_transfer",
    "status": "completed",
    "transaction_id": "TXN-$(date +%Y%m%d)-001",
    "reference_number": "REF-001",
    "notes": "Payment for January 2024 rent"
}
EOF
)

PAYMENT_RESPONSE=$(curl -s -X POST "${API_URL}/payments/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYMENT_JSON")

PAYMENT_ID=$(echo "$PAYMENT_RESPONSE" | jq -r '.id')

if [ -z "$PAYMENT_ID" ] || [ "$PAYMENT_ID" == "null" ]; then
    print_error "Failed to create payment"
    echo "Response: $PAYMENT_RESPONSE"
    exit 1
fi
print_success "Payment created (ID: $PAYMENT_ID)"

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Sample tenant and lease creation completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Tenant: John Doe (ID: $TENANT_ID)"
echo "  • Unit: Unit 101 (ID: $UNIT_ID)"
echo "  • Lease: $LEASE_NUMBER (ID: $LEASE_ID)"
echo "  • Bill: $BILL_NUMBER (ID: $BILL_ID)"
echo "  • Payment: $PAYMENT_ID"
echo ""
echo -e "${CYAN}💰 Multi-Currency Details:${NC}"
echo "  • Lease Currency: USD"
echo "  • Rent Amount: $750 USD"
echo "  • Payment Currency: KES"
echo "  • Payment Amount: 108,750 KES"
echo "  • Exchange Rate: 145 KES/USD"
echo ""
echo -e "${CYAN}📝 Next Steps:${NC}"
echo "  • View lease: ${API_URL}/leases/${LEASE_ID}"
echo "  • View bill: ${API_URL}/bills/${BILL_ID}"
echo "  • View payment: ${API_URL}/payments/${PAYMENT_ID}"
echo ""
print_separator