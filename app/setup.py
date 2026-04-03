# app/setup.py
import asyncio
import sys
from pathlib import Path

# Add the parent directory to sys.path (project root)
project_root = str(Path(__file__).parent.parent)
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    print(f"✅ Added {project_root} to sys.path")

# Now use absolute imports starting with 'app'
from app.db.seed.seed_data import main as seed_main

if __name__ == "__main__":
    print("🚀 Running database seed...")
    asyncio.run(seed_main())