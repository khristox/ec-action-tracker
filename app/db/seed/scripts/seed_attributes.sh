#!/bin/bash
# app/db/seed/scripts/seed_attributes.sh
# Seed Action Tracker Attributes (Meeting Status, Action Status, etc.)
# Usage: ./seed_attributes.sh [BASE_URL] [USERNAME] [PASSWORD]

# ==================== CONFIGURATION ====================
DEFAULT_BASE_URL="http://127.0.0.1:8001"
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
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=${USERNAME}&password=${PASSWORD}")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
    print_error "Authentication failed"
    exit 1
fi
print_success "Authenticated"

# ==================== CREATE ACTION TRACKER GROUP ====================
print_info "Creating Action Tracker group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "ACTION_TRACKER",
    "name": "Action Tracker",
    "description": "Attributes for Action Tracker system (Meeting Status, Action Status, Document Types, etc.)",
    "allow_multiple": true,
    "is_required": false,
    "display_order": 5,
    "extra_metadata": {
        "icon": "track_changes",
        "color": "#2196F3",
        "public": true,
        "category": "action_tracker"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s -X GET "${API_URL}/attribute-groups/?code=ACTION_TRACKER" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Action Tracker group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Action Tracker group, continuing..."
        GROUP_ID="UNKNOWN"
    else
        print_success "Action Tracker group created (ID: $GROUP_ID)"
    fi
fi

# ==================== ATTRIBUTE DATA ====================
ATTRIBUTES=(
    "MEETING_STATUS_PENDING:Meeting Status - Pending:PENDING:1:#FFC107:schedule:Meeting scheduled but not started"
    "MEETING_STATUS_STARTED:Meeting Status - Started:STARTED:2:#2196F3:play_circle:Meeting in progress"
    "MEETING_STATUS_ENDED:Meeting Status - Ended:ENDED:3:#9E9E9E:stop_circle:Meeting ended"
    "MEETING_STATUS_AWAITING_ACTION:Meeting Status - Awaiting Action:AWAITING:4:#FF9800:pending_actions:Meeting completed, awaiting action items"
    "MEETING_STATUS_CLOSED:Meeting Status - Closed:CLOSED:5:#4CAF50:check_circle:Meeting fully completed and closed"
    "MEETING_STATUS_CANCELLED:Meeting Status - Cancelled:CANCELLED:6:#F44336:cancel:Meeting cancelled"

    "ACTION_STATUS_PENDING:Action Status - Pending:PENDING:10:#FFC107:pending:Action not yet started"
    "ACTION_STATUS_IN_PROGRESS:Action Status - In Progress:IN_PROGRESS:11:#2196F3:play_arrow:Action being worked on"
    "ACTION_STATUS_COMPLETED:Action Status - Completed:COMPLETED:12:#4CAF50:check_circle:Action completed"
    "ACTION_STATUS_OVERDUE:Action Status - Overdue:OVERDUE:13:#F44336:warning:Action past due date"
    "ACTION_STATUS_BLOCKED:Action Status - Blocked:BLOCKED:14:#9C27B0:block:Action blocked by dependency"
    "ACTION_STATUS_CANCELLED:Action Status - Cancelled:CANCELLED:15:#757575:cancel:Action cancelled"

    "INDIVIDUAL_NOT_STARTED:Individual Status - Not Started:NOT_STARTED:20:#9E9E9E:fiber_new:Haven't started yet"
    "INDIVIDUAL_IN_PROGRESS:Individual Status - In Progress:IN_PROGRESS:21:#2196F3:play_arrow:Actively working on it"
    "INDIVIDUAL_BLOCKED:Individual Status - Blocked:BLOCKED:22:#F44336:block:Stuck, need assistance"
    "INDIVIDUAL_REVIEW:Individual Status - Ready for Review:REVIEW:23:#FF9800:rate_review:Completed, awaiting review"
    "INDIVIDUAL_COMPLETED:Individual Status - Completed:COMPLETED:24:#4CAF50:check_circle:Fully completed"

    "DOC_TYPE_AGENDA:Document Type - Agenda:AGENDA:30:#2196F3:menu_book:Meeting agenda document"
    "DOC_TYPE_PRESENTATION:Document Type - Presentation:PRESENTATION:31:#9C27B0:slideshow:Presentation slides"
    "DOC_TYPE_REPORT:Document Type - Report:REPORT:32:#FF9800:assessment:Meeting report"
    "DOC_TYPE_MINUTES:Document Type - Minutes:MINUTES:33:#4CAF50:description:Meeting minutes"
    "DOC_TYPE_ATTACHMENT:Document Type - Attachment:ATTACHMENT:34:#607D8B:attach_file:General attachment"
    "DOC_TYPE_REFERENCE:Document Type - Reference:REFERENCE:35:#795548:reference:Reference material"

    "PRIORITY_LOW:Priority - Low:LOW:40:#4CAF50:low_priority:Low priority - can be done when time permits"
    "PRIORITY_MEDIUM:Priority - Medium:MEDIUM:41:#FFC107:medium_priority:Medium priority - standard timeline"
    "PRIORITY_HIGH:Priority - High:HIGH:42:#FF9800:high_priority:High priority - needs attention soon"
    "PRIORITY_URGENT:Priority - Urgent:URGENT:43:#F44336:urgent:Urgent - immediate attention required"

    "VISIBILITY_PUBLIC:Visibility - Public:PUBLIC:50:#4CAF50:public:Visible to all users"
    "VISIBILITY_PRIVATE:Visibility - Private:PRIVATE:51:#9E9E9E:lock:Visible only to creator"
    "VISIBILITY_TEAM_ONLY:Visibility - Team Only:TEAM_ONLY:52:#2196F3:group:Visible only to team members"
)

# ==================== CREATE ATTRIBUTES WITH RETRY ====================
print_info "Creating Action Tracker attributes..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL=${#ATTRIBUTES[@]}
RETRIES=3

for attribute in "${ATTRIBUTES[@]}"; do
    IFS=':' read -r code name short_name sort_order color icon description <<< "$attribute"
    
    print_info "Processing: ${name} (${code})..."
    
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=ACTION_TRACKER&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi

    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "ACTION_TRACKER",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "icon": "${icon}",
        "color": "${color}",
        "description": "${description}",
        "status": "active"
    }
}
EOF
)

    success=false
    for attempt in $(seq 1 $RETRIES); do
        RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$ATTRIBUTE_JSON")
        
        if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
            ATTRIBUTE_ID=$(echo "$RESPONSE" | jq -r '.id')
            print_success "  ✅ Created: ${name} (${code}) - ${description}"
            ((SUCCESS_COUNT++))
            success=true
            break
        else
            ERROR=$(echo "$RESPONSE" | jq -r '.error.message // .detail // "Unknown error"')
            print_warning "  ⚠️ Attempt $attempt failed: ${ERROR}"
            sleep 0.5
        fi
    done

    if [ "$success" = false ]; then
        print_error "  ❌ Failed after $RETRIES attempts: ${name} (${code})"
        ((FAIL_COUNT++))
    fi

    sleep 0.2
done

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying Action Tracker group..."
sleep 2

VERIFY_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/ACTION_TRACKER/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    
    if [ "$ATTRIBUTE_COUNT" -gt 0 ]; then
        print_success "Found ${ATTRIBUTE_COUNT} attributes in Action Tracker group"
        
        echo ""
        echo -e "${BLUE}📋 Attributes by Category:${NC}"
        echo ""
        for category in "MEETING_STATUS" "ACTION_STATUS" "INDIVIDUAL" "DOC_TYPE" "PRIORITY" "VISIBILITY"; do
            echo -e "${YELLOW}${category//_/ }:${NC}"
            echo "$VERIFY_RESPONSE" | jq -r ".items[] | select(.code | startswith(\"$category\")) | \"  • \(.name) - \(.extra_metadata.description)\""
            echo ""
        done
    else
        print_warning "No attributes found"
    fi
else
    print_warning "Could not retrieve attributes"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Action Tracker attributes setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total attributes: ${TOTAL}"
echo "  • Successfully created: ${SUCCESS_COUNT}"
echo "  • Already existed: ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Failed: ${FAIL_COUNT}"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get all Action Tracker attributes"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/ACTION_TRACKER/attributes\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, extra_metadata}'"
echo ""
print_separator