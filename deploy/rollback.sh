#!/usr/bin/env bash
# Quay ve ban image truoc lan update.sh gan nhat (tag :previous).
# Luu y: KHONG dao nguoc migration DB. Migration thuong chi them cot/bang nen code cu van chay;
# neu lan cap nhat co migration xoa/doi cot, khoi phuc DB bang restore.sh (update.sh da dump truoc khi migrate).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

for image in "${APP_IMAGES[@]}"; do
    if ! docker image inspect "$image:previous" >/dev/null 2>&1; then
        echo "Khong co $image:previous - khong the rollback."
        exit 1
    fi
done

for image in "${APP_IMAGES[@]}"; do
    docker tag "$image:current" "$image:rollback-from" 2>/dev/null || true
    docker tag "$image:previous" "$image:current"
done

"${COMPOSE[@]}" up -d --no-build --force-recreate backend worker beat frontend mcp
log "Da rollback. Ban vua bi thay the duoc giu o tag :rollback-from."
"${COMPOSE[@]}" ps
