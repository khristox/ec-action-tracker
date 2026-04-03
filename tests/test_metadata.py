# tests/test_metadata.py
import sys
from pathlib import Path

# Add project root to path FIRST
project_root = str(Path(__file__).parent.parent)  # Go up one level from tests/
if project_root not in sys.path:
    sys.path.insert(0, project_root)
    print(f"✅ Added {project_root} to sys.path")

print("Testing model registration...")
print(f"Python path: {sys.path}")

try:
    # Import Base first
    from app.db.base import Base
    print(f"✅ Base imported successfully")
    
    print(f"Before imports - Tables in metadata: {list(Base.metadata.tables.keys())}")
    
    # Now import models
    from app.models.user import User, Role,Permission
    print(f"✅ Models imported successfully")
    
    # Access tables to force registration
    _ = User.__table__
    _ = Role.__table__
    _ = Permission.__table__
    
    print(f"After imports - Tables in metadata: {list(Base.metadata.tables.keys())}")
    
    if Base.metadata.tables:
        print("✅ Models registered successfully!")
        print(f"Tables: {list(Base.metadata.tables.keys())}")
    else:
        print("❌ Models NOT registered!")
        
except ImportError as e:
    print(f"❌ Import error: {e}")
    
    # Debug: Check what directories exist
    print("\n📁 Checking directory structure:")
    app_path = Path(project_root) / "app"
    if app_path.exists():
        print(f"✅ app directory exists at: {app_path}")
        print(f"Contents: {[p.name for p in app_path.iterdir()]}")
    else:
        print(f"❌ app directory NOT found at: {app_path}")