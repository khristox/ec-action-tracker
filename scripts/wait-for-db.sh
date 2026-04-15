#!/bin/bash
# scripts/wait-for-db.sh

set -e

host="${DB_HOST:-mysql}"
port="${DB_PORT:-3306}"
user="${DB_USER:-ec_user}"
password="${DB_PASSWORD:-ec_password}"

echo "Waiting for MySQL at $host:$port..."

until mysql -h"$host" -P"$port" -u"$user" -p"$password" -e "SELECT 1" &>/dev/null; do
    echo "MySQL is unavailable - sleeping"
    sleep 1
done

echo "MySQL is up - executing command"
exec "$@"