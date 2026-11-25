# Easy Remote Desktop

A browser-based remote desktop prototype for a computer you own or are authorized to control.

## Published controller

https://bigggooner.github.io/Remote-connection/

The controller website is hosted by GitHub Pages. The relay server is a separate Linux VPS service; GitHub Pages cannot run WebSocket signaling or TURN.

## Remote keyboard and mouse

The controller supports mouse movement, left/middle/right click, scrolling, and keyboard key-down/key-up events over an encrypted WebRTC data channel. On phones and tablets, the controller also includes a text box that opens the on-screen keyboard. Touch gestures control the pointer. Click the video to focus a physical keyboard on desktop.

The Windows host uses pynput to apply remote input. The host must approve each session locally. Ctrl+Alt+Esc disables remote input immediately; closing the host window ends the session. Browser and operating-system reserved shortcuts may not be forwarded.

## Relay deployment

The repository now includes:
- `server.js` and `package.json`: WebSocket signaling and short-lived TURN credential API.
- `deploy/relay/`: Docker Compose deployment with Caddy HTTPS and Coturn.
- `web/`: GitHub Pages controller.

For deployment, follow [deploy/relay/README.md](deploy/relay/README.md). You need a Linux VPS with a public IPv4 address, a domain/subdomain pointing to it, and firewall access to TCP 80/443, TCP+UDP 3478, and UDP 49160–49200. A public server is required for dependable home-Wi-Fi to mobile-hotspot connections.

After the relay is running, configure `web/config.js` with:
- `signalingUrl: 'wss://YOUR-RELAY-HOSTNAME'`
- `turnCredentialsUrl: 'https://YOUR-RELAY-HOSTNAME/api/turn-credentials'`

Keep the TURN shared secret only in the VPS `.env` file. Never put it in GitHub or browser/host configuration.

## Windows host

The Windows host files are supplied in the Easy Remote Desktop project ZIP. Extract it on the host PC, run `Start Host.bat`, and approve locally when prompted. Configure the relay URLs in `host/settings.json` after the VPS is deployed.

## Security notice

This is a prototype, not a security-audited commercial remote access product. Keep session codes private, only approve sessions you initiated, use HTTPS/WSS, and stop the host when finished. TURN forwards encrypted WebRTC traffic and consumes VPS bandwidth.
