# Easy Remote Desktop

Browser controller for an authorized remote desktop session. The controller website is deployed with GitHub Pages; the host agent and signaling/TURN services run on the host PC and a separate Linux VPS.

## Website deployment

1. Open **Settings → Pages** in this repository.
2. Under **Build and deployment**, select **GitHub Actions**.
3. The workflow at `.github/workflows/pages.yml` publishes the `web/` folder whenever you push to `main`.
4. After the workflow succeeds, your website is:
   `https://bigggooner.github.io/Remote-connection/`

## Important: GitHub Pages is not the relay

GitHub Pages only serves the static browser files. It cannot run the always-on WebSocket signaling server or TURN daemon. For home Wi-Fi ↔ mobile hotspot connections, deploy the signaling service and Coturn on a Linux VPS with a public IP and a domain name.

The relay deployment files and Windows host agent are in the companion project ZIP:
[Download the GitHub + Relay project ZIP](https://github.com/bigggooner/Remote-connection/releases)

Follow `deploy/relay/README.md` in that ZIP to set up the VPS. The VPS must allow TCP 80/443, TCP+UDP 3478, and the configured UDP media relay range. After the relay is running, configure `web/config.js` with:
- `signalingUrl`: `wss://your-relay-domain`
- `turnCredentialsUrl`: `https://your-relay-domain/api/turn-credentials`

Commit and push the updated `web/config.js`; GitHub Pages will publish it automatically. Keep the TURN shared secret only on the VPS in its `.env` file.

## Host and controller

- Host PC: extract the companion ZIP, configure relay settings, then run `Start Host.bat`. Approve access locally when prompted.
- Controller PC: open the GitHub Pages URL, enter the one-time code shown by the host, and select **Connect securely**.
- The host can stop the session by closing the host window or using Ctrl+Alt+Esc.

## Security

This is a prototype, not a security-audited remote access product. Keep one-time session codes private, use HTTPS/WSS, keep TURN secrets off the website and repository, and only connect to computers you own or are authorized to access.
