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

The update script runs `git pull --ff-only`, rebuilds images, migrates Django, and restarts the containers.
