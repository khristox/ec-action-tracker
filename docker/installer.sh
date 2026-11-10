#!/bin/bash
set -e
#pyinstaller --noconfirm --onefile --windowed \
#  --name "ecatmis_app" \
#  --add-data "static:static" \
#  --collect-all uvicorn \
#  --collect-all fastapi \
#  app/main.py

cd ../frontend

echo "===== BUILDING FRONTEND ====="
npm run build

echo "===== VERIFYING VITE BASE ====="
grep -oE 'src="[^"]+\.js[^"]*"' dist/index.html
grep -oE 'href="[^"]*webmanifest[^"]*"' dist/index.html

cd ../

echo "===== COPYING FRONTEND TO STATIC ====="
rm -rf static/*
mkdir -p static
cp -r frontend/dist/* static/

echo "===== VERIFYING STATIC ====="
grep -oE 'src="[^"]+\.js[^"]*"' static/index.html

echo "===== PREPARING DEPLOYMENT DIST ====="
rm -rf dist
mkdir -p dist
cp -r frontend/dist/* dist/

echo "===== CREATING DEPLOYMENT ZIP ====="
zip -r dist/ecatmis_deploy.zip . \
  -x "frontend/*" \
     "venv/*" \
     "backup/*" \
     "dist/*" \
     ".git/*" \
     "build/*" \
     "alembic/*" \
     "app/api/*" \
     "app/crud/*" \
     "app/models/*" \
     "app/schemas/*" \
     "app/core/*" \
     "app/db/*"

echo "===== BUILD COMPLETE ====="
cd docker