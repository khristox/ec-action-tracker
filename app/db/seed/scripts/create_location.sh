#!/bin/bash
# run_location_loader.sh
# Run location loader with proper PYTHONPATH

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../../.." && pwd)"

# Set PYTHONPATH
export PYTHONPATH="$PROJECT_ROOT:$PYTHONPATH"

# Navigate to project root
cd "$PROJECT_ROOT"

# Run the Python script
python "$SCRIPT_DIR/bulk_load_locations.py" "$@"