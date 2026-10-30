#!/usr/bin/env bash
# Cap nhat production. Cac buoc: kiem tra ca thi dang dien ra -> git pull -> sao luu DB ->
# giu image cu (:previous) -> build tung image -> migrate -> khoi dong -> kiem tra.
# Bien: FORCE_DEPLOY=1 (bo qua chan ca thi), SKIP_BACKUP=1, DEPLOY_MIN_FREE_GB (mac dinh 3).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"
CADDY_CONTAINER="${CADDY_CONTAINER:-examedu-caddy}"
CADDYFILE_PATH="${CADDYFILE_PATH:-/opt/khaothi.fermat.vn/deploy/caddy/Caddyfile}"
CADDY_CONFIG_IN_CONTAINER="${CADDY_CONFIG_IN_CONTAINER:-/etc/caddy/Caddyfile}"
LOCK_FILE=/var/tmp/khaothi-deploy.lock
MIN_FREE_GB="${DEPLOY_MIN_FREE_GB:-3}"

sync_caddy_config() {
    if [[ ! -f "$CADDYFILE_PATH" ]]; then
        echo "Caddyfile not found at $CADDYFILE_PATH; skipping Caddy sync."
        return
    fi

    if ! docker ps --format '{{.Names}}' | grep -Fxq "$CADDY_CONTAINER"; then
        echo "Caddy container $CADDY_CONTAINER is not running; skipping Caddy sync."
        return
    fi

    local backup_path
    backup_path="${CADDYFILE_PATH}.backup.$(date +%Y%m%d%H%M%S)"
    cp "$CADDYFILE_PATH" "$backup_path"

    DOMAIN="$DOMAIN" \
    CADDY_BLOCK_PATH="$ROOT_DIR/deploy/caddy.khaothi.conf" \
    CADDYFILE_PATH="$CADDYFILE_PATH" \
    python3 - <<'PY'
import os
import re
from pathlib import Path

domain = os.environ["DOMAIN"]
block_path = Path(os.environ["CADDY_BLOCK_PATH"])
caddyfile_path = Path(os.environ["CADDYFILE_PATH"])
begin = f"# BEGIN managed {domain}"
end = f"# END managed {domain}"

source_block = block_path.read_text(encoding="utf-8").strip()
managed_block = f"{begin}\n{source_block}\n{end}\n"
text = caddyfile_path.read_text(encoding="utf-8")

marker_pattern = re.compile(
    rf"(?ms)^{re.escape(begin)}\n.*?^{re.escape(end)}\n?"
)
if marker_pattern.search(text):
    updated = marker_pattern.sub(managed_block, text)
else:
    lines = text.splitlines(keepends=True)
    offsets = []
    cursor = 0
    for line in lines:
        offsets.append(cursor)
        cursor += len(line)

    site_pattern = re.compile(
        rf"^\s*(?:https?://)?{re.escape(domain)}(?:[\s{{,]|$)"
    )
    replacement_range = None

    for line, offset in zip(lines, offsets):
        if not site_pattern.match(line):
            continue

        depth = 0
        seen_open = False
        for index in range(offset, len(text)):
            char = text[index]
            if char == "{":
                depth += 1
                seen_open = True
            elif char == "}":
                depth -= 1
                if seen_open and depth == 0:
                    end_index = index + 1
                    if end_index < len(text) and text[end_index] == "\n":
                        end_index += 1
                    replacement_range = (offset, end_index)
                    break
        break

    if replacement_range:
        start, stop = replacement_range
        updated = text[:start] + managed_block + text[stop:]
    else:
        separator = "" if text.endswith("\n") else "\n"
        updated = text + separator + "\n" + managed_block

caddyfile_path.write_text(updated, encoding="utf-8")
PY

    if ! docker exec "$CADDY_CONTAINER" caddy validate --config "$CADDY_CONFIG_IN_CONTAINER"; then
        echo "Caddy validation failed; restoring $backup_path."
        cp "$backup_path" "$CADDYFILE_PATH"
        docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDY_CONFIG_IN_CONTAINER" || true
        exit 1
    fi

    docker exec "$CADDY_CONTAINER" caddy reload --config "$CADDY_CONFIG_IN_CONTAINER"
}

verify_production() {
    docker inspect -f '{{.State.Running}}' khaothi-frontend | grep -Fxq true

    if docker exec "$CADDY_CONTAINER" sh -c "command -v wget >/dev/null 2>&1"; then
        docker exec "$CADDY_CONTAINER" wget -qO- http://khaothi-frontend/ >/dev/null
    else
        echo "wget is unavailable in $CADDY_CONTAINER; skipping in-network frontend probe."
    fi

    curl -fsSIL --max-redirs 5 "https://$DOMAIN/" >/dev/null
    curl -fsS --retry 6 --retry-delay 5 --retry-all-errors "https://$DOMAIN/api/v1/health/live/" >/dev/null
    curl -fsS --retry 6 --retry-delay 5 --retry-all-errors "https://$DOMAIN/mcp/healthz" >/dev/null
    # Ready kiem tra DB/Redis/Celery that; chi canh bao vi nhip tim beat can toi 1 phut sau khoi dong.
    if ! curl -fsS --retry 6 --retry-delay 10 --retry-all-errors "https://$DOMAIN/api/v1/health/ready/"; then
        echo
        echo "CANH BAO: /api/v1/health/ready/ chua on. Kiem tra: docker logs khaothi-worker / khaothi-beat"
    fi
    echo
}

guard_active_exams() {
    if [[ "${FORCE_DEPLOY:-0}" == "1" ]] || ! container_running khaothi-backend; then
        return
    fi
    local active
    active="$(docker exec khaothi-backend python manage.py active_exam_sessions 2>/dev/null | tail -n1 || echo "?")"
    if [[ "$active" == "?" ]]; then
        log "Khong dem duoc phien thi (ban backend cu chua co lenh active_exam_sessions) - tiep tuc."
        return
    fi
    if [[ "$active" != "0" ]]; then
        log "DUNG: dang co $active thi sinh lam bai. Deploy se lam gian doan ket noi cua ho."
        log "Doi het ca thi roi chay lai, hoac FORCE_DEPLOY=1 bash deploy/update.sh neu bat buoc."
        exit 1
    fi
}

check_disk() {
    local free_gb
    free_gb="$(df -P --block-size=1G / | awk 'NR==2 {print $4}')"
    if (( free_gb < MIN_FREE_GB )); then
        log "DUNG: chi con ${free_gb} GB trong (can >= ${MIN_FREE_GB} GB de build). Thu: docker system prune"
        exit 1
    fi
}

keep_previous_images() {
    local image
    for image in "${APP_IMAGES[@]}"; do
        if docker image inspect "$image:current" >/dev/null 2>&1; then
            docker tag "$image:current" "$image:previous"
        fi
    done
}

on_failure() {
    local line="$1"
    send_alert "Deploy THAT BAI o dong $line. Neu he thong hong: bash deploy/rollback.sh"
}

# Gom vao ham: bash doc het truoc khi chay, nen git pull sua file nay giua chung khong gay loi.
main() {
    cd "$ROOT_DIR"
    [[ -f "$ENV_FILE" ]] || { echo "Thieu $ENV_FILE (xem deploy/.env.production.example)."; exit 1; }

    guard_active_exams
    check_disk

    touch "$LOCK_FILE"
    trap 'rm -f "$LOCK_FILE"' EXIT
    trap 'on_failure $LINENO' ERR

    git pull --ff-only
    REVISION="$(git rev-parse --short HEAD)"
    log "Deploy revision $REVISION"

    "${COMPOSE[@]}" up -d postgres pgbouncer redis livekit

    if [[ "${SKIP_BACKUP:-0}" != "1" ]]; then
        log "Sao luu DB truoc khi migrate..."
        bash "$ROOT_DIR/deploy/backup.sh" --db-only
    fi

    keep_previous_images
    # Build lan luot (khong song song) de tranh het RAM tren VPS 4 GB.
    for service in backend frontend mcp; do
        log "Build $service..."
        "${COMPOSE[@]}" build "$service"
    done

    "${COMPOSE[@]}" run --rm backend python manage.py migrate --noinput
    "${COMPOSE[@]}" run --rm backend python manage.py check --tag eduexam_ops || true
    "${COMPOSE[@]}" up -d --no-build
    "${COMPOSE[@]}" up -d --no-build --force-recreate --no-deps frontend
    sync_caddy_config
    verify_production
    "${COMPOSE[@]}" ps

    echo "$(date '+%Y-%m-%d %H:%M:%S') $REVISION" >> "$ROOT_DIR/deploy/.deploy-history"
    docker image prune -f >/dev/null
    log "Xong. Neu can quay lai ban truoc: bash deploy/rollback.sh"
}

main "$@"; exit
