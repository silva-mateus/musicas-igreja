#!/bin/bash

# Backup Script - Musicas Igreja (PostgreSQL version)
# Backs up the PostgreSQL database and organized PDFs
#
# Crontab (daily at 3am):
#   0 3 * * * /opt/homelab/scripts/musicas-igreja/backup.sh >> /var/log/musicas-backup.log 2>&1
#
# Manual:
#   ./backup.sh

set -e

# ============================================
# CONFIGURATION
# ============================================

BACKUP_DIR="${BACKUP_DIR:-/home/thi_s/backups/musicas-igreja}"
MAX_BACKUPS="${MAX_BACKUPS:-30}"

PG_CONTAINER="${PG_CONTAINER:-postgres}"
API_CONTAINER="${API_CONTAINER:-musicas-igreja-api}"

DB_NAME="${DB_NAME:-musicas_igreja}"
DB_USER="${DB_USER:-musicas_user}"

TIMESTAMP=$(date +"%Y-%m-%d %H:%M:%S")
DATE_TAG=$(date +"%Y%m%d")

# ============================================
# HELPERS
# ============================================

log()      { echo "[$TIMESTAMP] $1"; }
log_info() { echo "[$TIMESTAMP] [INFO] $1"; }
log_ok()   { echo "[$TIMESTAMP] [OK]   $1"; }
log_err()  { echo "[$TIMESTAMP] [ERR]  $1" >&2; }

# ============================================
# PRE-CHECKS
# ============================================

if ! docker info > /dev/null 2>&1; then
    log_err "Docker is not running"
    exit 1
fi

if ! docker ps --format '{{.Names}}' | grep -q "^${PG_CONTAINER}$"; then
    log_err "PostgreSQL container '${PG_CONTAINER}' is not running"
    exit 1
fi

mkdir -p "$BACKUP_DIR/daily"

log "Starting backup..."

# ============================================
# TEMP DIR
# ============================================

TEMP_DIR=$(mktemp -d)
trap "rm -rf $TEMP_DIR" EXIT

# ============================================
# 1. DATABASE DUMP
# ============================================

log_info "Dumping PostgreSQL database '${DB_NAME}'..."

docker exec "$PG_CONTAINER" pg_dump -U "$DB_USER" -d "$DB_NAME" --no-owner --no-privileges > "$TEMP_DIR/database.sql" 2>/dev/null

if [ -s "$TEMP_DIR/database.sql" ]; then
    DB_SIZE=$(du -h "$TEMP_DIR/database.sql" | awk '{print $1}')
    log_ok "Database dump: ${DB_SIZE}"
else
    log_err "Database dump is empty or failed"
    exit 1
fi

# ============================================
# 2. ORGANIZED PDFs
# ============================================

log_info "Copying organized PDFs..."

if docker ps --format '{{.Names}}' | grep -q "^${API_CONTAINER}$"; then
    docker cp "${API_CONTAINER}:/app/organized" "$TEMP_DIR/organized" 2>/dev/null || {
        log_info "No organized folder found in container, creating empty"
        mkdir -p "$TEMP_DIR/organized"
    }
else
    log_info "API container not running, skipping PDFs"
    mkdir -p "$TEMP_DIR/organized"
fi

PDF_COUNT=$(find "$TEMP_DIR/organized" -name "*.pdf" 2>/dev/null | wc -l)
ORGANIZED_SIZE=$(du -sh "$TEMP_DIR/organized" 2>/dev/null | awk '{print $1}')
log_ok "Organized PDFs: ${PDF_COUNT} files (${ORGANIZED_SIZE})"

# ============================================
# 3. CHECK FOR CHANGES (incremental logic)
# ============================================

CURRENT_HASH=$(sha256sum "$TEMP_DIR/database.sql" | awk '{print $1}')
HASH_FILE="$BACKUP_DIR/.last_backup_hash"

if [ -f "$HASH_FILE" ] && [ "$(cat "$HASH_FILE")" = "$CURRENT_HASH" ]; then
    log_ok "No database changes since last backup - skipping"
    exit 0
fi

# ============================================
# 4. CREATE BACKUP ARCHIVE
# ============================================

BACKUP_NAME="musicas_backup_${DATE_TAG}"
BACKUP_FILE="$BACKUP_DIR/daily/${BACKUP_NAME}.tar.gz"

if [ -f "$BACKUP_FILE" ]; then
    BACKUP_NAME="musicas_backup_${DATE_TAG}_$(date +%H%M%S)"
    BACKUP_FILE="$BACKUP_DIR/daily/${BACKUP_NAME}.tar.gz"
fi

log_info "Creating archive: ${BACKUP_NAME}"

cat > "$TEMP_DIR/MANIFEST.txt" << EOF
Backup - Musicas Igreja
=======================
Date:     $TIMESTAMP
Name:     $BACKUP_NAME
DB Hash:  $CURRENT_HASH

Contents:
  Database: $DB_SIZE
  PDFs:     $PDF_COUNT files ($ORGANIZED_SIZE)
EOF

tar -czf "$BACKUP_FILE" -C "$TEMP_DIR" .

ARCHIVE_SIZE=$(du -h "$BACKUP_FILE" | awk '{print $1}')
log_ok "Archive created: ${BACKUP_FILE} (${ARCHIVE_SIZE})"

echo "$CURRENT_HASH" > "$HASH_FILE"
ln -sf "$BACKUP_FILE" "$BACKUP_DIR/latest.tar.gz"

# ============================================
# 5. ROTATE OLD BACKUPS
# ============================================

BACKUP_COUNT=$(ls -1 "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null | wc -l)

if [ "$BACKUP_COUNT" -gt "$MAX_BACKUPS" ]; then
    REMOVE_COUNT=$((BACKUP_COUNT - MAX_BACKUPS))
    log_info "Rotating: removing ${REMOVE_COUNT} old backup(s)..."
    ls -1t "$BACKUP_DIR/daily/"*.tar.gz | tail -n "$REMOVE_COUNT" | xargs rm -f
    log_ok "Rotation complete"
fi

# ============================================
# SUMMARY
# ============================================

log "Backup complete"
log_info "Directory: $BACKUP_DIR/daily/"
log_info "Backups:   $(ls -1 "$BACKUP_DIR/daily/"*.tar.gz 2>/dev/null | wc -l)"
log_info "Disk used: $(du -sh "$BACKUP_DIR/daily" 2>/dev/null | awk '{print $1}')"
