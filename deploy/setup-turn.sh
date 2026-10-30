#!/usr/bin/env bash
# Bat / gia han / tat TURN (UDP 3478 + TLS 5349) cho LiveKit, dung chung chung chi Caddy cua ten mien.
#   bash deploy/setup-turn.sh            # bat (hoac cap nhat) TURN
#   bash deploy/setup-turn.sh --renew    # cron: chep lai chung chi neu Caddy da gia han
#   bash deploy/setup-turn.sh --disable  # tat TURN
# Moi buoc deu kiem tra lai; neu LiveKit khong khoi dong duoc se tu khoi phuc cau hinh cu.
# Bat/tat lam LiveKit khoi dong lai (webcam ngat vai giay) -> tu choi khi dang co ca thi (FORCE=1 de ep).
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

MODE="${1:-enable}"
CADDY_CONTAINER="${CADDY_CONTAINER:-examedu-caddy}"
CERT_DIR="$ROOT_DIR/deploy/turn-certs"
LIVEKIT_YAML="$ROOT_DIR/deploy/livekit.yaml"
TURN_DOMAIN="${TURN_DOMAIN:-$DOMAIN}"

die() {
    log "LOI: $*"
    # Chay tu cron (--renew) thi khong ai nhin log -> gui canh bao.
    if [[ "$MODE" == "--renew" ]]; then send_alert "Gia han chung chi TURN: $*"; fi
    exit 1
}

active_exams() {
    if [[ "${FORCE:-0}" == "1" ]] || ! container_running khaothi-backend; then
        echo 0
        return
    fi
    docker exec khaothi-backend python manage.py active_exam_sessions 2>/dev/null | tail -n1 || echo 0
}

set_env_flag() {
    local value="$1"
    if grep -qE '^LIVEKIT_TURN_ENABLED=' "$ENV_FILE"; then
        sed -i -E "s/^LIVEKIT_TURN_ENABLED=.*/LIVEKIT_TURN_ENABLED=${value}/" "$ENV_FILE"
    else
        printf '\nLIVEKIT_TURN_ENABLED=%s\n' "$value" >> "$ENV_FILE"
    fi
}

# Chep chung chi cua ten mien tu kho Caddy vao thu muc dich ($1).
fetch_cert() {
    local dest="$1" crt_path key_path
    container_running "$CADDY_CONTAINER" || die "Caddy ($CADDY_CONTAINER) khong chay."
    crt_path="$(docker exec "$CADDY_CONTAINER" sh -c \
        "find / -path /proc -prune -o -type f -path '*/certificates/*/${TURN_DOMAIN}/${TURN_DOMAIN}.crt' -print 2>/dev/null" | head -n1)"
    [[ -n "$crt_path" ]] || die "Khong tim thay chung chi ${TURN_DOMAIN} trong $CADDY_CONTAINER."
    key_path="${crt_path%.crt}.key"
    mkdir -p "$dest"
    chmod 700 "$dest"
    docker exec "$CADDY_CONTAINER" cat "$crt_path" > "$dest/turn.crt"
    docker exec "$CADDY_CONTAINER" cat "$key_path" > "$dest/turn.key"
    chmod 644 "$dest/turn.crt"
    chmod 600 "$dest/turn.key"
    validate_cert "$dest" || die "Chung chi/khoa ${TURN_DOMAIN} khong hop le hoac khong khop nhau."
}

# Nap thu cap chung chi + khoa nhu mot may chu TLS: loi neu hong hoac khong khop.
validate_cert() {
    python3 - "$1/turn.crt" "$1/turn.key" <<'PY' 2>/dev/null
import ssl
import sys

ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
ctx.load_cert_chain(sys.argv[1], sys.argv[2])
PY
}

# Ghi (hoac xoa) khoi turn: trong livekit.yaml, giu nguyen cac phan khac.
write_turn_block() {
    local enable="$1"
    LIVEKIT_YAML="$LIVEKIT_YAML" ENABLE="$enable" TURN_DOMAIN="$TURN_DOMAIN" python3 - <<'PY'
import os
import re
from pathlib import Path

path = Path(os.environ["LIVEKIT_YAML"])
text = path.read_text(encoding="utf-8")
# Bo khoi turn: cu (tu dong "turn:" toi dong top-level tiep theo).
text = re.sub(r"(?ms)^turn:\n(?:[ \t]+.*\n|[ \t]*\n)*", "", text)
if os.environ["ENABLE"] == "1":
    block = (
        "turn:\n"
        "  enabled: true\n"
        f"  domain: {os.environ['TURN_DOMAIN']}\n"
        "  udp_port: 3478\n"
        "  tls_port: 5349\n"
        "  cert_file: /etc/livekit-certs/turn.crt\n"
        "  key_file: /etc/livekit-certs/turn.key\n"
        "  relay_range_start: 30000\n"
        "  relay_range_end: 30049\n"
    )
    if not text.endswith("\n"):
        text += "\n"
    text += block
path.write_text(text, encoding="utf-8")
PY
}

port_busy() {
    local proto="$1" port="$2"
    if [[ "$proto" == udp ]]; then
        ss -Hlnu "sport = :$port" 2>/dev/null | grep -q .
    else
        ss -Hlnt "sport = :$port" 2>/dev/null | grep -q .
    fi
}

recreate_livekit() {
    # Nap lai lib.sh de COMPOSE theo co LIVEKIT_TURN_ENABLED moi.
    source "$ROOT_DIR/deploy/lib.sh"
    "${COMPOSE[@]}" up -d --no-deps --force-recreate livekit
}

# $1 = 1 neu can thay TURN khoi dong; $2 = moc thoi gian (unix) truoc khi khoi dong lai.
# Dat khi container chay on dinh 20 giay (khong tu khoi dong lai) va log moi co dong TURN.
livekit_ok() {
    local want_turn="$1" since="$2" restarts i
    sleep 5
    restarts="$(docker inspect -f '{{.RestartCount}}' khaothi-livekit 2>/dev/null || echo x)"
    for i in 1 2 3 4; do
        sleep 5
        container_running khaothi-livekit || return 1
        [[ "$(docker inspect -f '{{.RestartCount}}' khaothi-livekit 2>/dev/null)" == "$restarts" ]] || return 1
    done
    if [[ "$want_turn" == "1" ]]; then
        docker logs --since "$since" khaothi-livekit 2>&1 | grep -q "Starting TURN server" || return 1
    fi
    return 0
}

[[ -f "$LIVEKIT_YAML" ]] || die "Thieu $LIVEKIT_YAML."
[[ -f "$ENV_FILE" ]] || die "Thieu $ENV_FILE."

case "$MODE" in
    --renew)
        [[ "$(env_value LIVEKIT_TURN_ENABLED)" == "1" ]] || exit 0
        tmp="$(mktemp -d)"
        trap 'rm -rf "$tmp"' EXIT
        fetch_cert "$tmp"
        if cmp -s "$tmp/turn.crt" "$CERT_DIR/turn.crt"; then
            log "Chung chi TURN chua doi."
            exit 0
        fi
        if [[ "$(active_exams)" != "0" ]]; then
            log "Chung chi moi nhung dang co ca thi; se thu lai lan chay sau."
            exit 0
        fi
        cp "$CERT_DIR/turn.crt" "$tmp/old.crt" 2>/dev/null || true
        cp "$CERT_DIR/turn.key" "$tmp/old.key" 2>/dev/null || true
        cp "$tmp/turn.crt" "$tmp/turn.key" "$CERT_DIR/"
        since="$(date +%s)"
        docker restart khaothi-livekit >/dev/null
        if ! livekit_ok 1 "$since"; then
            cp "$tmp/old.crt" "$CERT_DIR/turn.crt"; cp "$tmp/old.key" "$CERT_DIR/turn.key"
            docker restart khaothi-livekit >/dev/null
            send_alert "Gia han chung chi TURN that bai, da dung lai chung chi cu."
            exit 1
        fi
        log "Da cap nhat chung chi TURN."
        ;;

    --disable)
        [[ "$(active_exams)" == "0" ]] || die "Dang co thi sinh lam bai (FORCE=1 de ep)."
        cp "$LIVEKIT_YAML" "$LIVEKIT_YAML.backup.$(date +%Y%m%d%H%M%S)"
        write_turn_block 0
        set_env_flag 0
        since="$(date +%s)"
        recreate_livekit
        livekit_ok 0 "$since" || die "LiveKit khong khoi dong. Xem: docker logs khaothi-livekit"
        log "Da tat TURN."
        ;;

    enable|--enable)
        [[ "$(active_exams)" == "0" ]] || die "Dang co thi sinh lam bai (FORCE=1 de ep)."
        if [[ "$(env_value LIVEKIT_TURN_ENABLED)" != "1" ]]; then
            for spec in udp:3478 tcp:5349 udp:30000 udp:30049; do
                if port_busy "${spec%%:*}" "${spec##*:}"; then
                    die "Cong ${spec##*:}/${spec%%:*} dang bi chuong trinh khac dung tren VPS."
                fi
            done
        fi

        fetch_cert "$CERT_DIR"
        yaml_backup="$LIVEKIT_YAML.backup.$(date +%Y%m%d%H%M%S)"
        cp "$LIVEKIT_YAML" "$yaml_backup"
        old_flag="$(env_value LIVEKIT_TURN_ENABLED)"

        write_turn_block 1
        set_env_flag 1
        log "Khoi dong lai LiveKit voi TURN..."
        since="$(date +%s)"
        if ! recreate_livekit || ! livekit_ok 1 "$since"; then
            log "LiveKit khong khoi dong voi TURN. Log:"
            docker logs --tail 20 khaothi-livekit 2>&1 || true
            log "Khoi phuc cau hinh cu..."
            cp "$yaml_backup" "$LIVEKIT_YAML"
            set_env_flag "${old_flag:-0}"
            recreate_livekit
            send_alert "Bat TURN that bai, da khoi phuc LiveKit ve cau hinh cu."
            exit 1
        fi
        log "TURN da bat: turn:${TURN_DOMAIN}:3478 (UDP), turns:${TURN_DOMAIN}:5349 (TLS)."
        log "Nho mo cac cong tren firewall nha cung cap VPS (neu co): 3478/udp, 5349/tcp, 30000-30049/udp."
        ;;

    *)
        die "Tham so khong hop le: $MODE"
        ;;
esac
