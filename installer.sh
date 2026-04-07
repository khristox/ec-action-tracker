pyinstaller --noconfirm --onefile --windowed \
  --name "ecatmis_app" \
  --add-data "static:static" \
  --collect-all uvicorn \
  --collect-all fastapi \
  app/main.py


  zip -r dist/ecatmis_deploy.zip . -x "frontend/*" "venv/*" "backup/*" "dist/*" ".git/*" "build/*" "alembic/*" "app/api/*" "app/crud/*" "app/models/*" "app/schemas/*" "app/core/*" "app/db/*"
  