#!/bin/bash
# app/db/seed/scripts/seed_menus.sh
# Seed Menu system for Action Tracker (Electoral Commission)
# WITH NICE ICONS - Material Symbols, Font Awesome, and MUI

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
    read -p "Enter API base URL [http://localhost:8001]: " input
    BASE_URL="${input:-http://localhost:8001}"
fi

# Get USERNAME
if [ -n "$2" ]; then
    USERNAME="$2"
else
    read -p "Enter admin username [admin]: " input
    USERNAME="${input:-admin}"
fi

# Get PASSWORD
if [ -n "$3" ]; then
    PASSWORD="$3"
else
    read -sp "Enter admin password [Admin123!]: " input
    echo ""
    PASSWORD="${input:-Admin123!}"
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
print_info "Fetching existing menus..."

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

print_info "Found ${#EXISTING_MENU_IDS[@]} existing menus"
echo ""

# ==================== CREATE MENUS FUNCTION ====================
declare -A MENU_IDS
CREATE_COUNT=0
UPDATE_COUNT=0
FAIL_COUNT=0

delete_existing_menu() {
    local menu_code=$1
    local menu_id=${EXISTING_MENU_IDS["$menu_code"]}
    
    if [ -n "$menu_id" ] && [ "$menu_id" != "null" ]; then
        print_warning "  Deleting existing: ${menu_code}"
        curl -s -X DELETE "${API_URL}/menus/${menu_id}/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
        curl -s -X DELETE "${API_URL}/menus/${menu_id}" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
        unset EXISTING_MENU_IDS["$menu_code"]
    fi
}

create_menu() {
    local code=$1
    local title=$2
    local icon=$3
    local icon_type=$4
    local icon_library=$5
    local icon_color=$6
    local path=$7
    local sort_order=$8
    local parent_code=$9
    
    # Delete if exists
    if [ -n "${EXISTING_MENU_IDS[$code]}" ]; then
        delete_existing_menu "$code"
        ((UPDATE_COUNT++))
    fi
    
    print_info "  Creating: ${title} (${code})"
    
    # Get parent ID
    PARENT_ID="null"
    if [ -n "$parent_code" ] && [ "$parent_code" != "" ]; then
        PARENT_ID="${MENU_IDS[$parent_code]}"
        if [ -z "$PARENT_ID" ] || [ "$PARENT_ID" == "null" ]; then
            PARENT_ID="${EXISTING_MENU_IDS[$parent_code]}"
        fi
        if [ -z "$PARENT_ID" ] || [ "$PARENT_ID" == "null" ]; then
            print_error "    ❌ Parent '${parent_code}' not found!"
            ((FAIL_COUNT++))
            return 1
        fi
    fi
    
    # Handle path
    if [ -z "$path" ] || [ "$path" == "" ]; then
        path_value="null"
    else
        path="${path#/}"
        path_value="\"${path}\""
    fi
    
    # Build JSON
    if [ "$PARENT_ID" != "null" ]; then
        JSON_PAYLOAD="{\"code\":\"${code}\",\"title\":\"${title}\",\"icon\":\"${icon}\",\"icon_type\":\"${icon_type}\",\"icon_library\":\"${icon_library}\",\"icon_color\":\"${icon_color}\",\"path\":${path_value},\"sort_order\":${sort_order},\"parent_id\":\"${PARENT_ID}\"}"
    else
        JSON_PAYLOAD="{\"code\":\"${code}\",\"title\":\"${title}\",\"icon\":\"${icon}\",\"icon_type\":\"${icon_type}\",\"icon_library\":\"${icon_library}\",\"icon_color\":\"${icon_color}\",\"path\":${path_value},\"sort_order\":${sort_order}}"
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
        return 0
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"' 2>/dev/null)
        print_error "    ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
        return 1
    fi
}

# ==================== STEP 1: CREATE ROOT MENUS ====================
print_header "STEP 1: Creating Root Menus"
echo ""

create_menu "dashboard" "Dashboard" "Dashboard" "mui" "mui" "#1976d2" "dashboard" 1 ""
create_menu "meetings" "Meetings" "event" "material_symbols" "material-symbols-outlined" "#4caf50" "meetings" 2 ""
create_menu "actions" "Actions" "fa-tasks" "fontawesome" "fas" "#ff9800" "actions" 3 ""
create_menu "participants" "Participants" "People" "mui" "mui" "#9c27b0" "participants" 4 ""
create_menu "documents" "Documents" "folder" "material_symbols" "material-symbols-outlined" "#2196f3" "documents" 5 ""
create_menu "reports" "Reports" "fa-chart-bar" "fontawesome" "fas" "#f44336" "reports" 6 ""
create_menu "calendar" "Calendar" "calendar_month" "material_symbols" "material-symbols-outlined" "#00bcd4" "calendar" 7 ""
create_menu "settings" "Settings" "fa-cog" "fontawesome" "fas" "#757575" "" 8 ""

echo ""

# ==================== STEP 2: MEETINGS SUBMENUS ====================
print_header "STEP 2: Creating Meetings Submenus"
echo ""

create_menu "meetings_list" "All Meetings" "List" "mui" "mui" "#4caf50" "meetings" 1 "meetings"
create_menu "meetings_create" "Create Meeting" "Add" "mui" "mui" "#4caf50" "meetings/create" 2 "meetings"
create_menu "meetings_minutes" "Meeting Minutes" "Description" "mui" "mui" "#4caf50" "meetings/minutes" 3 "meetings"
create_menu "meetings_participants" "Meeting Participants" "People" "mui" "mui" "#4caf50" "meetings/participants" 4 "meetings"

echo ""

# ==================== STEP 3: ACTIONS SUBMENUS ====================
print_header "STEP 3: Creating Actions Submenus"
echo ""

create_menu "my_tasks" "My Tasks" "fa-tasks" "fontawesome" "fas" "#ff9800" "actions/my-tasks" 1 "actions"
create_menu "all_actions" "All Actions" "fa-list" "fontawesome" "fas" "#ff9800" "actions/all" 2 "actions"
create_menu "overdue_actions" "Overdue Actions" "fa-exclamation-triangle" "fontawesome" "fas" "#f44336" "actions/overdue" 3 "actions"
create_menu "action_assign" "Assign Actions" "fa-user-plus" "fontawesome" "fas" "#ff9800" "actions/assign" 4 "actions"
create_menu "action_progress" "Progress Updates" "fa-chart-line" "fontawesome" "fas" "#4caf50" "actions/progress" 5 "actions"

echo ""

# ==================== STEP 4: PARTICIPANTS SUBMENUS ====================
print_header "STEP 4: Creating Participants Submenus"
echo ""

create_menu "participants_list" "All Participants" "List" "mui" "mui" "#9c27b0" "participants" 1 "participants"
create_menu "participant_lists" "Participant Lists" "Group" "mui" "mui" "#9c27b0" "participant-lists" 2 "participants"
create_menu "participants_create" "Add Participant" "PersonAdd" "mui" "mui" "#9c27b0" "participants/create" 3 "participants"
create_menu "participants_import" "Bulk Import" "Upload" "mui" "mui" "#9c27b0" "participants/import" 4 "participants"

echo ""

# ==================== STEP 5: DOCUMENTS SUBMENUS ====================
print_header "STEP 5: Creating Documents Submenus"
echo ""

create_menu "documents_all" "All Documents" "Folder" "mui" "mui" "#2196f3" "documents" 1 "documents"
create_menu "documents_agendas" "Agendas" "Article" "mui" "mui" "#2196f3" "documents/agendas" 2 "documents"
create_menu "documents_minutes" "Minutes" "Description" "mui" "mui" "#2196f3" "documents/minutes" 3 "documents"
create_menu "documents_reports" "Reports" "Assessment" "mui" "mui" "#2196f3" "documents/reports" 4 "documents"

echo ""

# ==================== STEP 6: REPORTS SUBMENUS ====================
print_header "STEP 6: Creating Reports Submenus"
echo ""

create_menu "reports_meetings" "Meeting Reports" "Event" "mui" "mui" "#f44336" "reports/meetings" 1 "reports"
create_menu "reports_actions" "Action Reports" "Assignment" "mui" "mui" "#f44336" "reports/actions" 2 "reports"
create_menu "reports_participants" "Participant Reports" "People" "mui" "mui" "#f44336" "reports/participants" 3 "reports"
create_menu "reports_export" "Export Data" "Download" "mui" "mui" "#f44336" "reports/export" 4 "reports"

echo ""

# ==================== STEP 7: SETTINGS SUBMENUS ====================
print_header "STEP 7: Creating Settings Submenus"
echo ""

# User Profile & Account Settings
create_menu "profile" "Profile" "fa-user" "fontawesome" "fas" "#795548" "settings/profile" 1 "settings"
create_menu "security" "Security" "fa-shield-alt" "fontawesome" "fas" "#dc004e" "settings/security" 2 "settings"
create_menu "preferences" "Preferences" "fa-sliders-h" "fontawesome" "fas" "#607d8b" "settings/preferences" 3 "settings"

# System Administration
create_menu "users" "User Management" "fa-users" "fontawesome" "fas" "#3f51b5" "settings/users" 4 "settings"
create_menu "roles" "Role Management" "fa-tag" "fontawesome" "fas" "#9c27b0" "settings/roles" 5 "settings"
create_menu "audit" "Audit Logs" "fa-history" "fontawesome" "fas" "#607d8b" "settings/audit" 6 "settings"

# Locations (under Settings) - Using Material Symbol
create_menu "locations" "Locations" "location_on" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations" 7 "settings"

echo ""

# ==================== STEP 8: LOCATIONS SUBMENUS ====================
print_header "STEP 8: Creating Locations Hierarchy (under Settings/Locations)"
echo ""

create_menu "locations_list" "All Locations" "list_alt" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations" 1 "locations"
create_menu "locations_regions" "Regions" "map" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations/regions" 2 "locations"
create_menu "locations_districts" "Districts" "account_balance" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations/districts" 3 "locations"
create_menu "locations_constituencies" "Constituencies" "groups" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations/constituencies" 4 "locations"
create_menu "locations_parishes" "Parishes" "church" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations/parishes" 5 "locations"
create_menu "locations_villages" "Villages" "house" "material_symbols" "material-symbols-outlined" "#795548" "settings/locations/villages" 6 "locations"

echo ""

# ==================== STEP 9: ADMIN STRUCTURES SUBMENUS ====================
print_header "STEP 9: Creating Admin Structures Submenus (under Settings)"
echo ""

create_menu "admin_structures" "Admin Structures" "fa-sitemap" "fontawesome" "fas" "#607d8b" "settings/admin-structures" 8 "settings"
create_menu "structures_list" "All Structures" "list_alt" "material_symbols" "material-symbols-outlined" "#607d8b" "settings/admin-structures" 1 "admin_structures"
create_menu "structures_departments" "Departments" "fa-building" "fontawesome" "fas" "#607d8b" "settings/admin-structures/departments" 2 "admin_structures"
create_menu "structures_units" "Units" "groups" "material_symbols" "material-symbols-outlined" "#607d8b" "settings/admin-structures/units" 3 "admin_structures"
create_menu "structures_divisions" "Divisions" "AccountTree" "mui" "mui" "#607d8b" "settings/admin-structures/divisions" 4 "admin_structures"
create_menu "structures_positions" "Positions" "fa-id-badge" "fontawesome" "fas" "#607d8b" "settings/admin-structures/positions" 5 "admin_structures"

echo ""

# ==================== STEP 10: SOCIAL MEDIA ====================
print_header "STEP 10: Creating Social Media Menus"
echo ""

create_menu "facebook" "Facebook" "fa-facebook" "fontawesome" "fab" "#1877f2" "" 15 ""

echo ""

print_info "Menu creation summary: Created: $CREATE_COUNT, Updated: $UPDATE_COUNT, Failed: $FAIL_COUNT"
echo ""

# ==================== ASSIGN PERMISSIONS ====================
print_separator
print_header "Assigning Menu Permissions to Roles"
print_separator
echo ""

declare -A ROLE_MENUS

# Admin - Full access to everything
ROLE_MENUS["admin"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,all_actions,overdue_actions,action_assign,action_progress,participants,participants_list,participant_lists,participants_create,participants_import,documents,documents_all,documents_agendas,documents_minutes,documents_reports,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security,preferences,users,roles,audit,locations,locations_list,locations_regions,locations_districts,locations_constituencies,locations_parishes,locations_villages,admin_structures,structures_list,structures_departments,structures_units,structures_divisions,structures_positions,facebook"
ROLE_MENUS["super_admin"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,all_actions,overdue_actions,action_assign,action_progress,participants,participants_list,participant_lists,participants_create,participants_import,documents,documents_all,documents_agendas,documents_minutes,documents_reports,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security,preferences,users,roles,audit,locations,locations_list,locations_regions,locations_districts,locations_constituencies,locations_parishes,locations_villages,admin_structures,structures_list,structures_departments,structures_units,structures_divisions,structures_positions,facebook"

# Meeting Creator
ROLE_MENUS["meeting_creator"]="dashboard,meetings,meetings_list,meetings_create,meetings_minutes,meetings_participants,actions,my_tasks,participants,participants_list,participant_lists,documents,documents_all,calendar,settings,profile,security,preferences"

# Meeting Participant
ROLE_MENUS["meeting_participant"]="dashboard,meetings,meetings_list,meetings_minutes,actions,my_tasks,documents,documents_all,calendar,settings,profile,security"

# Action Assigner
ROLE_MENUS["action_assigner"]="dashboard,meetings,meetings_list,actions,all_actions,action_assign,action_progress,participants,participants_list,participant_lists,reports,reports_actions,calendar,settings,profile,security,preferences"

# Action Owner
ROLE_MENUS["action_owner"]="dashboard,meetings,meetings_list,actions,my_tasks,action_progress,calendar,settings,profile,security"

# Action Viewer
ROLE_MENUS["action_viewer"]="dashboard,meetings,meetings_list,actions,all_actions,reports,reports_actions,calendar,settings,profile,security"

# Participant Manager
ROLE_MENUS["participant_manager"]="dashboard,participants,participants_list,participant_lists,participants_create,participants_import,meetings,meetings_list,meetings_participants,calendar,settings,profile,security,preferences"

# Document Manager
ROLE_MENUS["document_manager"]="dashboard,documents,documents_all,documents_agendas,documents_minutes,documents_reports,meetings,meetings_list,calendar,settings,profile,security"

# Report Viewer
ROLE_MENUS["report_viewer"]="dashboard,reports,reports_meetings,reports_actions,reports_participants,reports_export,calendar,settings,profile,security"

# Basic User
ROLE_MENUS["user"]="dashboard,meetings,meetings_list,actions,my_tasks,calendar,settings,profile,security"

PERMISSION_SUCCESS=0
PERMISSION_FAIL=0

# Clear existing permissions
print_info "Clearing existing permissions..."
for role_code in "${!ROLE_MENUS[@]}"; do
    ROLE_ID="${ROLE_IDS[$role_code]}"
    if [ -n "$ROLE_ID" ]; then
        curl -s -X DELETE "${API_URL}/roles/${ROLE_ID}/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
    fi
done
print_success "Permissions cleared"
echo ""

# Assign new permissions
for role_code in "${!ROLE_MENUS[@]}"; do
    ROLE_ID="${ROLE_IDS[$role_code]}"
    [ -z "$ROLE_ID" ] && continue
    
    print_info "Processing role: ${role_code}"
    
    IFS=',' read -ra MENU_CODES <<< "${ROLE_MENUS[$role_code]}"
    for menu_code in "${MENU_CODES[@]}"; do
        MENU_ID="${MENU_IDS[$menu_code]}"
        [ -z "$MENU_ID" ] && MENU_ID="${EXISTING_MENU_IDS[$menu_code]}"
        [ -z "$MENU_ID" ] && continue
        
        PERM_JSON="{\"role_id\":\"${ROLE_ID}\",\"menu_id\":\"${MENU_ID}\",\"can_view\":true,\"can_access\":true,\"can_show_mb_bottom\":false}"
        
        curl -s -X POST "${API_URL}/menus/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" \
            -H "Content-Type: application/json" \
            -d "$PERM_JSON" > /dev/null
    done
    
    print_success "  ✅ Assigned permissions to ${role_code}"
done

# ==================== VERIFICATION ====================
echo ""
print_separator
print_header "Verifying Menu Hierarchy"
print_separator
echo ""

ADMIN_MENUS=$(curl -s -X GET "${API_URL}/menus/" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

echo -e "${CYAN}📋 Final Menu Structure:${NC}"
echo "$ADMIN_MENUS" | jq -r '
def display(level):
    .[] | 
    "  " * level + "📁 " + .title + 
    (if .icon then " [" + .icon + "]" else "" end),
    (if .children and (.children | length) > 0 then .children | display(level + 1) else empty end);
display(0)' 2>/dev/null

echo ""
print_separator
print_success "Seeding completed successfully!"
print_separator
echo ""

echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total menus created: ${CREATE_COUNT}"
echo "  • Root menus: Dashboard, Meetings, Actions, Participants, Documents, Reports, Calendar, Settings"
echo "  • Locations is under Settings with Material Symbols"
echo "  • Admin Structures is under Settings with mixed icons"
echo "  • Facebook uses FAB brand icon"
echo ""

echo -e "${CYAN}📂 Complete Menu Hierarchy:${NC}"
echo ""
echo "📁 Dashboard [Dashboard] (MUI)"
echo "📁 Meetings [event] (Material Symbol)"
echo "  📄 All Meetings [List] (MUI)"
echo "  📄 Create Meeting [Add] (MUI)"
echo "  📄 Meeting Minutes [Description] (MUI)"
echo "  📄 Meeting Participants [People] (MUI)"
echo "📁 Actions [fa-tasks] (Font Awesome)"
echo "  📄 My Tasks [fa-tasks] (FA)"
echo "  📄 All Actions [fa-list] (FA)"
echo "  📄 Overdue Actions [fa-exclamation-triangle] (FA)"
echo "  📄 Assign Actions [fa-user-plus] (FA)"
echo "  📄 Progress Updates [fa-chart-line] (FA)"
echo "📁 Participants [People] (MUI)"
echo "  📄 All Participants [List] (MUI)"
echo "  📄 Participant Lists [Group] (MUI)"
echo "  📄 Add Participant [PersonAdd] (MUI)"
echo "  📄 Bulk Import [Upload] (MUI)"
echo "📁 Documents [folder] (Material Symbol)"
echo "  📄 All Documents [Folder] (MUI)"
echo "  📄 Agendas [Article] (MUI)"
echo "  📄 Minutes [Description] (MUI)"
echo "  📄 Reports [Assessment] (MUI)"
echo "📁 Reports [fa-chart-bar] (Font Awesome)"
echo "  📄 Meeting Reports [Event] (MUI)"
echo "  📄 Action Reports [Assignment] (MUI)"
echo "  📄 Participant Reports [People] (MUI)"
echo "  📄 Export Data [Download] (MUI)"
echo "📁 Calendar [calendar_month] (Material Symbol)"
echo "📁 Settings [fa-cog] (Font Awesome)"
echo "  📄 Profile [fa-user] (FA)"
echo "  📄 Security [fa-shield-alt] (FA)"
echo "  📄 Preferences [fa-sliders-h] (FA)"
echo "  📄 User Management [fa-users] (FA)"
echo "  📄 Role Management [fa-tag] (FA)"
echo "  📄 Audit Logs [fa-history] (FA)"
echo "  📁 Locations [location_on] (Material Symbol)"
echo "    📄 All Locations [list_alt] (MS)"
echo "    📄 Regions [map] (MS)"
echo "    📄 Districts [account_balance] (MS)"
echo "    📄 Constituencies [groups] (MS)"
echo "    📄 Parishes [church] (MS)"
echo "    📄 Villages [house] (MS)"
echo "  📁 Admin Structures [fa-sitemap] (FA)"
echo "    📄 All Structures [list_alt] (MS)"
echo "    📄 Departments [fa-building] (FA)"
echo "    📄 Units [groups] (MS)"
echo "    📄 Divisions [AccountTree] (MUI)"
echo "    📄 Positions [fa-id-badge] (FA)"
echo "📁 Facebook [fa-facebook] (FAB Brand)"
echo ""

print_success "Done! Refresh your browser to see the updated menu structure with nice icons!"