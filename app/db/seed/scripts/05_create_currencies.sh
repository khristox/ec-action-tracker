#!/bin/bash
# app/db/seed/scripts/seed_currencies.sh
# Seed Currency attribute group and attributes
# Usage: ./seed_currencies.sh [BASE_URL] [USERNAME] [PASSWORD]

# Remove set -e to prevent exit on errors
# set -e

# ==================== CONFIGURATION ====================
DEFAULT_BASE_URL="http://localhost:8000"
DEFAULT_USERNAME="admin"
DEFAULT_PASSWORD="Admin123!"

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
CYAN='\033[0;36m'
NC='\033[0m'

# ==================== HELPER FUNCTIONS ====================
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
print_header() { echo -e "${CYAN}📌 $1${NC}"; }
print_separator() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

# ==================== PARAMETER HANDLING ====================
print_separator
print_header "CURRENCY ATTRIBUTE SEEDER"
print_separator
echo ""

# Get BASE_URL
if [ -n "$1" ]; then
    BASE_URL="$1"
elif [ -n "$BASE_URL" ]; then
    BASE_URL="$BASE_URL"
else
    read -p "Enter API base URL [${DEFAULT_BASE_URL}]: " input
    BASE_URL="${input:-$DEFAULT_BASE_URL}"
fi

# Get USERNAME
if [ -n "$2" ]; then
    USERNAME="$2"
elif [ -n "$ADMIN_USERNAME" ]; then
    USERNAME="$ADMIN_USERNAME"
else
    read -p "Enter admin username [${DEFAULT_USERNAME}]: " input
    USERNAME="${input:-$DEFAULT_USERNAME}"
fi

# Get PASSWORD
if [ -n "$3" ]; then
    PASSWORD="$3"
elif [ -n "$ADMIN_PASSWORD" ]; then
    PASSWORD="$ADMIN_PASSWORD"
else
    read -sp "Enter admin password [${DEFAULT_PASSWORD}]: " input
    echo ""
    PASSWORD="${input:-$DEFAULT_PASSWORD}"
fi

print_info "Configuration:"
print_info "  API URL: ${BASE_URL}"
print_info "  Username: ${USERNAME}"
print_separator

# Validate URL
if [[ ! "$BASE_URL" =~ ^https?:// ]]; then
    print_error "Invalid URL format"
    exit 1
fi

# ==================== SERVER CONNECTION ====================
print_info "Testing server connection..."
if ! curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    print_error "Server not running at ${BASE_URL}"
    exit 1
fi
print_success "Server is running"

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

# ==================== CREATE CURRENCY GROUP ====================
print_info "Creating Currency group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "CURRENCY",
    "name": "Currency",
    "description": "Currency preferences and settings",
    "allow_multiple": false,
    "is_required": false,
    "display_order": 10,
    "extra_metadata": {
        "icon": "money",
        "color": "#4CAF50",
        "public": true,
        "category": "preferences"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s -X GET "${API_URL}/attribute-groups/?code=CURRENCY" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Currency group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Currency group"
        echo "Response: $GROUP_RESPONSE"
        exit 1
    fi
    print_success "Currency group created (ID: $GROUP_ID)"
fi

# ==================== CURRENCY DATA ====================
# Define currencies in an array
CURRENCIES=(
    "USD:US Dollar:USD:1:\$:\$:2:US dollars:🇺🇸:North America:true"
    "EUR:Euro:EUR:2:€:€:2:euros:🇪🇺:Europe:false"
    "GBP:British Pound:GBP:3:£:£:2:British pounds:🇬🇧:Europe:false"
    "JPY:Japanese Yen:JPY:4:¥:￥:0:Japanese yen:🇯🇵:Asia:false"
    "CNY:Chinese Yuan:CNY:5:¥:CN¥:2:Chinese yuan:🇨🇳:Asia:false"
    "CAD:Canadian Dollar:CAD:6:CA\$:\$:2:Canadian dollars:🇨🇦:North America:false"
    "AUD:Australian Dollar:AUD:7:A\$:\$:2:Australian dollars:🇦🇺:Oceania:false"
    "CHF:Swiss Franc:CHF:8:CHF:CHF:2:Swiss francs:🇨🇭:Europe:false"
    "INR:Indian Rupee:INR:9:₹:₹:2:Indian rupees:🇮🇳:Asia:false"
    "ZAR:South African Rand:ZAR:10:R:R:2:South African rand:🇿🇦:Africa:false"
    "KES:Kenyan Shilling:KES:11:KSh:KSh:2:Kenyan shillings:🇰🇪:Africa:false"
    "UGX:Ugandan Shilling:UGX:12:USh:USh:0:Ugandan shillings:🇺🇬:Africa:false"
    "TZS:Tanzanian Shilling:TZS:13:TSh:TSh:0:Tanzanian shillings:🇹🇿:Africa:false"
    "NGN:Nigerian Naira:NGN:14:₦:₦:2:Nigerian nairas:🇳🇬:Africa:false"
    "GHS:Ghanaian Cedi:GHS:15:₵:₵:2:Ghanaian cedis:🇬🇭:Africa:false"
)

# ==================== CREATE CURRENCY ATTRIBUTES ====================
print_info "Creating currency attributes..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for currency in "${CURRENCIES[@]}"; do
    IFS=':' read -r code name short_name sort_order symbol symbol_native decimal_digits name_plural flag_emoji region is_default <<< "$currency"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=CURRENCY&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    # Check if exists in paginated response
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "CURRENCY",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "symbol": "${symbol}",
        "symbol_native": "${symbol_native}",
        "decimal_digits": ${decimal_digits},
        "name_plural": "${name_plural}",
        "flag_emoji": "${flag_emoji}",
        "region": "${region}",
        "is_default": ${is_default},
        "status": "active"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} (${code}) ${flag_emoji} ${symbol}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed to create ${name}: ${ERROR}"
        ((FAIL_COUNT++))
        # Don't exit, continue with next currency
    fi
done

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying created currencies..."

# Wait a moment for attributes to be indexed
sleep 2

# Get all attributes in group
VERIFY_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/CURRENCY/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    print_success "Found ${ATTRIBUTE_COUNT} currencies in the group"
    
    echo ""
    echo -e "${BLUE}📋 Currencies in system:${NC}"
    echo "$VERIFY_RESPONSE" | jq -r '.items[] | "  • \(.code) - \(.name) (\(.extra_metadata.symbol)) \(.extra_metadata.flag_emoji)"'
else
    print_warning "Could not retrieve currencies"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Currency attribute setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total currencies processed: ${#CURRENCIES[@]}"
echo "  • Successfully created: ${SUCCESS_COUNT}"
echo "  • Already existed (skipped): ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Failed: ${FAIL_COUNT}"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get all currencies"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/CURRENCY/attributes\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, symbol: .extra_metadata.symbol}'"
echo ""
echo "  # Get specific currency"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/?code=KES\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.'"
echo ""
print_separator