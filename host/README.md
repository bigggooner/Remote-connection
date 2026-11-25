# Windows host agent

Run Start Host.bat on the Windows computer. The launcher generates a one-time session code, loads host/settings.json, and asks for explicit local approval before screen sharing and remote input begin.

The browser controller sends mouse movement, left/middle/right clicks, scrolling, and keyboard key-down/key-up events over an encrypted WebRTC data channel. The host agent applies them with pynput. Click the remote video to focus keyboard input. Browser and operating-system reserved shortcuts may not be forwarded.

The host can immediately disable remote input with Ctrl+Alt+Esc or stop the session by closing the host window. Only approve sessions you initiated and keep the one-time code private.
