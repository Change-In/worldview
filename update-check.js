/* NAV-161: an app window (the laptop app especially) can stay open for days on
   the version it opened with, so fixes never show up. When the app comes back
   into view, ask the server which build it has. If it is newer, offer a
   one-tap reload. It never reloads by itself and stays quiet during a lesson.
   Reads BUILD, currentLessonId and voice from index.html's own script. */
(() => {
  'use strict';
  const GAP = 10 * 60 * 1000;
  let lastCheck = Date.now(), offered = '';
  const read = f => { try { return f(); } catch (e) { return undefined; } };
  const current = () => String(read(() => typeof BUILD === 'string' ? BUILD : '') || '');
  const inLesson = () => !!read(() => (typeof currentLessonId !== 'undefined' && currentLessonId) || (typeof voice !== 'undefined' && voice.active));

  /* Read the page only as far as its BUILD line, then stop downloading. */
  async function serverBuild() {
    const res = await fetch(location.pathname.replace(/[^/]*$/, '') + '?build=' + Date.now(), {cache:'no-store', credentials:'same-origin'});
    if (!res.ok || !res.body) return '';
    const reader = res.body.getReader(), dec = new TextDecoder();
    let text = '';
    for (;;) {
      const {done, value} = await reader.read();
      if (value) text += dec.decode(value, {stream:true});
      const m = text.match(/const BUILD = "([^"]+)"/);
      if (m) { reader.cancel().catch(() => {}); return m[1]; }
      if (done || text.length > 3e6) return '';
    }
  }
  async function check() {
    if (document.hidden || !/^https?:$/.test(location.protocol) || !current() || Date.now() - lastCheck < GAP) return;
    lastCheck = Date.now();
    let next = '';
    try { next = await serverBuild(); } catch (e) { return; }
    if (next && next !== current() && next !== offered && !inLesson()) offer(next);
  }
  function offer(next) {
    offered = next;
    document.getElementById('wv-update')?.remove();
    const el = document.createElement('div');
    el.id = 'wv-update'; el.setAttribute('role', 'status');
    el.innerHTML = '<span><b></b> is ready</span><button type="button" data-u="reload">Reload</button><button type="button" data-u="close" aria-label="Not now">✕</button>';
    el.querySelector('b').textContent = 'Version ' + next.split(' ')[0];
    el.addEventListener('click', e => {
      const u = e.target.closest('[data-u]')?.dataset.u;
      if (u === 'reload') location.reload();
      if (u === 'close') el.remove();
    });
    document.body.appendChild(el);
  }
  const css = document.createElement('style');
  css.textContent = `#wv-update { position:fixed; left:50%; transform:translateX(-50%); bottom:calc(env(safe-area-inset-bottom) + 74px); z-index:300; display:flex; align-items:center; gap:10px; width:max-content; max-width:calc(100vw - 32px); white-space:nowrap; box-sizing:border-box; padding:8px 8px 8px 16px; border-radius:999px; background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ddd); box-shadow:0 10px 30px rgba(0,0,0,.18); font:600 13.5px/1.3 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif; }
#wv-update b { font-weight:700; }
#wv-update button { all:unset; cursor:pointer; padding:8px 14px; border-radius:999px; background:var(--accent,#c96f45); color:#fff; font-weight:700; }
#wv-update button[data-u="close"] { padding:8px 10px; background:transparent; color:var(--ink-soft,#666); }
#wv-update button:focus-visible { outline:2px solid var(--accent,#c96f45); outline-offset:2px; }`;
  document.head.appendChild(css);
  document.addEventListener('visibilitychange', check);
  window.addEventListener('focus', check);
  setInterval(check, GAP);
})();
