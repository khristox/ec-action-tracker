#!/bin/bash
# app/db/seed/scripts/seed_document_types.sh
# Seed Document Types attribute group and attributes with enhanced metadata
# Usage: ./seed_document_types.sh [BASE_URL] [USERNAME] [PASSWORD]

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

if ! command -v jq &> /dev/null; then
    print_error "jq is required but not installed. Please install jq first."
    exit 1
fi

# ==================== PARAMETER HANDLING ====================
print_separator
print_header "DOCUMENT TYPES ATTRIBUTE SEEDER"
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
if ! curl -s --connect-timeout 5 -f "${BASE_URL}/health" > /dev/null 2>&1; then
    print_error "Server not running at ${BASE_URL}"
    exit 1
fi
print_success "Server is running"

# ==================== AUTHENTICATION ====================
print_info "Authenticating..."

API_URL="${BASE_URL}/api/v1"
LOGIN_RESPONSE=$(curl -s --connect-timeout 5 -X POST "${API_URL}/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${USERNAME}&password=${PASSWORD}")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
    print_error "Authentication failed"
    exit 1
fi
print_success "Authenticated"

# ==================== CREATE DOCUMENT TYPES GROUP ====================
print_info "Creating Document Types group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "DOCUMENT_TYPE",
    "name": "Document Types",
    "description": "Document types for meetings and action items",
    "allow_multiple": false,
    "is_required": false,
    "display_order": 15,
    "extra_metadata": {
        "icon": "description",
        "color": "#3B82F6",
        "public": true,
        "category": "document_management",
        "group_type": "document_type",
        "ui_component": "dropdown"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s --connect-timeout 5 -X GET "${API_URL}/attribute-groups/?code=DOCUMENT_TYPE" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

# Handle paginated response
if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Document Types group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s --connect-timeout 5 -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Document Types group"
        exit 1
    fi
    print_success "Document Types group created (ID: $GROUP_ID)"
fi

# ==================== DOCUMENT TYPES DATA ====================
# Format: code:name:short_name:sort_order:icon:color:allowed_extensions:description
DOCUMENT_TYPES=(
    "DOC_TYPE_AGENDA:Agenda:AGD:1:article:#3B82F6:pdf,doc,docx:Meeting agenda and schedule documents"
    "DOC_TYPE_PRESENTATION:Presentation:PRS:2:slideshow:#8B5CF6:pdf,ppt,pptx:Slides and presentation materials"
    "DOC_TYPE_REPORT:Report:RPT:3:assessment:#10B981:pdf,doc,docx,xls,xlsx:Formal reports and analysis"
    "DOC_TYPE_MINUTES:Minutes:MNT:4:description:#F59E0B:pdf,doc,docx,txt:Meeting minutes and notes"
    "DOC_TYPE_ATTACHMENT:Attachment:ATT:5:attach_file:#6B7280:pdf,doc,docx,xls,xlsx,ppt,pptx,jpg,png,txt,zip:General attachments and supporting files"
    "DOC_TYPE_REFERENCE:Reference:REF:6:menu_book:#EF4444:pdf,doc,docx,txt,url:Reference materials and resources"
    "DOC_TYPE_CONTRACT:Contract:CNT:7:gavel:#DC2626:pdf,doc,docx:Legal agreements and contracts"
    "DOC_TYPE_INVOICE:Invoice:INV:8:receipt:#059669:pdf,doc,docx,xls,xlsx:Billing and payment documents"
    "DOC_TYPE_POLICY:Policy:PLC:9:policy:#7C3AED:pdf,doc,docx:Organizational policies and guidelines"
    "DOC_TYPE_TRAINING:Training:TRN:10:school:#EA580C:pdf,ppt,pptx,doc,docx:Training materials and guides"
)

# ==================== CREATE DOCUMENT TYPE ATTRIBUTES ====================
print_info "Creating document type attributes..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0

# Process each document type individually
for doc_type in "${DOCUMENT_TYPES[@]}"; do
    IFS=':' read -r code name short_name sort_order icon color allowed_extensions description <<< "$doc_type"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s --connect-timeout 5 -X GET "${API_URL}/attributes/?group_code=DOCUMENT_TYPE&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    # Handle paginated response
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Convert allowed_extensions string to JSON array
    IFS=',' read -ra EXT_ARRAY <<< "$allowed_extensions"
    EXT_JSON=$(printf '"%s",' "${EXT_ARRAY[@]}" | sed 's/,$//')
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "DOCUMENT_TYPE",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${short_name}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "icon": "${icon}",
        "color": "${color}",
        "allowed_extensions": [${EXT_JSON}],
        "max_file_size_mb": 50,
        "description": "${description}",
        "category": "document_management",
        "status": "active",
        "require_approval": false,
        "versioning": true,
        "display_as": "chip",
        "filterable": true
    }
}
EOF
)
    
    # Debug: Show the JSON being sent (optional - remove in production)
    # echo "  JSON Payload:" >&2
    # echo "$ATTRIBUTE_JSON" | jq '.' >&2
    
    RESPONSE=$(curl -s --connect-timeout 5 -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    # Debug: Show response (optional - remove in production)
    # echo "  Response:" >&2
    # echo "$RESPONSE" | jq '.' >&2
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} (${code}) ${icon} - ${description:0:50}..."
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
        # Don't exit, continue with next document type
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.5
done

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying Document Types group..."

# Wait for attributes to be indexed
sleep 2

# Get all attributes in group
VERIFY_RESPONSE=$(curl -s --connect-timeout 5 -X GET "${API_URL}/attribute-groups/DOCUMENT_TYPE/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    
    if [ "$ATTRIBUTE_COUNT" -gt 0 ]; then
        print_success "Found ${ATTRIBUTE_COUNT} document type attributes"
        
        echo ""
        echo -e "${BLUE}📋 Document Type Attributes:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[] | "  • \(.name) (\(.code)) - \(.extra_metadata.icon) - Extensions: \(.extra_metadata.allowed_extensions | join(\", \"))"'
    else
        print_warning "No document type attributes found"
    fi
else
    print_warning "Could not retrieve document type attributes"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Document Types attribute setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total document types: ${#DOCUMENT_TYPES[@]}"
echo "  • Successfully created: ${SUCCESS_COUNT}"
echo "  • Already existed: ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Failed: ${FAIL_COUNT}"
echo ""
echo -e "${CYAN}📋 Document Type Options:${NC}"
echo "  • Agenda (DOC_TYPE_AGENDA) - Meeting agendas 📋"
echo "  • Presentation (DOC_TYPE_PRESENTATION) - Slides and presentations 📊"
echo "  • Report (DOC_TYPE_REPORT) - Formal reports 📑"
echo "  • Minutes (DOC_TYPE_MINUTES) - Meeting minutes 📝"
echo "  • Attachment (DOC_TYPE_ATTACHMENT) - General attachments 📎"
echo "  • Reference (DOC_TYPE_REFERENCE) - Reference materials 📚"
echo "  • Contract (DOC_TYPE_CONTRACT) - Legal agreements ⚖️"
echo "  • Invoice (DOC_TYPE_INVOICE) - Billing documents 💰"
echo "  • Policy (DOC_TYPE_POLICY) - Policies and guidelines 📜"
echo "  • Training (DOC_TYPE_TRAINING) - Training materials 🎓"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get Document Types group (public)"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/DOCUMENT_TYPE\" | jq '.'"
echo ""
echo "  # Get all document type attributes"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/DOCUMENT_TYPE/attributes\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, allowed_extensions: .extra_metadata.allowed_extensions}'"
echo ""
echo "  # Get specific document type"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/?code=DOC_TYPE_ATTACHMENT\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.'"
echo ""
echo "  # Get allowed extensions for a document type"
echo "  curl -X GET \"${BASE_URL}/api/v1/attributes/DOC_TYPE_ATTACHMENT\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.extra_metadata.allowed_extensions'"
echo ""
print_separator