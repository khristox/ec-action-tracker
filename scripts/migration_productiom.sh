#!/bin/bash
# migrate_production.sh - Enhanced Production Migration Script

set -e  # Exit on any error
set -o pipefail  # Pipe failures cause script to fail

# ============================================
# PRODUCTION MIGRATION SCRIPT
# ============================================

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration - Update these for your environment
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_NAME="${DB_NAME:-ectracker}"
DB_USER="${DB_USER:-ectracker_user}"
DB_PASS="${DB_PASS:-Ec928\$db_}"
BACKUP_DIR="${BACKUP_DIR:-/tmp/backups}"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# ============================================
# FUNCTIONS
# ============================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}  $1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_info() {
    echo -e "${CYAN}ℹ️  $1${NC}"
}

print_step() {
    echo -e "${PURPLE}[$1]${NC} $2"
}

# Function to run psql with password
run_psql() {
    PGPASSWORD="$DB_PASS" psql -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" "$@"
}

# Function to run alembic
run_alembic() {
    alembic "$@"
}

# ============================================
# MAIN SCRIPT
# ============================================

print_header "PRODUCTION MIGRATION SCRIPT"
echo ""
echo "Database: $DB_NAME on $DB_HOST:$DB_PORT"
echo "User: $DB_USER"
echo "Backup directory: $BACKUP_DIR"
echo ""

# Step 0: Pre-flight checks
print_step "0/7" "Running pre-flight checks..."

# Check if database is accessible
print_info "Testing database connection..."
if ! run_psql -c "SELECT 1" > /dev/null 2>&1; then
    print_error "Cannot connect to database. Check your credentials."
    exit 1
fi
print_success "Database connection successful"

# Check if alembic is available
if ! command -v alembic &> /dev/null; then
    print_error "alembic command not found. Activate virtual environment first."
    exit 1
fi
print_success "alembic available"

# Check if virtual environment is active
if [ -z "$VIRTUAL_ENV" ]; then
    print_warning "Virtual environment not active. Some dependencies might be missing."
    echo -e "   Run: ${YELLOW}source venv/bin/activate${NC}"
    echo -e "   Then run this script again."
    exit 1
fi

echo ""

# Step 1: Backup
print_step "1/7" "Creating database backup..."
BACKUP_FILE="backup_${DB_NAME}_$(date +%Y%m%d_%H%M%S).sql"
BACKUP_PATH="$BACKUP_DIR/$BACKUP_FILE"

if run_psql -c "SELECT 1" > /dev/null 2>&1; then
    # Use pg_dump with password
    export PGPASSWORD="$DB_PASS"
    pg_dump -U "$DB_USER" -h "$DB_HOST" -d "$DB_NAME" > "$BACKUP_PATH"
    unset PGPASSWORD
    print_success "Backup saved to: $BACKUP_PATH"
    
    # Show backup size
    BACKUP_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    print_info "Backup size: $BACKUP_SIZE"
else
    print_error "Failed to create backup"
    exit 1
fi

# Step 2: Check current state
print_step "2/7" "Checking current migration state..."
CURRENT_REV=$(run_alembic current | head -1)
echo -e "   Current revision: ${CYAN}$CURRENT_REV${NC}"

# Get list of pending migrations
PENDING_MIGRATIONS=$(run_alembic upgrade --sql head 2>/dev/null | grep -c "CREATE TABLE\|ALTER TABLE\|ADD COLUMN" || echo "0")
print_info "Pending changes: $PENDING_MIGRATIONS migration statements"

# Step 3: Generate migration preview
print_step "3/7" "Generating SQL preview (dry run)..."
PREVIEW_FILE="$BACKUP_DIR/migration_preview_$(date +%Y%m%d_%H%M%S).sql"
run_alembic upgrade --sql head > "$PREVIEW_FILE" 2>&1

if [ -s "$PREVIEW_FILE" ]; then
    print_success "SQL preview saved to: $PREVIEW_FILE"
    PREVIEW_SIZE=$(du -h "$PREVIEW_FILE" | cut -f1)
    print_info "Preview size: $PREVIEW_SIZE"
else
    print_warning "No SQL generated. You might be up to date."
    rm -f "$PREVIEW_FILE"
fi

# Step 4: Show what will change
print_step "4/7" "Changes to be applied:"
echo -e "${YELLOW}----------------------------------------${NC}"

if [ -f "$PREVIEW_FILE" ]; then
    echo "The following operations will be performed:"
    grep -E "CREATE TABLE|ALTER TABLE|ADD COLUMN|CREATE INDEX|DROP TABLE" "$PREVIEW_FILE" 2>/dev/null | head -30 || echo "  No structural changes detected"
    
    # Count changes
    CREATE_COUNT=$(grep -c "CREATE TABLE" "$PREVIEW_FILE" 2>/dev/null || echo "0")
    ALTER_COUNT=$(grep -c "ALTER TABLE" "$PREVIEW_FILE" 2>/dev/null || echo "0")
    ADD_COUNT=$(grep -c "ADD COLUMN" "$PREVIEW_FILE" 2>/dev/null || echo "0")
    
    echo ""
    echo "Summary:"
    echo "  - CREATE TABLE: $CREATE_COUNT"
    echo "  - ALTER TABLE: $ALTER_COUNT"
    echo "  - ADD COLUMN: $ADD_COUNT"
else
    echo "  No preview file available"
fi

echo -e "${YELLOW}----------------------------------------${NC}"

# Step 5: Check if any changes will be applied
if [ "$PENDING_MIGRATIONS" -eq 0 ]; then
    print_warning "No pending migrations detected."
    echo -e "   Your database is already up to date."
    echo -e "   Backup saved to: ${GREEN}$BACKUP_PATH${NC}"
    exit 0
fi

# Step 6: Ask for confirmation
print_step "5/7" "Confirmation required"
echo -e "${RED}⚠️  WARNING: This will modify the production database!${NC}"
echo -e "${YELLOW}This will apply $PENDING_MIGRATIONS migration statements.${NC}"
echo ""
echo -e "${YELLOW}Type 'yes' to continue, 'no' to abort:${NC}"
read -r confirmation

if [ "$confirmation" != "yes" ]; then
    print_error "Migration aborted by user"
    echo "   Backup file: $BACKUP_PATH"
    echo "   SQL preview: $PREVIEW_FILE"
    exit 1
fi

# Additional safety check
echo ""
echo -e "${YELLOW}Are you sure this is the PRODUCTION database? Type 'PRODUCTION' to confirm:${NC}"
read -r confirm_prod

if [ "$confirm_prod" != "PRODUCTION" ]; then
    print_error "Migration aborted - production confirmation failed"
    echo "   Backup file: $BACKUP_PATH"
    echo "   SQL preview: $PREVIEW_FILE"
    exit 1
fi

# Step 7: Run migration
print_step "6/7" "Running migration..."

# Run migration with logging
echo "Starting migration at $(date)" | tee -a "$BACKUP_DIR/migration.log"
if run_alembic upgrade head 2>&1 | tee -a "$BACKUP_DIR/migration.log"; then
    print_success "Migration completed successfully"
else
    print_error "Migration failed!"
    echo "   Backup file: $BACKUP_PATH"
    echo "   Check migration.log for details: $BACKUP_DIR/migration.log"
    exit 1
fi

# Step 8: Verify
print_step "7/7" "Verifying migration..."

# Check current revision
NEW_REV=$(run_alembic current | head -1)
echo -e "   New revision: ${CYAN}$NEW_REV${NC}"

# Check for new tables
echo -e "   Checking for new tables..."
NEW_TABLES=$(run_psql -t -c "\dt" | grep -E "notifications|email_history" || echo "")
if [ -n "$NEW_TABLES" ]; then
    print_success "New tables found:"
    echo "$NEW_TABLES"
else
    print_warning "No new tables detected. They might not be created yet."
fi

# Check table counts
echo ""
print_info "Checking table counts..."
run_psql -t -c "SELECT 'notifications' as table, COUNT(*) FROM notifications UNION SELECT 'email_history', COUNT(*) FROM email_history;" 2>/dev/null || echo "  Tables not ready"

# ============================================
# SUMMARY
# ============================================

echo ""
print_header "MIGRATION COMPLETE"

echo "Summary:"
echo -e "  ✅ Migration: ${GREEN}Successful${NC}"
echo -e "  📊 Backup: ${GREEN}$BACKUP_PATH${NC}"
echo -e "  📝 SQL Preview: ${GREEN}$PREVIEW_FILE${NC}"
echo -e "  📋 Log: ${GREEN}$BACKUP_DIR/migration.log${NC}"
echo ""
echo -e "${YELLOW}Recommended next steps:${NC}"
echo "  1. Test the application functionality"
echo "  2. Monitor for errors: tail -f logs/app.log"
echo "  3. Verify user operations work"
echo "  4. Keep the backup until confirmed stable"

echo ""
print_success "Done!"