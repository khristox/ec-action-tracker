#!/bin/bash

echo "🔧 Fixing Alembic migrations..."

# Show current state
echo ""
echo "📌 Current revision:"
alembic current

echo ""
echo "📌 All heads:"
alembic heads

# Get the current head
HEAD=$(alembic heads | grep -v "mergepoint" | head -1 | cut -d' ' -f1)
echo ""
echo "📌 Using head: $HEAD"

# Stamp the database
echo ""
echo "📝 Stamping database to head..."
alembic stamp $HEAD

# Try to upgrade
echo ""
echo "🚀 Applying migrations..."
alembic upgrade head

# Check final state
echo ""
echo "✅ Final state:"
alembic current

echo ""
echo "🎉 Done!"
