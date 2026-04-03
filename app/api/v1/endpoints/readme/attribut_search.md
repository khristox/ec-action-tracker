# Basic search within group
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?search=male"

# Search in specific fields only
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?search=he&search_fields=code,name"

# Filter by exact code
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?code=M"

# Filter by sort order range
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?min_sort_order=1&max_sort_order=3"

# Sort by different fields
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?sort_by=name&sort_order=desc"

# Date range filtering
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?created_after=2024-01-01&created_before=2024-12-31"

# Combined search with filters
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?search=he&active_only=true&sort_by=sort_order&limit=10"

# Dedicated search endpoint
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes/search?q=male"

# Continuous scroll
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?limit=5"
# Get next page using cursor from response
curl -X GET "http://localhost:8000/api/v1/attribute-groups/GENDER/attributes?cursor=eyJpZCI6IjEyMyJ9&limit=5"



http://localhost:8000/api/v1/attribute-groups/?include_attributes=false




# Get admin token
ADMIN_TOKEN=$(curl -s -X POST "http://localhost:8001/api/v1/auth/login" \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "username=admin&password=Admin123!" | jq -r '.access_token')

# Verify token is set
echo "Token: $ADMIN_TOKEN"

curl -X GET "http://localhost:8001/api/v1/courses/" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json"

