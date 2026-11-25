(() => {
  const $ = id => document.getElementById(id);
  const cfg = window.ERD_CONFIG || {};
  const roomEl = $('room'), serverEl = $('server'), video = $('screen'), wrap = $('screenWrap');
  const defaultWs = location.protocol === 'https:' ? `wss://${location.host}` : `ws://${location.host}`;
  const signalingUrl = cfg.signalingUrl && !cfg.signalingUrl.includes('CHANGE-ME') ? cfg.signalingUrl : defaultWs;
  let ws = null, pc = null, dc = null, focused = false, lastMove = 0, pendingCandidates = [], offerStarted = false, connecting = false;
  serverEl.value = signalingUrl;
  const status = value => { $('status').textContent = value; };
  const peerState = value => { $('peerState').textContent = value; };
  const videoInfo = value => { $('videoInfo').textContent = value; };
  const setConnected = on => { $('connect').disabled = on; $('disconnect').disabled = !on; };
  function sendSignal(data) { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: 'signal', data })); }
  function cleanRoom() { return roomEl.value.trim().toUpperCase(); }
  async function getIceServers() {
    const endpoint = cfg.turnCredentialsUrl;
    if (endpoint && !endpoint.includes('CHANGE-ME')) {
      const response = await fetch(endpoint, { cache: 'no-store' });
      if (!response.ok) throw new Error(`TURN service returned HTTP ${response.status}`);
      const body = await response.json();
      if (!Array.isArray(body.iceServers) || !body.iceServers.length) throw new Error('TURN service returned no ICE servers.');
      return body.iceServers;
    }
    return [{ urls: ['stun:stun.cloudflare.com:3478', 'stun:stun.l.google.com:19302'] }];
  }
  function closeAll() {
    connecting = false; offerStarted = false; pendingCandidates = [];
    try { dc?.close(); } catch {} try { pc?.close(); } catch {} try { ws?.close(); } catch {}
    dc = pc = ws = null; video.srcObject = null; $('placeholder').hidden = false;
    $('fullscreen').disabled = true; $('keyStatus').textContent = 'Input: waiting';
    peerState('Disconnected'); videoInfo('Waiting for video'); status('Offline'); setConnected(false);
  }
  function wireDataChannel(channel) {
    channel.onopen = () => { $('keyStatus').textContent = 'Input channel: connected'; };
    channel.onclose = () => { $('keyStatus').textContent = 'Input channel: closed'; };
    channel.onerror = () => { $('keyStatus').textContent = 'Input channel: error'; };
  }
  async function makePeer() {
    const iceServers = await getIceServers();
    pc = new RTCPeerConnection({ iceServers, iceCandidatePoolSize: 4 });
    pc.addTransceiver('video', { direction: 'recvonly' });
    pc.onicecandidate = event => { if (event.candidate) sendSignal({ candidate: event.candidate }); };
    pc.onconnectionstatechange = () => {
      peerState(pc.connectionState);
      if (pc.connectionState === 'failed') videoInfo('Connection failed — check relay server and firewall.');
    };
    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'checking') videoInfo('Finding network route…');
      if (['connected', 'completed'].includes(pc.iceConnectionState)) { videoInfo('Network connected — checking route…'); showNetworkRoute(); }
      if (pc.iceConnectionState === 'failed') videoInfo('Direct and relay paths failed. Check TURN server ports and settings.');
    };
    pc.ontrack = event => {
      video.srcObject = event.streams?.[0] || new MediaStream([event.track]);
      $('placeholder').hidden = true; $('fullscreen').disabled = false; videoInfo('Receiving host screen');
      video.play().catch(() => { videoInfo('Click the video area to start playback'); });
    };
    dc = pc.createDataChannel('remote-input', { ordered: true }); wireDataChannel(dc);
  }
  async function startOffer() {
    if (offerStarted) return; offerStarted = true;
    try {
      peerState('Preparing secure connection…'); await makePeer();
      const offer = await pc.createOffer(); await pc.setLocalDescription(offer);
      sendSignal({ description: pc.localDescription }); peerState('Negotiating encrypted connection…');
    } catch (error) { peerState('Connection setup failed'); videoInfo(error.message || 'Could not create WebRTC connection.'); console.error(error); }
  }
  async function showNetworkRoute() {
    try {
      const report = await pc.getStats(); let selected = null;
      report.forEach(stat => { if (stat.type === 'candidate-pair' && (stat.selected || (stat.nominated && stat.state === 'succeeded'))) selected = stat; });
      if (!selected) return;
      const local = report.get(selected.localCandidateId), remote = report.get(selected.remoteCandidateId);
      videoInfo(local?.candidateType === 'relay' || remote?.candidateType === 'relay' ? 'Connected through TURN relay' : 'Connected directly (TURN fallback ready)');
    } catch (error) { console.debug('Could not inspect ICE route:', error); }
  }
  function sendInput(payload) { if ($('inputEnabled').checked && dc?.readyState === 'open') dc.send(JSON.stringify(payload)); }
  function point(event) {
    const rect = video.getBoundingClientRect(), width = video.videoWidth || rect.width, height = video.videoHeight || rect.height;
    const scale = Math.min(rect.width / width, rect.height / height), drawWidth = width * scale, drawHeight = height * scale;
    const left = rect.left + (rect.width - drawWidth) / 2, top = rect.top + (rect.height - drawHeight) / 2;
    return { x: Math.max(0, Math.min(1, (event.clientX - left) / drawWidth)), y: Math.max(0, Math.min(1, (event.clientY - top) / drawHeight)) };
  }
  video.addEventListener('pointermove', event => {
    if (!focused) return; const now = performance.now(); if (now - lastMove < 8) return; lastMove = now;
    sendInput({ type: 'move', ...point(event) });
  });
  video.addEventListener('pointerdown', event => { focused = true; video.focus(); sendInput({ type: 'button', button: event.button, down: true, ...point(event) }); event.preventDefault(); });
  video.addEventListener('pointerup', event => { sendInput({ type: 'button', button: event.button, down: false, ...point(event) }); event.preventDefault(); });
  video.addEventListener('contextmenu', event => event.preventDefault());
  video.addEventListener('wheel', event => { if (focused) { sendInput({ type: 'wheel', dx: event.deltaX, dy: event.deltaY }); event.preventDefault(); } }, { passive: false });
  window.addEventListener('keydown', event => {
    if (!focused || document.activeElement === roomEl || document.activeElement === serverEl) return;
    sendInput({ type: 'key', key: event.key, code: event.code, down: true, repeat: event.repeat });
    if (['Tab', 'Alt', 'Meta', 'Control'].includes(event.key) || event.ctrlKey || event.altKey) event.preventDefault();
  });
  window.addEventListener('keyup', event => { if (focused) sendInput({ type: 'key', key: event.key, code: event.code, down: false }); });
  window.addEventListener('blur', () => { focused = false; sendInput({ type: 'release-all' }); });
  async function connect() {
    if (connecting) return;
    const room = cleanRoom(), url = serverEl.value.trim() || signalingUrl;
    if (!/^[A-Z0-9]{6,32}$/.test(room)) { alert('Enter the connection code shown on the host computer.'); return; }
    if (location.protocol === 'https:' && !url.startsWith('wss://')) { alert('Internet connections need a secure signaling address beginning with wss://.'); return; }
    closeAll(); connecting = true; setConnected(true); status('Connecting to relay…');
    try {
      ws = new WebSocket(url);
      ws.onopen = () => { status('Connected to signaling server'); ws.send(JSON.stringify({ type: 'join', room, role: 'controller' })); };
      ws.onmessage = async event => {
        let message; try { message = JSON.parse(event.data); } catch { return; }
        if (message.type === 'joined') {
          status('Joined private session'); if (message.peers > 0) await startOffer(); else peerState('Waiting for host to connect…');
        } else if (message.type === 'peer-joined') { await startOffer(); }
        else if (message.type === 'signal' && message.data) {
          const signal = message.data;
          try {
            if (signal.description) {
              if (!pc) await makePeer();
              await pc.setRemoteDescription(signal.description);
              for (const candidate of pendingCandidates.splice(0)) { try { await pc.addIceCandidate(candidate); } catch (error) { console.warn('Queued ICE candidate:', error); } }
              if (signal.description.type === 'answer') peerState('Encrypted connection established');
            } else if (signal.candidate) {
              if (pc?.remoteDescription) await pc.addIceCandidate(signal.candidate); else pendingCandidates.push(signal.candidate);
            }
          } catch (error) { console.error(error); peerState('Connection negotiation failed'); videoInfo(error.message || 'Could not negotiate WebRTC.'); }
        } else if (message.type === 'error') { alert(message.message || 'The signaling server rejected the connection.'); closeAll(); }
        else if (message.type === 'peer-left') { peerState('Host disconnected'); videoInfo('The host ended the session.'); }
      };
      ws.onerror = () => { status('Signaling error — check the relay address'); };
      ws.onclose = () => { if (connecting) { connecting = false; status('Signaling disconnected'); setConnected(false); } };
    } catch (error) { alert(`Could not connect to signaling server: ${error.message}`); closeAll(); }
  }
  $('connect').onclick = connect; $('disconnect').onclick = closeAll;
  $('fullscreen').onclick = () => wrap.requestFullscreen?.();
  window.addEventListener('beforeunload', closeAll);
  const queryRoom = new URLSearchParams(location.search).get('room');
  if (queryRoom) roomEl.value = queryRoom.toUpperCase();
})();