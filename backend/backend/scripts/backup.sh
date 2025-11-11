#!/bin/bash
# PostgreSQL Backup Script for Linux/Unix
# Creates timestamped compressed backup of voo_db database

set -e  # Exit on error

# Configuration from environment or defaults
DB_NAME="${PGDATABASE:-voo_db}"
DB_HOST="${PGHOST:-localhost}"
DB_PORT="${PGPORT:-5432}"
DB_USER="${PGUSER:-postgres}"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
RETENTION_DAYS="${RETENTION_DAYS:-30}"

# Timestamp for backup file
TIMESTAMP=$(date +%Y%m%d_%H%M)
BACKUP_FILE="voo_db_${TIMESTAMP}.sql"
BACKUP_PATH="${BACKUP_DIR}/${BACKUP_FILE}"
COMPRESSED_PATH="${BACKUP_PATH}.gz"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
WHITE='\033[1;37m'
NC='\033[0m' # No Color

# Create backup directory if it doesn't exist
if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${CYAN}Creating backup directory: ${BACKUP_DIR}${NC}"
    mkdir -p "$BACKUP_DIR"
fi

echo -e "\n${CYAN}===============================================${NC}"
echo -e "${CYAN}  PostgreSQL Backup - voo_db Database${NC}"
echo -e "${CYAN}===============================================${NC}\n"

echo -e "${YELLOW}Configuration:${NC}"
echo -e "${WHITE}  Database: ${DB_NAME}${NC}"
echo -e "${WHITE}  Host: ${DB_HOST}${NC}"
echo -e "${WHITE}  Port: ${DB_PORT}${NC}"
echo -e "${WHITE}  User: ${DB_USER}${NC}"
echo -e "${WHITE}  Backup Dir: ${BACKUP_DIR}${NC}"
echo -e "${WHITE}  File: ${BACKUP_FILE}${NC}"
echo ""

# Check if pg_dump is available
if ! command -v pg_dump &> /dev/null; then
    echo -e "${RED}ERROR: pg_dump not found in PATH${NC}"
    echo -e "${RED}Please ensure PostgreSQL client tools are installed${NC}"
    exit 1
fi

# Check PGPASSWORD
if [ -z "$PGPASSWORD" ]; then
    echo -e "${YELLOW}WARNING: PGPASSWORD environment variable not set${NC}"
    echo -e "${YELLOW}You may be prompted for the database password${NC}"
    echo ""
fi

# Create database dump
echo -e "${YELLOW}Creating database dump...${NC}"

if pg_dump --host="$DB_HOST" \
           --port="$DB_PORT" \
           --username="$DB_USER" \
           --format=plain \
           --file="$BACKUP_PATH" \
           "$DB_NAME" 2>&1; then
    
    echo -e "${GREEN}✓ Database dump created successfully${NC}"
    
    # Get file size
    FILE_SIZE=$(du -h "$BACKUP_PATH" | cut -f1)
    echo -e "${WHITE}  File size: ${FILE_SIZE}${NC}"
    
    # Compress with gzip
    if command -v gzip &> /dev/null; then
        echo -e "\n${YELLOW}Compressing backup...${NC}"
        
        if gzip -f "$BACKUP_PATH"; then
            COMPRESSED_SIZE=$(du -h "$COMPRESSED_PATH" | cut -f1)
            
            echo -e "${GREEN}✓ Backup compressed successfully${NC}"
            echo -e "${WHITE}  Compressed size: ${COMPRESSED_SIZE}${NC}"
            
            FINAL_FILE="$COMPRESSED_PATH"
        else
            echo -e "${YELLOW}✗ Compression failed, keeping uncompressed backup${NC}"
            FINAL_FILE="$BACKUP_PATH"
        fi
    else
        echo -e "\n${YELLOW}WARNING: gzip not found, backup will not be compressed${NC}"
        FINAL_FILE="$BACKUP_PATH"
    fi
    
    # Cleanup old backups
    echo -e "\n${YELLOW}Cleaning up old backups (older than ${RETENTION_DAYS} days)...${NC}"
    
    OLD_BACKUPS=$(find "$BACKUP_DIR" -name "voo_db_*.sql*" -type f -mtime +${RETENTION_DAYS} 2>/dev/null || true)
    
    if [ -n "$OLD_BACKUPS" ]; then
        echo "$OLD_BACKUPS" | while read -r old_backup; do
            echo -e "  ${WHITE}Removing: $(basename "$old_backup")${NC}"
            rm -f "$old_backup"
        done
        COUNT=$(echo "$OLD_BACKUPS" | wc -l)
        echo -e "${GREEN}✓ Removed ${COUNT} old backup(s)${NC}"
    else
        echo -e "${WHITE}  No old backups to remove${NC}"
    fi
    
    # Summary
    echo -e "\n${CYAN}===============================================${NC}"
    echo -e "${GREEN}  Backup Completed Successfully!${NC}"
    echo -e "${CYAN}===============================================${NC}"
    echo -e "${WHITE}  Location: ${FINAL_FILE}${NC}"
    echo -e "${WHITE}  Timestamp: $(date '+%Y-%m-%d %H:%M:%S')${NC}"
    echo -e "\n"
    
else
    echo -e "\n${RED}ERROR: Backup failed${NC}"
    exit 1
fi
