# test_import.py
try:
    from app.api.v1.endpoints.action_tracker import router
    print("✅ Successfully imported actiontracker router")
    print(f"Router routes: {router.routes}")
except Exception as e:
    print(f"❌ Error importing: {e}")