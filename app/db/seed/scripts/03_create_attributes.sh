#!/bin/bash
# app/db/seed/scripts/seed_attributes.sh
# Seed Attribute data for Action Tracker (Electoral Commission)
# This creates attribute definitions and their values

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
MAGENTA='\033[0;35m'
NC='\033[0m'

# ==================== HELPER FUNCTIONS ====================
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
print_header() { echo -e "${CYAN}📌 $1${NC}"; }
print_separator() { echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

print_separator
print_header "ACTION TRACKER ATTRIBUTES SEEDER"
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
LOGIN_URL="${API_URL}/auth/login"

LOGIN_RESPONSE=$(curl -s -X POST "${LOGIN_URL}" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${USERNAME}&password=${PASSWORD}")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
    print_error "Authentication failed"
    exit 1
fi
print_success "Authenticated"

# ==================== FUNCTION TO CREATE ATTRIBUTE ====================
create_attribute() {
    local code=$1
    local name=$2
    local description=$3
    
    print_info "Creating attribute: ${name} (${code})..."
    
    JSON_PAYLOAD=$(cat <<EOF
{
    "code": "${code}",
    "name": "${name}",
    "description": "${description}"
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    ATTRIBUTE_ID=$(echo "$RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "null" ]; then
        print_success "    ✅ Attribute created (ID: ${ATTRIBUTE_ID:0:8}...)"
        echo "$ATTRIBUTE_ID"
        return 0
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // .message // "Unknown error"' 2>/dev/null)
        
        # Check if attribute already exists
        if [[ "$ERROR" == *"already exists"* ]]; then
            print_warning "    ⏭️  Attribute already exists, fetching ID..."
            # Get existing attribute ID
            GET_RESPONSE=$(curl -s -X GET "${API_URL}/attributes/by-code/${code}" \
                -H "Authorization: Bearer $ADMIN_TOKEN")
            ATTRIBUTE_ID=$(echo "$GET_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
            if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "null" ]; then
                print_success "    ✅ Found existing attribute (ID: ${ATTRIBUTE_ID:0:8}...)"
                echo "$ATTRIBUTE_ID"
                return 0
            fi
        fi
        
        print_error "    ❌ Failed to create attribute: ${ERROR}"
        echo ""
        return 1
    fi
}

# ==================== FUNCTION TO CREATE ATTRIBUTE VALUE ====================
create_attribute_value() {
    local attribute_id=$1
    local code=$2
    local name=$3
    local description=$4
    local sort_order=$5
    
    JSON_PAYLOAD=$(cat <<EOF
{
    "attribute_id": "${attribute_id}",
    "code": "${code}",
    "name": "${name}",
    "description": "${description}",
    "sort_order": ${sort_order},
    "is_active": true
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attribute-values/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    VALUE_ID=$(echo "$RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -n "$VALUE_ID" ] && [ "$VALUE_ID" != "null" ]; then
        print_success "      ✅ Value created: ${name} (${code})"
        return 0
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // .message // "Unknown error"' 2>/dev/null)
        
        # Check if value already exists
        if [[ "$ERROR" == *"already exists"* ]]; then
            print_warning "      ⏭️  Value already exists: ${name} (${code})"
            return 0
        fi
        
        print_error "      ❌ Failed to create value: ${ERROR}"
        return 1
    fi
}

# ==================== CREATE ATTRIBUTES AND VALUES ====================
print_separator
print_header "Creating Attributes and Values"
print_separator
echo ""

# Track success/failure
TOTAL_ATTRIBUTES=0
SUCCESS_ATTRIBUTES=0
TOTAL_VALUES=0
SUCCESS_VALUES=0

# ==================== 1. MEETING STATUS ====================
echo ""
print_header "1. Meeting Status Attribute"
echo ""

ATTRIBUTE_ID=$(create_attribute "meeting_status" "Meeting Status" "Status of meetings from scheduling to completion")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Meeting Status Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "pending" "Pending" "Meeting scheduled but not started" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "started" "Started" "Meeting in progress" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "ended" "Ended" "Meeting ended" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "awaiting_action" "Awaiting Action" "Meeting completed, awaiting action items" 4
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "closed" "Closed" "Meeting fully completed and closed" 5
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "cancelled" "Cancelled" "Meeting cancelled" 6
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== 2. ACTION STATUS (Overall) ====================
echo ""
print_header "2. Action Status Attribute (Overall)"
echo ""

ATTRIBUTE_ID=$(create_attribute "action_status" "Action Status" "Overall status of action items")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Action Status Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "pending" "Pending" "Action not yet started" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "in_progress" "In Progress" "Action being worked on" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "completed" "Completed" "Action completed" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "overdue" "Overdue" "Action past due date" 4
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "blocked" "Blocked" "Action blocked by dependency" 5
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "cancelled" "Cancelled" "Action cancelled" 6
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== 3. INDIVIDUAL STATUS (User self-reporting) ====================
echo ""
print_header "3. Individual Status Attribute (User Self-Reporting)"
echo ""

ATTRIBUTE_ID=$(create_attribute "individual_status" "Individual Status" "User's self-reported status for assigned actions")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Individual Status Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "not_started" "Not Started" "Haven't started yet" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "in_progress" "In Progress" "Actively working on it" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "blocked" "Blocked" "Stuck, need assistance" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "review" "Ready for Review" "Completed, awaiting review" 4
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "completed" "Completed" "Fully completed" 5
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== 4. DOCUMENT TYPE ====================
echo ""
print_header "4. Document Type Attribute"
echo ""

ATTRIBUTE_ID=$(create_attribute "document_type" "Document Type" "Types of documents attached to meetings")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Document Type Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "agenda" "Agenda" "Meeting agenda document" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "presentation" "Presentation" "Presentation slides" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "report" "Report" "Meeting report" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "minutes" "Minutes" "Meeting minutes" 4
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "attachment" "Attachment" "General attachment" 5
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "reference" "Reference" "Reference material" 6
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== 5. ACTION PRIORITY ====================
echo ""
print_header "5. Action Priority Attribute"
echo ""

ATTRIBUTE_ID=$(create_attribute "action_priority" "Action Priority" "Priority levels for action items")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Priority Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "low" "Low" "Low priority - can be done when time permits" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "medium" "Medium" "Medium priority - standard timeline" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "high" "High" "High priority - needs attention soon" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "urgent" "Urgent" "Urgent - immediate attention required" 4
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== 6. PARTICIPANT LIST VISIBILITY ====================
echo ""
print_header "6. Participant List Visibility Attribute"
echo ""

ATTRIBUTE_ID=$(create_attribute "participant_list_visibility" "Participant List Visibility" "Visibility levels for participant lists")

if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "" ]; then
    ((TOTAL_ATTRIBUTES++))
    ((SUCCESS_ATTRIBUTES++))
    
    # Visibility Values
    echo "  Creating values..."
    create_attribute_value "$ATTRIBUTE_ID" "public" "Public" "Visible to all users" 1
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "private" "Private" "Visible only to creator" 2
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
    
    create_attribute_value "$ATTRIBUTE_ID" "team_only" "Team Only" "Visible only to team members" 3
    ((TOTAL_VALUES++)); ((SUCCESS_VALUES++))
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_header "SEEDING COMPLETE"
print_separator
echo ""

echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Attributes created: ${SUCCESS_ATTRIBUTES}/${TOTAL_ATTRIBUTES}"
echo "  • Attribute values created: ${SUCCESS_VALUES}/${TOTAL_VALUES}"
echo ""

echo -e "${CYAN}📋 Attributes Created:${NC}"
echo "  ✅ meeting_status - Meeting Status"
echo "  ✅ action_status - Action Status (Overall)"
echo "  ✅ individual_status - Individual Status (User Self-Reporting)"
echo "  ✅ document_type - Document Type"
echo "  ✅ action_priority - Action Priority"
echo "  ✅ participant_list_visibility - Participant List Visibility"
echo ""

echo -e "${CYAN}🔧 Next Steps:${NC}"
echo "  1. Run the menu seeder: ./app/db/seed/scripts/seed_menus.sh"
echo "  2. Run the users seeder: ./app/db/seed/scripts/seed_users.sh"
echo "  3. Start using the Action Tracker"
echo ""

print_separator
print_success "Attribute seeding completed successfully!"
print_separator