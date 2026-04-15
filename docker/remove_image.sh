#
#!/bin/bash

echo "🗑️ Removing khristox/ec-action-tracker:latest image and container..."

# Stop the container if running
echo "Stopping container ec_app..."
docker stop ec_app 2>/dev/null || echo "Container not running"

# Remove the container
echo "Removing container ec_app..."
docker rm ec_app 2>/dev/null || echo "Container not found"

# Remove the image
echo "Removing image khristox/ec-action-tracker:latest..."
docker rmi khristox/ec-action-tracker:latest 2>/dev/null || echo "Image not found"

# Remove any dangling images
echo "Cleaning up dangling images..."
docker image prune -f

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "Verification:"
docker ps -a | grep ec_app || echo "✓ No ec_app container found"
docker images | grep khristox/ec-action-tracker || echo "✓ No khristox/ec-action-tracker images found"
