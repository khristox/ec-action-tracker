#!/bin/bash
# diagnostic.sh - Check available menu endpoints

BASE_URL="http://localhost:8001"
API_URL="${BASE_URL}/api/v1"

# Login first
echo "Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/auth/login" \
    -H "Content-Type: application/x-www-form-urlencoded" \
    -d "username=admin&password=Admin123!")

ADMIN_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.access_token')

if [ -z "$ADMIN_TOKEN" ] || [ "$ADMIN_TOKEN" == "null" ]; then
    echo "Login failed"
    exit 1
fi

echo "Token obtained: ${ADMIN_TOKEN:0:20}..."

# Check available endpoints
echo -e "\n=== Testing Menu Endpoints ===\n"

# Test GET /menus/
echo "1. GET /menus/"
curl -s -X GET "${API_URL}/menus/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -w "\nHTTP Status: %{http_code}\n"

# Test POST /menus/
echo -e "\n2. POST /menus/ (Method test)"
curl -s -X POST "${API_URL}/menus/" \
    -H "Authorization: Bearer $ADMIN_TOKEN" \
    -H "Content-Type: application/json" \
    -d '{"code":"test","title":"Test","icon":"Test","sort_order":1}' \
    -w "\nHTTP Status: %{http_code}\n"

# Check if router is registered
echo -e "\n3. Check if router is registered"
curl -s -X GET "${API_URL}/openapi.json" | jq '.paths | keys | map(select(contains("menus")))'