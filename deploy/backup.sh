#!/usr/bin/env bash
# Sao luu PostgreSQL (+ media) ra dia VPS va day ban sao len R2.
#   bash deploy/backup.sh            # DB + media
#   bash deploy/backup.sh --db-only  # chi DB (update.sh dung truoc khi migrate)
# Bien (moi truong hoac deploy/.env.production): BACKUP_DIR, BACKUP_KEEP_DAYS,
# BACKUP_REMOTE_KEEP_DAYS, BACKUP_UPLOAD (1/0).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

DB_ONLY=0
[[ "${1:-}" == "--db-only" ]] && DB_ONLY=1

BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-/opt/backups/khaothi}"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-$(env_value BACKUP_KEEP_DAYS)}"; KEEP_DAYS="${KEEP_DAYS:-14}"
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_KEEP_DAYS:-$(env_value BACKUP_REMOTE_KEEP_DAYS)}"; REMOTE_KEEP_DAYS="${REMOTE_KEEP_DAYS:-30}"
UPLOAD="${BACKUP_UPLOAD:-$(env_value BACKUP_UPLOAD)}"; UPLOAD="${UPLOAD:-1}"
MEDIA_VOLUME="${MEDIA_VOLUME:-khaothi_backend_media}"
STAMP="$(date +%Y%m%d_%H%M%S)"

mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/media"
chmod 700 "$BACKUP_DIR"

trap 'send_alert "Sao luu THAT BAI (dong $LINENO)."' ERR

upload() {
    local file="$1" name="$2"
    [[ "$UPLOAD" == "1" ]] || return 0
    if ! container_running khaothi-backend; then
        log "Backend khong chay, bo qua upload $name."
        return 0
    fi
    "${COMPOSE[@]}" exec -T backend python manage.py upload_backup \
        --name "$name" --keep-days "$REMOTE_KEEP_DAYS" < "$file"
}

# 1. Database (dinh dang custom cua pg_dump; khoi phuc bang deploy/restore.sh).
db_file="$BACKUP_DIR/db/eduexam_${STAMP}.dump"
log "Dump PostgreSQL -> $db_file"
"${COMPOSE[@]}" exec -T postgres sh -c 'pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc --no-owner' > "$db_file.partial"
# Doc lai muc luc de chac file khong hong.
"${COMPOSE[@]}" exec -T postgres pg_restore --list < "$db_file.partial" > /dev/null
mv "$db_file.partial" "$db_file"
log "DB: $(du -h "$db_file" | cut -f1)"
upload "$db_file" "db/$(basename "$db_file")"

# 2. Media (tai lieu, avatar...). Anh vi pham da nam tren R2 nen khong can.
if [[ "$DB_ONLY" == "0" ]]; then
    media_file="$BACKUP_DIR/media/media_${STAMP}.tar.gz"
    log "Nen media ($MEDIA_VOLUME) -> $media_file"
    docker run --rm -v "$MEDIA_VOLUME":/data:ro alpine:3.20 tar -C /data -czf - . > "$media_file.partial"
    mv "$media_file.partial" "$media_file"
    log "Media: $(du -h "$media_file" | cut -f1)"
    upload "$media_file" "media/$(basename "$media_file")"
fi

# 3. Xoa ban cu tren dia VPS.
find "$BACKUP_DIR/db" "$BACKUP_DIR/media" -type f -mtime +"$KEEP_DAYS" -delete
find "$BACKUP_DIR" -name '*.partial' -mmin +120 -delete
date +%s > "$BACKUP_DIR/.last-success"
log "Sao luu xong."
