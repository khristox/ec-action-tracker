#!/bin/bash

echo "📦 Building Docker image..."

# Ensure static directory exists with content
if [ ! -d "static" ] || [ -z "$(ls -A static)" ]; then
    echo "⚠️  Static directory missing or empty. Creating placeholder..."
    mkdir -p static
    cat > static/index.html << 'EOF'
<!DOCTYPE html>
<html>
<head><title>EC Action Tracker API</title></head>
<body><h1>API Running</h1><a href="/docs">Docs</a></body>
</html>
EOF
fi

echo "📁 Files to be included in build:"
docker run --rm -v $(pwd):/app alpine find /app -type f \( -name "*.py" -o -name "*.html" \) | head -20

# Login to Docker Hub
docker login

# Build the image
docker build -t khristox/ec-action-tracker:latest .

# Verify static files in image
echo "🔍 Verifying static files in image..."
docker run --rm khristox/ec-action-tracker:latest ls -la /app/static/

# Tag and push
VERSION=$(date +%Y%m%d-%H%M%S)
docker tag khristox/ec-action-tracker:latest khristox/ec-action-tracker:${VERSION}
docker push khristox/ec-action-tracker:latest
docker push khristox/ec-action-tracker:${VERSION}

echo "✅ Build complete!"
echo "Image: khristox/ec-action-tracker:latest"