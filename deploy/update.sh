#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE=(docker compose -p khaothi --env-file "$ROOT_DIR/deploy/.env.production" -f "$ROOT_DIR/deploy/docker-compose.prod.yml")

cd "$ROOT_DIR"

git pull --ff-only

"${COMPOSE[@]}" up -d postgres redis livekit
"${COMPOSE[@]}" build backend worker beat frontend
"${COMPOSE[@]}" run --rm backend python manage.py migrate
"${COMPOSE[@]}" up -d
"${COMPOSE[@]}" ps
