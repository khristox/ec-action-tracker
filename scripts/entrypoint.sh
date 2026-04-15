#!/bin/bash
# scripts/entrypoint.sh

set -e

echo "Starting EC Action Tracker Application..."
echo "Environment: ${APP_ENV:-production}"

# Function to wait for database
wait_for_db() {
    echo "Waiting for database to be ready..."
    local max_retries=30
    local retry_count=0
    
    until python -c "
import pymysql
import os
try:
    conn = pymysql.connect(
        host=os.getenv('DB_HOST', 'mysql'),
        user=os.getenv('DB_USER', 'ec_user'),
        password=os.getenv('DB_PASSWORD', 'ec_password'),
        database=os.getenv('DB_NAME', 'ec_db'),
        port=int(os.getenv('DB_PORT', 3306))
    )
    conn.close()
    print('Database is ready!')
    exit(0)
except Exception as e:
    print(f'Waiting for database... {e}')
    exit(1)
" 2>/dev/null; do
        retry_count=$((retry_count+1))
        if [ $retry_count -ge $max_retries ]; then
            echo "Error: Database connection timeout after ${max_retries} attempts"
            exit 1
        fi
        echo "Database not ready yet... (attempt $retry_count/$max_retries)"
        sleep 2
    done
}

# Initialize database
init_database() {
    echo "Initializing database..."
    
    # Run migrations (adjust based on your migration system)
    if [ -f "app/db/migrations/init.sql" ]; then
        echo "Running initial migrations..."
        mysql -h${DB_HOST} -u${DB_USER} -p${DB_PASSWORD} ${DB_NAME} < app/db/migrations/init.sql
    fi
    
    # Run seed data
    if [ -f "app/db/seed/seed_data.py" ]; then
        echo "Seeding database..."
        python app/db/seed/seed_data.py
    fi
}

# Main execution
main() {
    # Wait for database
    wait_for_db
    
    # Initialize database (first time only)
    if [ ! -f "/app/.initialized" ]; then
        echo "First time setup - initializing database..."
        init_database
        touch /app/.initialized
        echo "Initialization complete"
    else
        echo "Database already initialized"
    fi
    
    # Start the application
    echo "Starting application server..."
    
    # Choose appropriate start command based on framework
    if [ -f "app/main.py" ]; then
        # FastAPI/Starlette
        exec uvicorn app.main:app --host 0.0.0.0 --port ${APP_PORT:-8000} --reload ${APP_ENV:-production}
    elif [ -f "app.py" ]; then
        # Flask
        exec python app.py
    else
        # Generic Python app
        exec python main.py
    fi
}

main