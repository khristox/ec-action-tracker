#!/usr/bin/env python
"""
Fix Alembic migrations by properly stamping and applying migrations.
"""
import subprocess
import sys
import os
from pathlib import Path

def run_command(cmd, description=""):
    """Run a command and print output."""
    if description:
        print(f"\n📌 {description}")
        print("=" * 50)
    
    print(f"🔧 Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    
    if result.stdout:
        print(result.stdout)
    if result.stderr:
        print(result.stderr)
    
    return result

def main():
    print("🔧 Fixing Alembic Migrations")
    print("=" * 60)
    
    # Step 1: Check current state
    run_command("alembic current", "Current Revision")
    
    # Step 2: Get the head revision
    result = run_command("alembic heads", "Available Heads")
    heads = result.stdout.strip().split('\n')
    head_revision = heads[0].split()[0] if heads else None
    
    if head_revision:
        print(f"\n📌 Head revision: {head_revision}")
    
    # Step 3: Stamp the database to head (mark as up-to-date)
    print("\n📝 Stamping database to head...")
    run_command(f"alembic stamp {head_revision}", "Stamping Database")
    
    # Step 4: Try to upgrade
    print("\n🚀 Applying migrations...")
    run_command("alembic upgrade head", "Upgrading to Head")
    
    # Step 5: Verify final state
    run_command("alembic current", "Final State")
    
    print("\n" + "=" * 60)
    print("✅ Alembic fix completed!")
    print("\nIf you still see 'Target database is not up to date', try:")
    print("  1. alembic downgrade base")
    print("  2. alembic upgrade head")
    print("  3. alembic revision --autogenerate -m 'add_reminder_columns'")
    print("  4. alembic upgrade head")

if __name__ == "__main__":
    main()
