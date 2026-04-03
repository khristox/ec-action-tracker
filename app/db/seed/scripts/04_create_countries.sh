#!/bin/bash
# app/db/seed/scripts/seed_countries.sh
# Seed Countries attribute group and attributes with enhanced metadata

set +e  # Don't exit on error

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_success() { echo -e "${GREEN}✅ $1${NC}"; }
print_error() { echo -e "${RED}❌ $1${NC}"; }
print_info() { echo -e "${BLUE}ℹ️ $1${NC}"; }
print_warning() { echo -e "${YELLOW}⚠️ $1${NC}"; }

# Check if BASE_URL is already set as environment variable or passed as argument
if [ -n "$BASE_URL" ]; then
    print_info "Using BASE_URL from environment: ${BASE_URL}"
elif [ -n "$1" ]; then
    BASE_URL="$1"
    print_info "Using BASE_URL from argument: ${BASE_URL}"
else
    echo ""
    echo -e "${BLUE}=================================${NC}"
    echo -e "${BLUE}  Countries Attribute Setup Script  ${NC}"
    echo -e "${BLUE}=================================${NC}"
    echo ""
    read -p "Enter API base URL [http://localhost:8000]: " BASE_URL
    BASE_URL=${BASE_URL:-http://localhost:8000}
fi

# Check if USERNAME is already set as environment variable
if [ -n "$ADMIN_USERNAME" ]; then
    USERNAME="$ADMIN_USERNAME"
    print_info "Using USERNAME from environment: ${USERNAME}"
elif [ -n "$2" ]; then
    USERNAME="$2"
    print_info "Using USERNAME from argument: ${USERNAME}"
else
    echo ""
    read -p "Enter admin username [admin]: " USERNAME
    USERNAME=${USERNAME:-admin}
fi

# Check if PASSWORD is already set as environment variable
if [ -n "$ADMIN_PASSWORD" ]; then
    PASSWORD="$ADMIN_PASSWORD"
    print_info "Using PASSWORD from environment"
elif [ -n "$3" ]; then
    PASSWORD="$3"
    print_info "Using PASSWORD from argument"
else
    echo ""
    read -sp "Enter admin password [Admin123!]: " PASSWORD
    echo ""
    PASSWORD=${PASSWORD:-Admin123!}
fi

print_info "Using API: ${BASE_URL}"

# Test server connection
echo ""
print_info "Testing server connection..."
if ! curl -s -f "${BASE_URL}/health" > /dev/null 2>&1; then
    print_error "Server is not running at ${BASE_URL}"
    echo "   Please start the server first."
    exit 1
fi
print_success "Server is running"

# Get admin token
echo ""
print_info "Getting admin token..."
LOGIN_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=${USERNAME}&password=${PASSWORD}")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ "$ADMIN_TOKEN" == "null" ] || [ -z "$ADMIN_TOKEN" ]; then
    print_error "Failed to get admin token"
    echo "Response: $LOGIN_RESPONSE"
    echo ""
    echo "Possible issues:"
    echo "  - Invalid username or password"
    echo "  - Server not responding correctly"
    echo "  - API endpoint may be different"
    exit 1
fi
print_success "Got admin token"

# Function to handle API responses
handle_response() {
    local response=$1
    local entity=$2
    
    if echo "$response" | jq -e '.id' > /dev/null 2>&1; then
        print_success "$entity created"
        echo "$response" | jq -r '.id'
        return 0
    elif echo "$response" | jq -e '.detail' > /dev/null 2>&1; then
        local detail=$(echo "$response" | jq -r '.detail')
        if [[ "$detail" == *"already exists"* ]]; then
            print_warning "$entity already exists"
            return 0
        else
            print_error "Failed to create $entity: $detail"
            return 1
        fi
    else
        print_error "Failed to create $entity"
        echo "Response: $response"
        return 1
    fi
}

# Create Countries group with enhanced metadata
create_countries_group() {
    echo ""
    print_info "Creating Countries group with management metadata..."
    
    GROUP_JSON=$(cat <<'EOF'
{
    "code": "COUNTRY",
    "name": "Country",
    "description": "Country of origin or residence",
    "allow_multiple": false,
    "is_required": true,
    "display_order": 6,
    "extra_metadata": {
        "icon": "globe",
        "color": "#4CAF50",
        "public": true,
        "description": "User's country of residence",
        "category": "demographic",
        "sub_category": "location",
        "data_type": "select",
        "searchable": true,
        "filterable": true,
        "sortable": true,
        "group_type": "geographic",
        "ui_component": "dropdown",
        "placeholder": "Select your country",
        "help_text": "Please select your country of residence",
        "tags": ["location", "demographic", "profile", "address"],
        "version": 1,
        "lifecycle": {
            "status": "active"
        }
    }
}
EOF
)
    
    GROUP_RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/attribute-groups/" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$GROUP_JSON")
    
    handle_response "$GROUP_RESPONSE" "Countries group"
}

# Create Countries group
create_countries_group

# Wait a moment for group to be created
sleep 1

# Function to check if country exists - FIXED
country_exists() {
    local code=$1
    local response=$(curl -s -X GET "${BASE_URL}/api/v1/attributes/?group_code=COUNTRY&code=${code}" \
      -H "Authorization: Bearer $ADMIN_TOKEN")
    
    # Check if response is an array and has items
    if echo "$response" | jq -e 'type == "array" and length > 0' > /dev/null 2>&1; then
        local id=$(echo "$response" | jq -r '.[0].id // ""')
        if [ -n "$id" ] && [ "$id" != "null" ] && [ "$id" != "" ]; then
            return 0
        fi
    fi
    return 1
}

# Function to create a country
create_country() {
    local code="$1"
    local name="$2"
    local phone_code="$3"
    local continent="$4"
    local currency="$5"
    local currency_symbol="$6"
    local flag="$7"
    local capital="$8"
    local sort_order="$9"
    local subregion="${10:-}"
    local population="${11:-null}"
    
    # Check if country already exists
    if country_exists "$code"; then
        print_warning "Country $name ($code) already exists, skipping..."
        return 0
    fi
    
    # Build JSON for country creation
    COUNTRY_JSON=$(cat <<EOF
{
    "group_code": "COUNTRY",
    "code": "$code",
    "name": "$name",
    "short_name": "$code",
    "sort_order": $sort_order,
    "extra_metadata": {
        "phone_code": "$phone_code",
        "continent": "$continent",
        "subregion": "$subregion",
        "currency": "$currency",
        "currency_symbol": "$currency_symbol",
        "flag": "$flag",
        "capital": "$capital",
        "population": $population,
        "calling_code": "$phone_code"
    }
}
EOF
)
    
    # Create the country
    RESPONSE=$(curl -s -X POST "${BASE_URL}/api/v1/attributes/" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$COUNTRY_JSON")
    
    if echo "$RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
        print_success "Created $name ($code)"
        return 0
    else
        local detail=$(echo "$RESPONSE" | jq -r '.detail // "Unknown error"')
        print_warning "Could not create $name: $detail"
        echo "Response: $RESPONSE" | head -c 500
        echo ""
        return 1
    fi
}

echo ""
print_info "Seeding countries with enhanced metadata..."

# Track counters
SUCCESS_COUNT=0
FAIL_COUNT=0

# East African Countries
create_country "UG" "Uganda" "+256" "Africa" "UGX" "USh" "🇺🇬" "Kampala" 1 "Eastern Africa" 45741000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "KE" "Kenya" "+254" "Africa" "KES" "KSh" "🇰🇪" "Nairobi" 2 "Eastern Africa" 53771000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "TZ" "Tanzania" "+255" "Africa" "TZS" "TSh" "🇹🇿" "Dodoma" 3 "Eastern Africa" 59734000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "RW" "Rwanda" "+250" "Africa" "RWF" "FRw" "🇷🇼" "Kigali" 4 "Eastern Africa" 12952000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "BI" "Burundi" "+257" "Africa" "BIF" "FBu" "🇧🇮" "Gitega" 5 "Eastern Africa" 11891000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "SS" "South Sudan" "+211" "Africa" "SSP" "£" "🇸🇸" "Juba" 6 "Eastern Africa" 11494000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# Major African Countries
create_country "NG" "Nigeria" "+234" "Africa" "NGN" "₦" "🇳🇬" "Abuja" 10 "Western Africa" 206140000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "ZA" "South Africa" "+27" "Africa" "ZAR" "R" "🇿🇦" "Pretoria" 11 "Southern Africa" 59309000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "GH" "Ghana" "+233" "Africa" "GHS" "₵" "🇬🇭" "Accra" 12 "Western Africa" 31073000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "ET" "Ethiopia" "+251" "Africa" "ETB" "Br" "🇪🇹" "Addis Ababa" 13 "Eastern Africa" 114964000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "EG" "Egypt" "+20" "Africa" "EGP" "£" "🇪🇬" "Cairo" 14 "Northern Africa" 102334000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "MA" "Morocco" "+212" "Africa" "MAD" "DH" "🇲🇦" "Rabat" 15 "Northern Africa" 36910600 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# North America
create_country "US" "United States" "+1" "North America" "USD" "$" "🇺🇸" "Washington, D.C." 30 "North America" 331893000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "CA" "Canada" "+1" "North America" "CAD" "$" "🇨🇦" "Ottawa" 31 "North America" 38008000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "MX" "Mexico" "+52" "North America" "MXN" "$" "🇲🇽" "Mexico City" 32 "North America" 128933000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# Europe
create_country "GB" "United Kingdom" "+44" "Europe" "GBP" "£" "🇬🇧" "London" 40 "Northern Europe" 67886000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "FR" "France" "+33" "Europe" "EUR" "€" "🇫🇷" "Paris" 41 "Western Europe" 67390000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "DE" "Germany" "+49" "Europe" "EUR" "€" "🇩🇪" "Berlin" 42 "Western Europe" 83200000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "IT" "Italy" "+39" "Europe" "EUR" "€" "🇮🇹" "Rome" 43 "Southern Europe" 60360000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "ES" "Spain" "+34" "Europe" "EUR" "€" "🇪🇸" "Madrid" 44 "Southern Europe" 47350000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# Asia
create_country "CN" "China" "+86" "Asia" "CNY" "¥" "🇨🇳" "Beijing" 60 "Eastern Asia" 1411778724 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "IN" "India" "+91" "Asia" "INR" "₹" "🇮🇳" "New Delhi" 61 "Southern Asia" 1380004385 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "JP" "Japan" "+81" "Asia" "JPY" "¥" "🇯🇵" "Tokyo" 62 "Eastern Asia" 125800000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "KR" "South Korea" "+82" "Asia" "KRW" "₩" "🇰🇷" "Seoul" 63 "Eastern Asia" 51709000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "ID" "Indonesia" "+62" "Asia" "IDR" "Rp" "🇮🇩" "Jakarta" 64 "Southeastern Asia" 273524000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# Oceania
create_country "AU" "Australia" "+61" "Oceania" "AUD" "$" "🇦🇺" "Canberra" 80 "Australia and New Zealand" 25788000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "NZ" "New Zealand" "+64" "Oceania" "NZD" "$" "🇳🇿" "Wellington" 81 "Australia and New Zealand" 5110000 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# South America
create_country "BR" "Brazil" "+55" "South America" "BRL" "R$" "🇧🇷" "Brasília" 90 "South America" 213993437 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "AR" "Argentina" "+54" "South America" "ARS" "$" "🇦🇷" "Buenos Aires" 91 "South America" 45195774 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "CL" "Chile" "+56" "South America" "CLP" "$" "🇨🇱" "Santiago" 92 "South America" 19116201 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

# Middle East
create_country "AE" "United Arab Emirates" "+971" "Asia" "AED" "د.إ" "🇦🇪" "Abu Dhabi" 100 "Western Asia" 9890400 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "SA" "Saudi Arabia" "+966" "Asia" "SAR" "﷼" "🇸🇦" "Riyadh" 101 "Western Asia" 34813867 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))
create_country "QA" "Qatar" "+974" "Asia" "QAR" "﷼" "🇶🇦" "Doha" 102 "Western Asia" 2881053 && ((SUCCESS_COUNT++)) || ((FAIL_COUNT++))

echo ""
print_info "Seeding completed! Success: $SUCCESS_COUNT, Failed: $FAIL_COUNT"

# Verify the group was created
echo ""
print_info "Verifying Countries group and attributes..."

# Try to get the group by code directly
VERIFY_RESPONSE=$(curl -s -X GET "${BASE_URL}/api/v1/attribute-groups/COUNTRY" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

if echo "$VERIFY_RESPONSE" | jq -e '.id' > /dev/null 2>&1; then
    GROUP_ID=$(echo "$VERIFY_RESPONSE" | jq -r '.id')
    ATTRIBUTE_COUNT=$(echo "$VERIFY_RESPONSE" | jq -r '.attributes | length // 0')
    print_success "Countries group verified (ID: $GROUP_ID)"
    print_info "Total countries seeded: $ATTRIBUTE_COUNT"
    
    # Show a sample of countries
    if [ $ATTRIBUTE_COUNT -gt 0 ]; then
        echo ""
        echo -e "${BLUE}📋 Sample of seeded countries:${NC}"
        echo "$VERIFY_RESPONSE" | jq -r '.attributes[0:10] | .[] | "  • \(.name) (\(.code)) - Phone: \(.extra_metadata.phone_code) Capital: \(.extra_metadata.capital) \(.extra_metadata.flag)"' 2>/dev/null || echo "  Unable to display sample"
        
        if [ $ATTRIBUTE_COUNT -gt 10 ]; then
            echo "  ... and $((ATTRIBUTE_COUNT - 10)) more countries"
        fi
    else
        print_warning "No countries were created. Please check the API logs."
    fi
else
    print_warning "Could not verify Countries group"
    echo "Response: $VERIFY_RESPONSE" | head -c 500
    echo ""
fi

echo ""
echo -e "${BLUE}=================================${NC}"
echo -e "${GREEN}✅ Countries attribute setup completed!${NC}"
echo -e "${BLUE}=================================${NC}"
echo ""
echo "Total countries seeded: $SUCCESS_COUNT"