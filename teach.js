/* Teach (v3.1.95; NAV-253, NAV-254, LES-384, BUS-104; plan 2026-11-23).
   One page for anyone signed in:
   - Start: say what you want to teach, add photos or notes (or slides, which go to slides.html and come back here).
     lesson-ai?mode=draft action "describe" writes the whole lesson; each slide is a simple card this page draws
     (title + short lines) and saves as slides/NN.jpg, so the student page (slides-lesson.html) and the slide-by-slide
     editor (slides.html) work unchanged. Then the conversation map (action "map").
   - Lesson (?l=): the lesson as a student sees it (play.html?preview=1), "Change something" (action "change", with Undo),
     and Share (publish, link, Explore, course). Edit slide by slide, Teacher Studio, Unpublish and Delete are under More.
   The free amount (3 new lessons a month per account) is checked on the server. */
(() => {
  const URL_ = 'https://eqppapoepynjvsfnoodj.supabase.co', KEY = 'sb_publishable_rfg0gznLhbAW07TlC4U6WQ_i8WqA3PT';
  const FILES = URL_ + '/storage/v1/object/public/lesson-files/', BUCKET = 'lesson-files', T = 'worldview_teacher_lessons';
  const db = window.supabase.createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'worldview-alpha-auth'}});
  const PB = window.WorldviewPublish, WC = window.WorldviewClasses;
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const money = v => '$' + (v < 0.01 && v > 0 ? v.toFixed(3) : v.toFixed(2));
  const show = id => ['signedout', 'loading', 'startview', 'lessonview'].forEach(x => { $('#' + x).hidden = x !== id; });
  const toast = m => { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); };
  const playLink = id => new URL('play.html?l=' + encodeURIComponent(id), location.href).href;
  const LID = new URLSearchParams(location.search).get('l') || '';
  let user = null, row = null, L = null, busy = false, undo = null, latest = null, styled = false, hasCourses = false;

  /* ---------- talking to Worldview ---------- */
  const authHeaders = async () => { let token = KEY; try { const s = (await db.auth.getSession()).data.session; if (s) token = s.access_token; } catch (e) {} return {apikey: KEY, authorization: 'Bearer ' + token}; };
  async function draftAI(body) {
    try {
      const r = await fetch(URL_ + '/functions/v1/lesson-ai?mode=draft', {method: 'POST', headers: Object.assign({'content-type': 'application/json'}, await authHeaders()), body: JSON.stringify(body)});
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return j;
      const e = j.error;
      return Object.assign({}, j, {ok: false, error: (e && e.message) || (typeof e === 'string' && e) || 'The AI couldn\'t answer just now. Try again.', type: (e && e.type) || 'http_' + r.status});
    } catch (e) { return {ok: false, error: 'Worldview couldn\'t be reached. Check the internet connection.', type: 'network'}; }
  }
  const put = (id, path, blob, type) => db.storage.from(BUCKET).upload(id + '/' + path, blob, {upsert: true, contentType: type || blob.type || undefined, cacheControl: path === 'lesson.json' ? '10' : '3600'});
  async function readLessonFile(id) {
    const {data, error} = await db.storage.from(BUCKET).download(id + '/lesson.json');
    if (error || !data) return null;
    try { const j = JSON.parse(await data.text()); return j && j.format === 'slides-v1' ? j : null; } catch (e) { return null; }
  }
  async function saveNow() {
    L.updated = new Date().toISOString();
    const {error} = await put(row.id, 'lesson.json', new Blob([JSON.stringify(L)], {type: 'application/json'}), 'application/json');
    $('#saved').textContent = error ? 'Not saved: ' + error.message : 'Saved';
    return !error;
  }
  function addCost(r) { if (r && r.costUsd != null) { L.cost = L.cost || {draftUsd: 0, calls: 0, model: ''}; L.cost.draftUsd = Math.round(((L.cost.draftUsd || 0) + r.costUsd) * 10000) / 10000; L.cost.calls = (L.cost.calls || 0) + 1; L.cost.model = r.model || L.cost.model; } }

  /* ---------- slide cards: a title and short lines, drawn here; the boxes say where each line sits (for one-point-at-a-time covers) ---------- */
  const CW = 1280, CH = 800;
  function wrap(ctx, text, width) {
    const words = String(text).split(/\s+/).filter(Boolean), rows = []; let cur = '';
    for (const w of words) { const t = cur ? cur + ' ' + w : w; if (cur && ctx.measureText(t).width > width) { rows.push(cur); cur = w; } else cur = t; }
    if (cur) rows.push(cur);
    return rows.length ? rows : [''];
  }
  function drawCard(title, lines, n, total) {
    const c = document.createElement('canvas'); c.width = CW; c.height = CH;
    const ctx = c.getContext('2d'), X = 110, W = CW - X - 110;
    const SANS = '-apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif', SERIF = 'Georgia, "Times New Roman", serif';
    let scale = 1, layout = null;
    for (; scale >= 0.55; scale -= 0.05) { // shrink until it fits
      const ts = Math.round(68 * scale), ls = Math.round(40 * scale), gap = Math.round(26 * scale);
      ctx.font = '400 ' + ts + 'px ' + SERIF; const tRows = wrap(ctx, title, W);
      ctx.font = '400 ' + ls + 'px ' + SANS; const lRows = lines.map(l => wrap(ctx, l, W - 44));
      const h = tRows.length * ts * 1.15 + 50 + lRows.reduce((t, r) => t + r.length * ls * 1.3 + gap, 0);
      layout = {ts, ls, gap, tRows, lRows, h};
      if (h <= CH - 180) break;
    }
    ctx.fillStyle = '#f8f4ec'; ctx.fillRect(0, 0, CW, CH);
    ctx.fillStyle = '#bd5a30'; ctx.fillRect(0, 0, 18, CH);
    ctx.fillStyle = '#6f6355'; ctx.font = '600 26px ' + SANS; ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillText(n + ' / ' + total, CW - 60, 70); ctx.textAlign = 'left';
    let y = Math.max(120, Math.round((CH - layout.h) / 2) - 10) + layout.ts; // the block sits in the middle when there is room
    ctx.fillStyle = '#2c241c'; ctx.font = '400 ' + layout.ts + 'px ' + SERIF;
    layout.tRows.forEach(r => { ctx.fillText(r, X, y); y += layout.ts * 1.15; });
    y += 50 - layout.ts * 0.15;
    const boxes = [];
    ctx.font = '400 ' + layout.ls + 'px ' + SANS;
    layout.lRows.forEach(rows => {
      const top = y - layout.ls * 0.95; let right = X;
      ctx.fillStyle = '#bd5a30'; ctx.beginPath(); ctx.arc(X + 10, y - layout.ls * 0.34, layout.ls * 0.16, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#2c241c';
      rows.forEach((r, k) => { ctx.fillText(r, X + 44, y); right = Math.max(right, X + 44 + ctx.measureText(r).width); if (k < rows.length - 1) y += layout.ls * 1.3; });
      boxes.push([X / CW, top / CH, Math.min(1, (right + 8) / CW), (y + layout.ls * 0.3) / CH].map(v => Math.round(Math.max(0, Math.min(1, v)) * 1000) / 1000));
      y += layout.ls * 1.3 + layout.gap;
    });
    return new Promise(res => c.toBlob(b => res({blob: b, boxes}), 'image/jpeg', 0.88));
  }
  async function cardSlide(id, s, total, stamp) {
    const lines = (s.lines || []).filter(Boolean);
    const {blob, boxes} = await drawCard(s.title || 'Part ' + s.n, lines, s.n, total);
    const path = 'slides/' + (stamp ? stamp + '-' : '') + pad(s.n) + '.jpg';
    const {error} = await put(id, path, blob, 'image/jpeg');
    if (error) throw new Error('Slide ' + s.n + ' couldn\'t be saved: ' + error.message);
    return {image: path, text: lines.join('\n'), lines: lines.length ? boxes : undefined};
  }
  const base = s => { const o = {script: s.script || '', keyPoints: s.keyPoints || [], tripUps: s.tripUps || [], pause: s.pause || '', needsTeacher: !!s.needsTeacher, needsTeacherWhy: s.needsTeacherWhy || '', edited: false}; if (Array.isArray(s.steps) && s.steps.length) o.steps = s.steps; return o; };

  /* ---------- the conversation map (same as slides.js draftMap, without kept edits: a change redraws it) ---------- */
  async function draftMap() {
    const r = await draftAI({lesson: row.id, action: 'map', title: L.title, notes: L.teacherNotes || '', rules: L.rules || [],
      slides: L.slides.map(s => ({n: s.n, title: s.title || '', text: (s.text || '').slice(0, 800), script: (s.script || '').slice(0, 1200), keyPoints: s.keyPoints || []})),
      goals: L.goals.map(g => ({text: g.text, evidence: g.evidence}))});
    addCost(r);
    if (!r.ok || !r.map) return false;
    const gid = g => { const k = +String(g || '').slice(1) - 1; return (L.goals[k] || {}).id || ''; };
    L.map = {recipe: r.conversationRecipe || 'conversation 1.1', drafted: new Date().toISOString(), questionsEdited: false, opening: r.map.opening, survey: r.map.survey, chapters: r.map.chapters.map(c => Object.assign({}, c, {goal: gid(c.goal), edited: false}))};
    L.conversationRecipe = L.map.recipe;
    return true;
  }

  /* ---------- START: what do you want to teach? ---------- */
  const picks = []; // {kind: 'photo'|'text', name, file, url, text}
  function renderFiles() {
    $('#files').innerHTML = picks.map((p, i) => `<span class="tc-file">${p.kind === 'photo' ? `<img src="${esc(p.url)}" alt="">` : ''}<span>${esc(p.name)}</span><button type="button" data-rm="${i}" aria-label="Remove ${esc(p.name)}">✕</button></span>`).join('');
  }
  $('#pick').addEventListener('change', async e => {
    for (const f of [...e.target.files]) {
      if (/^image\//.test(f.type)) { if (picks.filter(p => p.kind === 'photo').length >= 6) { toast('Up to 6 photos.'); continue; } picks.push({kind: 'photo', name: f.name, file: f, url: URL.createObjectURL(f)}); }
      else if (f.size < 400000) picks.push({kind: 'text', name: f.name, text: await f.text()});
      else toast(f.name + ' is too big. Paste the part you need instead.');
    }
    e.target.value = ''; renderFiles();
  });
  $('#files').addEventListener('click', e => { const b = e.target.closest('[data-rm]'); if (!b) return; const p = picks.splice(+b.dataset.rm, 1)[0]; if (p && p.url) URL.revokeObjectURL(p.url); renderFiles(); });
  /* Talk instead: the browser's own dictation, where it has one. */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) {
    $('#talk').hidden = false; let rec = null;
    $('#talk').addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = navigator.language || 'en-US';
      const start = $('#what').value.replace(/\s+$/, ''), done = [];
      rec.onresult = ev => { let interim = ''; for (let i = ev.resultIndex; i < ev.results.length; i++) { const t = ev.results[i][0].transcript; if (ev.results[i].isFinal) done.push(t.trim()); else interim += t; } $('#what').value = [start, done.join(' '), interim.trim()].filter(Boolean).join(start ? ' ' : ''); };
      rec.onend = () => { rec = null; $('#talk').classList.remove('on'); $('#talk span').textContent = 'Talk instead'; };
      rec.onerror = ev => { if (ev.error === 'not-allowed') toast('Worldview needs the microphone for this. You can type instead.'); };
      try { rec.start(); $('#talk').classList.add('on'); $('#talk span').textContent = 'Listening… tap to stop'; } catch (e) { rec = null; }
    });
  }
  async function shrink(file) { // a photo at most 1,600 px wide, as JPEG
    const bmp = await createImageBitmap(file).catch(() => null); if (!bmp) return null;
    const k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
    c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise(res => c.toBlob(res, 'image/jpeg', 0.85));
  }
  const step = (frac, text) => { $('#prog').hidden = false; $('#progbar').style.width = Math.round(frac * 100) + '%'; $('#progt').textContent = text; };
  async function make() {
    if (busy) return;
    const what = $('#what').value.trim(), photos = picks.filter(p => p.kind === 'photo');
    const notes = [what, ...picks.filter(p => p.kind === 'text').map(p => 'Notes from ' + p.name + ':\n' + p.text)].filter(Boolean).join('\n\n').slice(0, 40000);
    $('#makemsg').textContent = '';
    if (!notes && !photos.length) { $('#makemsg').textContent = 'Say what you want to teach first, or add a photo of your notes.'; $('#what').focus(); return; }
    busy = true; $('#make').disabled = true;
    let made = null;
    try {
      step(0.04, 'Starting your lesson…');
      const guess = (what.split(/[.!?\n]/)[0] || 'My lesson').trim().slice(0, 60) || 'My lesson';
      const {data, error} = await db.from(T).insert({title: guess, html: '<!doctype html><title>Lesson</title>', note: {format: 'slides-v1', made: 'described'}}).select('id,title,shared,note').single();
      if (error) throw new Error(/lesson_limit/.test(error.message) ? 'You have 50 lessons, the most for now. Delete one first.' : 'The lesson couldn\'t be started: ' + error.message);
      row = made = data;
      await PB.ensureSlidesStyle(db, row.id, '');
      const images = [];
      for (const [i, p] of photos.entries()) {
        step(0.08 + 0.08 * i / photos.length, 'Adding your photos…');
        const b = await shrink(p.file); if (!b) continue;
        const path = 'material/' + pad(images.length + 1) + '.jpg';
        const {error: e2} = await put(row.id, path, b, 'image/jpeg'); if (e2) throw new Error('A photo couldn\'t be saved: ' + e2.message);
        images.push(path);
      }
      step(0.18, 'Writing the lesson… this is the long part');
      let tick = 0.18; const timer = setInterval(() => { tick = Math.min(0.7, tick + 0.012); step(tick, 'Writing the lesson… this is the long part'); }, 1000);
      const r = await draftAI({lesson: row.id, action: 'describe', title: '', notes: notes || 'Teach what the photos show.', rules: [], images});
      clearInterval(timer);
      if (!r.ok) { const e = new Error(r.error); e.type = r.type; throw e; }
      const d = r.lesson;
      L = {format: 'slides-v1', recipe: r.promptVersion || 'describe-v1', title: d.title || guess, teacherNotes: notes, rules: [], styles: {conversation: true, lecture: true, voice: true},
        source: {described: true, photos: images.length, made: new Date().toISOString()}, goals: d.goals || [], check: d.check || [], slides: [], cost: {draftUsd: 0, calls: 0, model: ''}, status: 'ready'};
      addCost(r);
      for (const [i, s] of d.slides.entries()) {
        step(0.72 + 0.14 * i / d.slides.length, 'Drawing the slides…');
        const pic = await cardSlide(row.id, s, d.slides.length, '');
        L.slides.push(Object.assign({n: s.n, title: s.title, card: true}, pic, base(s)));
      }
      await saveNow();
      await db.from(T).update({title: L.title.slice(0, 120)}).eq('id', row.id);
      step(0.9, 'Planning the conversation…');
      if (await draftMap()) await saveNow();
      step(1, 'Ready');
      location.replace('teach.html?l=' + encodeURIComponent(row.id));
    } catch (e) {
      $('#prog').hidden = true;
      $('#makemsg').textContent = e.message || String(e);
      // nothing was written: take the empty lesson away again, so it doesn't sit in the list
      if (made && !L) { try { const {data: fl} = await db.storage.from(BUCKET).list(made.id + '/material'); if (fl && fl.length) await db.storage.from(BUCKET).remove(fl.map(f => made.id + '/material/' + f.name)); await db.from(T).delete().eq('id', made.id); } catch (x) {} row = null; }
    } finally { busy = false; $('#make').disabled = false; }
  }
  $('#make').addEventListener('click', make);
  $('#what').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) make(); });

  async function renderMine() {
    const {data} = await db.from(T).select('id,title,shared,note,updated_at,kind').eq('owner_id', user.id).order('updated_at', {ascending: false}).limit(40);
    const rows = (data || []).filter(r => r.kind !== 'experiment');
    if (!rows.length) return;
    $('#mine').hidden = false;
    $('#minelist').innerHTML = rows.map(r => {
      const slides = r.note && r.note.format === 'slides-v1';
      const href = slides ? 'teach.html?l=' + encodeURIComponent(r.id) : 'studio.html?from=teach&l=' + encodeURIComponent(r.id);
      return `<a class="tc-row" href="${href}">${slides ? `<img src="${FILES + esc(r.id)}/slides/01.jpg" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph'}))">` : '<span class="ph"></span>'}<span class="grow"><b>${esc(r.title)}</b><em>${r.shared ? 'Published' : 'Draft'}${slides ? '' : ' · Teacher Studio'}</em></span><span aria-hidden="true">›</span></a>`;
    }).join('');
  }

  /* ---------- THE LESSON ---------- */
  async function preview() {
    if (!styled) { try { await PB.ensureSlidesStyle(db, row.id); styled = true; } catch (e) { toast(e.message); } }
    const src = 'play.html?l=' + encodeURIComponent(row.id) + '&preview=1';
    $('#frame').src = src + '&t=' + Date.now(); $('#full').href = src;
  }
  const changedSincePublish = () => !!(row.shared && latest && L.updated && new Date(L.updated) > new Date(latest.published_at || 0));
  function renderState() {
    $('#state').textContent = row.shared ? 'Published' + (latest ? ' · v' + latest.version : '') : 'Draft · only you see it';
    $('#state').className = 'chip' + (row.shared ? ' ok' : '');
    $('#flag').textContent = changedSincePublish() ? 'Changes not published yet' : '';
    $('#unpub').hidden = !row.shared;
    renderShare();
  }
  function renderShare() {
    const s = $('#share'), link = playLink(row.id);
    if (!row.shared) {
      s.innerHTML = `<h2>Share</h2><p class="muted small">Publish it, then anyone with the link can take it. No account needed.</p><button type="button" class="btn big" data-sh="publish">Publish</button><p class="tc-msg" id="pubmsg"></p>`;
      return;
    }
    const courses = hasCourses ? '<option value="">No course</option>' + WC.list().map(c => `<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') : '';
    s.innerHTML = `<h2>Share</h2>
      ${changedSincePublish() ? '<button type="button" class="btn big" data-sh="publish">Publish changes</button><p class="muted small">Students have the last published version until you do.</p>' : ''}
      <div class="tc-link"><input type="text" readonly value="${esc(link)}" aria-label="Lesson link"><button type="button" class="btn small" data-sh="copy">Copy link</button></div>
      <label class="toggle"><input type="checkbox" data-sh="listed"${row.listed ? ' checked' : ''}> Show it on Explore</label>
      ${hasCourses ? `<label class="small muted" for="course">Put it in a course</label><select id="course" data-sh="course">${courses}</select>` : ''}
      <p class="tc-msg" id="pubmsg"></p>`;
    const sel = $('#course'); if (sel) sel.value = (row.note && row.note.classId) || '';
  }
  async function publish() {
    if (busy) return; busy = true;
    const say = t => { const m = $('#pubmsg'); if (m) { m.className = 'tc-msg ok'; m.textContent = t; } };
    say('Publishing…');
    try {
      const html = await PB.ensureSlidesStyle(db, row.id); styled = true;
      const r = await PB.publish({db, id: row.id, shared: row.shared, html, latest, setShared: v => PB.setShared(db, row.id, v), onProgress: say});
      if (r.cancelled) throw new Error('Couldn\'t publish it. Check the internet connection and try again.');
      row.shared = true; latest = await PB.latestRelease(db, row.id);
      renderState(); say('Published. Copy the link and send it to your students.');
    } catch (e) { renderState(); const m = $('#pubmsg'); if (m) { m.className = 'tc-msg'; m.textContent = (e.version ? 'It is published, but not every file is locked in yet. Press Publish changes to try again. ' : '') + (e.message || e); } }
    busy = false;
  }
  $('#share').addEventListener('click', async e => {
    const b = e.target.closest('[data-sh]'); if (!b) return;
    if (b.dataset.sh === 'publish') return publish();
    if (b.dataset.sh === 'copy') { const link = playLink(row.id); try { await navigator.clipboard.writeText(link); toast('Link copied.'); } catch (x) { const i = $('#share input[readonly]'); i.select(); toast('Select the link and copy it.'); } }
  });
  $('#share').addEventListener('change', async e => {
    const t = e.target;
    if (t.dataset.sh === 'listed') { const {error} = await db.from(T).update({listed: t.checked}).eq('id', row.id); if (error) { t.checked = !t.checked; toast('Couldn\'t save that.'); } else { row.listed = t.checked; toast(t.checked ? 'It shows on Explore for everyone signed in.' : 'Only people with the link can open it.'); } }
    if (t.dataset.sh === 'course') {
      const note = Object.assign({}, row.note || {}); if (t.value) note.classId = t.value; else delete note.classId;
      const {error} = await db.from(T).update({note}).eq('id', row.id);
      if (error) toast('Couldn\'t save that.'); else { row.note = note; toast(t.value ? 'It is in ' + ((WC.get(t.value) || {}).name || 'the course') + '. Give it a day in School.' : 'Not in a course.'); }
    }
  });

  /* Change something: the whole lesson and the instruction go to the AI, which returns the whole lesson changed. Undo keeps the copy from before. */
  async function change() {
    const ask = $('#ask').value.trim(), msg = $('#chmsg');
    if (busy) return; if (!ask) { $('#ask').focus(); return; }
    if (L.slides.length > 40) { msg.className = 'tc-msg'; msg.textContent = 'This lesson has more than 40 slides, too many to change in one go. Use Edit slide by slide under More.'; return; }
    busy = true; $('#send').disabled = true; msg.className = 'tc-msg ok'; msg.textContent = 'Changing the lesson… about a minute';
    const before = JSON.stringify(L);
    try {
      const gnum = id => L.goals.findIndex(g => g.id === id) + 1;
      const r = await draftAI({lesson: row.id, action: 'change', ask, title: L.title, notes: L.teacherNotes || '', rules: L.rules || [], made: L.source && L.source.described ? 'described' : 'slides',
        slides: L.slides.map(s => ({n: s.n, card: !!s.card, title: s.title || '', text: s.text || '', script: s.script || '', steps: s.steps || [], keyPoints: s.keyPoints || [], tripUps: s.tripUps || [], pause: s.pause || ''})),
        goals: L.goals.map(g => ({text: g.text, evidence: g.evidence})), check: L.check.map(c => ({goal: gnum(c.goal), question: c.question}))});
      addCost(r);
      if (!r.ok) throw new Error(r.error);
      const c = r.change, old = new Map(L.slides.map(s => [s.n, s])), stamp = Date.now().toString(36), slides = [];
      for (const s of c.slides) {
        msg.textContent = 'Drawing the slides…';
        const o = s.keep ? old.get(s.keep) : null;
        if (o && !o.card) { slides.push(Object.assign({}, o, {n: s.n, title: s.title || o.title}, base(s))); if (!(s.steps && s.steps.length)) delete slides[slides.length - 1].steps; continue; }
        const text = (s.lines || []).filter(Boolean).join('\n');
        const same = o && o.card && o.title === s.title && (o.text || '') === text && o.n === s.n && c.slides.length === L.slides.length;
        const pic = same ? {image: o.image, text: o.text, lines: o.lines} : await cardSlide(row.id, s, c.slides.length, stamp);
        slides.push(Object.assign({n: s.n, title: s.title, card: true}, pic, base(s)));
      }
      const oldCheck = new Map(L.check.map(q => [q.question, q]));
      L.slides = slides;
      if (c.goals.length) L.goals = c.goals;
      L.check = c.check.map(q => { const o = oldCheck.get(q.question); return o && o.image ? Object.assign({}, q, {image: o.image}) : q; });
      if (c.title) L.title = c.title;
      if (L.styles && L.styles.conversation !== false) { msg.textContent = 'Updating the conversation…'; if (!(await draftMap())) L.map = null; }
      if (!(await saveNow())) throw new Error('The change couldn\'t be saved. Try again.');
      if (c.title && c.title !== row.title) { row.title = c.title.slice(0, 120); await db.from(T).update({title: row.title}).eq('id', row.id); $('#title').value = row.title; }
      undo = before; $('#undo').hidden = false; $('#ask').value = '';
      msg.className = 'tc-msg ok'; msg.textContent = c.summary || 'Changed.';
      renderState(); preview(); loadCost();
    } catch (e) { msg.className = 'tc-msg'; msg.textContent = e.message || String(e); }
    busy = false; $('#send').disabled = false;
  }
  $('#send').addEventListener('click', change);
  $('#ask').addEventListener('keydown', e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) change(); });
  $('#ideas').addEventListener('click', e => { const b = e.target.closest('[data-idea]'); if (!b) return; $('#ask').value = b.dataset.idea; $('#ask').focus(); });
  $('#undo').addEventListener('click', async () => {
    if (!undo || busy) return;
    const cur = L; L = JSON.parse(undo); L.cost = cur.cost; // what was spent stays spent
    if (await saveNow()) { undo = null; $('#undo').hidden = true; $('#chmsg').className = 'tc-msg ok'; $('#chmsg').textContent = 'Back to how it was.'; if (L.title !== row.title) { row.title = L.title; $('#title').value = L.title; await db.from(T).update({title: L.title.slice(0, 120)}).eq('id', row.id); } renderState(); preview(); }
  });
  $('#title').addEventListener('change', async () => {
    const t = $('#title').value.trim().slice(0, 90); if (!t) { $('#title').value = row.title; return; }
    L.title = t; row.title = t; await saveNow(); await db.from(T).update({title: t}).eq('id', row.id); renderState();
  });
  let unpubSure = false, delSure = false;
  $('#unpub').addEventListener('click', async () => {
    if (!unpubSure) { unpubSure = true; $('#unpub').firstChild.textContent = 'Tap again to unpublish '; setTimeout(() => { unpubSure = false; $('#unpub').firstChild.textContent = 'Unpublish '; }, 4000); return; }
    if (await PB.setShared(db, row.id, false)) { row.shared = false; renderState(); toast('Unpublished. The link stops working; results are kept.'); } else toast('Couldn\'t unpublish it.');
  });
  $('#del').addEventListener('click', async () => {
    if (row.shared) { toast('Unpublish it first (just above).'); return; }
    if (!delSure) { delSure = true; $('#del').textContent = 'Tap again to delete it for good'; setTimeout(() => { delSure = false; $('#del').textContent = 'Delete lesson'; }, 4000); return; }
    const {error} = await db.from(T).delete().eq('id', row.id);
    if (error) { toast('Couldn\'t delete it: ' + error.message); return; }
    location.replace('teach.html');
  });
  async function loadCost() {
    const {data} = await db.from('worldview_teacher_lesson_ai_calls').select('cost_usd').eq('lesson_id', row.id).eq('kind', 'draft');
    const usd = (data || []).reduce((t, c) => t + (Number(c.cost_usd) || 0), 0);
    $('#cost').textContent = usd ? 'Making and changing this lesson has cost Worldview ' + money(usd) + ' so far.' : '';
  }
  async function openLesson() {
    const {data: r} = await db.from(T).select('id,title,shared,listed,note').eq('id', LID).maybeSingle();
    if (!r) { show('startview'); $('#makemsg').textContent = 'That lesson isn\'t yours or no longer exists.'; return renderMine(); }
    row = r;
    if (!(row.note && row.note.format === 'slides-v1')) { location.replace('studio.html?from=teach&l=' + encodeURIComponent(row.id)); return; }
    L = await readLessonFile(row.id);
    if (!L) {
      // made from slides and never finished: the slides page picks it up. Made from words: say so here, with a way out.
      if (!(row.note && row.note.made === 'described')) { location.replace('slides.html?from=teach&l=' + encodeURIComponent(row.id)); return; }
      show('startview'); renderMine();
      $('#makemsg').innerHTML = 'This lesson didn\'t finish being made. Write what you want to teach again below, or <button type="button" class="linkbtn" id="drop">delete it</button>.';
      $('#drop').addEventListener('click', async () => { await db.from(T).delete().eq('id', row.id); location.replace('teach.html'); });
      return;
    }
    L.cost = L.cost || {draftUsd: 0, calls: 0, model: ''};
    try { latest = await PB.latestRelease(db, row.id); } catch (e) { latest = null; }
    try { const {data: cls} = await db.from('worldview_classes').select('id').eq('owner_id', user.id).limit(1); hasCourses = !!(cls && cls.length); } catch (e) { hasCourses = false; }
    $('#title').value = row.title; document.title = row.title + ' · Teach';
    $('#backto').href = 'teach.html'; $('#backt').textContent = 'Teach'; $('#backto').setAttribute('aria-label', 'Back to Teach');
    $('#edit').href = 'slides.html?from=teach&l=' + encodeURIComponent(row.id);
    $('#studio').href = 'studio.html?from=teach&l=' + encodeURIComponent(row.id);
    show('lessonview'); renderState(); preview(); loadCost();
  }
  window.addEventListener('beforeunload', e => { if (busy) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start ---------- */
  (async () => {
    const {data} = await db.auth.getSession(); const s = data && data.session;
    if (!s || !s.user || s.user.is_anonymous) return show('signedout');
    user = s.user;
    try { await Promise.race([WC.pull(db, user.id), new Promise(r => setTimeout(r, 4000))]); } catch (e) {}
    if (LID) return openLesson();
    show('startview'); renderMine();
  })();
})();
