#!/bin/bash
# app/db/seed/scripts/seed_recurring_meeting.sh
# Seed Recurring Meeting attribute group and attributes
# Usage: ./seed_recurring_meeting.sh [BASE_URL] [USERNAME] [PASSWORD]

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
print_header "RECURRING MEETING ATTRIBUTE SEEDER"
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

# ==================== CREATE RECURRING MEETING GROUP ====================
print_info "Creating Recurring Meeting group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "RECURRING_MEETING",
    "name": "Recurring Meeting Settings",
    "description": "Configuration settings for recurring meetings including recurrence types, days, weeks, and statuses",
    "allow_multiple": false,
    "is_required": false,
    "display_order": 15,
    "extra_metadata": {
        "icon": "repeat",
        "color": "#7C3AED",
        "public": true,
        "category": "meeting",
        "group_type": "recurrence",
        "ui_component": "tabs"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s -X GET "${API_URL}/attribute-groups/?code=RECURRING_MEETING" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

# Handle paginated response
if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Recurring Meeting group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Recurring Meeting group"
        exit 1
    fi
    print_success "Recurring Meeting group created (ID: $GROUP_ID)"
fi

# ==================== RECURRENCE TYPES ====================
print_info "Creating recurrence types..."

RECURRENCE_TYPES=(
    "RECURRENCE_TYPE_DAILY:Daily:daily:1:calendar_today:📅:#7C3AED:Every day:Meeting recurs every day"
    "RECURRENCE_TYPE_WEEKLY:Weekly:weekly:2:calendar_view_week:📆:#3B82F6:Every week:Meeting recurs every week"
    "RECURRENCE_TYPE_BIWEEKLY:Bi-Weekly:biweekly:3:compare_arrows:🔄:#10B981:Every 2 weeks:Meeting recurs every two weeks"
    "RECURRENCE_TYPE_MONTHLY:Monthly:monthly:4:calendar_month:📅:#F59E0B:Every month:Meeting recurs every month"
    "RECURRENCE_TYPE_QUARTERLY:Quarterly:quarterly:5:timeline:📊:#EF4444:Every 3 months:Meeting recurs every quarter (3 months)"
    "RECURRENCE_TYPE_YEARLY:Yearly:yearly:6:event:🎉:#8B5CF6:Every year:Meeting recurs every year"
    "RECURRENCE_TYPE_CUSTOM:Custom:custom:7:tune:⚙️:#6B7280:Custom pattern:Custom recurrence pattern"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for type in "${RECURRENCE_TYPES[@]}"; do
    IFS=':' read -r code name value sort_order icon emoji color description_long description_short <<< "$type"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=RECURRING_MEETING&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "RECURRING_MEETING",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "value": "${value}",
        "icon": "${icon}",
        "emoji": "${emoji}",
        "color": "${color}",
        "description": "${description_short}",
        "long_description": "${description_long}",
        "status": "active",
        "category": "recurrence_type"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} ${emoji} - ${description_short}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
    fi
    
    sleep 0.5
done

echo ""
print_info "Recurrence types summary: Created ${SUCCESS_COUNT}, Skipped ${SKIP_COUNT}, Failed ${FAIL_COUNT}"
echo ""

# ==================== RECURRENCE DAYS ====================
print_info "Creating recurrence days..."

RECURRENCE_DAYS=(
    "RECURRENCE_DAY_MONDAY:Monday:monday:10:schedule:🌙:#EF4444:Mon:Meeting occurs on Monday"
    "RECURRENCE_DAY_TUESDAY:Tuesday:tuesday:11:schedule:🌙:#F59E0B:Tue:Meeting occurs on Tuesday"
    "RECURRENCE_DAY_WEDNESDAY:Wednesday:wednesday:12:schedule:🌙:#10B981:Wed:Meeting occurs on Wednesday"
    "RECURRENCE_DAY_THURSDAY:Thursday:thursday:13:schedule:🌙:#3B82F6:Thu:Meeting occurs on Thursday"
    "RECURRENCE_DAY_FRIDAY:Friday:friday:14:schedule:🎉:#7C3AED:Fri:Meeting occurs on Friday"
    "RECURRENCE_DAY_SATURDAY:Saturday:saturday:15:weekend:🎊:#8B5CF6:Sat:Meeting occurs on Saturday"
    "RECURRENCE_DAY_SUNDAY:Sunday:sunday:16:weekend:🙏:#EC4899:Sun:Meeting occurs on Sunday"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for day in "${RECURRENCE_DAYS[@]}"; do
    IFS=':' read -r code name value sort_order icon emoji color short_name description <<< "$day"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=RECURRING_MEETING&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "RECURRING_MEETING",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "value": "${value}",
        "icon": "${icon}",
        "emoji": "${emoji}",
        "color": "${color}",
        "description": "${description}",
        "day_name": "${name}",
        "status": "active",
        "category": "recurrence_day"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} ${emoji} - ${description}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
    fi
    
    sleep 0.5
done

echo ""
print_info "Recurrence days summary: Created ${SUCCESS_COUNT}, Skipped ${SKIP_COUNT}, Failed ${FAIL_COUNT}"
echo ""

# ==================== RECURRENCE WEEKS ====================
print_info "Creating recurrence weeks..."

RECURRENCE_WEEKS=(
    "RECURRENCE_WEEK_FIRST:First:1:20:looks_one:1️⃣:#10B981:1st:First week of the month"
    "RECURRENCE_WEEK_SECOND:Second:2:21:looks_two:2️⃣:#3B82F6:2nd:Second week of the month"
    "RECURRENCE_WEEK_THIRD:Third:3:22:looks_3:3️⃣:#F59E0B:3rd:Third week of the month"
    "RECURRENCE_WEEK_FOURTH:Fourth:4:23:looks_4:4️⃣:#EF4444:4th:Fourth week of the month"
    "RECURRENCE_WEEK_LAST:Last:-1:24:looks_last:🔚:#7C3AED:Last:Last week of the month"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for week in "${RECURRENCE_WEEKS[@]}"; do
    IFS=':' read -r code name value sort_order icon emoji color short_name description <<< "$week"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=RECURRING_MEETING&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "RECURRING_MEETING",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "value": ${value},
        "icon": "${icon}",
        "emoji": "${emoji}",
        "color": "${color}",
        "description": "${description}",
        "week_number": "${name}",
        "status": "active",
        "category": "recurrence_week"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} ${emoji} - ${description}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
    fi
    
    sleep 0.5
done

echo ""
print_info "Recurrence weeks summary: Created ${SUCCESS_COUNT}, Skipped ${SKIP_COUNT}, Failed ${FAIL_COUNT}"
echo ""

# ==================== RECURRING MEETING STATUSES ====================
print_info "Creating recurring meeting statuses..."

RECURRING_STATUSES=(
    "RECURRING_STATUS_ACTIVE:Active:active:30:play_circle:▶️:#10B981:Meeting is active and generating occurrences"
    "RECURRING_STATUS_PAUSED:Paused:paused:31:pause_circle:⏸️:#F59E0B:Meeting is temporarily paused"
    "RECURRING_STATUS_CANCELLED:Cancelled:cancelled:32:cancel:❌:#EF4444:Meeting has been cancelled"
    "RECURRING_STATUS_COMPLETED:Completed:completed:33:check_circle:✅:#8B5CF6:Meeting has completed all occurrences"
)

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

for status in "${RECURRING_STATUSES[@]}"; do
    IFS=':' read -r code name value sort_order icon emoji color description <<< "$status"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=RECURRING_MEETING&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "RECURRING_MEETING",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "value": "${value}",
        "icon": "${icon}",
        "emoji": "${emoji}",
        "color": "${color}",
        "description": "${description}",
        "status_type": "${value}",
        "status": "active",
        "category": "recurring_status"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} ${emoji} - ${description}"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
    fi
    
    sleep 0.5
done

echo ""
print_info "Recurring statuses summary: Created ${SUCCESS_COUNT}, Skipped ${SKIP_COUNT}, Failed ${FAIL_COUNT}"
echo ""

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying Recurring Meeting group..."

# Wait for attributes to be indexed
sleep 2

# Get all attributes in group
VERIFY_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/RECURRING_MEETING/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    
    if [ "$ATTRIBUTE_COUNT" -gt 0 ]; then
        print_success "Found ${ATTRIBUTE_COUNT} recurring meeting attributes"
        
        echo ""
        echo -e "${BLUE}📋 Recurring Meeting Attributes:${NC}"
        echo ""
        
        # Group by category
        echo -e "${CYAN}  📅 Recurrence Types:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | select(.extra_metadata.category == "recurrence_type") | "    • \(.name) \(.extra_metadata.emoji) - \(.extra_metadata.description)"'
        
        echo ""
        echo -e "${CYAN}  📆 Recurrence Days:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | select(.extra_metadata.category == "recurrence_day") | "    • \(.name) \(.extra_metadata.emoji) - \(.extra_metadata.description)"'
        
        echo ""
        echo -e "${CYAN}  🔢 Recurrence Weeks:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | select(.extra_metadata.category == "recurrence_week") | "    • \(.name) \(.extra_metadata.emoji) - \(.extra_metadata.description)"'
        
        echo ""
        echo -e "${CYAN}  ⚡ Recurring Statuses:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | select(.extra_metadata.category == "recurring_status") | "    • \(.name) \(.extra_metadata.emoji) - \(.extra_metadata.description)"'
    else
        print_warning "No recurring meeting attributes found"
    fi
else
    print_warning "Could not retrieve recurring meeting attributes"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Recurring Meeting attribute setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Recurrence Types: 7"
echo "  • Recurrence Days: 7"
echo "  • Recurrence Weeks: 5"
echo "  • Recurring Statuses: 4"
echo "  • Total attributes: 23"
echo ""
echo -e "${CYAN}📋 Recurrence Options:${NC}"
echo "  • Daily (daily) - Every day 📅"
echo "  • Weekly (weekly) - Every week 📆"
echo "  • Bi-Weekly (biweekly) - Every 2 weeks 🔄"
echo "  • Monthly (monthly) - Every month 📅"
echo "  • Quarterly (quarterly) - Every 3 months 📊"
echo "  • Yearly (yearly) - Every year 🎉"
echo "  • Custom (custom) - Custom pattern ⚙️"
echo ""
echo -e "${CYAN}📅 Day Options:${NC}"
echo "  • Monday - Friday (weekdays) 🌙"
echo "  • Saturday - Sunday (weekends) 🎊"
echo ""
echo -e "${CYAN}🔢 Week Options:${NC}"
echo "  • First, Second, Third, Fourth, or Last week of month"
echo ""
echo -e "${CYAN}⚡ Status Options:${NC}"
echo "  • Active - Generating occurrences ▶️"
echo "  • Paused - Temporarily paused ⏸️"
echo "  • Cancelled - Meeting cancelled ❌"
echo "  • Completed - All occurrences done ✅"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get Recurring Meeting group (public)"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/RECURRING_MEETING\" | jq '.'"
echo ""
echo "  # Get all recurrence type attributes"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/RECURRING_MEETING/attributes?category=recurrence_type\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, value: .extra_metadata.value}'"
echo ""
echo "  # Get all recurrence days"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/?group_code=RECURRING_MEETING&category=recurrence_day\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, day: .extra_metadata.value}'"
echo ""
echo "  # Get specific recurrence type"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/?code=RECURRENCE_TYPE_WEEKLY\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[0].extra_metadata'"
echo ""
echo "  # Get all recurring meeting statuses"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/RECURRING_MEETING/attributes?category=recurring_status\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, status: .extra_metadata.value, emoji: .extra_metadata.emoji}'"
echo ""
print_separator