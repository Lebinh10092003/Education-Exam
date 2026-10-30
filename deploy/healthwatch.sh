#!/usr/bin/env bash
# Giam sat dinh ky (cron moi 2 phut, xem install-cron.sh):
#  - container unhealthy/dung -> tu khoi dong lai + canh bao
#  - /api/v1/health/ready/ loi (DB, Redis, Celery beat/worker)
#  - dia gan day, ban sao luu qua cu
# Chi gui canh bao khi trang thai thay doi (khong spam moi 2 phut).
set -uo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

STATE_FILE="${HEALTHWATCH_STATE_FILE:-/var/tmp/khaothi-healthwatch.state}"
DISK_LIMIT="${HEALTHWATCH_DISK_PERCENT:-$(env_value HEALTHWATCH_DISK_PERCENT)}"; DISK_LIMIT="${DISK_LIMIT:-85}"
BACKUP_DIR="${BACKUP_DIR:-$(env_value BACKUP_DIR)}"; BACKUP_DIR="${BACKUP_DIR:-/opt/backups/khaothi}"
BACKUP_MAX_AGE_HOURS="${BACKUP_MAX_AGE_HOURS:-26}"
WATCHED=(khaothi-backend khaothi-worker khaothi-beat khaothi-frontend khaothi-mcp khaothi-livekit khaothi-pgbouncer)

# Dang chay update.sh thi bo qua de khong khoi dong lai container giua chung.
if [[ -f /var/tmp/khaothi-deploy.lock ]]; then
    log "Dang deploy, bo qua."
    exit 0
fi

problems=()

for name in "${WATCHED[@]}"; do
    if ! status="$(docker inspect -f '{{.State.Status}} {{if .State.Health}}{{.State.Health.Status}}{{end}}' "$name" 2>/dev/null)"; then
        status=missing
    fi
    case "$status" in
        "running healthy"|"running "|"running starting") ;;
        "running unhealthy")
            problems+=("$name unhealthy (da khoi dong lai)")
            docker restart "$name" >/dev/null 2>&1 || true
            ;;
        missing) problems+=("$name khong ton tai") ;;
        *)
            problems+=("$name dang '$status' (da thu khoi dong)")
            docker start "$name" >/dev/null 2>&1 || true
            ;;
    esac
done

ready="$(curl -sS -m 10 "https://$DOMAIN/api/v1/health/ready/" 2>&1 | tr -s '\r\n' ' ' || true)"
if ! grep -q '"status":"ok"' <<<"$ready"; then
    problems+=("health/ready loi: ${ready:0:200}")
fi

disk="$(df --output=pcent / 2>/dev/null | tail -n1 | tr -dc '0-9')"
if [[ -n "$disk" && "$disk" -ge "$DISK_LIMIT" ]]; then
    problems+=("dia / da dung ${disk}%")
fi

if [[ -d "$BACKUP_DIR" ]]; then
    last="$(cat "$BACKUP_DIR/.last-success" 2>/dev/null || echo 0)"
    age_h=$(( ($(date +%s) - last) / 3600 ))
    if (( age_h > BACKUP_MAX_AGE_HOURS )); then
        problems+=("sao luu gan nhat cach day ${age_h} gio")
    fi
fi

if (( ${#problems[@]} )); then
    current="$(printf '%s\n' "${problems[@]}" | sed -E 's/[0-9]+/N/g' | sort)"
    # (chu so da bo o tren: chi canh bao khi LOAI su co thay doi, khong phai khi % dia nhich len)
else
    current=""
fi
previous="$(cat "$STATE_FILE" 2>/dev/null || true)"
if [[ "$current" != "$previous" ]]; then
    if [[ -n "$current" ]]; then
        send_alert "Su co: $(printf '%s; ' "${problems[@]}")"
    else
        send_alert "He thong da on dinh tro lai."
    fi
    printf '%s' "$current" > "$STATE_FILE"
fi
if [[ -z "$current" ]]; then log "OK"; else log "Van de: ${problems[*]}"; fi
