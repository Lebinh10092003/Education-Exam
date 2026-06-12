#!/usr/bin/env bash
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -p khaothi --env-file "$ROOT_DIR/deploy/.env.production" -f "$ROOT_DIR/deploy/docker-compose.prod.yml")
DOMAIN="${DOMAIN:-khaothi.fermat.vn}"
CADDY_CONTAINER="${CADDY_CONTAINER:-movedrive-caddy-1}"
CADDYFILE_PATH="${CADDYFILE_PATH:-/opt/movedrive/Caddyfile}"
CADDY_CONFIG_IN_CONTAINER="${CADDY_CONFIG_IN_CONTAINER:-/etc/caddy/Caddyfile}"

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
    curl -fsS "https://$DOMAIN/api/v1/health/live/" >/dev/null
}

cd "$ROOT_DIR"

git pull --ff-only

"${COMPOSE[@]}" up -d postgres pgbouncer redis livekit
"${COMPOSE[@]}" build backend worker beat frontend
"${COMPOSE[@]}" run --rm backend python manage.py migrate
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" up -d --force-recreate --no-deps frontend
sync_caddy_config
verify_production
"${COMPOSE[@]}" ps
