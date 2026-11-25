# Internet relay (Node.js signaling + Coturn TURN)

Requires a Linux VPS with a public IPv4 address, Docker Compose v2, and a DNS A record pointing a relay hostname to the VPS.

## DNS and firewall

Create an A record such as relay.example.com pointing to the VPS. Open these ports in both the VPS firewall and provider firewall:
- TCP 80 and 443
- UDP and TCP 3478
- UDP 49160–49200

Install Docker Engine and Compose v2 on Ubuntu. Clone this repository, then:

```bash
cd Remote-connection/deploy/relay
cp .env.example .env
openssl rand -hex 32
```

Put the generated value in TURN_SECRET. Set RELAY_DOMAIN and TURN_REALM to your hostname, TURN_URLS to turn:YOUR_HOST:3478?transport=udp,turn:YOUR_HOST:3478?transport=tcp, and ALLOWED_ORIGINS to https://bigggooner.github.io (origin only, no repository path). Then:

```bash
chmod 600 .env
docker compose up -d --build
docker compose ps
docker compose logs -f signal turn caddy
```

Caddy obtains the HTTPS certificate when DNS and ports 80/443 are ready. Verify https://YOUR_HOST/health returns ok:true and turnConfigured:true.

## Client settings

Set web/config.js to signalingUrl wss://YOUR_HOST and turnCredentialsUrl https://YOUR_HOST/api/turn-credentials. Configure host/settings.json with the same URLs. Never put TURN_SECRET in the website or host settings; it belongs only in the VPS .env.

The host agent asks for local approval and supports Ctrl+Alt+Esc as an emergency stop. Keep the one-time session code private. Test from two different networks. A healthy API does not prove UDP reachability. TURN relays encrypted WebRTC packets and uses VPS bandwidth. This prototype is not security-audited.
