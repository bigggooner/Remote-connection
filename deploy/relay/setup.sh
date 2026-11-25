#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
if [[ -f .env ]]; then echo ".env already exists; edit it manually."; exit 1; fi
command -v docker >/dev/null || { echo "Install Docker Engine first."; exit 1; }
docker compose version >/dev/null 2>&1 || { echo "Install Docker Compose v2."; exit 1; }
command -v openssl >/dev/null || { echo "Install openssl."; exit 1; }
read -r -p "Relay hostname (e.g. relay.example.com): " DOMAIN
read -r -p "GitHub Pages origin (https://bigggooner.github.io): " ORIGIN
[[ "$DOMAIN" =~ ^[A-Za-z0-9.-]+$ ]] || { echo "Invalid hostname."; exit 1; }
[[ "$ORIGIN" =~ ^https://[A-Za-z0-9.-]+(:[0-9]+)?$ ]] || { echo "Enter only an HTTPS origin."; exit 1; }
SECRET="$(openssl rand -hex 32)"
cat > .env <<ENV
RELAY_DOMAIN=$DOMAIN
TURN_REALM=$DOMAIN
TURN_SECRET=$SECRET
TURN_URLS=turn:$DOMAIN:3478?transport=udp,turn:$DOMAIN:3478?transport=tcp
ALLOWED_ORIGINS=$ORIGIN
ENV
chmod 600 .env
echo "Created .env. Open TCP 80/443, TCP+UDP 3478, UDP 49160-49200."
read -r -p "Start Docker services now? [y/N] " ANSWER
if [[ "$ANSWER" =~ ^[Yy]$ ]]; then docker compose up -d --build; docker compose ps; else echo "Start later with docker compose up -d --build"; fi
