#!/bin/bash
# switch-env.sh

case "$1" in
  docker)
    echo "Switching to Docker environment..."
    cp .env.docker .env
    echo "✅ Using Docker configuration"
    ;;
  local)
    echo "Switching to Local environment..."
    cp .env.local .env
    echo "✅ Using Local configuration"
    ;;
  *)
    echo "Usage: ./switch-env.sh [docker|local]"
    exit 1
    ;;
esac

echo "Environment switched. Run 'docker-compose up -d' to start"