/* A disposable preview from the same PCM tap used by the recorder fallback. */
(() => {
  let active = null;
  const q = id => document.getElementById(id);
  const enabled = () => { try { return localStorage.getItem('wv-live-words') !== 'off'; } catch { return true; } };
  const show = (text, note) => {
    if (q('mock-live-words')) q('mock-live-words').textContent = text;
    if (q('mock-live-words-note')) q('mock-live-words-note').textContent = note;
  };
  function stop() {
    const current = active; active = null;
    if (current) {
      clearTimeout(current.timer); clearTimeout(current.limit);
      current.pcm.onPreviewPcm = null;
      current.pcm.onPreviewEnd = null;
      current.queue = []; current.words = '';
      try { current.socket?.close(); } catch {}
    }
    q('mock-live-words-panel')?.setAttribute('hidden','');
    show('', '');
    q('mock-learner-shell')?.style.setProperty('--voice-level','0');
  }
  function begin({pcm, isCurrent, getToken, url, model, preview, car}) {
    stop();
    if (!isCurrent() || car) return;
    if (!pcm) {
      const panel = q('mock-live-words-panel');
      if (panel) panel.hidden = !enabled();
      show('', 'Your recording will appear after you send. Live words are unavailable on this device.');
      return;
    }
    const current = {pcm, queue:[], queuedBytes:0, words:'', socket:null, ready:false, unavailable:false};
    active = current;
    const valid = () => active === current && isCurrent() && pcm.active && !document.hidden;
    const panel = q('mock-live-words-panel');
    const wantsWords = enabled();
    if (panel) panel.hidden = !wantsWords;
    show('', 'Connecting live words…');
    const unavailable = (note = 'Live words unavailable. Your complete recording will appear after you send.') => {
      if (active !== current) return;
      current.unavailable = true; current.queue = []; current.queuedBytes = 0;
      clearTimeout(current.timer); clearTimeout(current.limit);
      try { current.socket?.close(); } catch {}
      show(current.words, note);
    };
    pcm.onPreviewPcm = samples => {
      if (!valid()) { stop(); return; }
      let energy = 0;
      for (const sample of samples) energy += (sample / 32768) ** 2;
      q('mock-learner-shell')?.style.setProperty('--voice-level', String(Math.min(1,Math.sqrt(energy / samples.length) * 7)));
      if (!wantsWords || current.unavailable) return;
      if (current.ready) {
        if (current.socket.bufferedAmount > 262144) { unavailable(); return; }
        current.socket.send(samples);
      } else {
        current.queuedBytes += samples.byteLength;
        if (current.queuedBytes > pcm.sampleRate * 2 * 6) { unavailable(); return; }
        current.queue.push(samples.slice());
      }
    };
    pcm.onPreviewEnd = () => {
      if (active !== current) return;
      unavailable('Live preview finished. Keep talking; your complete recording will appear after you send.');
      q('mock-learner-shell')?.style.setProperty('--voice-level','0');
    };
    if (!wantsWords) return;
    if (model !== 'deepgram-nova-3' || !window.WebSocket) { unavailable('Your recording will appear after you send. Live words are unavailable with this transcription choice.'); return; }
    if (preview) { unavailable('Preview only — no microphone or transcription service is connected.'); return; }
    current.timer = setTimeout(() => unavailable(),8000);
    current.limit = setTimeout(() => unavailable('Live preview finished. Keep talking; your complete recording will appear after you send.'),60000);
    Promise.resolve().then(getToken).then(token => {
      if (!valid() || current.unavailable) return;
      const socket = new WebSocket(url); current.socket = socket;
      socket.onopen = () => {
        if (!valid() || current.unavailable) { socket.close(); return; }
        socket.send(JSON.stringify({type:'start',token,sampleRate:pcm.sampleRate,language:'en'}));
      };
      socket.onmessage = event => {
        if (!valid() || current.unavailable) { socket.close(); return; }
        try {
          const result = JSON.parse(event.data);
          if (result.type === 'ready') {
            clearTimeout(current.timer); current.ready = true;
            for (const chunk of current.queue) socket.send(chunk);
            current.queue = []; current.queuedBytes = 0;
            show('', 'Speak naturally. Live words may change.');
          } else if (result.type === 'caption' && typeof result.text === 'string') {
            if (result.final) current.words = (current.words + ' ' + result.text).trim().slice(-12000);
            const text = result.final ? current.words : (current.words + ' ' + result.text).trim();
            show(text.slice(-12000), 'Live words · preview');
            const words = q('mock-live-words'); if (words) words.scrollTop = words.scrollHeight;
          } else if (result.type === 'closed') unavailable();
        } catch { unavailable(); }
      };
      socket.onerror = () => unavailable();
      socket.onclose = () => { if (active === current && !current.unavailable) unavailable(); };
    }).catch(() => unavailable());
  }
  function initialize() {
    const toggle = q('mock-live-words-toggle');
    if (!toggle) return;
    toggle.setAttribute('aria-pressed',String(enabled()));
    toggle.addEventListener('click', () => {
      const next = !enabled();
      try { localStorage.setItem('wv-live-words',next?'on':'off'); } catch {}
      toggle.setAttribute('aria-pressed',String(next));
      if (!next) stop();
    });
  }
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide',stop);
  window.WorldviewLiveCaptions = {begin,stop};
  initialize();
})();
