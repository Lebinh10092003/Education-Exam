# Ham dung chung cho cac script trong deploy/ (source, khong chay truc tiep).
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT_DIR/deploy/.env.production}"
COMPOSE=(docker compose -p khaothi --env-file "$ENV_FILE" -f "$ROOT_DIR/deploy/docker-compose.prod.yml")
DOMAIN="${DOMAIN:-khaothi.fermat.vn}"
# Image tu build; update.sh giu ban truoc o tag :previous de rollback.
APP_IMAGES=(khaothi-backend khaothi-frontend khaothi-mcp)

# TURN (setup-turn.sh) them cong + chung chi cho LiveKit qua file compose bo sung.
if [[ -f "$ENV_FILE" ]] && grep -qE '^LIVEKIT_TURN_ENABLED=1' "$ENV_FILE"; then
    COMPOSE+=(-f "$ROOT_DIR/deploy/docker-compose.turn.yml")
fi

log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*"; }

# Doc 1 bien tu .env.production (khong source ca file vi gia tri co the chua dau cach).
env_value() {
    local key="$1" line
    [[ -f "$ENV_FILE" ]] || return 0
    line="$(grep -E "^${key}=" "$ENV_FILE" | tail -n1 || true)"
    line="${line#*=}"
    line="${line%$'\r'}"
    if [[ "$line" == \"*\" || "$line" == \'*\' ]]; then
        line="${line:1:${#line}-2}"
    fi
    printf '%s' "$line"
}

container_running() {
    [[ "$(docker inspect -f '{{.State.Running}}' "$1" 2>/dev/null || true)" == "true" ]]
}

# Gui canh bao qua Telegram va/hoac webhook neu da cau hinh trong .env.production.
send_alert() {
    local message="$1" token chat webhook
    token="$(env_value ALERT_TELEGRAM_BOT_TOKEN)"
    chat="$(env_value ALERT_TELEGRAM_CHAT_ID)"
    webhook="$(env_value ALERT_WEBHOOK_URL)"
    log "ALERT: $message"
    if [[ -n "$token" && -n "$chat" ]]; then
        curl -fsS -m 15 "https://api.telegram.org/bot${token}/sendMessage" \
            --data-urlencode "chat_id=${chat}" \
            --data-urlencode "text=[${DOMAIN}] ${message}" >/dev/null || log "Khong gui duoc Telegram."
    fi
    if [[ -n "$webhook" ]]; then
        python3 -c 'import json,sys; print(json.dumps({"text": sys.argv[1]}))' "[${DOMAIN}] ${message}" \
            | curl -fsS -m 15 -H 'Content-Type: application/json' --data-binary @- "$webhook" >/dev/null \
            || log "Khong gui duoc webhook."
    fi
}
