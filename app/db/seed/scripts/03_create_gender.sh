#!/bin/bash
# app/db/seed/scripts/seed_gender.sh
# Seed Gender attribute group and attributes with enhanced metadata
# Usage: ./seed_gender.sh [BASE_URL] [USERNAME] [PASSWORD]

# Remove set -e to prevent exit on errors
# set -e

# ==================== CONFIGURATION ====================
DEFAULT_BASE_URL="http://localhost:8001"
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
print_header "GENDER ATTRIBUTE SEEDER"
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

# ==================== CREATE GENDER GROUP ====================
print_info "Creating Gender group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "GENDER",
    "name": "Gender",
    "description": "Gender identity of the user",
    "allow_multiple": false,
    "is_required": true,
    "display_order": 5,
    "extra_metadata": {
        "icon": "user",
        "color": "#9C27B0",
        "public": true,
        "category": "demographic",
        "group_type": "identity",
        "ui_component": "dropdown"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s -X GET "${API_URL}/attribute-groups/?code=GENDER" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

# Handle paginated response
if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Gender group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Gender group"
        exit 1
    fi
    print_success "Gender group created (ID: $GROUP_ID)"
fi

# ==================== GENDER DATA ====================
# Define genders in a simple array
GENDERS=(
    "M:Male:M:1:mars:👨:#2196F3:he:him:his:his:himself:he/him:Mr.:Male gender identity"
    "F:Female:F:2:venus:👩:#E91E63:she:her:her:hers:herself:she/her:Ms.:Female gender identity"
    "NB:Non-binary:NB:3:user:🧑:#9C27B0:they:them:their:theirs:themself:they/them:Mx.:Non-binary gender identity"
    "OTHER:Other:Oth:4:user:🌈:#FF9800:user_specified:user_specified:user_specified:user_specified:user_specified:custom:User:Other gender identity or prefer to self-describe"
    "PNS:Prefer Not to Say:PNS:5:lock:🤐:#9E9E9E:they:them:their:theirs:themself:prefer not to specify:User:User prefers not to disclose gender identity"
)

# ==================== CREATE GENDER ATTRIBUTES ====================
print_info "Creating gender attributes..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Process each gender individually
for gender in "${GENDERS[@]}"; do
    IFS=':' read -r code name short_name sort_order icon emoji color pronoun_subject pronoun_object pronoun_possessive pronoun_possessive_pronoun pronoun_reflexive pronoun_display honorific description <<< "$gender"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=GENDER&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    # Handle paginated response
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "GENDER",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "icon": "${icon}",
        "emoji": "${emoji}",
        "color": "${color}",
        "pronouns": {
            "subject": "${pronoun_subject}",
            "object": "${pronoun_object}",
            "possessive": "${pronoun_possessive}",
            "possessive_pronoun": "${pronoun_possessive_pronoun}",
            "reflexive": "${pronoun_reflexive}"
        },
        "pronoun_display": "${pronoun_display}",
        "honorific": "${honorific}",
        "description": "${description}",
        "status": "active"
    }
}
EOF
)
    
    # Debug: Show the JSON being sent
    echo "  JSON Payload:" >&2
    echo "$ATTRIBUTE_JSON" | jq '.' >&2
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    # Debug: Show response
    echo "  Response:" >&2
    echo "$RESPONSE" | jq '.' >&2
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} (${code}) ${emoji} - ${pronoun_display}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
        # Don't exit, continue with next gender
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.5
done

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying Gender group..."

# Wait for attributes to be indexed
sleep 2

# Get all attributes in group
VERIFY_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/GENDER/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    
    if [ "$ATTRIBUTE_COUNT" -gt 0 ]; then
        print_success "Found ${ATTRIBUTE_COUNT} gender attributes"
        
        echo ""
        echo -e "${BLUE}📋 Gender Attributes:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | "  • \(.name) (\(.code)) - \(.extra_metadata.pronoun_display) \(.extra_metadata.emoji)"'
    else
        print_warning "No gender attributes found"
    fi
else
    print_warning "Could not retrieve gender attributes"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Gender attribute setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total genders: ${#GENDERS[@]}"
echo "  • Successfully created: ${SUCCESS_COUNT}"
echo "  • Already existed: ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Failed: ${FAIL_COUNT}"
echo ""
echo -e "${CYAN}📋 Gender Options:${NC}"
echo "  • Male (M) - he/him (Mr.) 👨"
echo "  • Female (F) - she/her (Ms.) 👩"
echo "  • Non-binary (NB) - they/them (Mx.) 🧑"
echo "  • Other (OTHER) - custom pronouns 🌈"
echo "  • Prefer Not to Say (PNS) - prefer not to specify 🤐"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get Gender group (public)"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/GENDER\" | jq '.'"
echo ""
echo "  # Get all gender attributes"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/GENDER/attributes\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, pronouns: .extra_metadata.pronoun_display}'"
echo ""
echo "  # Get specific gender"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/?code=M\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.'"
echo ""
print_separator