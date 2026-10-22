/* Teacher Studio's helper chat (NAV-197). The teacher talks to their own Codex here, next to the
   live preview. Codex runs on the teacher's computer: this page sends messages to the small
   Worldview Lessons window it opened (window-to-window messages, only between those two pages),
   and that window passes them to Worldview Lessons, which runs Codex in the lesson folder and
   reports its progress back. Changes reach the preview the usual way (the small window saves them).
   Layout: Spotlight. Whatever the teacher touches gets the bigger share; dragging the line sets
   how big, remembered for each side. Off by default: the ⋯ menu or ?helper=on turns it on. */
(function () {
  'use strict';
  var KIT = ['http://localhost:8195', 'http://127.0.0.1:8195'];
  var EFFORTS = [['low', 'Quick'], ['medium', 'Normal'], ['high', 'Deep'], ['xhigh', 'Deepest']];
  var STARTERS = ['How do I begin?', 'What can a lesson do?', 'How do students get my lesson?'];
  var RM = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s) { return document.querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return {'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]; }); }
  function store(k, v) { try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }

  window.WorldviewStudioChat = function (o) {
    var q = new URLSearchParams(location.search).get('helper');
    if (q === 'on' || q === 'off') store('wv-helper', q);
    var P = {model: '', effort: '', fast: null, follow: true, share: {chat: 0.56, prev: 0.34}};
    try { var saved = JSON.parse(store('wv-helper-settings') || '{}'); if (saved && typeof saved === 'object') { Object.assign(P, saved); P.share = Object.assign({chat: 0.56, prev: 0.34}, saved.share || {}); } } catch (e) {}
    var S = {on: store('wv-helper') === 'on', wide: true, kit: null, kitOrigin: '', kitAt: 0, ready: false, need: '', asked: 0,
      items: [], busy: false, live: null, latestUndo: '', codex: true, defaults: null, focus: 'chat', point: null, pointing: false, doneAt: 0, typed: null};
    var mq = window.matchMedia ? matchMedia('(min-width: 900px)') : null;
    S.wide = mq ? mq.matches : true;
    var chat = $('#hchat'), split = $('#hsplit'), line = $('#hline'), main = $('#hmain');

    chat.innerHTML =
      '<div class="hc-head"><span class="hc-title">Helper</span><span class="hc-who" id="hcwho">Codex</span><span class="grow"></span>' +
      '<button type="button" class="iconbtn" id="hcset" aria-expanded="false" aria-controls="hcbox" title="Model, thinking and Fast mode">⚙ <span id="hcsetl"></span></button>' +
      '<button type="button" class="iconbtn" id="hcwin" title="Open this conversation in a text window on your computer">↗ Text window</button></div>' +
      '<div class="hc-set" id="hcbox" hidden>' +
      '<label class="small" for="hcmodel"><b>Model</b></label><select id="hcmodel"></select><span class="small muted" id="hcabout"></span>' +
      '<b class="small">Thinking</b><div class="seg" id="hceffort" role="group" aria-label="How hard it thinks"></div>' +
      '<label class="toggle"><input type="checkbox" id="hcfast"><span>Fast mode <span class="small muted" style="font-weight:500">faster replies; uses your plan’s limits faster</span></span></label>' +
      '<label class="toggle"><input type="checkbox" id="hcfollow"><span>Show me changes <span class="small muted" style="font-weight:500">the preview grows when the lesson changes</span></span></label></div>' +
      '<div class="hc-log" id="hclog" aria-live="polite"></div>' +
      '<form class="hc-comp" id="hccomp" autocomplete="off"><div class="hc-pchip" id="hcpchip" hidden></div>' +
      '<div class="hc-row"><textarea id="hcta" rows="1" placeholder="Tell your helper what you want…" aria-label="Message to your helper" enterkeyhint="send"></textarea>' +
      '<button type="submit" class="hc-send" id="hcsend" aria-label="Send">↑</button></div></form>';
    var log = $('#hclog'), ta = $('#hcta');

    function saveP() { store('wv-helper-settings', JSON.stringify(P)); }
    function lessonId() { var l = o.lesson(); return l ? l.id : ''; }
    function toKit(m) {
      if (!S.kit || !S.kitOrigin) return false;
      try { S.kit.postMessage(Object.assign({wvstudio: 1, w: lessonId()}, m), S.kitOrigin); return true; } catch (e) { return false; }
    }

    /* ---------- layout: Spotlight plus a line you can drag ---------- */
    function applySplit() {
      var on = S.on && S.wide;
      split.classList.toggle('on', on); chat.hidden = !on; line.hidden = !on;
      document.body.classList.toggle('helperon', on);
      split.style.setProperty('--c', S.focus === 'chat' ? P.share.chat : P.share.prev);
      $('#pointbtn').hidden = !on; $('#fshelper').hidden = !on;
      $('#helpernote').hidden = !(S.on && !S.wide);
      var t = $('#helpertoggle'); if (t) t.textContent = S.on ? 'Turn off the helper chat' : 'Helper chat (try it)';
      if (!on && S.pointing) setPointing(false);
    }
    function setFocus(f) { if (S.focus === f) return; S.focus = f; applySplit(); }
    chat.addEventListener('pointerdown', function () { setFocus('chat'); });
    chat.addEventListener('focusin', function () { setFocus('chat'); });
    main.addEventListener('pointerdown', function () { if (S.on) setFocus('prev'); });
    // a tap inside the lesson preview (a frame) never reaches this page, but it takes the focus away from it
    addEventListener('blur', function () { setTimeout(function () { var a = document.activeElement; if (S.on && a && a.tagName === 'IFRAME' && main.contains(a)) setFocus('prev'); }, 0); });
    var drag = null;
    line.addEventListener('pointerdown', function (e) { drag = {id: e.pointerId}; line.setPointerCapture(e.pointerId); split.classList.add('dragging'); e.preventDefault(); });
    line.addEventListener('pointermove', function (e) {
      if (!drag) return;
      var r = split.getBoundingClientRect(), c = Math.min(0.75, Math.max(0.22, (e.clientX - r.left) / r.width));
      drag.c = c; split.style.setProperty('--c', c);
    });
    function endDrag() { if (!drag) return; if (drag.c) { P.share[S.focus] = Math.round(drag.c * 100) / 100; saveP(); } drag = null; split.classList.remove('dragging'); applySplit(); }
    line.addEventListener('pointerup', endDrag); line.addEventListener('pointercancel', endDrag);
    line.addEventListener('dblclick', function () { P.share = {chat: 0.56, prev: 0.34}; saveP(); applySplit(); o.toast('Back to the usual sizes.'); });
    line.addEventListener('keydown', function (e) {
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
      P.share[S.focus] = Math.min(0.75, Math.max(0.22, P.share[S.focus] + (e.key === 'ArrowRight' ? 0.03 : -0.03))); saveP(); applySplit();
    });
    if (mq) { var onMq = function () { S.wide = mq.matches; applySplit(); }; if (mq.addEventListener) mq.addEventListener('change', onMq); else mq.addListener(onMq); }

    /* ---------- the conversation ---------- */
    function typedText(key, text) {
      if (!S.typed || S.typed.key !== key) return text;
      return text.slice(0, S.typed.len);
    }
    function typeOut(key, text) {
      var t0 = performance.now(), from = (S.typed && S.typed.text === text) ? S.typed.len : 0;
      S.typed = {key: key, text: text, len: RM ? text.length : from};
      clearTimeout(S.typeT);
      (function tick() {
        if (!S.typed || S.typed.text !== text) return;
        S.typed.len = RM ? text.length : Math.min(text.length, from + Math.round((performance.now() - t0) * 0.11));
        var el = log.querySelector('[data-typing="' + key + '"]');
        if (el) el.textContent = text.slice(0, S.typed.len);
        down();
        if (S.typed.len < text.length) S.typeT = setTimeout(tick, 16); else S.typed = null;
      })();
    }
    function down() { log.scrollTop = log.scrollHeight; }
    function connCard() {
      var l = o.lesson(), stale = !S.kitAt || Date.now() - S.kitAt > 6000;
      if (stale) {
        var waited = S.asked && Date.now() - S.asked > 15000;
        return '<div class="hc-card"><b>Your helper runs on this computer.</b><p>Worldview Lessons connects it to this lesson. It opens a small window that keeps running while you work.</p>' +
          '<div class="row"><button type="button" class="btn small" data-hc="connect">' + (S.asked ? 'Connect again' : 'Connect') + '</button></div>' +
          (waited ? '<p class="small muted">Nothing happened? Double-click <b>Worldview Lessons</b> on your Desktop, then press Connect again. Pop-ups must be allowed for this site.</p>' : S.asked ? '<p class="small muted">Opening…</p>' : '') + '</div>';
      }
      if (!S.ready) {
        var why = S.need === 'signin' ? 'Sign in once in the small Worldview Lessons window. It may be behind this one.'
          : S.need === 'setup' ? 'Choose where “' + esc(l ? l.title : 'this lesson') + '” lives in the small Worldview Lessons window, then press Start editing.'
          : 'Look at the small Worldview Lessons window: it needs something before your helper can start.';
        return '<div class="hc-card"><b>Almost there.</b><p>' + why + '</p></div>';
      }
      if (!S.codex) return '<div class="hc-card"><b>Codex isn’t on this computer yet.</b><p>Install it once: open PowerShell and run <code>npm install -g @openai/codex</code>, then reload this page.</p></div>';
      return '';
    }
    function howCard() {
      return '<div class="hc-card hc-how"><b>How this works</b>' +
        '<p>Tell your helper what you want, in everyday words. It changes the lesson on your computer, and the preview updates while you watch.</p>' +
        '<ul><li><b>Point</b> (above the preview) lets you tap the exact part you mean.</li><li>Every change has <b>Undo</b>.</li><li><b>⚙</b> sets Fast mode and how hard it thinks.</li><li><b>↗ Text window</b> opens this same conversation in a window of its own.</li></ul>' +
        '<div class="hc-chips">' + STARTERS.map(function (s) { return '<button type="button" class="hc-chip" data-say="' + esc(s) + '">' + esc(s) + '</button>'; }).join('') + '</div></div>';
    }
    function itemHtml(it) {
      var key = String(it.at || '');
      if (it.who === 'me') return '<div class="hc-m hc-me">' + (it.point ? '<span class="hc-pt">◎ ' + esc(it.point.label) + '</span>' : '') + esc(it.text) + '</div>';
      if (it.who === 'wv') return '<div class="hc-note">' + esc(it.text) + '</div>';
      if (it.who === 'err') return '<div class="hc-note hc-err">' + esc(it.text) + '</div>';
      var undo = it.undo && !it.undone && it.undo === S.latestUndo && !S.busy;
      var steps = it.steps && it.steps.length ? '<details class="hc-steps"><summary>Worked ' + (it.secs || 1) + 's · ' + it.steps.length + ' step' + (it.steps.length === 1 ? '' : 's') + '</summary><div>' + it.steps.map(esc).join('<br>') + '</div></details>' : '';
      return steps + '<div class="hc-m hc-ai"><span data-typing="' + esc(key) + '">' + esc(typedText(key, it.text)) + '</span>' + (undo ? '<div class="hc-acts"><button type="button" data-hc="undo">Undo this change</button></div>' : '') + '</div>';
    }
    function liveHtml() {
      var L = S.live; if (!L) return '';
      var secs = Math.max(0, Math.round((Date.now() - L.started) / 1000)), step = L.steps.length ? L.steps[L.steps.length - 1] : (L.pending ? 'Sending' : 'Thinking');
      return (L.say ? '<div class="hc-m hc-ai hc-interim"><span data-typing="live">' + esc(typedText('live', L.say)) + '</span></div>' : '') +
        '<div class="hc-work"><span class="hc-spin"></span><span id="hcstep">Working · ' + esc(step) + '</span><span class="muted" id="hcsecs">' + secs + 's</span></div>';
    }
    function render() {
      var c = connCard();
      log.innerHTML = c || ((S.items.length || S.busy ? '' : howCard()) + S.items.map(itemHtml).join('') + liveHtml());
      var off = !!c;
      ta.disabled = off; $('#hcsend').disabled = off && !S.busy;
      $('#hcsend').textContent = S.busy ? '■' : '↑'; $('#hcsend').setAttribute('aria-label', S.busy ? 'Stop' : 'Send');
      $('#hcsend').classList.toggle('stop', S.busy);
      $('#hcwin').disabled = off;
      down();
    }
    setInterval(function () {
      if (S.live) { var s = $('#hcsecs'); if (s) s.textContent = Math.round((Date.now() - S.live.started) / 1000) + 's'; }
      var stale = !S.kitAt || Date.now() - S.kitAt > 6000;
      if (S.on && (stale !== S.wasStale)) { S.wasStale = stale; if (stale) S.ready = false; render(); }
      else if (S.on && stale && S.asked && Date.now() - S.asked > 15000 && !S.waitedShown) { S.waitedShown = true; render(); }
    }, 1000);
    function renderChip() {
      var c = $('#hcpchip'); c.hidden = !S.point;
      if (S.point) c.innerHTML = '◎ About: ' + esc(S.point.label) + ' <button type="button" aria-label="Remove">×</button>';
    }

    /* ---------- settings ---------- */
    function fillSettings() {
      var d = S.defaults || {models: []}, models = d.models && d.models.length ? d.models : [{id: d.model || '', name: d.model || 'Your Codex model', about: '', efforts: EFFORTS.map(function (x) { return x[0]; })}];
      var model = P.model && models.some(function (m) { return m.id === P.model; }) ? P.model : (d.model || models[0].id);
      var m = models.filter(function (x) { return x.id === model; })[0] || models[0];
      $('#hcmodel').innerHTML = models.map(function (x) { return '<option value="' + esc(x.id) + '"' + (x.id === model ? ' selected' : '') + '>' + esc(x.name) + (x.id === d.model ? ' (your Codex default)' : '') + '</option>'; }).join('');
      $('#hcabout').textContent = m.about || '';
      var efforts = EFFORTS.filter(function (e) { return !m.efforts || !m.efforts.length || m.efforts.indexOf(e[0]) >= 0; });
      var effort = P.effort && efforts.some(function (e) { return e[0] === P.effort; }) ? P.effort : (d.effort || 'medium');
      $('#hceffort').innerHTML = efforts.map(function (e) { return '<button type="button" data-effort="' + e[0] + '" class="' + (e[0] === effort ? 'on' : '') + '">' + e[1] + '</button>'; }).join('');
      var fast = P.fast == null ? !!d.fast : P.fast;
      $('#hcfast').checked = fast; $('#hcfollow').checked = P.follow !== false;
      var en = (EFFORTS.filter(function (e) { return e[0] === effort; })[0] || [0, 'Normal'])[1];
      $('#hcsetl').textContent = (fast ? 'Fast · ' : '') + en;
      $('#hcwho').textContent = 'Codex · ' + m.name;
    }
    $('#hcset').addEventListener('click', function () { var b = $('#hcbox'); b.hidden = !b.hidden; $('#hcset').setAttribute('aria-expanded', String(!b.hidden)); });
    $('#hcmodel').addEventListener('change', function (e) { P.model = e.target.value; saveP(); fillSettings(); });
    $('#hceffort').addEventListener('click', function (e) { var b = e.target.closest('[data-effort]'); if (!b) return; P.effort = b.dataset.effort; saveP(); fillSettings(); });
    $('#hcfast').addEventListener('change', function (e) { P.fast = e.target.checked; saveP(); fillSettings(); });
    $('#hcfollow').addEventListener('change', function (e) { P.follow = e.target.checked; saveP(); });

    /* ---------- talking to the small Worldview Lessons window ---------- */
    addEventListener('message', function (e) {
      if (KIT.indexOf(e.origin) < 0) return;
      var m = e.data; if (!m || m.wvkit !== 1 || typeof m.type !== 'string') return;
      if (!lessonId() || m.w !== lessonId()) return;
      S.kit = e.source; S.kitOrigin = e.origin; S.kitAt = Date.now();
      if (m.type === 'hello') {
        var was = S.ready; S.ready = !!m.ready; S.need = m.need || '';
        if (S.ready && !was) toKit({type: 'history'});
        if (S.ready !== was || S.wasStale) { S.wasStale = false; render(); }
        return;
      }
      if (m.type === 'history') {
        if (m.ok) {
          S.items = Array.isArray(m.items) ? m.items : []; S.latestUndo = m.latestUndo || ''; S.codex = m.codex !== false; S.defaults = m.settings || null;
          S.busy = !!m.busy; S.live = m.busy ? {steps: m.steps || [], say: (m.says || []).slice(-1)[0] || '', started: m.started || Date.now()} : null;
          fillSettings();
        }
        return render();
      }
      if (m.type === 'result') {
        if (m.ok === false && m.error) { o.toast(m.error); if (m.of === 'send') { S.busy = false; S.live = null; render(); } }
        if (m.of === 'window' && m.ok) o.toast('The text window is opening on your computer, in this same conversation.');
        return;
      }
      if (m.type === 'event') onEvent(m.ev || {});
    });
    function onEvent(ev) {
      if (ev.kind === 'start') { S.busy = true; S.live = {steps: [], say: '', started: Date.now()}; if (ev.item) S.items.push(ev.item); render(); }
      else if (ev.kind === 'step' && S.live) { S.live.steps.push(ev.text); S.live.pending = false; var st = $('#hcstep'); if (st) st.textContent = 'Working · ' + ev.text; else render(); }
      else if (ev.kind === 'say' && S.live) { S.live.say = S.liveSay = ev.text; render(); typeOut('live', ev.text); }
      else if (ev.kind === 'done') {
        var it = ev.item || {}, key = String(it.at || '');
        S.busy = false; S.live = null; S.doneAt = Date.now(); S.latestUndo = ev.latestUndo || '';
        // the reply is usually the last thing it said while working: carry on typing it, or leave it if it's already typed out
        if (it.who === 'ai' && S.typed && S.typed.key === 'live' && S.typed.text === it.text) S.typed.key = key;
        else if (it.who === 'ai' && S.liveSay === it.text) S.typed = null;
        else if (it.who === 'ai') S.typed = {key: key, text: it.text, len: 0};
        S.liveSay = '';
        S.items.push(it); render();
        if (it.who === 'ai' && S.typed && S.typed.key === key) typeOut(key, it.text);
      }
      else if (ev.kind === 'undo') { S.items.forEach(function (x) { if (x.undo === ev.id) x.undone = true; }); if (ev.item) S.items.push(ev.item); S.latestUndo = ev.latestUndo || ''; render(); }
      else if (ev.kind === 'lost') { S.ready = false; render(); }
    }
    function send() {
      var t = ta.value.trim();
      if (S.busy) { toKit({type: 'stop'}); return; }
      if (!t || !S.ready) return;
      var ok = toKit({type: 'send', text: t, point: S.point, model: P.model || '', effort: P.effort || '', fast: P.fast == null ? null : !!P.fast});
      if (!ok) { o.toast('The Worldview Lessons window isn’t connected. Press Connect.'); return; }
      ta.value = ''; autosize(); S.point = null; renderChip();
      S.busy = true; S.live = {steps: [], say: '', started: Date.now(), pending: true}; render();
    }
    function autosize() { ta.style.height = 'auto'; ta.style.height = Math.min(ta.scrollHeight, 160) + 'px'; }
    ta.addEventListener('input', autosize);
    ta.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(); } });
    $('#hccomp').addEventListener('submit', function (e) { e.preventDefault(); send(); });
    $('#hcpchip').addEventListener('click', function (e) { if (e.target.closest('button')) { S.point = null; renderChip(); } });
    $('#hcwin').addEventListener('click', function () { if (!toKit({type: 'window'})) o.toast('Connect first.'); });
    log.addEventListener('click', function (e) {
      var b = e.target.closest('[data-hc],[data-say]'); if (!b) return;
      if (b.dataset.say) { ta.value = b.dataset.say; autosize(); ta.focus(); return; }
      if (b.dataset.hc === 'connect') { S.asked = Date.now(); S.waitedShown = false; o.openKit(); render(); }
      if (b.dataset.hc === 'undo') toKit({type: 'undo'});
    });

    /* ---------- Point ---------- */
    function setPointing(on, quiet) {
      S.pointing = on; if (!quiet) o.host.point(on);
      $('#pointbtn').classList.toggle('on', on); $('#pointbtn').setAttribute('aria-pressed', String(on));
      $('#pointhint').hidden = !on;
      if (on) setFocus('prev');
    }
    $('#pointbtn').addEventListener('click', function () { setPointing(!S.pointing); });
    addEventListener('keydown', function (e) { if (e.key === 'Escape' && S.pointing) setPointing(false); });
    $('#fshelper').addEventListener('click', function () { o.exitFs(); setFocus('chat'); setTimeout(function () { ta.focus(); }, 50); });

    var api = {
      pointed: function (d) {
        setPointing(false, true);
        if (!d) return;
        S.point = d; renderChip(); setFocus('chat'); setTimeout(function () { if (!ta.disabled) ta.focus(); }, 60);
      },
      previewChanged: function () {
        if (S.pointing) setPointing(false, true);
        if (S.on && S.wide && P.follow !== false && (S.busy || Date.now() - S.doneAt < 20000)) setFocus('prev');
      },
      lessonChanged: function () {
        S.kit = null; S.kitOrigin = ''; S.kitAt = 0; S.ready = false; S.need = ''; S.asked = 0; S.items = []; S.busy = false; S.live = null; S.point = null; S.typed = null;
        renderChip(); render(); applySplit();
      },
      toggle: function () { S.on = !S.on; store('wv-helper', S.on ? 'on' : 'off'); applySplit(); render(); o.toast(S.on ? 'Helper chat is on. Press Connect to start.' : 'Helper chat is off.'); },
      isOn: function () { return S.on && S.wide; }
    };
    fillSettings(); applySplit(); render();
    return api;
  };
})();
