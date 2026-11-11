/* A lesson from a teacher's slides (v3.1.70; LES-338, LES-339, BUS-099; plan 2026-11-10, phase 1).
   1. The teacher chooses a PDF. pdf.js (vendored, no CDN) draws each page as a picture about 1,280 px wide and reads its text.
   2. "Draft the lesson" makes a normal Teacher Studio lesson named "Class, Unit N: name" (so Places finds it), uploads the
      pictures to its files (slides/01.jpg …) and asks lesson-ai?mode=draft for scripts, 8 slides at a time, then for the
      goals and the end-of-lesson check. Worldview stops at $2 per presentation (checked on the server).
   3. Everything lives in the lesson's lesson.json ("slides-v1"); this page edits it and saves as you type.
   Content (slides, goals, check) is kept apart from how students take it: slides-lesson.html (v3.1.72, LES-340) reads lesson.json. */
(() => {
  const URL_ = 'https://eqppapoepynjvsfnoodj.supabase.co', KEY = 'sb_publishable_rfg0gznLhbAW07TlC4U6WQ_i8WqA3PT';
  const FILES = URL_ + '/storage/v1/object/public/lesson-files/', BUCKET = 'lesson-files', T = 'worldview_teacher_lessons';
  const PDFJS = new URL('vendor/pdfjs-6.5.438/', document.currentScript ? document.currentScript.src : location.href).href, MAX = 60, BATCH = 8, WIDTH = 1280;
  const db = window.supabase.createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'worldview-alpha-auth'}});
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const money = v => '$' + (v < 0.01 && v > 0 ? v.toFixed(3) : v.toFixed(2));
  const show = id => ['signedout', 'loading', 'newview', 'lessonview'].forEach(x => { $('#' + x).hidden = x !== id; });
  const toast = m => { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); };

  /* ---------- classes (places-classes.js; a lesson is linked to its class by note.classId, v3.1.73) ---------- */
  const WC = window.WorldviewClasses;
  const classOptions = () => WC.list().map(c => '<option value="' + esc(c.id) + '">' + esc(c.name) + '</option>').join('');
  const classOfRow = () => (row && WC.ofLesson(row)) || null;
  /* Back goes to the class's calendar in Teacher view, never to the School home. */
  const classHref = id => './#places' + (id ? '/' + encodeURIComponent(id) : '');
  const setBack = id => { $('#backto').href = classHref(id); };
  /* v3.1.76: coming back to the School tab was a full load of the 1 MB Worldview page and its sign-in and lesson lists.
     When the teacher came here from that page, go back instead, so the browser can show it again from memory. */
  $('#backto').addEventListener('click', e => {
    let fromApp = false; try { const r = new URL(document.referrer); fromApp = r.origin === location.origin && /\/(index\.html)?$/.test(r.pathname); } catch (x) {}
    if (fromApp && history.length > 1) { e.preventDefault(); history.back(); }
  });
  /* Old lessons keep their "Class, Unit N: " title prefix when renamed; new ones are named just what the teacher typed. */
  const titleFor = name => { const m = row && /^(.*?,\s*unit\s*\d+\s*:\s*)/i.exec(row.title || ''); return ((m && classOfRow() ? m[1] : '') + name).slice(0, 120); };

  /* ---------- talking to Worldview ---------- */
  const authHeaders = async () => { let token = KEY; try { const s = (await db.auth.getSession()).data.session; if (s) token = s.access_token; } catch (e) {} return {apikey: KEY, authorization: 'Bearer ' + token}; };
  async function draftAI(body) {
    try {
      const r = await fetch(URL_ + '/functions/v1/lesson-ai?mode=draft', {method: 'POST', headers: Object.assign({'content-type': 'application/json'}, await authHeaders()), body: JSON.stringify(body)});
      const j = await r.json().catch(() => ({}));
      if (r.ok && j.ok) return j;
      const e = j.error;
      return Object.assign({}, j, {ok: false, error: (e && e.message) || (typeof e === 'string' && e) || 'The drafting AI couldn\'t answer just now.', type: (e && e.type) || 'http_' + r.status});
    } catch (e) { return {ok: false, error: 'Worldview couldn\'t be reached. Check the internet connection.', type: 'network'}; }
  }
  const put = (path, blob, type) => db.storage.from(BUCKET).upload(row.id + '/' + path, blob, {upsert: true, contentType: type || blob.type || undefined, cacheControl: path === 'lesson.json' ? '10' : '3600'});
  async function readLessonFile(id) {
    const {data, error} = await db.storage.from(BUCKET).download(id + '/lesson.json');
    if (error || !data) return null;
    try { const j = JSON.parse(await data.text()); return j && j.format === 'slides-v1' ? j : null; } catch (e) { return null; }
  }

  /* ---------- state ---------- */
  let user = null, row = null, L = null, resumeRow = null, busy = false, saveTimer = 0, picFor = -1;
  const picked = new Set(); // slide numbers ticked for 'Draft these again'
  const RECIPE = 'lecture-pauses 1.1', isCurrent = r => /^lecture-pauses 1\.1\b/.test(r || '');

  /* ---------- 1. reading the PDFs into a queue ---------- */
  let pdfjsP = null;
  const pdfjs = () => (pdfjsP = pdfjsP || import(PDFJS + 'pdf.min.mjs').then(m => { m.GlobalWorkerOptions.workerSrc = PDFJS + 'pdf.worker.min.mjs'; return m; }));
  const Q = []; let qid = 0, curQ = null;
  const itemEl = it => document.querySelector('[data-qid="' + it.id + '"]');
  function setProg(it, frac, text) {
    const el = itemEl(it); if (!el) return;
    el.querySelector('.q-prog').hidden = frac == null;
    if (frac != null) { el.querySelector('.q-fill').style.width = Math.round(Math.max(0.02, Math.min(1, frac)) * 100) + '%'; el.querySelector('.q-text').textContent = text; }
  }
  const itemFail = (it, html) => { it.state = 'error'; it.msg = html; renderQueue(); };
  async function readPdf(file, it) {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) return itemFail(it, `<b>Worldview needs this presentation as a PDF.</b> ${esc(file.name)} isn't a PDF. In PowerPoint choose <b>File › Save As › PDF</b> (Keynote: File › Export To › PDF; Google Slides: File › Download › PDF), then choose the PDF here.`);
    if (file.size > 150 * 1024 * 1024) return itemFail(it, '<b>That PDF is over 150 MB.</b> Save it again with smaller pictures (PowerPoint: File › Compress Pictures), or split it in two.');
    it.prog = [0, 'Opening ' + file.name + '…']; setProg(it, 0, it.prog[1]);
    let doc, task;
    try {
      const lib = await pdfjs();
      task = lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: PDFJS + 'standard_fonts/', isEvalSupported: false}); doc = await task.promise;
    } catch (e) {
      return itemFail(it, `<b>${esc(file.name)} couldn't be opened.</b> ${/password/i.test(String(e && e.name)) ? 'It is protected by a password. Save a copy without the password and choose that.' : 'Save the presentation as a PDF again and choose the new file.'}`);
    }
    if (doc.numPages > MAX) return itemFail(it, `<b>${esc(file.name)} has ${doc.numPages} slides.</b> Worldview takes up to ${MAX} slides at a time. Split it into two PDFs and make two lessons.`);
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      it.prog = [(n - 1) / doc.numPages, `Reading slide ${n} of ${doc.numPages}…`]; setProg(it, it.prog[0], it.prog[1]);
      const page = await doc.getPage(n), v1 = page.getViewport({scale: 1}), vp = page.getViewport({scale: Math.min(4, WIDTH / v1.width)});
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      // 'print' draws without waiting for screen frames, so reading continues while the tab is in the background.
      await page.render({canvasContext: cx, canvas: cv, viewport: vp, intent: 'print'}).promise;
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.84));
      let text = '', lines = null;
      try {
        const tc = await page.getTextContent(), lib = await pdfjs();
        text = tc.items.map(x => (x.str || '') + (x.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim();
        lines = lineBoxes(tc.items, v1, lib, text);
      } catch (e) {}
      const title = (text.split('\n').find(x => x.trim()) || '').trim().slice(0, 120);
      pages.push({n, blob, url: URL.createObjectURL(blob), text: text.slice(0, 3000), title, lines: text.length <= 3000 ? lines : null});
      page.cleanup();
    }
    let meta = '';
    try { const md = await doc.getMetadata(); meta = (md && md.info && md.info.Title || '').trim(); } catch (e) {}
    try { await task.destroy(); } catch (e) {}
    const fileName = file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
    it.pages = pages; it.file = file.name; it.state = 'ready'; it.prog = null;
    it.name = (meta && !/^(powerpoint|presentation|slide)/i.test(meta) && meta.length < 90 ? meta : fileName).slice(0, 90);
    it.empty = pages.filter(p => !p.text).length;
    renderQueue();
  }
  /* v3.1.74: where each line of the slide's text sits on the picture, as [left, top, right, bottom] from 0 to 1, one per
     non-empty text line (the same lines the drafting AI numbers). The student page covers lines not reached yet only when
     these agree with the steps; anything odd (rotated text, a line count that doesn't match) gives null: the whole slide shows. */
  function lineBoxes(items, vp, lib, text) {
    const out = []; let s = '', box = null;
    const flush = () => { if (s.replace(/\s+/g, ' ').trim()) out.push(box); s = ''; box = null; };
    for (const it of items) {
      const str = it.str || '';
      if (str.trim()) {
        const tx = lib.Util.transform(vp.transform, it.transform), h = Math.hypot(tx[2], tx[3]);
        if (Math.abs(tx[1]) > 0.01 * Math.abs(tx[0]) + 0.01) return null; // rotated text
        const b = [tx[4] / vp.width, (tx[5] - h) / vp.height, (tx[4] + it.width * vp.scale) / vp.width, (tx[5] + h * 0.25) / vp.height];
        box = box ? [Math.min(box[0], b[0]), Math.min(box[1], b[1]), Math.max(box[2], b[2]), Math.max(box[3], b[3])] : b;
      }
      s += str + ' ';
      if (it.hasEOL) flush();
    }
    flush();
    const want = text.split('\n').map(x => x.trim()).filter(Boolean).length;
    if (!out.length || out.length !== want || out.some(b => !b)) return null;
    return out.map(b => b.map(x => Math.round(Math.max(0, Math.min(1, x)) * 1000) / 1000));
  }
  const readSafe = (f, it) => readPdf(f, it).catch(() => itemFail(it, '<b>' + esc(f.name) + ' could not be read.</b> Save the presentation as a PDF again and choose the new file.'));
  const STATE = {reading: 'Reading…', ready: 'Ready', waiting: 'Waiting for its turn', drafting: 'Drafting…', done: 'Drafted', failed: 'Stopped', error: 'Can\'t use this file'};
  function renderQueue() {
    $('#deck').hidden = !Q.length;
    $('#queue').innerHTML = Q.map(it => {
      const cost = it.L && it.L.cost && it.L.cost.draftUsd ? ' · cost ' + money(it.L.cost.draftUsd) : '';
      const meta = it.pages ? `${it.pages.length} slide${it.pages.length === 1 ? '' : 's'} from ${esc(it.file)}${it.empty ? ' · ' + it.empty + ' with no readable text (the AI reads the picture)' : ''}` : esc(it.fileName || '');
      const open = it.row ? `<a class="btn small" href="slides.html?l=${esc(it.row.id)}">${it.state === 'done' ? 'Open the lesson' : 'Open it to finish drafting'}</a>` : '';
      return `<div class="sl-q-item ${it.state}" data-qid="${it.id}">
        <div class="q-top">${it.state === 'ready' ? `<input type="text" class="q-name" maxlength="90" autocomplete="off" aria-label="Lesson name" value="${esc(it.name)}">` : `<b class="q-name">${esc(it.name || it.fileName || 'Presentation')}</b>`}<span class="chip${it.state === 'done' ? ' ok' : ''}">${STATE[it.state] || ''}${cost}</span></div>
        <p class="muted small q-meta">${meta}</p>
        ${it.pages && it.state === 'ready' ? '<div class="sl-thumbs">' + it.pages.slice(0, 12).map(p => `<img src="${p.url}" alt="Slide ${p.n}" loading="lazy">`).join('') + '</div>' : ''}
        <div class="q-prog sl-progress" hidden><div class="bar"><i class="q-fill"></i></div><p class="q-text" role="status"></p></div>
        ${it.msg ? `<div class="sl-ask" role="status">${it.msg}</div>` : ''}
        <div class="q-acts">${it.state === 'done' || it.state === 'failed' ? open : ''}${it.state === 'ready' || it.state === 'error' || (it.state === 'failed' && !it.row) ? '<button type="button" class="linkbtn" data-q="remove">Remove</button>' : ''}</div>
      </div>`;
    }).join('');
    const ready = Q.filter(x => x.state === 'ready'), reading = Q.some(x => x.state === 'reading'), running = Q.some(x => x.state === 'drafting' || x.state === 'waiting');
    $('#go').disabled = busy || reading || !ready.length;
    $('#go').textContent = ready.length > 1 ? 'Draft these ' + ready.length + ' lessons' : 'Draft the lesson';
    $('#other').disabled = busy;
    $('#drop').hidden = running;
    const est = ready.reduce((t, x) => t + x.pages.length * 0.012 + 0.03 + ($('#w-conv').checked ? 0.01 + x.pages.length * 0.0015 : 0), 0);
    $('#estimate').innerHTML = ready.length ? `Drafting should cost about <b>${money(est)}</b>${ready.length > 1 ? ' in all' : ''}. Worldview stops any one presentation that would pass $2.` : '';
    Q.forEach(it => { if (it.prog) setProg(it, it.prog[0], it.prog[1]); });
  }
  async function addFiles(files) {
    files = [...files].slice(0, resumeRow ? 1 : 12); if (!files.length) return;
    const fresh = files.map(f => ({id: ++qid, fileName: f.name, name: f.name.replace(/\.[a-z0-9]+$/i, ''), state: 'reading', file: f.name}));
    if (resumeRow) fresh[0].row = resumeRow;
    Q.push(...fresh); renderQueue();
    for (let i = 0; i < fresh.length; i++) await readSafe(files[i], fresh[i]);
  }

  /* ---------- 2. drafting ---------- */
  const outlineOf = () => L.slides.map(s => ({n: s.n, title: s.title || (s.text || '').split('\n')[0].slice(0, 120)}));
  const ctx = () => ({lesson: row.id, title: L.title, notes: L.teacherNotes || '', rules: L.rules || [], outline: outlineOf()});
  function addCost(r) { if (r && r.costUsd != null) { L.cost.draftUsd = Math.round(((L.cost.draftUsd || 0) + r.costUsd) * 10000) / 10000; L.cost.calls = (L.cost.calls || 0) + 1; L.cost.model = r.model || L.cost.model; } }
  const SLIDE_KEYS = ['title', 'script', 'steps', 'keyPoints', 'tripUps', 'pause', 'needsTeacher', 'needsTeacherWhy'];
  function mergeSlide(s, recipe) { const t = L.slides.find(x => x.n === s.n); if (!t) return; SLIDE_KEYS.forEach(k => { if (k !== 'title' || s.title) t[k] = k === 'steps' ? (Array.isArray(s.steps) ? s.steps : []) : s[k]; }); if (!t.steps.length) delete t.steps; if (recipe) t.recipe = recipe; t.edited = false; delete t.draft; }
  function progress(frac, text) { if (curQ) { curQ.prog = frac == null ? null : [frac, text]; setProg(curQ, frac, text); } }
  const waysChosen = () => ({conversation: $('#w-conv').checked, lecture: $('#w-lecture').checked, voice: true});

  /* Draft every queued presentation, one after another. Each becomes its own lesson with no date: it waits in the class's Drafts. */
  async function startQueue() {
    if (busy) return;
    const todo = Q.filter(x => x.state === 'ready'); if (!todo.length) return;
    const ways = waysChosen(); if (!ways.conversation && !ways.lecture) { $('#wmsg').textContent = 'Keep at least one way on, so students have a way to start.'; return; }
    const notes = $('#notes').value.trim(), cls = $('#for').value;
    todo.forEach(it => { const inp = itemEl(it) && itemEl(it).querySelector('input.q-name'); it.name = ((inp ? inp.value : it.name) || '').trim() || 'Slides'; it.state = 'waiting'; });
    busy = true; renderQueue();
    for (const it of todo) {
      curQ = it; it.state = 'drafting'; it.msg = ''; row = it.row || null; L = it.L || null; renderQueue();
      try { await draftOne(it, ways, notes, cls); it.state = 'done'; }
      catch (e) { it.state = 'failed'; it.msg = esc(e.message || String(e)); }
      it.prog = null; it.row = row; it.L = L; renderQueue();
    }
    busy = false; curQ = null; renderQueue();
    const done = Q.filter(x => x.state === 'done');
    if (Q.length === 1 && done.length === 1) { row = done[0].row; L = done[0].L; history.replaceState(null, '', 'slides.html?l=' + row.id); return openLesson(); }
    row = null; L = null;
    if (done.length) toast(done.length === 1 ? 'One lesson is drafted.' : done.length + ' lessons are drafted.');
  }
  async function draftOne(it, ways, notes, cls) {
    const name = it.name;
    if (!row) {
      progress(0.02, 'Making the lesson…');
      const note = Object.assign({format: 'slides-v1'}, WC.get(cls) ? {classId: cls} : {});
      const {data, error} = await db.from(T).insert({title: name.slice(0, 120), html: '<!doctype html><title>Lesson</title>', note}).select('id,title,shared,note').single();
      if (error) throw new Error(/lesson_limit/.test(error.message) ? 'You have 50 lessons, the most for now. Delete one in Teacher Studio first.' : 'The lesson couldn\'t be made: ' + error.message);
      row = data; it.row = row;
      // the student page (slides-lesson.html, v3.1.72) goes into the lesson; it reads lesson.json and holds no lesson content
      try { await WorldviewPublish.ensureSlidesStyle(db, row.id, ''); } catch (e) { throw new Error(e.message || String(e)); }
    }
    let done = 0;
    const jobs = it.pages.slice(), worker = async () => { for (let pg; (pg = jobs.shift());) { const {error} = await put('slides/' + pad(pg.n) + '.jpg', pg.blob, 'image/jpeg'); if (error) throw new Error('Slide ' + pg.n + '\'s picture couldn\'t be saved: ' + error.message); done++; progress(0.05 + 0.2 * done / it.pages.length, 'Saving slide pictures…'); } };
    await Promise.all([worker(), worker(), worker(), worker()]);
    L = {format: 'slides-v1', recipe: '', title: name, teacherNotes: notes, rules: [], styles: ways, source: {file: it.file, slides: it.pages.length, read: new Date().toISOString()},
      goals: [], check: [], slides: it.pages.map(pg => ({n: pg.n, image: 'slides/' + pad(pg.n) + '.jpg', title: pg.title, text: pg.text, lines: pg.lines || undefined, script: '', keyPoints: [], tripUps: [], pause: '', needsTeacher: false, needsTeacherWhy: '', edited: false})),
      cost: {draftUsd: 0, calls: 0, model: ''}, status: 'drafting'};
    it.L = L;
    await saveNow();
    it.pages.forEach(pg => URL.revokeObjectURL(pg.url)); it.pages = null;
    await runDraft(f => f, true);
  }
  /* Draft every slide that has no script yet, then the goals and the check. Safe to run again after a stop. */
  async function runDraft(onProgress, fromNew) {
    const say = (frac, text) => { if (fromNew) progress(0.25 + 0.75 * frac, text); else { $('#resume').hidden = false; $('#resume').innerHTML = `<span>${esc(text)}</span>`; } };
    const todo = L.slides.filter(s => !s.script);
    for (let i = 0; i < todo.length; i += BATCH) {
      const part = todo.slice(i, i + BATCH);
      say(i / (todo.length + BATCH), `Drafting slides ${part[0].n}–${part[part.length - 1].n} of ${L.slides.length}${L.cost.draftUsd ? ' · ' + money(L.cost.draftUsd) + ' so far' : ''}…`);
      const r = await draftAI(Object.assign(ctx(), {action: 'slides', slides: part.map(s => ({n: s.n, text: s.text || '', image: s.image}))}));
      addCost(r);
      if (!r.ok) { await saveNow(); throw new Error(r.error); }
      r.slides.forEach(x => mergeSlide(x, r.recipe)); if (r.recipe) L.recipe = r.recipe; await saveNow();
    }
    say(0.95, 'Writing the goals and the end-of-lesson check…');
    const r = await draftAI(Object.assign(ctx(), {action: 'lesson', slides: L.slides.filter(s => s.script).map(s => ({n: s.n, title: s.title, script: s.script, keyPoints: s.keyPoints}))}));
    addCost(r);
    if (!r.ok) { await saveNow(); throw new Error(r.error); }
    if (!L.goals.length) L.goals = r.lesson.goals;
    if (!L.check.length) L.check = r.lesson.check;
    L.status = 'ready'; await saveNow();
    // v3.1.75: the conversation map, only when Conversation is one of the ways students may learn this. A failed map never stops the lesson.
    if (L.styles && L.styles.conversation !== false && !L.map && L.goals.length) {
      say(0.98, 'Planning the conversation (its map)…');
      const m = await draftMap(false);
      if (!m.ok) toast('The lesson is drafted, but its conversation map couldn\'t be made: ' + m.error + ' Use "Build the conversation map" on the lesson page.');
    }
  }

  /* ---------- v3.1.75: the conversation map (LES-354..LES-356; recipe "conversation 1.0") ----------
     lesson.json `map` = {recipe, opening, survey: [{question, chapters: [id, id?]}], chapters: [{id, goal, title, slides: [n],
     terms: [{term, meaning}], points: [], tripUps: [], see, equation, edited}], questionsEdited, drafted}.
     v3.1.76 (recipe "conversation 1.1"): see = the chapter's one optional thing to look at: null | {kind: 'formula', formula, purpose,
     parts: [{part, meaning}], reading} | {kind: 'slide', slide: n, purpose} | {kind: 'example', example, purpose}. equation (the v3.1.75
     field) is still written for a formula, so older student pages keep working; a map with only equation reads as a formula. Drafted by lesson-ai?mode=draft action "map" from the slides' text and scripts, the notes and the
     goals only. "Draft the map again" keeps chapters (and questions) the teacher edited unless they tick "also replace". */
  const MAP_RECIPE = 'conversation 1.1';
  const SEE_LABEL = {formula: 'formula', slide: 'slide to look at', example: 'worked example'};
  const seeOf = c => c.see && c.see.kind ? c.see : c.equation ? Object.assign({kind: 'formula'}, c.equation) : null;
  function setSee(c, s) { c.see = s; c.equation = s && s.kind === 'formula' ? {formula: s.formula || '', purpose: s.purpose || '', parts: s.parts || [], reading: s.reading || ''} : null; }
  const openCh = new Set();
  let mapBusy = false;
  const mapEst = () => 0.01 + L.slides.length * 0.0015;
  const newCid = used => { let k = 1; while (used.has('c' + k)) k++; used.add('c' + k); return 'c' + k; };
  async function draftMap(replaceEdited) {
    const r = await draftAI({lesson: row.id, action: 'map', title: L.title, notes: L.teacherNotes || '', rules: L.rules || [],
      slides: L.slides.map(s => ({n: s.n, title: s.title || '', text: (s.text || '').slice(0, 800), script: (s.script || '').slice(0, 1200), keyPoints: s.keyPoints || []})),
      goals: L.goals.map(g => ({text: g.text, evidence: g.evidence}))});
    addCost(r);
    if (!r.ok || !r.map) { await saveNow(); return {ok: false, error: r.error || 'The AI returned no map.'}; }
    // the server numbers goals g1..gN in the order sent; this lesson's own goal ids may differ
    const gid = g => { const k = +String(g || '').slice(1) - 1; return (L.goals[k] || {}).id || ''; };
    const old = L.map, keep = old && !replaceEdited ? old.chapters.filter(c => c.edited) : [];
    const used = new Set(keep.map(c => c.id)), rename = {}, oldByGoal = {};
    // a redrafted chapter takes the id of the unedited chapter it replaces (same goal), so kept quick questions still point at it
    (old ? old.chapters : []).forEach(c => { if (c.goal && !used.has(c.id) && !oldByGoal[c.goal] && !keep.some(k => k.goal === c.goal)) oldByGoal[c.goal] = c.id; });
    let chapters = r.map.chapters.map(c => { const g = gid(c.goal), reuse = g && oldByGoal[g] && !used.has(oldByGoal[g]) ? oldByGoal[g] : ''; if (reuse) used.add(reuse); const id = reuse || newCid(used); rename[c.id] = id; return Object.assign({}, c, {id, goal: g, edited: false}); });
    keep.forEach(k => { const at = chapters.findIndex(c => c.goal && c.goal === k.goal && !c.kept); if (at >= 0) chapters[at] = Object.assign({}, k, {kept: true}); else chapters.push(Object.assign({}, k, {kept: true})); });
    chapters = chapters.map(c => { const o = Object.assign({}, c); delete o.kept; return o; });
    const ids = new Set(chapters.map(c => c.id));
    const keepQ = old && old.questionsEdited && !replaceEdited;
    L.map = {recipe: r.conversationRecipe || MAP_RECIPE, drafted: new Date().toISOString(), questionsEdited: !!keepQ,
      opening: keepQ ? old.opening : r.map.opening,
      survey: keepQ ? old.survey.map(q => ({question: q.question, chapters: q.chapters.filter(id => ids.has(id))})) : r.map.survey.map(q => ({question: q.question, chapters: q.chapters.map(id => rename[id]).filter(Boolean)})),
      chapters};
    L.conversationRecipe = L.map.recipe;
    await saveNow();
    return {ok: true, costUsd: r.costUsd || 0};
  }
  const chLabel = (c, k) => 'Chapter ' + (k + 1);
  const thumbs = ns => (ns || []).map(n => L.slides.find(s => s.n === n)).filter(Boolean).map(s => `<img src="${FILES + row.id + '/' + esc(s.image)}" alt="Slide ${s.n}" title="Slide ${s.n}" loading="lazy">`).join('');
  const pairs = (a, k1, k2) => (a || []).map(x => x[k1] + (x[k2] ? ': ' + x[k2] : '')).join('\n');
  const unpairs = (t, k1, k2, n) => t.split('\n').map(x => x.trim()).filter(Boolean).slice(0, n).map(x => { const i = x.indexOf(':'); return i > 0 ? {[k1]: x.slice(0, i).trim(), [k2]: x.slice(i + 1).trim()} : {[k1]: x, [k2]: ''}; });
  function chapterH(c, k) {
    const goalSel = '<option value="">No goal</option>' + L.goals.map((g, j) => `<option value="${esc(g.id)}"${g.id === c.goal ? ' selected' : ''}>Goal ${j + 1}</option>`).join('');
    const gk = L.goals.findIndex(g => g.id === c.goal), e = seeOf(c);
    const kindSel = [['', 'Nothing'], ['formula', 'A formula'], ['slide', 'A slide picture to look at'], ['example', 'A worked example']].map(([v, l]) => `<option value="${v}"${(e ? e.kind : '') === v ? ' selected' : ''}>${l}</option>`).join('');
    return `<li class="mp-ch" data-c="${k}"><details${openCh.has(c.id) ? ' open' : ''}><summary><span class="mp-n">${k + 1}</span><span class="mp-sum"><b class="mp-t">${esc(c.title)}</b><span class="muted small">${gk >= 0 ? 'Goal ' + (gk + 1) : 'No goal'} · ${(c.points || []).length} point${(c.points || []).length === 1 ? '' : 's'}${e ? ' · ' + SEE_LABEL[e.kind] : ''}${c.edited ? ' · edited by you' : ''}</span></span></summary>
      ${c.slides && c.slides.length ? `<div class="sl-thumbs mp-thumbs">${thumbs(c.slides)}</div>` : ''}
      <div class="mp-body">
        <div class="sl-row2"><label><span>Title</span><input type="text" data-cf="title" maxlength="80" value="${esc(c.title)}"></label><label><span>Goal it serves</span><select data-cf="goal">${goalSel}</select></label></div>
        <label><span>Slides it draws on <em>numbers, for example 3, 4, 5</em></span><input type="text" data-cf="slides" value="${esc((c.slides || []).join(', '))}" inputmode="numeric"></label>
        <label><span>Main points the student should reach <em>one per line</em></span><textarea data-cf="points" rows="3">${esc(lines(c.points))}</textarea></label>
        <label><span>Key terms <em>one per line, "term: what it means"</em></span><textarea data-cf="terms" rows="3">${esc(pairs(c.terms, 'term', 'meaning'))}</textarea></label>
        <label><span>Where students trip <em>one per line</em></span><textarea data-cf="tripUps" rows="2">${esc(lines(c.tripUps))}</textarea></label>
        <label><span>Something to see <em>optional: one thing the student looks at in this chapter</em></span><select data-cf="seekind">${kindSel}</select></label>
        ${e && e.kind === 'formula' ? `<div class="mp-eq"><label><span>Formula</span><input type="text" data-ef="formula" maxlength="200" value="${esc(e.formula)}"></label>
          <label><span>What it is for</span><input type="text" data-ef="purpose" maxlength="300" value="${esc(e.purpose)}"></label>
          <label><span>Each part <em>one per line, "part: what it means"</em></span><textarea data-ef="parts" rows="3">${esc(pairs(e.parts, 'part', 'meaning'))}</textarea></label>
          <label><span>What a higher or lower result tells you</span><input type="text" data-ef="reading" maxlength="300" value="${esc(e.reading)}"></label></div>` : ''}
        ${e && e.kind === 'slide' ? `<div class="mp-eq"><label><span>Slide number</span><input type="text" data-ef="slide" inputmode="numeric" maxlength="3" value="${esc(e.slide || '')}"></label>
          <label><span>What to look at on it, and what it shows</span><input type="text" data-ef="purpose" maxlength="300" value="${esc(e.purpose)}"></label></div>` : ''}
        ${e && e.kind === 'example' ? `<div class="mp-eq"><label><span>The worked example <em>only the material's own numbers and names</em></span><textarea data-ef="example" rows="3" maxlength="800">${esc(e.example)}</textarea></label>
          <label><span>What it shows</span><input type="text" data-ef="purpose" maxlength="300" value="${esc(e.purpose)}"></label></div>` : ''}
        <div class="sl-tools"><button type="button" class="sl-x" data-act="chup" aria-label="Move chapter ${k + 1} up"${k ? '' : ' disabled'}>↑</button><button type="button" class="sl-x" data-act="chdown" aria-label="Move chapter ${k + 1} down"${k < L.map.chapters.length - 1 ? '' : ' disabled'}>↓</button><span class="grow"></span><button type="button" class="linkbtn" data-act="chdel">Remove this chapter</button></div>
      </div></details></li>`;
  }
  function surveyH(q, k) {
    const opt = sel => '<option value="">None</option>' + L.map.chapters.map((c, j) => `<option value="${esc(c.id)}"${c.id === sel ? ' selected' : ''}>${esc(chLabel(c, j))}: ${esc(c.title.slice(0, 40))}</option>`).join('');
    return `<div class="sl-q mp-sq" data-s="${k}"><div class="lab"><span>Quick question ${k + 1}</span><span class="grow"></span><button type="button" class="sl-x" data-act="sqdel" aria-label="Remove quick question ${k + 1}">✕</button></div>
      <textarea data-sqf="question" rows="2" maxlength="400" aria-label="Quick question ${k + 1}">${esc(q.question)}</textarea>
      <div class="mp-about"><span class="muted small">About</span><select data-sqf="c0" aria-label="First chapter it asks about">${opt(q.chapters[0])}</select><select data-sqf="c1" aria-label="Second chapter it asks about">${opt(q.chapters[1])}</select></div></div>`;
  }
  function renderMap() {
    const box = $('#mapbox'); if (!box || !L) return;
    const conv = !(L.styles && L.styles.conversation === false);
    if (!L.map) {
      box.innerHTML = !conv ? '<p class="muted">Conversation is turned off for this lesson, so it has no map. Turn Conversation on in the class calendar\'s lesson panel to build one.</p>'
        : L.status === 'drafting' ? '<p class="muted">The map is planned after the slides, goals and check are drafted.</p>'
        : !L.goals.length ? '<p class="muted">Add at least one goal first: the map has one chapter per goal.</p>'
        : `<p>This lesson has no conversation map yet, so the Conversation is a simple one.</p><div class="row"><button type="button" class="btn small" data-act="mapbuild"${mapBusy ? ' disabled' : ''}>${mapBusy ? 'Planning…' : 'Build the conversation map'}</button><span class="muted small">About ${money(mapEst())}. Worldview still stops at $2 per presentation.</span></div>`;
      return;
    }
    const M = L.map, ed = M.chapters.some(c => c.edited) || M.questionsEdited;
    box.innerHTML = `${!conv ? '<p class="sl-ask">Conversation is turned off for this lesson, so students don\'t see this map. Turn it on in the class calendar\'s lesson panel.</p>' : ''}
      <label class="sl-field"><span>Opening question <em>one broad question about the whole subject</em></span><textarea data-mf="opening" rows="2" maxlength="400">${esc(M.opening)}</textarea></label>
      <div class="mp-survey"><b class="small">Quick questions <em class="muted">find out what the student already knows, at most two chapters each</em></b>${M.survey.map(surveyH).join('') || '<p class="muted small">None. The conversation goes straight to the chapters.</p>'}${M.survey.length < 4 ? '<button type="button" class="linkbtn" data-act="sqadd">Add a quick question</button>' : ''}</div>
      <b class="small">Chapters, in order</b>
      <ol class="mp-line">${M.chapters.map(chapterH).join('')}</ol>
      <div class="sl-tools"><button type="button" class="btn ghost small" data-act="chadd"${M.chapters.length >= 12 ? ' disabled' : ''}>Add a chapter</button></div>
      <div class="mp-again"><button type="button" class="btn ghost small" data-act="mapagain"${mapBusy ? ' disabled' : ''}>${mapBusy ? 'Planning…' : 'Draft the map again'}</button>${ed ? '<label class="sl-ck"><input type="checkbox" id="mapreplace"> Also replace the parts I edited</label>' : ''}<span class="muted small">About ${money(mapEst())}.${ed ? ' Parts you edited stay unless you tick the box.' : ''}</span></div>
      <p class="muted small">${esc(M.recipe || MAP_RECIPE)} · made from the slides, your notes and the goals only.</p>`;
    box.querySelectorAll('textarea').forEach(grow);
  }
  async function mapDraftClick(replace) {
    if (mapBusy || busy) return;
    mapBusy = true; renderMap();
    const m = await draftMap(replace);
    mapBusy = false; renderMap(); loadCost();
    toast(m.ok ? 'The conversation map is ready (' + money(m.costUsd) + ').' : 'Stopped: ' + m.error);
  }
  const chOf = el => L.map.chapters[+el.closest('.mp-ch').dataset.c];
  function chEdited(c, li) { if (!c.edited) { c.edited = true; const s = li && li.querySelector('.mp-sum .muted'); if (s && !/edited by you/.test(s.textContent)) s.textContent += ' · edited by you'; } }
  function mapInput(t) {
    if (t.dataset.mf === 'opening') { L.map.opening = t.value; L.map.questionsEdited = true; return saveSoon(); }
    const sq = t.closest('.mp-sq');
    if (sq && t.dataset.sqf === 'question') { L.map.survey[+sq.dataset.s].question = t.value; L.map.questionsEdited = true; return saveSoon(); }
    const li = t.closest('.mp-ch'); if (!li) return;
    const c = chOf(t), f = t.dataset.cf, ef = t.dataset.ef;
    if (f === 'title') { c.title = t.value; li.querySelector('.mp-t').textContent = t.value; }
    else if (f === 'points' || f === 'tripUps') c[f] = t.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, f === 'points' ? 6 : 4);
    else if (f === 'terms') c.terms = unpairs(t.value, 'term', 'meaning', 8);
    else if (ef) {
      const s = Object.assign({}, seeOf(c) || {kind: 'formula'});
      if (ef === 'parts') s.parts = unpairs(t.value, 'part', 'meaning', 8);
      else if (ef === 'slide') s.slide = +t.value.replace(/[^0-9]/g, '') || 0;
      else s[ef] = t.value;
      setSee(c, s);
    }
    else return;
    chEdited(c, li); saveSoon();
  }
  function mapChange(t) {
    const sq = t.closest('.mp-sq');
    if (sq && (t.dataset.sqf === 'c0' || t.dataset.sqf === 'c1')) { const q = L.map.survey[+sq.dataset.s], a = sq.querySelector('[data-sqf=c0]').value, b = sq.querySelector('[data-sqf=c1]').value; q.chapters = [...new Set([a, b].filter(Boolean))]; L.map.questionsEdited = true; return saveSoon(); }
    const li = t.closest('.mp-ch'); if (!li) return;
    const c = chOf(t);
    if (t.dataset.cf === 'goal') c.goal = t.value;
    else if (t.dataset.cf === 'slides') c.slides = [...new Set(t.value.split(/[^0-9]+/).map(Number).filter(n => L.slides.some(s => s.n === n)))].sort((a, b) => a - b).slice(0, 12);
    else if (t.dataset.cf === 'seekind') {
      const k = t.value, old = seeOf(c);
      setSee(c, !k ? null : old && old.kind === k ? old : k === 'formula' ? {kind: k, formula: '', purpose: '', parts: [], reading: ''} : k === 'slide' ? {kind: k, slide: (c.slides || [])[0] || 0, purpose: ''} : {kind: k, example: '', purpose: ''});
    }
    else return;
    chEdited(c, li); openCh.add(c.id); renderMap(); saveSoon();
  }
  function mapClick(b) {
    const M = L.map, li = b.closest('.mp-ch'), k = li ? +li.dataset.c : -1;
    switch (b.dataset.act) {
      case 'mapbuild': return mapDraftClick(false);
      case 'mapagain': return mapDraftClick(!!($('#mapreplace') && $('#mapreplace').checked));
      case 'chup': case 'chdown': { const j = b.dataset.act === 'chup' ? k - 1 : k + 1; [M.chapters[k], M.chapters[j]] = [M.chapters[j], M.chapters[k]]; M.chapters[j].edited = true; renderMap(); return saveSoon(); }
      case 'chdel': { const id = M.chapters[k].id; if (!confirm('Remove chapter ' + (k + 1) + ', "' + M.chapters[k].title + '"?')) return; M.chapters.splice(k, 1); M.survey.forEach(q => { q.chapters = q.chapters.filter(x => x !== id); }); renderMap(); return saveSoon(); }
      case 'chadd': { const c = {id: newCid(new Set(M.chapters.map(x => x.id))), goal: '', title: 'New chapter', slides: [], terms: [], points: [], tripUps: [], see: null, equation: null, edited: true}; M.chapters.push(c); openCh.add(c.id); renderMap(); saveSoon(); const t = document.querySelector('.mp-ch:last-child [data-cf=title]'); if (t) { t.focus(); t.select(); } return; }
      case 'sqadd': M.survey.push({question: '', chapters: []}); M.questionsEdited = true; renderMap(); saveSoon(); { const t = document.querySelector('.mp-sq:last-of-type textarea'); if (t) t.focus(); } return;
      case 'sqdel': M.survey.splice(+b.closest('.mp-sq').dataset.s, 1); M.questionsEdited = true; renderMap(); return saveSoon();
    }
  }
  async function resumeDraft() {
    if (busy) return; busy = true;
    try { await runDraft(null, false); $('#resume').hidden = true; toast('The lesson is drafted.'); }
    catch (e) { toast(e.message || String(e)); }
    finally { busy = false; renderLesson(); }
  }

  /* ---------- 3. saving ---------- */
  async function saveNow() {
    clearTimeout(saveTimer); saveTimer = 0;
    L.updated = new Date().toISOString();
    const {error} = await put('lesson.json', new Blob([JSON.stringify(L)], {type: 'application/json'}), 'application/json');
    const el = $('#saved'); if (el) el.textContent = error ? 'Not saved: ' + error.message : 'Saved';
    return !error;
  }
  const saveSoon = () => { $('#saved').textContent = 'Saving…'; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 900); };
  window.addEventListener('beforeunload', e => { if (saveTimer || busy) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- the lesson page ---------- */
  async function loadCost() {
    const {data} = await db.from('worldview_teacher_lesson_ai_calls').select('cost_usd,state').eq('lesson_id', row.id).eq('kind', 'draft');
    const rows = (data || []).filter(c => Number(c.cost_usd) > 0), usd = rows.reduce((t, c) => t + Number(c.cost_usd), 0);
    $('#cost').innerHTML = rows.length ? `Drafting this lesson cost <b>${money(usd)}</b> (${rows.length} call${rows.length === 1 ? '' : 's'}).` : 'Nothing has been drafted yet.';
  }
  const grow = el => { el.style.height = 'auto'; el.style.height = el.scrollHeight + 2 + 'px'; };
  const lines = a => (a || []).join('\n');
  function slideH(s, i) {
    return `<article class="sl-slide${s.needsTeacher ? ' flag' : ''}" data-i="${i}" id="s${s.n}">
      <div class="sl-pic"><img src="${FILES + row.id + '/' + esc(s.image)}" alt="Slide ${s.n}" loading="lazy"><span>Slide ${s.n}${s.title ? ' · ' + esc(s.title) : ''}</span><label class="sl-pick"><input type="checkbox" data-pick${picked.has(s.n) ? ' checked' : ''}> Select</label></div>
      <div class="sl-edit">
        ${s.needsTeacher ? `<div class="sl-flag"><b>Check this slide.</b><span>${esc(s.needsTeacherWhy || 'The AI wasn\'t sure it read everything here.')}</span><button type="button" class="linkbtn" data-act="okflag">It's right</button></div>` : ''}
        ${Array.isArray(s.steps) && s.steps.length ? `<div class="sl-steps"><p>Taught one point at a time. Students hear a point, then the lesson waits until they follow.</p>${s.steps.map((st, k) => `<div class="sl-step" data-k="${k}"><div class="lab"><span>Point ${k + 1}</span><span class="grow"></span><button type="button" class="sl-x" data-act="delstep" aria-label="Remove point ${k + 1}">✕</button></div><textarea data-sf="text" rows="3" maxlength="600" aria-label="Point ${k + 1}">${esc(st.text)}</textarea><input type="text" data-sf="check" maxlength="200" value="${esc(st.check || '')}" placeholder="A short check question (optional)" aria-label="Check question for point ${k + 1}"></div>`).join('')}<div class="sl-tools"><button type="button" class="linkbtn" data-act="addstep"${s.steps.length >= 6 ? ' disabled' : ''}>Add a point</button><button type="button" class="linkbtn" data-act="onescript">Make it one script</button></div></div>`
          : `<label>What the AI says<textarea class="script" data-f="script" rows="4">${esc(s.script)}</textarea></label><div class="sl-tools"><button type="button" class="linkbtn" data-act="tosteps">Teach it one point at a time</button></div>`}
        <div class="sl-row2"><label><span>Key points <em>one per line</em></span><textarea data-f="keyPoints" rows="2">${esc(lines(s.keyPoints))}</textarea></label><label><span>Where students trip <em>one per line</em></span><textarea data-f="tripUps" rows="2">${esc(lines(s.tripUps))}</textarea></label></div>
        <label><span>Pause to ask <em>optional</em></span><input type="text" data-f="pause" value="${esc(s.pause)}" maxlength="300" placeholder="A question before moving on"></label>
        <div class="sl-tools">${s.edited ? '<span class="chip">Edited by you</span>' : s.script ? '<span class="chip ok">AI draft</span>' : '<span class="chip">Not drafted yet</span>'}<span class="grow"></span><button type="button" class="linkbtn" data-act="redo">Draft this slide again</button></div>
        <div class="sl-redo" data-redo hidden><input type="text" data-f="ask" maxlength="500" placeholder="What should change? (optional)"><button type="button" class="btn small" data-act="redogo">Draft again</button></div>
      </div></article>`;
  }
  const goalOpts = sel => L.goals.map((g, k) => `<option value="${esc(g.id)}"${g.id === sel ? ' selected' : ''}>Goal ${k + 1}</option>`).join('') || '<option value="">No goals</option>';
  function goalH(g, k) {
    return `<div class="sl-goal" data-g="${k}"><div class="lab"><span>Goal ${k + 1}</span><span class="grow"></span><button type="button" class="sl-x" data-act="delgoal" aria-label="Remove goal ${k + 1}">✕</button></div>
      <textarea data-gf="text" rows="1" maxlength="300" placeholder="Students can …" aria-label="Goal ${k + 1}">${esc(g.text)}</textarea>
      <label class="lab" style="display:grid;gap:3px">What a student would say that shows it<textarea data-gf="evidence" rows="2" maxlength="400">${esc(g.evidence)}</textarea></label></div>`;
  }
  function checkH(q, k) {
    return `<div class="sl-q" data-q="${k}"><div class="lab"><span>Question ${k + 1}</span><select data-qf="goal" aria-label="Which goal it checks">${goalOpts(q.goal)}</select><span class="grow"></span>
      <button type="button" class="sl-x" data-act="qup" aria-label="Move up"${k ? '' : ' disabled'}>↑</button><button type="button" class="sl-x" data-act="qdown" aria-label="Move down"${k < L.check.length - 1 ? '' : ' disabled'}>↓</button><button type="button" class="sl-x" data-act="delq" aria-label="Remove question ${k + 1}">✕</button></div>
      <textarea data-qf="question" rows="2" maxlength="500" placeholder="Explain in your own words …" aria-label="Question ${k + 1}">${esc(q.question)}</textarea>
      ${q.image ? `<img src="${FILES + row.id + '/' + esc(q.image)}" alt="Picture for question ${k + 1}"><div class="sl-tools"><button type="button" class="linkbtn" data-act="qpic">Change the picture</button><button type="button" class="linkbtn" data-act="qnopic">Remove the picture</button></div>` : '<div class="sl-tools"><button type="button" class="linkbtn" data-act="qpic">Add a picture or equation photo</button></div>'}</div>`;
  }
  function renderGoals() { $('#goallist').innerHTML = L.goals.map(goalH).join('') || '<p class="muted small">No goals yet.</p>'; $('#goallist').querySelectorAll('textarea').forEach(grow); }
  function renderCheck() { $('#checklist').innerHTML = L.check.map(checkH).join('') || '<p class="muted small">No questions yet.</p>'; $('#checklist').querySelectorAll('textarea').forEach(grow); }
  function renderLesson() {
    $('#title').value = L.title;
    $('#lfor').innerHTML = '<option value="">No class</option>' + classOptions(); $('#lfor').value = (classOfRow() || {}).id || ''; setBack((classOfRow() || {}).id); renderBars();
    $('#state').textContent = row.shared ? 'Published' : 'Draft · only you see it';
    $('#state').classList.toggle('ok', !!row.shared);
    reSlides(); renderUpgrade();
    renderGoals(); renderCheck(); renderMap();
    $('#lnotes').value = L.teacherNotes || ''; $('#lrules').value = lines(L.rules);
    $('#recipe').textContent = L.recipe ? `Drafted with ${L.recipe}${L.cost.model ? ' (' + L.cost.model + ')' : ''} from ${L.source && L.source.file || 'a PDF'}.` : '';
    $('#studio').href = 'studio.html?from=places&l=' + row.id;
    const left = L.slides.filter(s => !s.script).length;
    if (L.status === 'drafting' && !busy) { $('#resume').hidden = false; $('#resume').innerHTML = `<span>Drafting stopped${left ? ` with ${left} slide${left === 1 ? '' : 's'} left` : ' before the goals'}.</span><button type="button" class="btn small" data-act="resume">Finish drafting</button>`; }
    else if (!busy) $('#resume').hidden = true;
    document.querySelectorAll('.sl-edit textarea').forEach(grow);
    document.title = L.title + ' · Lesson from slides';
    loadCost();
  }
  function openLesson() {
    show('lessonview'); renderLesson();
    // the School day panel opens a part directly: #slides (Lecture with pauses), #map (Conversation), #goals
    const h = /^#(slides|goals|check|map)$/.exec(location.hash); if (h) setTimeout(() => { const el = document.getElementById(h[1]); if (el) el.scrollIntoView(); }, 60);
  }
  $('#mapbox').addEventListener('toggle', e => { const li = e.target.closest && e.target.closest('.mp-ch'); if (!li || !L.map) return; const c = L.map.chapters[+li.dataset.c]; if (c) { if (e.target.open) openCh.add(c.id); else openCh.delete(c.id); } }, true);

  async function redo(i, art) {
    const s = L.slides[i]; if (busy) return;
    if (s.edited && !confirm('Draft this slide again? Your edits on it will be replaced.')) return;
    const btn = art.querySelector('[data-act=redogo]'), ask = art.querySelector('[data-f=ask]').value.trim();
    busy = true; btn.disabled = true; btn.textContent = 'Drafting…';
    const r = await draftAI(Object.assign(ctx(), {action: 'redo', slides: [{n: s.n, text: s.text || '', image: s.image}], ask, previous: s.script, before: (L.slides[i - 1] || {}).script || '', after: (L.slides[i + 1] || {}).script || ''}));
    addCost(r); busy = false;
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Draft again'; await saveNow(); loadCost(); return toast(r.error); }
    mergeSlide(r.slides[0], r.recipe); await saveNow();
    reSlide(i);
    loadCost(); toast('Slide ' + s.n + ' drafted again (' + money(r.costUsd || 0) + ').');
  }

  /* v3.1.74: several slides drafted again at once (with the teacher's instruction), and "Draft again with the newer version". */
  const reSlide = i => { const fresh = document.createElement('div'); fresh.innerHTML = slideH(L.slides[i], i); const art = document.getElementById('s' + L.slides[i].n); art.replaceWith(fresh.firstElementChild); document.querySelectorAll('#s' + L.slides[i].n + ' textarea').forEach(grow); };
  function reSlides() { $('#slidelist').innerHTML = L.slides.map(slideH).join(''); document.querySelectorAll('.sl-edit textarea').forEach(grow); L.slides.forEach(s => { if (picked.has(s.n)) document.getElementById('s' + s.n).classList.add('picked'); }); renderSel(); }
  const estUsd = n => n * 0.012 + 0.005 * Math.ceil(n / BATCH);
  function renderSel() {
    const n = picked.size; $('#selbar').hidden = !n || busy;
    $('#selcount').textContent = n + ' slide' + (n === 1 ? '' : 's') + ' selected';
    $('#selcost').textContent = n ? 'About ' + money(estUsd(n)) + '. Worldview still stops at $2 per presentation.' : '';
  }
  function renderUpgrade() {
    const u = $('#upgrade'), old = L.status !== 'drafting' && L.slides.some(s => s.script) && !isCurrent(L.recipe);
    u.hidden = !old || busy; if (!old) return;
    const edited = L.slides.filter(s => s.edited).length;
    u.innerHTML = `<p><b>A newer way of drafting is ready (${RECIPE}).</b> It explains each new term in plain words instead of reading the slide, says what a formula is for rather than the arithmetic, and takes busy slides one point at a time. This lesson keeps its scripts until you choose.</p>
      <div class="row"><button type="button" class="btn small" data-act="upgrade">Draft again with the newer version</button>${edited ? `<label class="sl-ck"><input type="checkbox" id="upedited"> Also replace the ${edited} slide${edited === 1 ? '' : 's'} I edited</label>` : '<input type="checkbox" id="upedited" hidden>'}<span class="muted small">About ${money(estUsd(L.slides.length))}. Goals and check questions stay as they are.</span></div>`;
  }
  async function redraftMany(ns, ask, upgrade) {
    if (busy || !ns.length) return;
    const list = ns.map(n => L.slides.find(s => s.n === n)).filter(Boolean);
    const edited = list.filter(s => s.edited).length;
    if (!upgrade && edited && !confirm(`Draft ${list.length === 1 ? 'this slide' : 'these ' + list.length + ' slides'} again? Your edits on ${edited} of them will be replaced.`)) return;
    busy = true; renderSel(); $('#upgrade').hidden = true;
    const before = L.cost.draftUsd || 0, say = t => { $('#resume').hidden = false; $('#resume').innerHTML = `<span>${esc(t)}</span>`; };
    let failed = '';
    for (let i = 0; i < list.length; i += BATCH) {
      const part = list.slice(i, i + BATCH);
      say(`Drafting slide${part.length === 1 ? '' : 's'} ${part.map(s => s.n).join(', ')} again${L.cost.draftUsd > before ? ' · ' + money(L.cost.draftUsd - before) + ' so far' : ''}…`);
      const r = await draftAI(Object.assign(ctx(), {action: 'slides', ask, slides: part.map(s => ({n: s.n, text: s.text || '', image: s.image, previous: (s.script || '').slice(0, 1500)}))}));
      addCost(r);
      if (!r.ok) { failed = r.error; break; }
      r.slides.forEach(x => mergeSlide(x, r.recipe)); await saveNow();
    }
    if (upgrade && !failed) L.recipe = RECIPE;
    await saveNow();
    busy = false; $('#resume').hidden = true; if (!failed) picked.clear();
    reSlides(); renderUpgrade(); loadCost();
    toast(failed ? 'Stopped: ' + failed : (list.length === 1 ? 'Slide ' + list[0].n : list.length + ' slides') + ' drafted again (' + money((L.cost.draftUsd || 0) - before) + ').');
  }

  /* a picture for a check question: made at most 1,280 px wide, saved in the lesson's files (check/…) */
  async function addCheckPicture(k, file) {
    if (!file || !/^image\//.test(file.type)) return toast('Choose a picture (a photo or screenshot).');
    try {
      const bmp = await createImageBitmap(file), sc = Math.min(1, WIDTH / bmp.width), cv = document.createElement('canvas');
      cv.width = Math.round(bmp.width * sc); cv.height = Math.round(bmp.height * sc);
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height); cx.drawImage(bmp, 0, 0, cv.width, cv.height);
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.86)), path = 'check/' + Date.now().toString(36) + '.jpg';
      const {error} = await put(path, blob, 'image/jpeg'); if (error) throw error;
      L.check[k].image = path; await saveNow(); renderCheck();
    } catch (e) { toast('The picture couldn\'t be added: ' + (e.message || e)); }
  }

  /* ---------- events ---------- */
  $('#pdf').addEventListener('change', e => { const f = e.target.files ? [...e.target.files] : []; e.target.value = ''; addFiles(f); });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); addFiles(e.dataTransfer && e.dataTransfer.files ? [...e.dataTransfer.files] : []); });
  $('#go').addEventListener('click', startQueue);
  $('#other').addEventListener('click', () => $('#pdf').click());
  $('#queue').addEventListener('click', e => { const b = e.target.closest('[data-q=remove]'); if (!b) return; const id = +b.closest('[data-qid]').dataset.qid, i = Q.findIndex(x => x.id === id); if (i >= 0) { (Q[i].pages || []).forEach(p => URL.revokeObjectURL(p.url)); Q.splice(i, 1); renderQueue(); } });
  const WAYS_MSG = 'Keep at least one way on, so students have a way to start.', WAYS_OK = 'Students can use either one. You can change this later in each lesson.';
  ['#w-conv', '#w-lecture'].forEach(id => $(id).addEventListener('change', e => { if (!$('#w-conv').checked && !$('#w-lecture').checked) { e.target.checked = true; $('#wmsg').textContent = WAYS_MSG; } else $('#wmsg').textContent = WAYS_OK; renderQueue(); }));
  $('#title').addEventListener('change', async () => {
    const name = $('#title').value.trim(); if (!name) { $('#title').value = L.title; return; }
    L.title = name; saveSoon();
    const t = titleFor(name); if (t !== row.title) { const {error} = await db.from(T).update({title: t}).eq('id', row.id); if (!error) row.title = t; }
  });
  $('#lfor').addEventListener('change', async e => {
    const c = WC.get(e.target.value), note = Object.assign({}, row.note || {}); if (c) note.classId = c.id; else delete note.classId;
    const {error} = await db.from(T).update({note}).eq('id', row.id);
    if (error) { $('#lfor').value = (classOfRow() || {}).id || ''; return toast('Couldn\'t move it: ' + error.message); }
    row.note = note; setBack(c && c.id); renderBars(); toast(c ? 'This lesson now belongs to ' + c.name + '.' : 'This lesson no longer belongs to a class.');
  });
  $('#lnotes').addEventListener('input', e => { L.teacherNotes = e.target.value; saveSoon(); });
  $('#lrules').addEventListener('input', e => { L.rules = e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 10); saveSoon(); });
  /* The bar at the top and end of a lesson: put it on the calendar (a day; the next class meeting by default) and go back to the class. */
  const dayText = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}); };
  function renderBars() {
    const c = classOfRow(), has = row && row.note && /^\d{4}-\d\d-\d\d$/.test(row.note.date || '') ? row.note.date : '', dflt = has || (c ? WC.nextMeetKey(c) : WC.keyOf(new Date()));
    document.querySelectorAll('.sl-bar').forEach(bar => {
      bar.innerHTML = `<span class="sl-barmsg">${has ? 'On the calendar for <b>' + esc(dayText(has)) + '</b>.' : 'Not on the calendar yet. Pick a day.'}</span>
        <label class="sl-barday">Day <input type="date" class="bar-day" value="${dflt}" aria-label="Day for this lesson"></label>
        <button type="button" class="btn small" data-bar-act="put">${has ? 'Move it' : 'Put it on the calendar'}</button>
        <a class="btn ghost small" href="${classHref(c && c.id)}">${c ? 'Back to class' : 'Back to School'}</a>`;
    });
  }
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-bar-act=put]'); if (!b) return;
    const k = b.closest('.sl-bar').querySelector('.bar-day').value; if (!/^\d{4}-\d\d-\d\d$/.test(k)) return toast('Pick a day first.');
    b.disabled = true; const note = Object.assign({}, row.note || {}, {date: k}), {error} = await db.from(T).update({note}).eq('id', row.id);
    if (error) { b.disabled = false; return toast('Couldn\'t save the day. Check the internet connection and try again.'); }
    row.note = note; renderBars(); toast('On the calendar for ' + dayText(k) + '.');
  });
  $('#lessonview').addEventListener('input', e => {
    const t = e.target; if (t.tagName === 'TEXTAREA') grow(t);
    if (t.closest('#mapbox')) return L.map ? mapInput(t) : undefined;
    const art = t.closest('.sl-slide');
    if (art && t.dataset.sf) {
      const s = L.slides[+art.dataset.i], k = +t.closest('.sl-step').dataset.k; markEdited(s, art);
      s.steps[k][t.dataset.sf] = t.value; s.script = s.steps.map(x => x.text.trim()).filter(Boolean).join(' ');
      return saveSoon();
    }
    if (art && t.dataset.f && t.dataset.f !== 'ask') {
      const s = L.slides[+art.dataset.i];
      markEdited(s, art);
      s[t.dataset.f] = t.dataset.f === 'keyPoints' || t.dataset.f === 'tripUps' ? t.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 5) : t.value;
      return saveSoon();
    }
    const g = t.closest('.sl-goal'); if (g && t.dataset.gf) { L.goals[+g.dataset.g][t.dataset.gf] = t.value; return saveSoon(); }
    const q = t.closest('.sl-q'); if (q && t.dataset.qf) { L.check[+q.dataset.q][t.dataset.qf] = t.value; return saveSoon(); }
  });
  function markEdited(s, art) { if (!s.edited && s.script) { s.draft = {script: s.script, steps: s.steps ? JSON.parse(JSON.stringify(s.steps)) : undefined, keyPoints: s.keyPoints, tripUps: s.tripUps, pause: s.pause}; s.edited = true; const c = art.querySelector('.sl-tools .chip'); if (c) { c.textContent = 'Edited by you'; c.classList.remove('ok'); } } }
  $('#lessonview').addEventListener('change', e => {
    if (e.target.closest('#mapbox')) return L.map ? mapChange(e.target) : undefined;
    if (e.target.matches('[data-pick]')) { const art = e.target.closest('.sl-slide'), n = L.slides[+art.dataset.i].n; if (e.target.checked) picked.add(n); else picked.delete(n); art.classList.toggle('picked', e.target.checked); return renderSel(); } const q = e.target.closest('.sl-q'); if (q && e.target.dataset.qf === 'goal') { L.check[+q.dataset.q].goal = e.target.value; saveSoon(); } });
  $('#lessonview').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.f === 'ask') { e.preventDefault(); const art = e.target.closest('.sl-slide'); redo(+art.dataset.i, art); } });
  $('#lessonview').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    if (b.closest('#mapbox')) return mapClick(b);
    const art = b.closest('.sl-slide'), q = b.closest('.sl-q'), g = b.closest('.sl-goal'), k = q ? +q.dataset.q : -1;
    switch (b.dataset.act) {
      case 'resume': return resumeDraft();
      case 'upgrade': return redraftMany(L.slides.filter(x => $('#upedited').checked || !x.edited).map(x => x.n), '', true);
      case 'redosel': return redraftMany([...picked].sort((a, b) => a - b), $('#selask').value.trim(), false);
      case 'selall': L.slides.forEach(x => picked.add(x.n)); return reSlides();
      case 'selnone': picked.clear(); return reSlides();
      case 'tosteps': { const s = L.slides[+art.dataset.i]; markEdited(s, art); s.steps = [{text: s.script || '', check: '', upTo: 0}, {text: '', check: '', upTo: 0}]; reSlide(+art.dataset.i); const ta = document.querySelectorAll('#s' + s.n + ' [data-sf=text]'); if (ta[1]) ta[1].focus(); return saveSoon(); }
      case 'addstep': { const s = L.slides[+art.dataset.i]; markEdited(s, art); s.steps.push({text: '', check: '', upTo: 0}); reSlide(+art.dataset.i); const ta = document.querySelectorAll('#s' + s.n + ' [data-sf=text]'); ta[ta.length - 1].focus(); return saveSoon(); }
      case 'delstep': case 'onescript': { const s = L.slides[+art.dataset.i]; markEdited(s, art); if (b.dataset.act === 'delstep') s.steps.splice(+b.closest('.sl-step').dataset.k, 1); const left = s.steps.filter(x => x.text.trim()); s.script = left.map(x => x.text.trim()).join(' '); if (b.dataset.act === 'onescript' || left.length < 2) delete s.steps; reSlide(+art.dataset.i); return saveSoon(); }
      case 'okflag': { const s = L.slides[+art.dataset.i]; s.needsTeacher = false; s.checked = true; art.classList.remove('flag'); b.closest('.sl-flag').remove(); return saveSoon(); }
      case 'redo': { const r = art.querySelector('[data-redo]'); r.hidden = !r.hidden; if (!r.hidden) r.querySelector('input').focus(); return; }
      case 'redogo': return redo(+art.dataset.i, art);
      case 'addgoal': L.goals.push({id: 'g' + (Math.max(0, ...L.goals.map(x => +String(x.id).slice(1) || 0)) + 1), text: '', evidence: ''}); renderGoals(); renderCheck(); saveSoon(); $('#goallist').lastElementChild.querySelector('textarea').focus(); return;
      case 'delgoal': { const id = L.goals[+g.dataset.g].id; L.goals.splice(+g.dataset.g, 1); L.check.forEach(c => { if (c.goal === id) c.goal = (L.goals[0] || {}).id || ''; }); renderGoals(); renderCheck(); return saveSoon(); }
      case 'addcheck': L.check.push({goal: (L.goals[0] || {}).id || '', question: ''}); renderCheck(); saveSoon(); $('#checklist').lastElementChild.querySelector('textarea').focus(); return;
      case 'delq': L.check.splice(k, 1); renderCheck(); return saveSoon();
      case 'qup': case 'qdown': { const j = b.dataset.act === 'qup' ? k - 1 : k + 1; [L.check[k], L.check[j]] = [L.check[j], L.check[k]]; renderCheck(); return saveSoon(); }
      case 'qpic': picFor = k; $('#checkpic').click(); return;
      case 'qnopic': delete L.check[k].image; renderCheck(); return saveSoon();
    }
  });
  $('#checkpic').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (picFor >= 0 && L.check[picFor]) addCheckPicture(picFor, f); });

  /* ---------- start ---------- */
  (async () => {
    const {data} = await db.auth.getSession(); const s = data && data.session;
    if (!s || !s.user || s.user.is_anonymous) return show('signedout');
    user = s.user; $('#who').textContent = user.email || '';
    const q = new URLSearchParams(location.search), id = q.get('l');
    if (id) {
      const {data: r} = await db.from(T).select('id,title,shared,note').eq('id', id).maybeSingle();
      if (!r) { show('newview'); $('#drop').hidden = true; $('#nvh').textContent = 'This lesson isn\'t yours or no longer exists'; return; }
      row = r; L = await readLessonFile(id);
      if (L) return openLesson();
      // Its slides never finished saving: choose the PDF again and it is drafted into the same lesson.
      $('#for').innerHTML = classOptions(); $('#for').value = (classOfRow() || {}).id || WC.list()[0].id; setBack((classOfRow() || {}).id); resumeRow = row; row = null;
      show('newview'); $('#nvh').textContent = 'Choose the PDF again to finish this lesson'; $('#nvp').textContent = 'Its slides never finished saving. Choose the same presentation again and it is drafted into this lesson.'; return;
    }
    $('#for').innerHTML = classOptions();
    const want = WC.get(q.get('class')) || WC.list()[0]; $('#for').value = want.id; setBack(want.id);
    $('#for').addEventListener('change', () => setBack($('#for').value));
    show('newview');
  })();
})();
