#!/bin/bash

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_PATH="${SCRIPT_DIR}/db/blog.db"
BACKUP_DIR="${SCRIPT_DIR}/backups"
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
BACKUP_FILE="${BACKUP_DIR}/blog_backup_${TIMESTAMP}.db"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Starting backup of $DB_PATH to $BACKUP_FILE..."

# Perform safe SQLite backup (works even if DB is in WAL mode and actively written to)
sqlite3 "$DB_PATH" ".backup '$BACKUP_FILE'"

if [ $? -eq 0 ]; then
    echo "Backup completed successfully!"
    
    # Optional: Compress the backup to save space
    gzip "$BACKUP_FILE"
    echo "Backup compressed: ${BACKUP_FILE}.gz"
    
    # Optional: Keep only the last 7 days of backups to save disk space
    find "$BACKUP_DIR" -name "blog_backup_*.db.gz" -type f -mtime +7 -delete
    echo "Old backups cleaned up."
else
    echo "Backup failed!"
    exit 1
fi
