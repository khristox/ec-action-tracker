#!/bin/bash
# app/db/seed/scripts/seed_permissions.sh
# Seed Fine-Grained Permissions for Action Tracker (Electoral Commission)

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
print_header "ACTION TRACKER PERMISSIONS SEEDER"
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

# ==================== GET ROLES ====================
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

# ==================== GET EXISTING PERMISSIONS ====================
print_info "Fetching existing permissions..."

EXISTING_PERMS_RESPONSE=$(curl -s -X GET "${API_URL}/permissions/?skip=0&limit=500" \
    -H "Authorization: Bearer $ADMIN_TOKEN" 2>/dev/null)

declare -A EXISTING_PERM_CODES
while IFS= read -r line; do
    code=$(echo "$line" | jq -r '.code')
    id=$(echo "$line" | jq -r '.id')
    if [ -n "$code" ] && [ "$code" != "null" ]; then
        EXISTING_PERM_CODES["$code"]="$id"
    fi
done < <(echo "$EXISTING_PERMS_RESPONSE" | jq -c '.[]' 2>/dev/null)

print_info "Found ${#EXISTING_PERM_CODES[@]} existing permissions"
echo ""

# ==================== CREATE PERMISSIONS FUNCTION ====================
declare -A PERM_IDS
CREATE_COUNT=0
UPDATE_COUNT=0
FAIL_COUNT=0

delete_existing_permission() {
    local perm_code=$1
    local perm_id=${EXISTING_PERM_CODES["$perm_code"]}
    
    if [ -n "$perm_id" ] && [ "$perm_id" != "null" ]; then
        print_warning "  Deleting existing: ${perm_code}"
        curl -s -X DELETE "${API_URL}/permissions/${perm_id}" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
        unset EXISTING_PERM_CODES["$perm_code"]
    fi
}

create_permission() {
    local code=$1
    local name=$2
    local resource=$3
    local action=$4
    local category=$5
    local description=$6
    
    # Delete if exists
    if [ -n "${EXISTING_PERM_CODES[$code]}" ]; then
        delete_existing_permission "$code"
        ((UPDATE_COUNT++))
    fi
    
    print_info "  Creating: ${name} (${code})"
    
    # Build JSON
    JSON_PAYLOAD=$(jq -n \
        --arg code "$code" \
        --arg name "$name" \
        --arg resource "$resource" \
        --arg action "$action" \
        --arg category "$category" \
        --arg description "$description" \
        '{
            code: $code,
            name: $name,
            resource: $resource,
            action: $action,
            category: $category,
            description: $description,
            is_system: true
        }')
    
    RESPONSE=$(curl -s -X POST "${API_URL}/permissions/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$JSON_PAYLOAD")
    
    PERM_ID=$(echo "$RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    
    if [ -n "$PERM_ID" ] && [ "$PERM_ID" != "null" ]; then
        print_success "    ✅ Created (ID: ${PERM_ID:0:8}...)"
        PERM_IDS["$code"]="$PERM_ID"
        ((CREATE_COUNT++))
        return 0
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"' 2>/dev/null)
        print_error "    ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
        return 1
    fi
}

# ==================== CREATE PERMISSIONS BY CATEGORY ====================
print_header "STEP 1: Creating Meeting Management Permissions"
echo ""

# Meeting Management
create_permission "meeting:create" "Create Meetings" "meeting" "create" "Meeting Management" "Ability to create new meetings"
create_permission "meeting:view_all" "View All Meetings" "meeting" "view_all" "Meeting Management" "Ability to view all meetings regardless of participation"
create_permission "meeting:view" "View Own Meetings" "meeting" "view" "Meeting Management" "Ability to view meetings you created or participate in"
create_permission "meeting:status_change" "Change Meeting Status" "meeting" "status_change" "Meeting Management" "Ability to change meeting status"
create_permission "meeting:record" "Record Meeting" "meeting" "record" "Meeting Management" "Ability to record meeting proceedings"
create_permission "meeting:view_recorder" "View Recorder in Meetings" "meeting" "view_recorder" "Meeting Management" "Ability to view recorded meeting content"
create_permission "meeting:update" "Update Meeting" "meeting" "update" "Meeting Management" "Ability to update meeting details"
create_permission "meeting:delete" "Delete Meeting" "meeting" "delete" "Meeting Management" "Ability to delete meetings"

echo ""

print_header "STEP 2: Creating Minutes Management Permissions"
echo ""

# Minutes Management
create_permission "minutes:add" "Add Minutes" "minutes" "add" "Minutes Management" "Ability to add minutes to meetings"
create_permission "minutes:edit" "Edit Minutes" "minutes" "edit" "Minutes Management" "Ability to edit meeting minutes"
create_permission "minutes:delete" "Delete Minutes" "minutes" "delete" "Minutes Management" "Ability to delete minutes"
create_permission "minutes:view" "View Minutes" "minutes" "view" "Minutes Management" "Ability to view minutes"
create_permission "minutes:approve" "Approve Minutes" "minutes" "approve" "Minutes Management" "Ability to approve meeting minutes"
create_permission "minutes:export" "Export Minutes" "minutes" "export" "Minutes Management" "Ability to export minutes to PDF/Word"
create_permission "minutes:sign" "Sign Minutes" "minutes" "sign" "Minutes Management" "Ability to digitally sign minutes"

echo ""

print_header "STEP 3: Creating Actions Management Permissions"
echo ""

# Actions Management
create_permission "action:create" "Create Actions" "action" "create" "Actions Management" "Ability to create actions from meetings"
create_permission "action:update" "Update Actions" "action" "update" "Actions Management" "Ability to update action status and details"
create_permission "action:delete" "Delete Actions" "action" "delete" "Actions Management" "Ability to delete actions"
create_permission "action:view_all" "View All Actions" "action" "view_all" "Actions Management" "Ability to view all actions"
create_permission "action:view_own" "View Own Actions" "action" "view_own" "Actions Management" "Ability to view actions assigned to user"
create_permission "action:assign" "Assign Actions" "action" "assign" "Actions Management" "Ability to assign actions to users"
create_permission "action:status_update" "Update Action Status" "action" "status_update" "Actions Management" "Ability to update action status"
create_permission "action:priority_update" "Update Action Priority" "action" "priority_update" "Actions Management" "Ability to update action priority"
create_permission "action:comment" "Comment on Actions" "action" "comment" "Actions Management" "Ability to add comments to actions"
create_permission "action:attachment" "Add Action Attachments" "action" "attachment" "Actions Management" "Ability to add attachments to actions"

echo ""

print_header "STEP 4: Creating Notifications Permissions"
echo ""

# Notifications
create_permission "notification:send" "Send Notifications" "notification" "send" "Notifications" "Ability to send notifications to meeting participants"
create_permission "notification:email" "Send Email Notifications" "notification" "email" "Notifications" "Ability to send email notifications"
create_permission "notification:view" "View Notifications" "notification" "view" "Notifications" "Ability to view notifications"
create_permission "notification:manage_templates" "Manage Notification Templates" "notification" "manage_templates" "Notifications" "Ability to manage notification templates"

echo ""

print_header "STEP 5: Creating Profile Management Permissions"
echo ""

# Profile Management
create_permission "profile:view" "View Profile" "profile" "view" "Profile Management" "Ability to view own profile"
create_permission "profile:update" "Update Profile" "profile" "update" "Profile Management" "Ability to update profile information"
create_permission "profile:change_password" "Change Password" "profile" "change_password" "Profile Management" "Ability to change password"
create_permission "profile:view_others" "View Others' Profiles" "profile" "view_others" "Profile Management" "Ability to view other users' profiles"

echo ""

print_header "STEP 6: Creating Participants Management Permissions"
echo ""

# Participants Management
create_permission "participant:add" "Add Participants" "participant" "add" "Participants Management" "Ability to add participants to meetings"
create_permission "participant:remove" "Remove Participants" "participant" "remove" "Participants Management" "Ability to remove participants from meetings"
create_permission "participant:view" "View Participants" "participant" "view" "Participants Management" "Ability to view meeting participants"
create_permission "participant:manage_lists" "Manage Participant Lists" "participant" "manage_lists" "Participants Management" "Ability to manage participant lists"

echo ""

print_header "STEP 7: Creating Administrative Permissions"
echo ""

# Administrative
create_permission "admin:manage_users" "Manage Users" "admin" "manage_users" "Administrative" "Ability to manage system users"
create_permission "admin:manage_roles" "Manage Roles" "admin" "manage_roles" "Administrative" "Ability to manage roles and permissions"
create_permission "admin:manage_menu_assignment" "Manage Menu Assignment" "admin" "manage_menu_assignment" "Administrative" "Ability to assign menus to roles"
create_permission "admin:view_audit" "View Audit Logs" "admin" "view_audit" "Administrative" "Ability to view system audit logs"
create_permission "admin:manage_locations" "Manage Locations" "admin" "manage_locations" "Administrative" "Ability to manage locations"
create_permission "admin:manage_structures" "Manage Admin Structures" "admin" "manage_structures" "Administrative" "Ability to manage administrative structures"

echo ""

print_header "STEP 8: Creating Report Permissions"
echo ""

# Reports
create_permission "report:meeting" "Meeting Reports" "report" "meeting" "Reports" "Ability to generate meeting reports"
create_permission "report:action" "Action Reports" "report" "action" "Reports" "Ability to generate action reports"
create_permission "report:participant" "Participant Reports" "report" "participant" "Reports" "Ability to generate participant reports"
create_permission "report:export" "Export Reports" "report" "export" "Reports" "Ability to export reports"

echo ""

print_header "STEP 9: Creating Dashboard Permissions"
echo ""

# Dashboard Permissions
create_permission "dashboard:view" "View Dashboard" "dashboard" "view" "Dashboard" "Ability to access the main dashboard"
create_permission "dashboard:overview" "Dashboard Overview" "dashboard" "overview" "Dashboard" "View dashboard overview statistics"
create_permission "dashboard:recent_meetings" "Recent Meetings Widget" "dashboard" "recent_meetings" "Dashboard" "View recent meetings widget"
create_permission "dashboard:upcoming_meetings" "Upcoming Meetings Widget" "dashboard" "upcoming_meetings" "Dashboard" "View upcoming meetings widget"
create_permission "dashboard:pending_actions" "Pending Actions Widget" "dashboard" "pending_actions" "Dashboard" "View pending actions widget"
create_permission "dashboard:overdue_actions" "Overdue Actions Widget" "dashboard" "overdue_actions" "Dashboard" "View overdue actions widget"
create_permission "dashboard:notifications" "Notifications Widget" "dashboard" "notifications" "Dashboard" "View notifications widget"
create_permission "dashboard:customize" "Customize Dashboard" "dashboard" "customize" "Dashboard" "Customize dashboard layout"

echo ""

# ==================== ASSIGN PERMISSIONS TO ROLES ====================
print_separator
print_header "Assigning Permissions to Roles"
print_separator
echo ""

# Function to assign permission to role
assign_permission_to_role() {
    local role_id=$1
    local perm_code=$2
    
    local perm_id="${PERM_IDS[$perm_code]}"
    if [ -z "$perm_id" ]; then
        perm_id="${EXISTING_PERM_CODES[$perm_code]}"
    fi
    
    if [ -z "$perm_id" ] || [ "$perm_id" == "null" ]; then
        print_warning "  ⚠️ Permission not found: ${perm_code}"
        return 1
    fi
    
    # Check if already assigned
    local check_response=$(curl -s -X GET "${API_URL}/roles/${role_id}/permissions" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$check_response" | jq -e ".[] | select(.id == \"$perm_id\")" > /dev/null 2>&1; then
        return 0
    fi
    
    # Assign permission
    local json_payload="{\"permission_id\":\"${perm_id}\"}"
    
    local response=$(curl -s -X POST "${API_URL}/roles/${role_id}/permissions" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$json_payload")
    
    local success=$(echo "$response" | jq -r '.status // "success"' 2>/dev/null)
    if [ "$success" != "error" ]; then
        return 0
    else
        return 1
    fi
}

# Clear existing role permissions first
print_info "Clearing existing role permissions..."
for role_code in "${!ROLE_IDS[@]}"; do
    role_id="${ROLE_IDS[$role_code]}"
    if [ -n "$role_id" ]; then
        curl -s -X DELETE "${API_URL}/roles/${role_id}/permissions" \
            -H "Authorization: Bearer $ADMIN_TOKEN" > /dev/null 2>&1
    fi
done
print_success "Role permissions cleared"
echo ""

# ==================== ADMIN ROLE - FULL ACCESS ====================
admin_role_id="${ROLE_IDS[admin]}"
if [ -n "$admin_role_id" ]; then
    print_info "Assigning permissions to ADMIN role..."
    
    # All permissions
    ALL_PERMISSIONS=(
        # Dashboard
        "dashboard:view" "dashboard:overview" "dashboard:recent_meetings"
        "dashboard:upcoming_meetings" "dashboard:pending_actions"
        "dashboard:overdue_actions" "dashboard:notifications" "dashboard:customize"
        
        # Meeting Management
        "meeting:create" "meeting:view_all" "meeting:view" "meeting:status_change"
        "meeting:record" "meeting:view_recorder" "meeting:update" "meeting:delete"
        
        # Minutes Management
        "minutes:add" "minutes:edit" "minutes:delete" "minutes:view"
        "minutes:approve" "minutes:export" "minutes:sign"
        
        # Actions Management
        "action:create" "action:update" "action:delete" "action:view_all"
        "action:view_own" "action:assign" "action:status_update" "action:priority_update"
        "action:comment" "action:attachment"
        
        # Notifications
        "notification:send" "notification:email" "notification:view" "notification:manage_templates"
        
        # Profile Management
        "profile:view" "profile:update" "profile:change_password" "profile:view_others"
        
        # Participants Management
        "participant:add" "participant:remove" "participant:view" "participant:manage_lists"
        
        # Administrative
        "admin:manage_users" "admin:manage_roles" "admin:manage_menu_assignment"
        "admin:view_audit" "admin:manage_locations" "admin:manage_structures"
        
        # Reports
        "report:meeting" "report:action" "report:participant" "report:export"
    )
    
    for perm_code in "${ALL_PERMISSIONS[@]}"; do
        if assign_permission_to_role "$admin_role_id" "$perm_code"; then
            echo -n "."
        fi
    done
    echo ""
    print_success "✅ ADMIN role granted all permissions"
fi

# ==================== SUPER ADMIN ROLE - FULL ACCESS ====================
super_admin_role_id="${ROLE_IDS[super_admin]}"
if [ -n "$super_admin_role_id" ]; then
    print_info "Assigning permissions to SUPER_ADMIN role..."
    
    # Same as admin - full access
    for perm_code in "${ALL_PERMISSIONS[@]}"; do
        assign_permission_to_role "$super_admin_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ SUPER_ADMIN role granted all permissions"
fi

# ==================== DEFAULT USER ROLE - ALL EXCEPT CREATE/RECORD MEETINGS ====================
user_role_id="${ROLE_IDS[user]}"
if [ -n "$user_role_id" ]; then
    print_info "Assigning permissions to DEFAULT USER role (All except Create/Record Meetings)..."
    
    USER_PERMISSIONS=(
        # Dashboard - Full dashboard access
        "dashboard:view"
        "dashboard:overview"
        "dashboard:recent_meetings"
        "dashboard:upcoming_meetings"
        "dashboard:pending_actions"
        "dashboard:overdue_actions"
        "dashboard:notifications"
        "dashboard:customize"
        
        # Meeting Management - All except create and record
        "meeting:view_all"                      # View all meetings
        "meeting:view"                          # View meetings they're part of
        "meeting:view_recorder"                 # View recorder in meetings
        "meeting:status_change"                 # Change meeting status (useful for participants)
        "meeting:update"                        # Update meeting details
        "meeting:delete"                        # Delete meetings they created
        
        # Minutes Management - Full minutes access except approve/sign
        "minutes:view"                          # View minutes
        "minutes:add"                           # Add minutes to meetings
        "minutes:edit"                          # Edit minutes
        "minutes:delete"                        # Delete minutes
        "minutes:export"                        # Export minutes
        
        # Actions Management - Full action management
        "action:create"                         # Create actions from meetings
        "action:update"                         # Update actions
        "action:delete"                         # Delete actions
        "action:view_all"                       # View all actions
        "action:view_own"                       # View assigned actions
        "action:assign"                         # Assign actions to others
        "action:status_update"                  # Update action status
        "action:priority_update"                # Update action priority
        "action:comment"                        # Comment on actions
        "action:attachment"                     # Add attachments to actions
        
        # Notifications - Full notification access
        "notification:send"                     # Send notifications
        "notification:email"                    # Send email notifications
        "notification:view"                     # View notifications
        
        # Profile Management - Full profile control
        "profile:view"                          # View own profile
        "profile:update"                        # Update own profile
        "profile:change_password"               # Change password
        
        # Participants Management - Full participant management
        "participant:add"                       # Add participants
        "participant:remove"                    # Remove participants
        "participant:view"                      # View participants
        "participant:manage_lists"              # Manage participant lists
        
        # Reports - Full reporting
        "report:meeting"                        # Meeting reports
        "report:action"                         # Action reports
        "report:participant"                    # Participant reports
        "report:export"                         # Export reports
    )
    
    for perm_code in "${USER_PERMISSIONS[@]}"; do
        assign_permission_to_role "$user_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ DEFAULT USER role granted all permissions except Create/Record Meetings"
fi

# ==================== SECRETARY ROLE ====================
secretary_role_id="${ROLE_IDS[secretary]}"
if [ -z "$secretary_role_id" ]; then
    # Create secretary role if it doesn't exist
    print_info "Creating Secretary role..."
    SECRETARY_RESPONSE=$(curl -s -X POST "${API_URL}/roles/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d '{
            "code": "secretary",
            "name": "Secretary",
            "description": "Meeting secretary role with minutes management permissions"
        }')
    
    secretary_role_id=$(echo "$SECRETARY_RESPONSE" | jq -r '.id // empty' 2>/dev/null)
    if [ -n "$secretary_role_id" ] && [ "$secretary_role_id" != "null" ]; then
        ROLE_IDS["secretary"]="$secretary_role_id"
        print_success "✅ Secretary role created"
    else
        print_error "Failed to create Secretary role"
    fi
fi

if [ -n "$secretary_role_id" ]; then
    print_info "Assigning permissions to SECRETARY role..."
    
    SECRETARY_PERMISSIONS=(
        # Full access similar to admin but focused on minutes
        "dashboard:view" "dashboard:overview" "dashboard:recent_meetings"
        "dashboard:upcoming_meetings" "dashboard:pending_actions"
        "dashboard:overdue_actions" "dashboard:notifications"
        
        "meeting:create" "meeting:view_all" "meeting:view"
        "meeting:status_change" "meeting:record" "meeting:view_recorder"
        "meeting:update"
        
        "minutes:add" "minutes:edit" "minutes:delete" "minutes:view"
        "minutes:approve" "minutes:export" "minutes:sign"
        
        "action:create" "action:update" "action:view_all" "action:assign"
        "action:status_update" "action:priority_update" "action:comment"
        
        "notification:send" "notification:email" "notification:view"
        
        "profile:view" "profile:update" "profile:change_password"
        
        "participant:add" "participant:remove" "participant:view" "participant:manage_lists"
        
        "report:meeting" "report:action" "report:export"
    )
    
    for perm_code in "${SECRETARY_PERMISSIONS[@]}"; do
        assign_permission_to_role "$secretary_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ SECRETARY role granted full minutes and meeting permissions"
fi

# ==================== MEETING PARTICIPANT ROLE ====================
participant_role_id="${ROLE_IDS[meeting_participant]}"
if [ -n "$participant_role_id" ]; then
    print_info "Assigning permissions to MEETING PARTICIPANT role..."
    
    PARTICIPANT_PERMISSIONS=(
        "dashboard:view" "dashboard:overview"
        "meeting:view" "meeting:view_recorder"
        "minutes:view"
        "action:view_own" "action:status_update" "action:comment"
        "profile:view" "profile:update" "profile:change_password"
        "notification:view"
    )
    
    for perm_code in "${PARTICIPANT_PERMISSIONS[@]}"; do
        assign_permission_to_role "$participant_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ MEETING PARTICIPANT role granted view permissions"
fi

# ==================== ACTION OWNER ROLE ====================
action_owner_role_id="${ROLE_IDS[action_owner]}"
if [ -n "$action_owner_role_id" ]; then
    print_info "Assigning permissions to ACTION OWNER role..."
    
    ACTION_OWNER_PERMISSIONS=(
        "dashboard:view" "dashboard:pending_actions" "dashboard:overdue_actions"
        "meeting:view"
        "minutes:view"
        "action:view_own" "action:update" "action:status_update"
        "action:comment" "action:attachment"
        "profile:view" "profile:update" "profile:change_password"
        "notification:view"
    )
    
    for perm_code in "${ACTION_OWNER_PERMISSIONS[@]}"; do
        assign_permission_to_role "$action_owner_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ ACTION OWNER role granted action update permissions"
fi

# ==================== MEETING CREATOR ROLE ====================
meeting_creator_role_id="${ROLE_IDS[meeting_creator]}"
if [ -n "$meeting_creator_role_id" ]; then
    print_info "Assigning permissions to MEETING CREATOR role..."
    
    MEETING_CREATOR_PERMISSIONS=(
        "dashboard:view" "dashboard:overview" "dashboard:recent_meetings"
        "dashboard:upcoming_meetings"
        "meeting:create" "meeting:view" "meeting:status_change"
        "meeting:update" "meeting:record" "meeting:view_recorder"
        "minutes:add" "minutes:edit" "minutes:view"
        "action:create" "action:update" "action:view_own"
        "participant:add" "participant:view"
        "notification:send" "notification:view"
        "profile:view" "profile:update"
    )
    
    for perm_code in "${MEETING_CREATOR_PERMISSIONS[@]}"; do
        assign_permission_to_role "$meeting_creator_role_id" "$perm_code" > /dev/null 2>&1
    done
    print_success "✅ MEETING CREATOR role granted meeting management permissions"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Permission Seeding Completed Success