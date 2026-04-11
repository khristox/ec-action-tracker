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

# ==================== GET EXISTING MENUS ====================
print_info "Fetching existing menus to determine replacements..."

EXISTING_MENUS_RESPONSE=$(curl -s -X GET "${API_URL}/menus/all" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)

declare -A EXISTING_MENU_IDS
while IFS= read -r line; do
    code=$(echo "$line" | jq -r '.code')
    id=$(echo "$line" | jq -r '.id')
    if [ -n "$code" ] && [ "$code" != "null" ]; then
        EXISTING_MENU_IDS["$code"]="$id"
    fi
done < <(echo "$EXISTING_MENUS_RESPONSE" | jq -c '.[]' 2>/dev/null)

print_info "Found ${#EXISTING_MENU_IDS[@]} existing menus in database"
echo ""

# ==================== CREATE OR REPLACE MENUS ====================
print_info "Creating/Replacing Action Tracker menus..."
echo ""

declare -A MENU_IDS
SUCCESS_COUNT=0
FAIL_COUNT=0
UPDATE_COUNT=0
CREATE_COUNT=0
SKIP_COUNT=0

# Function to delete existing menu if REPLACE mode is enabled
delete_existing_menu() {
    local menu_code=$1
    local menu_id=${EXISTING_MENU_IDS["$menu_code"]}
    
    if [ -n "$menu_id" ] && [ "$menu_id" != "null" ]; then
        print_warning "  Deleting existing menu: ${menu_code} (ID: ${menu_id:0:8}...)"
        
        # First delete all permissions for this menu
        curl -s -X DELETE "${API_URL}/menus/${menu_id}/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
        
        # Then delete the menu
        DELETE_RESPONSE=$(curl -s -X DELETE "${API_URL}/menus/${menu_id}" \
            -H "Authorization: Bearer $ADMIN_TOKEN")
        
        if echo "$DELETE_RESPONSE" | jq -e '.detail' > /dev/null 2>&1; then
            print_error "    Failed to delete: $(echo "$DELETE_RESPONSE" | jq -r '.detail')"
            return 1
        else
            print_success "    Deleted successfully"
            unset EXISTING_MENU_IDS["$menu_code"]
            return 0
        fi
    fi
    return 0
}

# Function to create or update a menu
create_or_replace_menu() {
    local code=$1
    local title=$2
    local icon=$3
    local path=$4
    local sort_order=$5
    local parent_code=$6
    local replace=${7:-true}  # Default to true to replace existing
    
    # Check if menu already exists
    EXISTING_ID="${EXISTING_MENU_IDS[$code]}"
    
    # If replace is true and menu exists, delete it first
    if [ "$replace" = "true" ] && [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "null" ]; then
        print_info "  Replacing: ${title} (${code})..."
        delete_existing_menu "$code"
        if [ $? -ne 0 ]; then
            ((FAIL_COUNT++))
            return 1
        fi
        ((UPDATE_COUNT++))
    elif [ -n "$EXISTING_ID" ] && [ "$EXISTING_ID" != "null" ]; then
        print_warning "  ⏭️  Keeping existing: ${title} (${code})"
        MENU_IDS["$code"]="$EXISTING_ID"
        ((SKIP_COUNT++))
        return 0
    else
        print_info "  Creating: ${title} (${code})..."
    fi
    
    # Get parent ID if parent_code provided
    PARENT_ID="null"
    if [ -n "$parent_code" ] && [ "$parent_code" != "" ]; then
        PARENT_ID="${MENU_IDS[$parent_code]}"
        if [ -z "$PARENT_ID" ] || [ "$PARENT_ID" == "null" ]; then
            # Check if parent exists in existing menus
            PARENT_ID="${EXISTING_MENU_IDS[$parent_code]}"
        fi
        if [ -z "$PARENT_ID" ] || [ "$PARENT_ID" == "null" ]; then
            print_error "    ❌ Parent '${parent_code}' not found! Cannot create child menu."
            ((FAIL_COUNT++))
            return 1
        fi
    fi
    
    # Handle path - ensure relative path (no leading slash if empty)
    if [ -z "$path" ] || [ "$path" == "" ]; then
        path_value="null"
    else
        # Ensure path is relative (remove leading slash if present)
        path="${path#/}"
        path_value="\"${path}\""
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
        ((CREATE_COUNT++))
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

# Core Action Tracker Menus with RELATIVE PATHS (using underscores, no hyphens)
create_or_replace_menu "dashboard" "Dashboard" "Dashboard" "dashboard" 1 "" true
create_or_replace_menu "meetings" "Meetings" "Event" "meetings" 2 "" true
create_or_replace_menu "actions" "Actions" "Assignment" "actions" 3 "" true
create_or_replace_menu "participants" "Participants" "People" "participants" 4 "" true
create_or_replace_menu "documents" "Documents" "Folder" "documents" 5 "" true
create_or_replace_menu "reports" "Reports" "Assessment" "reports" 6 "" true
create_or_replace_menu "calendar" "Calendar" "Calendar" "calendar" 7 "" true
create_or_replace_menu "settings" "Settings" "Settings" "" 99 "" true

echo ""

# ==================== STEP 2: Create MEETINGS SUBMENUS ====================
print_info "STEP 2: Creating Meetings submenus (parent: meetings)..."
echo ""

if [ -n "${MENU_IDS["meetings"]}" ] || [ -n "${EXISTING_MENU_IDS["meetings"]}" ]; then
    create_or_replace_menu "meetings_list" "All Meetings" "List" "meetings" 1 "meetings" true
    create_or_replace_menu "meetings_create" "Create Meeting" "Add" "meetings/create" 2 "meetings" true
    create_or_replace_menu "meetings_minutes" "Meeting Minutes" "Description" "meetings/minutes" 3 "meetings" true
    create_or_replace_menu "meetings_participants" "Meeting Participants" "People" "meetings/participants" 4 "meetings" true
else
    print_error "Parent 'meetings' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 3: Create ACTIONS SUBMENUS ====================
print_info "STEP 3: Creating Actions submenus (parent: actions)..."
echo ""

if [ -n "${MENU_IDS["actions"]}" ] || [ -n "${EXISTING_MENU_IDS["actions"]}" ]; then
    create_or_replace_menu "my_tasks" "My Tasks" "Task" "actions/my-tasks" 1 "actions" true
    create_or_replace_menu "all_actions" "All Actions" "List" "actions/all" 2 "actions" true
    create_or_replace_menu "overdue_actions" "Overdue Actions" "Warning" "actions/overdue" 3 "actions" true
    create_or_replace_menu "action_assign" "Assign Actions" "Assignment" "actions/assign" 4 "actions" true
    create_or_replace_menu "action_progress" "Progress Updates" "TrendingUp" "actions/progress" 5 "actions" true
else
    print_error "Parent 'actions' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 4: Create PARTICIPANTS SUBMENUS ====================
print_info "STEP 4: Creating Participants submenus (parent: participants)..."
echo ""

if [ -n "${MENU_IDS["participants"]}" ] || [ -n "${EXISTING_MENU_IDS["participants"]}" ]; then
    # Main participants list
    create_or_replace_menu "participants_list" "All Participants" "List" "participants" 1 "participants" true
    
    # Participant Lists management
    create_or_replace_menu "participant_lists" "Participant Lists" "Group" "participant-lists" 2 "participants" true
    
    # Add single participant form
    create_or_replace_menu "participants_create" "Add Participant" "PersonAdd" "participants/create" 3 "participants" true
    
    # NEW: Bulk import participants
    create_or_replace_menu "participants_import" "Bulk Import" "Upload" "participants/import" 4 "participants" true
    
    # NEW: Manage list members (submenu under participant-lists)
    if [ -n "${MENU_IDS["participant_lists"]}" ] || [ -n "${EXISTING_MENU_IDS["participant_lists"]}" ]; then
        create_or_replace_menu "list_members" "Manage Members" "People" "participant-lists/:id/members" 1 "participant_lists" true
    fi
fi

# ==================== STEP 5: Create DOCUMENTS SUBMENUS ====================
print_info "STEP 5: Creating Documents submenus (parent: documents)..."
echo ""

if [ -n "${MENU_IDS["documents"]}" ] || [ -n "${EXISTING_MENU_IDS["documents"]}" ]; then
    create_or_replace_menu "documents_all" "All Documents" "Folder" "documents" 1 "documents" true
    create_or_replace_menu "documents_agendas" "Agendas" "Article" "documents/agendas" 2 "documents" true
    create_or_replace_menu "documents_minutes" "Minutes" "Description" "documents/minutes" 3 "documents" true
    create_or_replace_menu "documents_reports" "Reports" "Assessment" "documents/reports" 4 "documents" true
else
    print_error "Parent 'documents' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 6: Create REPORTS SUBMENUS ====================
print_info "STEP 6: Creating Reports submenus (parent: reports)..."
echo ""

if [ -n "${MENU_IDS["reports"]}" ] || [ -n "${EXISTING_MENU_IDS["reports"]}" ]; then
    create_or_replace_menu "reports_meetings" "Meeting Reports" "Event" "reports/meetings" 1 "reports" true
    create_or_replace_menu "reports_actions" "Action Reports" "Assignment" "reports/actions" 2 "reports" true
    create_or_replace_menu "reports_participants" "Participant Reports" "People" "reports/participants" 3 "reports" true
    create_or_replace_menu "reports_export" "Export Data" "Download" "reports/export" 4 "reports" true
else
    print_error "Parent 'reports' not found! Cannot create submenus."
fi

echo ""

# ==================== STEP 7: Create SETTINGS SUBMENUS ====================
print_info "STEP 7: Creating Settings submenus (parent: settings)..."
echo ""

if [ -n "${MENU_IDS["settings"]}" ] || [ -n "${EXISTING_MENU_IDS["settings"]}" ]; then
    # User Profile & Account Settings (All users)
    create_or_replace_menu "profile" "Profile" "Person" "settings/profile" 1 "settings" true
    create_or_replace_menu "security" "Security" "Security" "settings/security" 2 "settings" true
    create_or_replace_menu "notifications" "Notifications" "Notifications" "settings/notifications" 3 "settings" true
    create_or_replace_menu "preferences" "Preferences" "Tune" "settings/preferences" 4 "settings" true
    
    # System Administration (Admin only)
    create_or_replace_menu "users" "User Management" "People" "settings/users" 10 "settings" true
    create_or_replace_menu "roles" "Role Management" "Badge" "settings/roles" 11 "settings" true
    create_or_replace_menu "audit" "Audit Logs" "History" "settings/audit" 12 "settings" true
    
    # Action Tracker Specific Settings
    create_or_replace_menu "status_config" "Status Configuration" "Settings" "settings/status" 15 "settings" true
    create_or_replace_menu "document_types" "Document Types" "Folder" "settings/document-types" 16 "settings" true
else
    print_error "Parent 'settings' not found! Cannot create submenus."
fi

echo ""
print_info "Menu creation summary: Created: $CREATE_COUNT, Updated: $UPDATE_COUNT, Skipped: $SKIP_COUNT, Failed: $FAIL_COUNT"
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

# Define role menu permissions for Action Tracker (UPDATED with underscores)
declare -A ROLE_MENUS

# Admin & Super Admin - Full access to everything (using underscore codes)
ROLE_MENUS["admin"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,all_actions,overdue_actions,action_assign,action_progress,participants,participants_list,participant_lists,participants_create,participants_import,documents,documents_all,documents_agendas,documents_minutes,documents_reports,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security,notifications,preferences,users,roles,audit,status_config,document_types"
ROLE_MENUS["super_admin"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,all_actions,overdue_actions,action_assign,action_progress,participants,participants_list,participant_lists,participants_create,participants_import,documents,documents_all,documents_agendas,documents_minutes,documents_reports,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security,notifications,preferences,users,roles,audit,status_config,document_types"

# Meeting Creator - Full meeting management
ROLE_MENUS["meeting_creator"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,participants,participants_list,participant_lists,documents,documents_all,calendar,settings,profile,security,notifications,preferences"

# Meeting Participant - View meetings only
ROLE_MENUS["meeting_participant"]="dashboard,meetings,meetings_list,meetings_minutes,actions,my_tasks,documents,documents_all,calendar,settings,profile,security,notifications"

# Action Assigner - Create and assign actions
ROLE_MENUS["action_assigner"]="dashboard,meetings,meetings_list,actions,all_actions,action_assign,action_progress,participants,participants_list,participant_lists,reports,reports_actions,calendar,settings,profile,security,notifications,preferences"

# Action Owner - Complete assigned actions
ROLE_MENUS["action_owner"]="dashboard,meetings,meetings_list,actions,my_tasks,action_progress,calendar,settings,profile,security,notifications"

# Action Viewer - Monitor action status
ROLE_MENUS["action_viewer"]="dashboard,meetings,meetings_list,actions,all_actions,reports,reports_actions,calendar,settings,profile,security,notifications"

# Participant Manager - Full participant and list management
ROLE_MENUS["participant_manager"]="dashboard,participants,participants_list,participant_lists,participants_create,participants_import,meetings,meetings_list,meetings_participants,calendar,settings,profile,security,notifications,preferences"

# Document Manager - Manage documents
ROLE_MENUS["document_manager"]="dashboard,documents,documents_all,documents_agendas,documents_minutes,documents_reports,meetings,meetings_list,calendar,settings,profile,security,notifications"

# Report Viewer - View reports
ROLE_MENUS["report_viewer"]="dashboard,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security,notifications"

# Basic User - Limited access
ROLE_MENUS["user"]="dashboard,meetings,meetings_list,actions,my_tasks,calendar,settings,profile,security,notifications"

PERMISSION_SUCCESS=0
PERMISSION_FAIL=0

# First, clear existing permissions for all menus to avoid duplicates
print_info "Clearing existing menu permissions..."
for role_code in "${!ROLE_MENUS[@]}"; do
    ROLE_ID="${ROLE_IDS[$role_code]}"
    if [ -n "$ROLE_ID" ]; then
        curl -s -X DELETE "${API_URL}/roles/${ROLE_ID}/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
    fi
done
print_success "Cleared existing permissions"
echo ""

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
        if [ -z "$MENU_ID" ] || [ "$MENU_ID" == "null" ]; then
            MENU_ID="${EXISTING_MENU_IDS[$menu_code]}"
        fi
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
    
    # Specifically show participant lists menu
    echo ""
    echo -e "${CYAN}📋 Participant Lists Menu:${NC}"
    echo "$ADMIN_MENUS" | jq -r '
    .. | 
    select(.code? == "participant_lists") | 
    "  ✅ Found: " + .title + " (Path: " + (.path // "N/A") + ")"
    ' 2>/dev/null
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
echo "  • New menus created: ${CREATE_COUNT}"
echo "  • Menus replaced: ${UPDATE_COUNT}"
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
echo "  # Check participant lists menu"
echo "  curl -X GET \"${API_URL}/menus/\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.. | select(.code? == \"participant_lists\")'"
echo ""

print_separator
print_success "Action Tracker menu system seeding completed successfully!"
print_separator