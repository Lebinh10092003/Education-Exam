# EduExam VPS deploy

Production runs with Docker Compose and the existing Caddy reverse proxy on the VPS.

## Files that stay out of Git

- `deploy/.env.production`
- `deploy/livekit.yaml`

## Update after the first deploy

```bash
cd /opt/khaothi.fermat.vn
bash deploy/update.sh
```

The update script runs `git pull --ff-only`, rebuilds images, migrates Django, restarts the containers, syncs the `khaothi.fermat.vn` block into the shared Caddyfile, reloads Caddy, and verifies both the frontend and API.

By default the script expects the existing reverse proxy container and mounted Caddyfile from the MoveDrive stack:

- `CADDY_CONTAINER=movedrive-caddy-1`
- `CADDYFILE_PATH=/opt/movedrive/Caddyfile`
- `CADDY_CONFIG_IN_CONTAINER=/etc/caddy/Caddyfile`

Override those environment variables before running the script if the VPS reverse proxy layout changes.
