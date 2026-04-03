#!/bin/bash
# app/db/seed/scripts/seed_languages.sh
# Seed Languages attribute group and attributes
# Usage: ./seed_languages.sh [BASE_URL] [USERNAME] [PASSWORD]

# Remove set +e to handle errors properly
# set +e

# ==================== CONFIGURATION ====================
DEFAULT_BASE_URL="http://localhost:8000"
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
print_header "LANGUAGE ATTRIBUTE SEEDER"
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

# ==================== CREATE LANGUAGE GROUP ====================
print_info "Creating Languages group..."

GROUP_JSON=$(cat <<EOF
{
    "code": "LANGUAGE",
    "name": "Languages",
    "description": "Languages available for learning",
    "allow_multiple": false,
    "is_required": true,
    "display_order": 2,
    "extra_metadata": {
        "icon": "translate",
        "color": "#2196F3",
        "public": true,
        "category": "academic",
        "group_type": "language",
        "ui_component": "dropdown"
    }
}
EOF
)

# Check if group exists
EXISTING_GROUP=$(curl -s -X GET "${API_URL}/attribute-groups/?code=LANGUAGE" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$EXISTING_GROUP" | jq -e '.items[0].id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$EXISTING_GROUP" | jq -r '.items[0].id')
    print_warning "Languages group already exists (ID: $GROUP_ID)"
else
    GROUP_RESPONSE=$(curl -s -X POST "${API_URL}/attribute-groups/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$GROUP_JSON")
    
    GROUP_ID=$(echo "$GROUP_RESPONSE" | jq -r '.id')
    
    if [ -z "$GROUP_ID" ] || [ "$GROUP_ID" == "null" ]; then
        print_error "Failed to create Languages group"
        exit 1
    fi
    print_success "Languages group created (ID: $GROUP_ID)"
fi

# ==================== LANGUAGE DATA ====================
# Define languages in a clean array format
LANGUAGES=(
    # code:name:native_name:flag:family:speakers_millions:writing_system:sort_order:difficulty
    "SW:Swahili:Kiswahili:🇹🇿:Bantu:200:Latin:1:Medium"
    "LU:Luganda:Oluganda:🇺🇬:Bantu:10:Latin:2:Medium"
    "RN:Kirundi:Ikirundi:🇧🇮:Bantu:12:Latin:3:Medium"
    "RW:Kinyarwanda:Ikinyarwanda:🇷🇼:Bantu:12:Latin:4:Medium"
    "NY:Chichewa:Chichewa:🇲🇼:Bantu:15:Latin:5:Medium"
    "LO:Luo:Dholuo:🇰🇪:Nilotic:5:Latin:6:Medium"
    "AM:Amharic:አማርኛ:🇪🇹:Semitic:32:Ge'ez:7:Hard"
    "OR:Oromo:Afaan Oromoo:🇪🇹:Cushitic:40:Latin:8:Medium"
    "SO:Somali:Af-Soomaali:🇸🇴:Cushitic:21:Latin:9:Medium"
    "HA:Hausa:Hausa:🇳🇬:Chadic:75:Latin:10:Medium"
    "YO:Yoruba:Yorùbá:🇳🇬:Volta-Niger:45:Latin:11:Medium"
    "IG:Igbo:Igbo:🇳🇬:Volta-Niger:30:Latin:12:Medium"
    "ZU:Zulu:isiZulu:🇿🇦:Bantu:27:Latin:13:Medium"
    "XH:Xhosa:isiXhosa:🇿🇦:Bantu:19:Latin:14:Medium"
    "EN:English:English:🇬🇧:Germanic:1500:Latin:20:Easy"
    "FR:French:Français:🇫🇷:Romance:300:Latin:21:Medium"
    "ES:Spanish:Español:🇪🇸:Romance:600:Latin:22:Medium"
    "PT:Portuguese:Português:🇵🇹:Romance:250:Latin:23:Medium"
    "DE:German:Deutsch:🇩🇪:Germanic:130:Latin:24:Hard"
    "IT:Italian:Italiano:🇮🇹:Romance:85:Latin:25:Medium"
    "RU:Russian:Русский:🇷🇺:Slavic:260:Cyrillic:26:Hard"
    "ZH:Mandarin:中文:🇨🇳:Sinitic:1100:Hanzi:27:Hard"
    "JA:Japanese:日本語:🇯🇵:Japonic:125:Kana/Kanji:28:Hard"
    "KO:Korean:한국어:🇰🇷:Koreanic:77:Hangul:29:Hard"
    "AR:Arabic:العربية:🇸🇦:Semitic:420:Arabic:30:Hard"
    "HI:Hindi:हिन्दी:🇮🇳:Indo-Aryan:600:Devanagari:31:Medium"
    "BN:Bengali:বাংলা:🇧🇩:Indo-Aryan:270:Bengali:32:Medium"
    "ID:Indonesian:Bahasa Indonesia:🇮🇩:Malayic:200:Latin:43:Easy"
    "TH:Thai:ไทย:🇹🇭:Tai:70:Thai:41:Hard"
    "VI:Vietnamese:Tiếng Việt:🇻🇳:Austroasiatic:90:Latin:42:Medium"
    "ASL:American Sign Language:ASL:🇺🇸:Sign:0.5:Sign:100:Medium"
)

# ==================== CREATE LANGUAGE ATTRIBUTES ====================
print_info "Creating language attributes..."
echo ""

SUCCESS_COUNT=0
FAIL_COUNT=0
SKIP_COUNT=0
TOTAL=${#LANGUAGES[@]}

for language in "${LANGUAGES[@]}"; do
    IFS=':' read -r code name native_name flag family speakers writing_system sort_order difficulty <<< "$language"
    
    print_info "Processing: ${name} (${code})..."
    
    # Check if attribute already exists
    EXISTING=$(curl -s -X GET "${API_URL}/attributes/?group_code=LANGUAGE&code=${code}" \
        -H "Authorization: Bearer $ADMIN_TOKEN")
    
    if echo "$EXISTING" | jq -e '.items[0].id' > /dev/null 2>&1; then
        print_warning "  ⏭️  Already exists, skipping"
        ((SKIP_COUNT++))
        continue
    fi
    
    # Create attribute
    ATTRIBUTE_JSON=$(cat <<EOF
{
    "group_code": "LANGUAGE",
    "code": "${code}",
    "name": "${name}",
    "short_name": "${code}",
    "sort_order": ${sort_order},
    "extra_metadata": {
        "icon": "translate",
        "emoji": "${flag}",
        "color": "#2196F3",
        "native_name": "${native_name}",
        "flag": "${flag}",
        "language_family": "${family}",
        "speakers_millions": ${speakers},
        "writing_system": "${writing_system}",
        "difficulty": "${difficulty}",
        "status": "active"
    }
}
EOF
)
    
    RESPONSE=$(curl -s -X POST "${API_URL}/attributes/" \
        -H "Authorization: Bearer $ADMIN_TOKEN" \
        -H "Content-Type: application/json" \
        -d "$ATTRIBUTE_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "  ✅ Created: ${name} (${code}) ${flag} - ${speakers}M speakers"
        ((SUCCESS_COUNT++))
    else
        ERROR=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_error "  ❌ Failed: ${ERROR}"
        ((FAIL_COUNT++))
    fi
    
    # Small delay to avoid rate limiting
    sleep 0.2
done

# ==================== VERIFICATION ====================
echo ""
print_info "Verifying Languages group..."

sleep 2

VERIFY_RESPONSE=$(curl -s -X GET "${API_URL}/attribute-groups/LANGUAGE/attributes" \
    -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.items' > /dev/null 2>&1; then
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq '.items | length')
    
    if [ "$ATTRIBUTE_COUNT" -gt 0 ]; then
        print_success "Found ${ATTRIBUTE_COUNT} languages"
        
        echo ""
        echo -e "${BLUE}📋 Language Samples:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.items[0:10] | .[] | "  • \(.name) (\(.code)) - \(.extra_metadata.emoji) - \(.extra_metadata.speakers_millions)M speakers - Difficulty: \(.extra_metadata.difficulty)"'
        
        if [ "$ATTRIBUTE_COUNT" -gt 10 ]; then
            echo "  ... and $((ATTRIBUTE_COUNT - 10)) more languages"
        fi
    else
        print_warning "No languages found"
    fi
else
    print_warning "Could not retrieve languages"
fi

# ==================== SUMMARY ====================
echo ""
print_separator
print_success "Languages attribute setup completed!"
print_separator
echo ""
echo -e "${CYAN}📊 Summary:${NC}"
echo "  • Total languages: ${TOTAL}"
echo "  • Successfully created: ${SUCCESS_COUNT}"
echo "  • Already existed: ${SKIP_COUNT}"
[ $FAIL_COUNT -gt 0 ] && echo "  • Failed: ${FAIL_COUNT}"
echo ""
echo -e "${CYAN}📋 Language Categories:${NC}"
echo "  • African: Swahili, Luganda, Kirundi, Kinyarwanda, Amharic, Hausa, Yoruba, Igbo, Zulu"
echo "  • European: English, French, Spanish, Portuguese, German, Italian, Russian"
echo "  • Asian: Mandarin, Japanese, Korean, Hindi, Bengali, Indonesian, Thai, Vietnamese"
echo "  • Middle Eastern: Arabic"
echo "  • Sign Languages: ASL"
echo ""
echo -e "${CYAN}🧪 Test commands:${NC}"
echo ""
echo "  # Get all languages (public)"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/LANGUAGE\" | jq '.'"
echo ""
echo "  # Get all language attributes"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/LANGUAGE/attributes\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.items[] | {code, name, speakers: .extra_metadata.speakers_millions}'"
echo ""
echo "  # Search for Swahili"
echo "  curl -X GET \"${BASE_URL}/api/v1/attribute-groups/LANGUAGE/attributes?search=Swahili\" \\"
echo "    -H \"Authorization: Bearer \$ADMIN_TOKEN\" | jq '.'"
echo ""
print_separator