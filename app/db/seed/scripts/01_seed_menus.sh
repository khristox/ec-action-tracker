#!/bin/bash
# app/db/seed/scripts/seed_menus.sh
# Seed Menu system for Action Tracker (Electoral Commission)
# Hierarchical structure with role-based permissions

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
print_header "ACTION TRACKER MENU SYSTEM SEEDER"
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

# ==================== GET ROLES FROM DATABASE ====================
print_info "Fetching roles from database..."

ROLES_RESPONSE=$(curl -s -X GET "${API_URL}/roles/?skip=0&limit=100" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

declare -A ROLE_IDS
declare -A ROLE_NAMES

while IFS= read -r line; do
    code=$(echo "$line" | jq -r '.code')
    id=$(echo "$line" | jq -r '.id')
    name=$(echo "$line" | jq -r '.name')
    ROLE_IDS["$code"]="$id"
    ROLE_NAMES["$code"]="$name"
done < <(echo "$ROLES_RESPONSE" | jq -c '.[]')

echo ""
print_info "Roles found in database:"
for code in "${!ROLE_IDS[@]}"; do
    print_success "  ✅ ${code}: ${ROLE_IDS[$code]:0:8}... (${ROLE_NAMES[$code]})"
done
echo ""

# ==================== CREATE MENUS IN ORDER (PARENTS FIRST) ====================
print_info "Creating Action Tracker menus (parents first, then children)..."
echo ""

declare -A MENU_IDS
SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Function to get menu ID by code
get_menu_id() {
    local menu_code=$1
    EXISTING_RESPONSE=$(curl -s -X GET "${API_URL}/menus/all" \
        -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)
    echo "$EXISTING_RESPONSE" | jq -r ".[] | select(.code==\"${menu_code}\") | .id" 2>/dev/null
}

# Function to create a menu
create_menu() {
    local code=$1
    local title=$2
    local icon=$3
    local path=$4
    local sort_order=$5
    local parent_code=$6
    
    # Check if menu already exists
    EXISTING_ID=$(get_menu_id "$code")
    if [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "null" ]; then
        print_warning "  ⏭️  Already exists: ${title} (${code})"
        MENU_IDS["$code"]="$EXISTING_ID"
        ((SKIP_COUNT++))
        return 0
    fi
    
    print_info "  Creating: ${title} (${code})..."
    
    # Get parent ID if parent_code provided
    PARENT_ID="null"
    if [ -n "$parent_code" ] && [ "$parent_code" != "" ]; then
        PARENT_ID="${MENU_IDS[$parent_code]}"
        if [ -z "$PARENT_ID" ] || [ "$PARENT_ID" == "null" ]; then
            print_error "    ❌ Parent '${parent_code}' not found! Cannot create child menu."
            ((FAIL_COUNT++))
            return 1
        fi
    fi
    
    # Handle path
    if [ -z "$path" ] || [ "$path" == "" ]; then
        path_value="null"
    else
        path_value="\"$path\""
    fi
    
    # Build JSON payload
    if [ "$PARENT_ID" != "null" ]; then
        JSON_PAYLOAD=$(cat <<EOF
{
    "code": "${code}",
    "title": "${title}",
    "icon": "${icon}",
    "path": ${path_value},
    "sort_order": ${sort_order},
    "parent_id": "${PARENT_ID}"
}
EOF
)
    else
        JSON_PAYLOAD=$(cat <<EOF
{
    "code": "${code}",
    "title": "${title}",
    "icon": "${icon}",
    "path": ${path_value},
    "sort_order": ${sort_order}
}
EOF
)
    fi
    
    RESPONSE=$(curl -s -X POST "${API_URL}/menus/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    MENU_ID=$(echo "$RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -n "$MENU_ID" ] && [ "$MENU_ID" != "null" ]; then
        print_success "    ✅ Created (ID: ${MENU_ID:0:8}...)"
        MENU_IDS["$code"]="$MENU_ID"
        ((SUCCESS_COUNT++))
        return 0
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // .message // "Unknown error"' 2>/dev/null)
        print_error "    ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
        return 1
    fi
}

# ==================== STEP 1: Create ROOT MENUS (no parents) ====================
print_info "STEP 1: Creating root menus for Action Tracker..."
echo ""

# Core Action Tracker Menus
create_menu "dashboard" "Dashboard" "Dashboard" "/dashboard" 1 ""
create_menu "meetings" "Meetings" "Event" "/meetings" 2 ""
create_menu "actions" "Actions" "Assignment" "/actions" 3 ""
create_menu "participants" "Participants" "People" "/participants" 4 ""
create_menu "documents" "Documents" "Folder" "/documents" 5 ""
create_menu "reports" "Reports" "Assessment" "/reports" 6 ""
create_menu "calendar" "Calendar" "Calendar" "/calendar" 7 ""
create_menu "settings" "Settings" "Settings" "" 99 ""

echo ""

# ==================== STEP 2: Create MEETINGS SUBMENUS ====================
print_info "STEP 2: Creating Meetings submenus (parent: meetings)..."
echo ""

if [ -n "${MENU_IDS["meetings"]}" ]; then
    create_menu "meetings-list" "All Meetings" "List" "/meetings" 1 "meetings"
    create_menu "meetings-create" "Create Meeting" "Add" "/meetings/create" 2 "meetings"
    create_menu "meetings-minutes" "Meeting Minutes" "Description" "/meetings/minutes" 3 "meetings"
    create_menu "meetings-participants" "Meeting Participants" "People" "/meetings/participants" 4 "meetings"
else
    print_error "Parent 'meetings' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 3: Create ACTIONS SUBMENUS ====================
print_info "STEP 3: Creating Actions submenus (parent: actions)..."
echo ""

if [ -n "${MENU_IDS["actions"]}" ]; then
    create_menu "my-tasks" "My Tasks" "Task" "/actions/my-tasks" 1 "actions"
    create_menu "all-actions" "All Actions" "List" "/actions/all" 2 "actions"
    create_menu "overdue-actions" "Overdue Actions" "Warning" "/actions/overdue" 3 "actions"
    create_menu "action-assign" "Assign Actions" "Assignment" "/actions/assign" 4 "actions"
    create_menu "action-progress" "Progress Updates" "TrendingUp" "/actions/progress" 5 "actions"
else
    print_error "Parent 'actions' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 4: Create PARTICIPANTS SUBMENUS ====================
print_info "STEP 4: Creating Participants submenus (parent: participants)..."
echo ""

if [ -n "${MENU_IDS["participants"]}" ]; then
    create_menu "participants-list" "All Participants" "List" "/participants" 1 "participants"
    create_menu "participant-lists" "Participant Lists" "Group" "/participants/lists" 2 "participants"
    create_menu "participants-create" "Add Participant" "PersonAdd" "/participants/create" 3 "participants"
else
    print_error "Parent 'participants' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 5: Create DOCUMENTS SUBMENUS ====================
print_info "STEP 5: Creating Documents submenus (parent: documents)..."
echo ""

if [ -n "${MENU_IDS["documents"]}" ]; then
    create_menu "documents-all" "All Documents" "Folder" "/documents" 1 "documents"
    create_menu "documents-agendas" "Agendas" "Article" "/documents/agendas" 2 "documents"
    create_menu "documents-minutes" "Minutes" "Description" "/documents/minutes" 3 "documents"
    create_menu "documents-reports" "Reports" "Assessment" "/documents/reports" 4 "documents"
else
    print_error "Parent 'documents' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 6: Create REPORTS SUBMENUS ====================
print_info "STEP 6: Creating Reports submenus (parent: reports)..."
echo ""

if [ -n "${MENU_IDS["reports"]}" ]; then
    create_menu "reports-meetings" "Meeting Reports" "Event" "/reports/meetings" 1 "reports"
    create_menu "reports-actions" "Action Reports" "Assignment" "/reports/actions" 2 "reports"
    create_menu "reports-participants" "Participant Reports" "People" "/reports/participants" 3 "reports"
    create_menu "reports-export" "Export Data" "Download" "/reports/export" 4 "reports"
else
    print_error "Parent 'reports' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 7: Create SETTINGS SUBMENUS ====================
print_info "STEP 7: Creating Settings submenus (parent: settings)..."
echo ""

if [ -n "${MENU_IDS["settings"]}" ]; then
    # User Profile & Account Settings (All users)
    create_menu "profile" "Profile" "Person" "/settings/profile" 1 "settings"
    create_menu "security" "Security" "Security" "/settings/security" 2 "settings"
    create_menu "notifications" "Notifications" "Notifications" "/settings/notifications" 3 "settings"
    create_menu "preferences" "Preferences" "Tune" "/settings/preferences" 4 "settings"
    
    # System Administration (Admin only)
    create_menu "users" "User Management" "People" "/settings/users" 10 "settings"
    create_menu "roles" "Role Management" "Badge" "/settings/roles" 11 "settings"
    create_menu "audit" "Audit Logs" "History" "/settings/audit" 12 "settings"
    
    # Action Tracker Specific Settings
    create_menu "status-config" "Status Configuration" "Settings" "/settings/status" 15 "settings"
    create_menu "document-types" "Document Types" "Folder" "/settings/document-types" 16 "settings"
else
    print_error "Parent 'settings' not found! Cannot create submenus."
fi

echo ""
print_info "Menu creation summary: Created: $SUCCESS_COUNT, Skipped: $SKIP_COUNT, Failed: $FAIL_COUNT"
echo ""

# ==================== DEFINE MOBILE BOTTOM NAVIGATION VISIBILITY ====================
# Function to determine if a menu should show on mobile bottom nav for a specific role
should_show_mb_bottom() {
    local role_code=$1
    local menu_code=$2
    
    case "$role_code" in
        "admin"|"super_admin")
            # Admin sees main navigation menus on bottom
            case "$menu_code" in
                "dashboard"|"meetings"|"actions"|"calendar")
                    echo "true"
                    ;;
                *)
                    echo "false"
                    ;;
            esac
            ;;
        "meeting_creator"|"meeting_participant")
            case "$menu_code" in
                "dashboard"|"meetings"|"actions"|"calendar")
                    echo "true"
                    ;;
                *)
                    echo "false"
                    ;;
            esac
            ;;
        "action_assigner"|"action_owner"|"action_viewer")
            case "$menu_code" in
                "dashboard"|"actions"|"meetings"|"calendar")
                    echo "true"
                    ;;
                *)
                    echo "false"
                    ;;
            esac
            ;;
        "participant_manager")
            case "$menu_code" in
                "dashboard"|"participants"|"meetings"|"calendar")
                    echo "true"
                    ;;
                *)
                    echo "false"
                    ;;
            esac
            ;;
        "user")
            case "$menu_code" in
                "dashboard"|"meetings"|"actions"|"calendar")
                    echo "true"
                    ;;
                *)
                    echo "false"
                    ;;
            esac
            ;;
        *)
            echo "false"
            ;;
    esac
}

# ==================== ASSIGN MENU PERMISSIONS TO ROLES ====================
print_separator
print_info "Assigning menu permissions to roles..."
print_separator
echo ""

# Define role menu permissions for Action Tracker
declare -A ROLE_MENUS

# Admin & Super Admin - Full access to everything
ROLE_MENUS["admin"]="dashboard,meetings,meetings-list,meetings-create,meetings-minutes,meetings-participants,actions,my-tasks,all-actions,overdue-actions,action-assign,action-progress,participants,participants-list,participant-lists,participants-create,documents,documents-all,documents-agendas,documents-minutes,documents-reports,reports,reports-meetings,reports-actions,reports-participants,reports-export,calendar,settings,profile,security,notifications,preferences,users,roles,audit,status-config,document-types"
ROLE_MENUS["super_admin"]="dashboard,meetings,meetings-list,meetings-create,meetings-minutes,meetings-participants,actions,my-tasks,all-actions,overdue-actions,action-assign,action-progress,participants,participants-list,participant-lists,participants-create,documents,documents-all,documents-agendas,documents-minutes,documents-reports,reports,reports-meetings,reports-actions,reports-participants,reports-export,calendar,settings,profile,security,notifications,preferences,users,roles,audit,status-config,document-types"

# Meeting Creator - Full meeting management
ROLE_MENUS["meeting_creator"]="dashboard,meetings,meetings-list,meetings-create,meetings-minutes,meetings-participants,actions,my-tasks,participants,participants-list,participant-lists,documents,documents-all,calendar,settings,profile,security,notifications"

# Meeting Participant - View meetings only
ROLE_MENUS["meeting_participant"]="dashboard,meetings,meetings-list,meetings-minutes,actions,my-tasks,documents,documents-all,calendar,settings,profile,security,notifications"

# Action Assigner - Create and assign actions
ROLE_MENUS["action_assigner"]="dashboard,meetings,meetings-list,actions,all-actions,action-assign,action-progress,participants,participants-list,reports,reports-actions,calendar,settings,profile,security,notifications"

# Action Owner - Complete assigned actions
ROLE_MENUS["action_owner"]="dashboard,meetings,meetings-list,actions,my-tasks,action-progress,calendar,settings,profile,security,notifications"

# Action Viewer - Monitor action status
ROLE_MENUS["action_viewer"]="dashboard,meetings,meetings-list,actions,all-actions,reports,reports-actions,calendar,settings,profile,security,notifications"

# Participant Manager - Manage participant lists
ROLE_MENUS["participant_manager"]="dashboard,participants,participants-list,participant-lists,participants-create,meetings,meetings-list,meetings-participants,calendar,settings,profile,security,notifications"

# Document Manager - Manage documents
ROLE_MENUS["document_manager"]="dashboard,documents,documents-all,documents-agendas,documents-minutes,documents-reports,meetings,meetings-list,calendar,settings,profile,security,notifications"

# Report Viewer - View reports
ROLE_MENUS["report_viewer"]="dashboard,reports,reports-meetings,reports-actions,reports-participants,reports-export,calendar,settings,profile,security,notifications"

# Basic User - Limited access
ROLE_MENUS["user"]="dashboard,meetings,meetings-list,actions,my-tasks,calendar,settings,profile,security,notifications"

PERMISSION_SUCCESS=0
PERMISSION_FAIL=0

for role_code in "${!ROLE_MENUS[@]}"; do
    ROLE_ID="${ROLE_IDS[$role_code]}"
    
    if [ -z "$ROLE_ID" ]; then
        print_warning "Role '$role_code' not found, skipping"
        continue
    fi
    
    print_info "Processing role: ${role_code} (${ROLE_NAMES[$role_code]}) - ID: ${ROLE_ID:0:8}..."
    
    # Collect menu IDs
    MENU_IDS_LIST=()
    IFS=',' read -ra MENU_CODES <<< "${ROLE_MENUS[$role_code]}"
    
    for menu_code in "${MENU_CODES[@]}"; do
        MENU_ID="${MENU_IDS[$menu_code]}"
        if [ -n "$MENU_ID" ] && [ "$MENU_ID" != "null" ]; then
            MENU_IDS_LIST+=("$MENU_ID")
        else
            print_warning "  Menu '${menu_code}' not found"
        fi
    done
    
    if [ ${#MENU_IDS_LIST[@]} -eq 0 ]; then
        print_warning "  No menus found for role ${role_code}"
        continue
    fi
    
    # Assign permissions with can_show_mb_bottom
    local_success=0
    for idx in "${!MENU_IDS_LIST[@]}"; do
        MENU_ID="${MENU_IDS_LIST[$idx]}"
        MENU_CODE="${MENU_CODES[$idx]}"
        
        # Determine if this menu should show on mobile bottom navigation for this role
        SHOW_MB_BOTTOM=$(should_show_mb_bottom "$role_code" "$MENU_CODE")
        
        PERM_JSON=$(cat <<EOF
{
    "role_id": "${ROLE_ID}",
    "menu_id": "${MENU_ID}",
    "can_view": true,
    "can_access": true,
    "can_show_mb_bottom": ${SHOW_MB_BOTTOM}
}
EOF
)
        
        RESPONSE=$(curl -s -X POST "${API_URL}/menus/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$PERM_JSON")
        
        if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
            ((local_success++))
            if [ "$SHOW_MB_BOTTOM" = "true" ]; then
                echo "    📱 ${MENU_CODE} will show on mobile bottom nav"
            fi
        else
            ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"' 2>/dev/null)
            print_warning "    Failed to assign ${MENU_CODE}: ${ERROR}"
        fi
    done
    
    if [ $local_success -eq ${#MENU_IDS_LIST[@]} ]; then
        print_success "  ✅ Assigned all ${local_success} menus to ${role_code}"
        ((PERMISSION_SUCCESS++))
    else
        print_warning "  ⚠️ Assigned ${local_success}/${#MENU_IDS_LIST[@]} menus to ${role_code}"
        ((PERMISSION_FAIL++))
    fi
    echo ""
done

# ==================== VERIFICATION ====================
echo ""
print_separator
print_info "Verifying Action Tracker menu system..."
print_separator
echo ""

# Test menu retrieval for admin
print_info "Testing admin menu access..."
ADMIN_MENUS=$(curl -s -X GET "${API_URL}/menus/" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

ADMIN_COUNT=$(echo "$ADMIN_MENUS" | jq 'length' 2>/dev/null)

if [ -n "$ADMIN_COUNT" ] && [ "$ADMIN_COUNT" -gt 0 ]; then
    print_success "Admin can access ${ADMIN_COUNT} root menus"
    
    echo ""
    echo -e "${CYAN}📋 Action Tracker Menu Structure:${NC}"
    echo "$ADMIN_MENUS" | jq -r '
    def display(level):
        .[] | 
        "  " * level + "📁 " + .title + 
        (if .path then " → " + .path else "" end),
        (if .children and (.children | length) > 0 then .children | display(level + 1) else empty end);
    display(0)' 2>/dev/null
else
    print_warning "No menus retrieved for admin"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Action Tracker Menu System Setup Completed!"
print_separator
echo ""

echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Root menus created: $(echo "$ADMIN_MENUS" | jq '[.[] | select(.parent_id == null)] | length' 2>/dev/null)"
echo "  • Total menus in database: $(echo "$ADMIN_MENUS" | jq 'length' 2>/dev/null)"
echo "  • Menus created this run: ${SUCCESS_COUNT}"
echo "  • Menus skipped: ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Menus failed: ${FAIL_COUNT}"
echo "  • Roles with permissions: ${PERMISSION_SUCCESS}"
echo ""

echo -e "${CYAN}📱 Mobile Bottom Navigation by Role:${NC}"
echo "  • Admin: Dashboard, Meetings, Actions, Calendar"
echo "  • Meeting Creator: Dashboard, Meetings, Actions, Calendar"
echo "  • Meeting Participant: Dashboard, Meetings, Actions, Calendar"
echo "  • Action Assigner: Dashboard, Actions, Meetings, Calendar"
echo "  • Action Owner: Dashboard, Actions (My Tasks), Calendar"
echo "  • Action Viewer: Dashboard, Actions, Calendar"
echo "  • Participant Manager: Dashboard, Participants, Meetings, Calendar"
echo "  • User: Dashboard, Meetings, Actions, Calendar"
echo ""

echo -e "${CYAN}🧪 Test Commands:${NC}"
echo ""
echo "  # Get menus for admin"
echo "  curl -X GET \"${API_URL}/menus/\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.[] | {title, path}'"
echo ""
echo "  # Get all menus"
echo "  curl -X GET \"${API_URL}/menus/all\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.[] | {code, title}'"
echo ""

print_separator
print_success "Action Tracker menu system seeding completed successfully!"
print_separator