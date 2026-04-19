#!/bin/bash
# app/db/seed/scripts/seed_attributes.sh
# Seed Attribute data for Action Tracker (Electoral Commission)

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

print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }
print_header() { echo -e "${CYAN}📌 $1${NC}"; }
print_separator() { echo -e "${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"; }

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

# ==================== GET OR CREATE ATTRIBUTE GROUP ====================
print_info "Fetching Action Tracker attribute group..."

# Try to get existing group using the same method as seed_gender.sh
GROUP_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/?code=ACTION_TRACKER" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

# Handle paginated response
if echo "$GROUP_RESPONSE" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.items[0].id')
    print_success "Found existing Action Tracker group (ID: ${GROUP_ID:0:8}...)"
else
    print_info "Creating Action Tracker attribute group..."
    GROUP_CREATE_JSON=$(cat <<EOF
{
    "code": "ACTION_TRACKER",
    "name": "Action Tracker",
    "description": "Action Tracker application attributes",
    "allow_multiple": false,
    "is_required": false,
    "display_order": 10,
    "extra_metadata": {
        "icon": "track_changes",
        "color": "#3B82F6",
        "category": "application",
        "is_system": true
    }
}
EOF
)
    
    GROUP_CREATE_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_CREATE_JSON")
    
    GROUP_ID=$(echo "$GROUP_CREATE_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create attribute group"
        exit 1
    fi
    print_success "Action Tracker group created (ID: ${GROUP_ID:0:8}...)"
fi

# ==================== FUNCTION TO CREATE ATTRIBUTE ====================
create_attribute() {
    local code=$1
    local name=$2
    local description=$3
    local data_type=$4
    local options_json=$5
    local extra_metadata_json=$6
    local is_required=${7:-false}
    
    print_info "Creating attribute: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=ACTION_TRACKER&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        return 0
    fi
    
    # Build JSON payload
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "ACTION_TRACKER",
    "code": "${code}",
    "name": "${name}",
    "description": "${description}",
    "data_type": "${data_type}",
    "options": ${options_json},
    "extra_metadata": ${extra_metadata_json},
    "is_required": ${is_required},
    "display_order": 1
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    ATTRIBUTE_ID=$(echo "$RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -n "$ATTRIBUTE_ID" ] && [ "$ATTRIBUTE_ID" != "null" ]; then
        print_success "    ✅ Created (ID: ${ATTRIBUTE_ID:0:8}...)"
        return 0
    else
        ERROR_MSG=$(echo "$RESPONSE" | jq -r '.detail // .message // "Unknown error"' 2>/dev/null)
        print_error "    ❌ Failed: ${ERROR_MSG}"
        return 1
    fi
}

# ==================== CREATE ATTRIBUTES ====================
print_separator
print_header "Creating Attributes"
print_separator
echo ""

SUCCESS_COUNT=0
TOTAL_COUNT=0

# ==================== 1. MEETING STATUS ====================
echo ""
print_header "1. Meeting Status Attribute"
echo ""

OPTIONS='[
    {"value": "scheduled", "label": "Scheduled", "color": "#3B82F6", "icon": "event", "sort_order": 1},
    {"value": "ongoing", "label": "Ongoing", "color": "#F59E0B", "icon": "play_circle", "sort_order": 2},
    {"value": "completed", "label": "Completed", "color": "#10B981", "icon": "check_circle", "sort_order": 3},
    {"value": "cancelled", "label": "Cancelled", "color": "#EF4444", "icon": "cancel", "sort_order": 4},
    {"value": "postponed", "label": "Postponed", "color": "#8B5CF6", "icon": "pending", "sort_order": 5}
]'

EXTRA_METADATA='{
    "display_as": "badge",
    "filterable": true,
    "sortable": true,
    "category": "workflow",
    "default": "scheduled"
}'

create_attribute "MEETING_STATUS" "Meeting Status" "Status of meetings from scheduling to completion" "select" "$OPTIONS" "$EXTRA_METADATA" true && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 2. ACTION STATUS ====================
echo ""
print_header "2. Action Status Attribute (Overall)"
echo ""

OPTIONS='[
    {"value": "pending", "label": "Pending", "color": "#F59E0B", "icon": "pending", "sort_order": 1},
    {"value": "in_progress", "label": "In Progress", "color": "#3B82F6", "icon": "play_circle", "sort_order": 2},
    {"value": "completed", "label": "Completed", "color": "#10B981", "icon": "check_circle", "sort_order": 3},
    {"value": "overdue", "label": "Overdue", "color": "#EF4444", "icon": "warning", "sort_order": 4},
    {"value": "blocked", "label": "Blocked", "color": "#6B7280", "icon": "cancel", "sort_order": 5},
    {"value": "cancelled", "label": "Cancelled", "color": "#EF4444", "icon": "cancel", "sort_order": 6}
]'

EXTRA_METADATA='{
    "display_as": "badge",
    "filterable": true,
    "sortable": true,
    "category": "workflow",
    "default": "pending",
    "progress_mapping": {
        "pending": 0,
        "in_progress": 50,
        "completed": 100,
        "overdue": 0,
        "blocked": 0,
        "cancelled": 0
    }
}'

create_attribute "ACTION_STATUS" "Action Status" "Overall status of action items" "select" "$OPTIONS" "$EXTRA_METADATA" true && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 3. INDIVIDUAL STATUS ====================
echo ""
print_header "3. Individual Status Attribute (User Self-Reporting)"
echo ""

OPTIONS='[
    {"value": "not_started", "label": "Not Started", "color": "#9CA3AF", "icon": "pending", "sort_order": 1},
    {"value": "in_progress", "label": "In Progress", "color": "#3B82F6", "icon": "play_circle", "sort_order": 2},
    {"value": "blocked", "label": "Blocked", "color": "#EF4444", "icon": "warning", "sort_order": 3},
    {"value": "review", "label": "Ready for Review", "color": "#8B5CF6", "icon": "pending_actions", "sort_order": 4},
    {"value": "completed", "label": "Completed", "color": "#10B981", "icon": "check_circle", "sort_order": 5}
]'

EXTRA_METADATA='{
    "display_as": "badge",
    "filterable": true,
    "category": "self_reporting",
    "default": "not_started",
    "requires_comment": ["blocked"],
    "progress_mapping": {
        "not_started": 0,
        "in_progress": 25,
        "blocked": 0,
        "review": 90,
        "completed": 100
    }
}'

create_attribute "INDIVIDUAL_STATUS" "Individual Status" "User's self-reported status for assigned actions" "select" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 4. DOCUMENT TYPE GROUP ====================
echo ""
print_header "4. Document Type Group (Parent Attribute)"
echo ""

# This is the parent/group attribute for document types
OPTIONS='[]'  # No options, this is just a group

EXTRA_METADATA='{
    "display_as": "group",
    "filterable": true,
    "category": "document_management",
    "is_group": true,
    "children": ["DOC_TYPE_AGENDA", "DOC_TYPE_PRESENTATION", "DOC_TYPE_REPORT", "DOC_TYPE_MINUTES", "DOC_TYPE_ATTACHMENT", "DOC_TYPE_REFERENCE"]
}'

create_attribute "DOCUMENT_TYPE" "Document Type" "Document type category for meeting documents" "group" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 5. DOCUMENT TYPE - AGENDA ====================
echo ""
print_header "5. Document Type - Agenda"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "article",
    "color": "#3B82F6",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "doc", "docx"]
}'

create_attribute "DOC_TYPE_AGENDA" "Agenda" "Meeting agenda documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 6. DOCUMENT TYPE - PRESENTATION ====================
echo ""
print_header "6. Document Type - Presentation"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "slideshow",
    "color": "#8B5CF6",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "ppt", "pptx"]
}'

create_attribute "DOC_TYPE_PRESENTATION" "Presentation" "Presentation documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 7. DOCUMENT TYPE - REPORT ====================
echo ""
print_header "7. Document Type - Report"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "assessment",
    "color": "#10B981",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "doc", "docx", "xls", "xlsx"]
}'

create_attribute "DOC_TYPE_REPORT" "Report" "Report documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 8. DOCUMENT TYPE - MINUTES ====================
echo ""
print_header "8. Document Type - Minutes"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "description",
    "color": "#F59E0B",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "doc", "docx", "txt"]
}'

create_attribute "DOC_TYPE_MINUTES" "Minutes" "Meeting minutes documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 9. DOCUMENT TYPE - ATTACHMENT ====================
echo ""
print_header "9. Document Type - Attachment"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "attach_file",
    "color": "#6B7280",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "jpg", "png", "txt", "zip"]
}'

create_attribute "DOC_TYPE_ATTACHMENT" "Attachment" "General attachment documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 10. DOCUMENT TYPE - REFERENCE ====================
echo ""
print_header "10. Document Type - Reference"
echo ""

OPTIONS='[]'

EXTRA_METADATA='{
    "display_as": "chip",
    "icon": "menu_book",
    "color": "#EF4444",
    "category": "document_type",
    "parent_code": "DOCUMENT_TYPE",
    "allowed_extensions": ["pdf", "doc", "docx", "txt", "url"]
}'

create_attribute "DOC_TYPE_REFERENCE" "Reference" "Reference documents" "string" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 11. ACTION PRIORITY ====================
echo ""
print_header "11. Action Priority Attribute"
echo ""

OPTIONS='[
    {"value": "low", "label": "Low", "color": "#10B981", "icon": "arrow_downward", "days_to_complete": 14, "sort_order": 1},
    {"value": "medium", "label": "Medium", "color": "#F59E0B", "icon": "remove", "days_to_complete": 7, "sort_order": 2},
    {"value": "high", "label": "High", "color": "#EF4444", "icon": "arrow_upward", "days_to_complete": 3, "sort_order": 3},
    {"value": "urgent", "label": "Urgent", "color": "#7C3AED", "icon": "priority_high", "days_to_complete": 1, "sort_order": 4}
]'

EXTRA_METADATA='{
    "display_as": "badge",
    "filterable": true,
    "sortable": true,
    "category": "workflow",
    "default": "medium"
}'

create_attribute "ACTION_PRIORITY" "Action Priority" "Priority levels for action items" "select" "$OPTIONS" "$EXTRA_METADATA" true && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 12. PARTICIPANT LIST VISIBILITY ====================
echo ""
print_header "12. Participant List Visibility Attribute"
echo ""

OPTIONS='[
    {"value": "public", "label": "Public", "color": "#3B82F6", "icon": "public", "description": "Visible to all users", "sort_order": 1},
    {"value": "private", "label": "Private", "color": "#6B7280", "icon": "lock", "description": "Visible only to creator", "sort_order": 2},
    {"value": "team_only", "label": "Team Only", "color": "#8B5CF6", "icon": "group", "description": "Visible only to team members", "sort_order": 3}
]'

EXTRA_METADATA='{
    "display_as": "chip",
    "filterable": true,
    "category": "permissions",
    "default": "private"
}'

create_attribute "PARTICIPANT_LIST_VISIBILITY" "Participant List Visibility" "Visibility levels for participant lists" "select" "$OPTIONS" "$EXTRA_METADATA" true && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 13. NOTIFICATION TYPE ====================
echo ""
print_header "13. Notification Type Attribute"
echo ""

OPTIONS='[
    {"value": "email", "label": "Email", "icon": "email", "sort_order": 1},
    {"value": "in_app", "label": "In-App", "icon": "notifications", "sort_order": 2},
    {"value": "sms", "label": "SMS", "icon": "sms", "sort_order": 3},
    {"value": "webhook", "label": "Webhook", "icon": "webhook", "sort_order": 4}
]'

EXTRA_METADATA='{
    "display_as": "chip",
    "filterable": true,
    "category": "notifications",
    "default": "email"
}'

create_attribute "NOTIFICATION_TYPE" "Notification Type" "Types of notifications sent to users" "select" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== 14. RECURRENCE PATTERN ====================
echo ""
print_header "14. Recurrence Pattern Attribute"
echo ""

OPTIONS='[
    {"value": "none", "label": "None", "icon": "close", "sort_order": 1},
    {"value": "daily", "label": "Daily", "icon": "today", "sort_order": 2},
    {"value": "weekly", "label": "Weekly", "icon": "calendar_view_week", "sort_order": 3},
    {"value": "monthly", "label": "Monthly", "icon": "calendar_month", "sort_order": 4},
    {"value": "quarterly", "label": "Quarterly", "icon": "calendar_today", "sort_order": 5},
    {"value": "yearly", "label": "Yearly", "icon": "event", "sort_order": 6}
]'

EXTRA_METADATA='{
    "display_as": "select",
    "category": "scheduling",
    "default": "none"
}'

create_attribute "RECURRENCE_PATTERN" "Recurrence Pattern" "Recurrence pattern for recurring meetings" "select" "$OPTIONS" "$EXTRA_METADATA" false && ((SUCCESS_COUNT++))
((TOTAL_COUNT++))

# ==================== SUMMARY ====================
echo ""
print_separator
print_header "SEEDING COMPLETE"
print_separator
echo ""

echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Attributes processed: ${SUCCESS_COUNT}/${TOTAL_COUNT}"
echo ""

echo -e "${CYAN}📋 Attributes Created:${NC}"
echo "  ✅ MEETING_STATUS - Meeting Status"
echo "  ✅ ACTION_STATUS - Action Status"
echo "  ✅ INDIVIDUAL_STATUS - Individual Status"
echo "  ✅ DOCUMENT_TYPE - Document Type (Group/Parent)"
echo "  ✅ DOC_TYPE_AGENDA - Agenda"
echo "  ✅ DOC_TYPE_PRESENTATION - Presentation"
echo "  ✅ DOC_TYPE_REPORT - Report"
echo "  ✅ DOC_TYPE_MINUTES - Minutes"
echo "  ✅ DOC_TYPE_ATTACHMENT - Attachment"
echo "  ✅ DOC_TYPE_REFERENCE - Reference"
echo "  ✅ ACTION_PRIORITY - Action Priority"
echo "  ✅ PARTICIPANT_LIST_VISIBILITY - Participant List Visibility"
echo "  ✅ NOTIFICATION_TYPE - Notification Type"
echo "  ✅ RECURRENCE_PATTERN - Recurrence Pattern"
echo ""

if [ $SUCCESS_COUNT -eq $TOTAL_COUNT ]; then
    print_success "All attributes seeded successfully!"
else
    print_warning "Some attributes failed to seed. Please check the errors above."
fi

print_separator