#!/usr/bin/env bash
# Khoi phuc DB tu file .dump (tao boi backup.sh). GHI DE toan bo du lieu hien tai.
#   CONFIRM=yes bash deploy/restore.sh /opt/backups/khaothi/db/eduexam_YYYYmmdd_HHMMSS.dump
# Ban tren R2 nam trong thu muc backups/db/ cua bucket; tai ve VPS truoc khi chay.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DUMP="${1:-}"
if [[ ! -f "$DUMP" ]]; then
    echo "Dung: CONFIRM=yes bash deploy/restore.sh <file.dump>"
    exit 1
fi
if [[ "${CONFIRM:-}" != "yes" ]]; then
    echo "Lenh nay ghi de toan bo database bang $DUMP."
    echo "Chay lai voi CONFIRM=yes neu chac chan."
    exit 1
fi

log "Kiem tra file dump..."
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$DUMP" > /dev/null

log "Sao luu an toan DB hien tai truoc khi ghi de..."
BACKUP_UPLOAD=0 bash "$ROOT_DIR/deploy/backup.sh" --db-only

log "Dung cac dich vu ung dung (giu postgres/redis)..."
"${COMPOSE[@]}" stop backend worker beat mcp frontend

log "Khoi phuc $DUMP ..."
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_restore -U "$POSTGRES_USER" -d "$POSTGRES_DB" --clean --if-exists --no-owner --single-transaction' < "$DUMP"

log "Migrate (neu dump cu hon code) va khoi dong lai..."
"${COMPOSE[@]}" run --rm backend python manage.py migrate --noinput
"${COMPOSE[@]}" up -d --no-build
log "Khoi phuc xong."
