#!/usr/bin/env bash
# Cai lich chay tu dong (chay 1 lan bang root): sao luu 02:15 moi dem + giam sat moi 2 phut.
set -euo pipefail
source "$(dirname "${BASH_SOURCE[0]}")/lib.sh"

cat > /etc/cron.d/khaothi <<CRON
SHELL=/bin/bash
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
15 2 * * * root bash $ROOT_DIR/deploy/backup.sh >> /var/log/khaothi-backup.log 2>&1
*/2 * * * * root bash $ROOT_DIR/deploy/healthwatch.sh >> /var/log/khaothi-health.log 2>&1
30 3 * * * root bash $ROOT_DIR/deploy/setup-turn.sh --renew >> /var/log/khaothi-turn.log 2>&1
CRON
chmod 644 /etc/cron.d/khaothi

cat > /etc/logrotate.d/khaothi <<'ROTATE'
/var/log/khaothi-*.log {
    weekly
    rotate 8
    compress
    missingok
    notifempty
}
ROTATE
log "Da cai /etc/cron.d/khaothi va /etc/logrotate.d/khaothi."
