/* A lesson from a teacher's slides (v3.1.70; LES-338, LES-339, BUS-099; plan 2026-11-10, phase 1).
   1. The teacher chooses a PDF. pdf.js (vendored, no CDN) draws each page as a picture about 1,280 px wide and reads its text.
   2. "Draft the lesson" makes a normal Teacher Studio lesson named "Class, Unit N: name" (so Places finds it), uploads the
      pictures to its files (slides/01.jpg …) and asks lesson-ai?mode=draft for scripts, 8 slides at a time, then for the
      goals and the end-of-lesson check. Worldview stops at $2 per presentation (checked on the server).
   3. Everything lives in the lesson's lesson.json ("slides-v1"); this page edits it and saves as you type.
   Content (slides, goals, check) is kept apart from how students take it (styles come in v3.1.71, LES-340). */
(() => {
  const URL_ = 'https://eqppapoepynjvsfnoodj.supabase.co', KEY = 'sb_publishable_rfg0gznLhbAW07TlC4U6WQ_i8WqA3PT';
  const FILES = URL_ + '/storage/v1/object/public/lesson-files/', BUCKET = 'lesson-files', T = 'worldview_teacher_lessons';
  const PDFJS = 'vendor/pdfjs-6.5.438/', MAX = 60, BATCH = 8, WIDTH = 1280;
  const db = window.supabase.createClient(URL_, KEY, {auth: {persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'worldview-alpha-auth'}});
  const $ = s => document.querySelector(s);
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const pad = n => String(n).padStart(2, '0');
  const money = v => '$' + (v < 0.01 && v > 0 ? v.toFixed(3) : v.toFixed(2));
  const show = id => ['signedout', 'loading', 'newview', 'lessonview'].forEach(x => { $('#' + x).hidden = x !== id; });
  const toast = m => { document.querySelectorAll('.toast').forEach(t => t.remove()); const t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 4000); };

  /* ---------- classes (the same naming as Teacher Studio, NAV-209) ---------- */
  const PD = window.WorldviewPlacesData || {classes: [], currentUnit: () => 0}, CLS = PD.classes;
  function classOf(title) {
    const t = title || '';
    for (const c of CLS) {
      const pre = c.name + ', unit ';
      if (t.slice(0, pre.length).toLowerCase() !== pre.toLowerCase()) continue;
      const m = t.slice(pre.length).match(/^(\d+)(?!\d)\s*:?\s*/);
      if (m && c.units[+m[1] - 1]) return {c, u: +m[1] - 1, name: t.slice(pre.length + m[0].length) || 'Untitled'};
    }
    return null;
  }
  const fullTitle = (p, name) => (p ? p.c.name + ', Unit ' + (p.u + 1) + ': ' + name : name).slice(0, 120);
  const classOptions = none => '<option value="">' + none + '</option>' + CLS.map((c, ci) => '<optgroup label="' + esc(c.name) + '">' + c.units.map((u, ui) => '<option value="' + ci + '|' + ui + '">' + esc(c.name) + ', Unit ' + (ui + 1) + ': ' + esc(u[0]) + '</option>').join('') + '</optgroup>').join('');
  const pickValue = v => { const [ci, ui] = (v || '').split('|'); return v && CLS[+ci] ? {c: CLS[+ci], u: +ui} : null; };
  const valueOf = p => p ? CLS.indexOf(p.c) + '|' + p.u : '';

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

  /* The lesson's own page until the styles arrive (v3.1.71): a plain read-along of the slides and their scripts. */
  const READALONG = name => `<!-- WORLDVIEW-SLIDES-LESSON: made from slides on Worldview (lesson.json). -->
<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(name)}</title>
<style>body{margin:0;padding:18px;font:16px/1.55 -apple-system,"Segoe UI",Roboto,sans-serif;background:#f8f4ec;color:#2c241c}main{max-width:760px;margin:0 auto;display:grid;gap:14px}h1{font:400 26px Georgia,serif;margin:0}img{width:100%;border-radius:8px;border:1px solid #e4dccb;background:#fff}p{margin:0}.s{font-family:Georgia,serif}.row{display:flex;gap:10px;justify-content:space-between;align-items:center}button{border:0;border-radius:999px;padding:10px 20px;background:#bd5a30;color:#fff;font:inherit;font-weight:700;cursor:pointer}button[disabled]{opacity:.4}.m{color:#6f6355;font-size:14px}</style></head>
<body><main id="m"><p class="m">Loading…</p></main>
<script>
const wv = WorldviewPort({title: ${JSON.stringify(String(name)).replace(/</g, '\\u003c')}});
let L = null, i = 0;
const e = s => String(s || '').replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
function draw() {
  const s = L.slides[i], last = i === L.slides.length - 1;
  document.getElementById('m').innerHTML = '<h1>' + e(L.title) + '</h1><img src="' + e(s.image) + '" alt="Slide ' + s.n + '"><p class="s">' + e(s.script) + '</p>' + (s.pause ? '<p class="m">Pause: ' + e(s.pause) + '</p>' : '') + '<div class="row"><button id="b"' + (i ? '' : ' disabled') + '>Back</button><span class="m">' + (i + 1) + ' of ' + L.slides.length + '</span><button id="n">' + (last ? 'Finish' : 'Next') + '</button></div>';
  document.getElementById('b').onclick = () => { i--; draw(); };
  document.getElementById('n').onclick = () => { if (last) { document.getElementById('m').innerHTML = '<h1>Explain it back</h1>' + (L.check || []).map(q => '<p class="s">' + e(q.question) + '</p>' + (q.image ? '<img src="' + e(q.image) + '" alt="">' : '')).join('') + '<p class="m">The full lesson, with an AI that listens, comes in the next version.</p>'; wv.done(); return; } i++; wv.progress((i + 1) / L.slides.length); draw(); };
}
wv.readFile('lesson.json').then(t => { try { L = JSON.parse(t); } catch (x) {} if (!L || !L.slides || !L.slides.length) { document.getElementById('m').innerHTML = '<p>This lesson has no slides yet.</p>'; return; } draw(); });
<\/script></body></html>
`;

  /* ---------- state ---------- */
  let user = null, row = null, L = null, deck = null, busy = false, saveTimer = 0, picFor = -1;

  /* ---------- 1. reading the PDF ---------- */
  let pdfjsP = null;
  const pdfjs = () => (pdfjsP = pdfjsP || import('./' + PDFJS + 'pdf.min.mjs').then(m => { m.GlobalWorkerOptions.workerSrc = new URL(PDFJS + 'pdf.worker.min.mjs', location.href).href; return m; }));
  const OTHER = /\.(pptx?|key|odp|docx?|pages|png|jpe?g|gif|heic)$/i;
  function askForPdf(file) {
    const n = file ? esc(file.name) : 'That file';
    $('#typeask').innerHTML = `<b>Worldview needs this presentation as a PDF.</b><p>${n} isn't a PDF. In PowerPoint choose <b>File › Save As › PDF</b> (Keynote: File › Export To › PDF; Google Slides: File › Download › PDF), then choose the PDF here.</p>`;
    $('#typeask').hidden = false;
  }
  async function readPdf(file) {
    $('#typeask').hidden = true; $('#deck').hidden = true;
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    if (!isPdf) return askForPdf(file);
    if (file.size > 150 * 1024 * 1024) { $('#typeask').innerHTML = '<b>That PDF is over 150 MB.</b><p>Save it again with smaller pictures (PowerPoint: File › Compress Pictures), or split it in two.</p>'; $('#typeask').hidden = false; return; }
    progress(0, 'Opening ' + file.name + '…');
    let doc, task;
    try {
      const lib = await pdfjs();
      task = lib.getDocument({data: new Uint8Array(await file.arrayBuffer()), standardFontDataUrl: new URL(PDFJS + 'standard_fonts/', location.href).href, isEvalSupported: false}); doc = await task.promise;
    } catch (e) {
      progress(null);
      $('#typeask').innerHTML = `<b>This PDF couldn't be opened.</b><p>${/password/i.test(String(e && e.name)) ? 'It is protected by a password. Save a copy without the password and choose that.' : 'Save the presentation as a PDF again and choose the new file.'}</p>`;
      $('#typeask').hidden = false; return;
    }
    if (doc.numPages > MAX) { progress(null); $('#typeask').innerHTML = `<b>This presentation has ${doc.numPages} slides.</b><p>Worldview takes up to ${MAX} slides at a time. Split it into two PDFs and make two lessons.</p>`; $('#typeask').hidden = false; return; }
    const pages = [];
    for (let n = 1; n <= doc.numPages; n++) {
      progress((n - 1) / doc.numPages, `Reading slide ${n} of ${doc.numPages}…`);
      const page = await doc.getPage(n), v1 = page.getViewport({scale: 1}), vp = page.getViewport({scale: Math.min(4, WIDTH / v1.width)});
      const cv = document.createElement('canvas'); cv.width = Math.round(vp.width); cv.height = Math.round(vp.height);
      const cx = cv.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, cv.width, cv.height);
      // 'print' draws without waiting for screen frames, so reading continues while the tab is in the background.
      await page.render({canvasContext: cx, canvas: cv, viewport: vp, intent: 'print'}).promise;
      const blob = await new Promise(r => cv.toBlob(r, 'image/jpeg', 0.84));
      let text = '';
      try { const tc = await page.getTextContent(); text = tc.items.map(it => (it.str || '') + (it.hasEOL ? '\n' : ' ')).join('').replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(); } catch (e) {}
      const title = (text.split('\n').find(x => x.trim()) || '').trim().slice(0, 120);
      pages.push({n, blob, url: URL.createObjectURL(blob), text: text.slice(0, 3000), title});
      page.cleanup();
    }
    let meta = '';
    try { const md = await doc.getMetadata(); meta = (md && md.info && md.info.Title || '').trim(); } catch (e) {}
    try { await task.destroy(); } catch (e) {}
    progress(null);
    const fileName = file.name.replace(/\.pdf$/i, '').replace(/[_]+/g, ' ').trim();
    deck = {file: file.name, pages};
    $('#name').value = (meta && !/^(powerpoint|presentation|slide)/i.test(meta) && meta.length < 90 ? meta : fileName).slice(0, 90);
    const empty = pages.filter(p => !p.text).length;
    $('#deckline').textContent = `${pages.length} slide${pages.length === 1 ? '' : 's'} from ${file.name}` + (empty ? ` · ${empty} with no readable text (the AI reads the picture)` : '');
    $('#thumbs').innerHTML = pages.map(p => `<img src="${p.url}" alt="Slide ${p.n}" loading="lazy">`).join('');
    const est = pages.length * 0.012 + 0.03;
    $('#estimate').innerHTML = `Drafting should cost about <b>${money(est)}</b>. Worldview stops if one presentation would pass $2.`;
    $('#deck').hidden = false; $('#go').disabled = false;
  }
  const readSafe = f => readPdf(f).catch(() => { progress(null); $('#typeask').innerHTML = '<b>This PDF could not be read.</b><p>Save the presentation as a PDF again and choose the new file.</p>'; $('#typeask').hidden = false; });
  function progress(frac, text) {
    const p = $('#progress'); if (frac == null) { p.hidden = true; return; }
    p.hidden = false; $('#pbar').style.width = Math.round(Math.max(0.02, Math.min(1, frac)) * 100) + '%'; $('#ptext').textContent = text;
  }

  /* ---------- 2. drafting ---------- */
  const outlineOf = () => L.slides.map(s => ({n: s.n, title: s.title || (s.text || '').split('\n')[0].slice(0, 120)}));
  const ctx = () => ({lesson: row.id, title: L.title, notes: L.teacherNotes || '', rules: L.rules || [], outline: outlineOf()});
  function addCost(r) { if (r && r.costUsd != null) { L.cost.draftUsd = Math.round(((L.cost.draftUsd || 0) + r.costUsd) * 10000) / 10000; L.cost.calls = (L.cost.calls || 0) + 1; L.cost.model = r.model || L.cost.model; } if (r && r.recipe) L.recipe = r.recipe; }
  const SLIDE_KEYS = ['title', 'script', 'keyPoints', 'tripUps', 'pause', 'needsTeacher', 'needsTeacherWhy'];
  function mergeSlide(s) { const t = L.slides.find(x => x.n === s.n); if (!t) return; SLIDE_KEYS.forEach(k => { if (k !== 'title' || s.title) t[k] = s[k]; }); t.edited = false; delete t.draft; }

  async function startDraft() {
    if (busy || !deck) return;
    const name = $('#name').value.trim() || 'Slides', p = pickValue($('#for').value);
    busy = true; $('#go').disabled = true; $('#other').disabled = true;
    try {
      if (!row) {
        progress(0.02, 'Making the lesson…');
        const {data, error} = await db.from(T).insert({title: fullTitle(p, name), html: READALONG(name), note: {format: 'slides-v1'}}).select('id,title,shared').single();
        if (error) throw new Error(/lesson_limit/.test(error.message) ? 'You have 50 lessons, the most for now. Delete one in Teacher Studio first.' : 'The lesson couldn\'t be made: ' + error.message);
        row = data;
      }
      let done = 0;
      const jobs = deck.pages.slice(), worker = async () => { for (let pg; (pg = jobs.shift());) { const {error} = await put('slides/' + pad(pg.n) + '.jpg', pg.blob, 'image/jpeg'); if (error) throw new Error('Slide ' + pg.n + '\'s picture couldn\'t be saved: ' + error.message); done++; progress(0.05 + 0.2 * done / deck.pages.length, `Saving slide pictures · ${done} of ${deck.pages.length}`); } };
      await Promise.all([worker(), worker(), worker(), worker()]);
      L = {format: 'slides-v1', recipe: '', title: name, teacherNotes: $('#notes').value.trim(), rules: [], source: {file: deck.file, slides: deck.pages.length, read: new Date().toISOString()},
        goals: [], check: [], slides: deck.pages.map(pg => ({n: pg.n, image: 'slides/' + pad(pg.n) + '.jpg', title: pg.title, text: pg.text, script: '', keyPoints: [], tripUps: [], pause: '', needsTeacher: false, needsTeacherWhy: '', edited: false})),
        cost: {draftUsd: 0, calls: 0, model: ''}, status: 'drafting'};
      await saveNow();
      history.replaceState(null, '', 'slides.html?l=' + row.id);
      deck.pages.forEach(pg => URL.revokeObjectURL(pg.url)); deck = null;
      await runDraft(f => f, true);
      openLesson();
    } catch (e) {
      progress(null); toast(e.message || String(e));
      if (L && row) openLesson(); else { $('#go').disabled = false; $('#other').disabled = false; }
    } finally { busy = false; }
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
      r.slides.forEach(mergeSlide); await saveNow();
    }
    say(0.95, 'Writing the goals and the end-of-lesson check…');
    const r = await draftAI(Object.assign(ctx(), {action: 'lesson', slides: L.slides.filter(s => s.script).map(s => ({n: s.n, title: s.title, script: s.script, keyPoints: s.keyPoints}))}));
    addCost(r);
    if (!r.ok) { await saveNow(); throw new Error(r.error); }
    if (!L.goals.length) L.goals = r.lesson.goals;
    if (!L.check.length) L.check = r.lesson.check;
    L.status = 'ready'; await saveNow();
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
      <div class="sl-pic"><img src="${FILES + row.id + '/' + esc(s.image)}" alt="Slide ${s.n}" loading="lazy"><span>Slide ${s.n}${s.title ? ' · ' + esc(s.title) : ''}</span></div>
      <div class="sl-edit">
        ${s.needsTeacher ? `<div class="sl-flag"><b>Check this slide.</b><span>${esc(s.needsTeacherWhy || 'The AI wasn\'t sure it read everything here.')}</span><button type="button" class="linkbtn" data-act="okflag">It's right</button></div>` : ''}
        <label>What the AI says<textarea class="script" data-f="script" rows="4">${esc(s.script)}</textarea></label>
        <div class="sl-row2"><label>Key points <span>one per line</span><textarea data-f="keyPoints" rows="2">${esc(lines(s.keyPoints))}</textarea></label><label>Where students trip <span>one per line</span><textarea data-f="tripUps" rows="2">${esc(lines(s.tripUps))}</textarea></label></div>
        <label>Pause to ask <span>optional</span><input type="text" data-f="pause" value="${esc(s.pause)}" maxlength="300" placeholder="A question before moving on"></label>
        <div class="sl-tools">${s.edited ? '<span class="chip">Edited by you</span>' : s.script ? '<span class="chip ok">AI draft</span>' : '<span class="chip">Not drafted yet</span>'}<span class="grow"></span><button type="button" class="linkbtn" data-act="redo">Draft this slide again</button></div>
        <div class="sl-redo" data-redo hidden><input type="text" data-f="ask" maxlength="500" placeholder="What should change? (optional)"><button type="button" class="btn small" data-act="redogo">Draft again</button></div>
      </div></article>`;
  }
  const goalOpts = sel => L.goals.map((g, k) => `<option value="${esc(g.id)}"${g.id === sel ? ' selected' : ''}>Goal ${k + 1}</option>`).join('') || '<option value="">No goals</option>';
  function goalH(g, k) {
    return `<div class="sl-goal" data-g="${k}"><div class="lab"><span>Goal ${k + 1}</span><span class="grow"></span><button type="button" class="sl-x" data-act="delgoal" aria-label="Remove goal ${k + 1}">✕</button></div>
      <input type="text" data-gf="text" value="${esc(g.text)}" maxlength="300" placeholder="Students can …" aria-label="Goal ${k + 1}">
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
    $('#lfor').innerHTML = classOptions('No class'); $('#lfor').value = valueOf(classOf(row.title));
    $('#state').textContent = row.shared ? 'Published' : 'Draft · only you see it';
    $('#state').classList.toggle('ok', !!row.shared);
    $('#slidelist').innerHTML = L.slides.map(slideH).join('');
    renderGoals(); renderCheck();
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
  function openLesson() { show('lessonview'); renderLesson(); }

  async function redo(i, art) {
    const s = L.slides[i]; if (busy) return;
    if (s.edited && !confirm('Draft this slide again? Your edits on it will be replaced.')) return;
    const btn = art.querySelector('[data-act=redogo]'), ask = art.querySelector('[data-f=ask]').value.trim();
    busy = true; btn.disabled = true; btn.textContent = 'Drafting…';
    const r = await draftAI(Object.assign(ctx(), {action: 'redo', slides: [{n: s.n, text: s.text || '', image: s.image}], ask, previous: s.script, before: (L.slides[i - 1] || {}).script || '', after: (L.slides[i + 1] || {}).script || ''}));
    addCost(r); busy = false;
    if (!r.ok) { btn.disabled = false; btn.textContent = 'Draft again'; await saveNow(); loadCost(); return toast(r.error); }
    mergeSlide(r.slides[0]); await saveNow();
    const fresh = document.createElement('div'); fresh.innerHTML = slideH(L.slides[i], i); art.replaceWith(fresh.firstElementChild);
    document.querySelectorAll('#s' + s.n + ' textarea').forEach(grow);
    loadCost(); toast('Slide ' + s.n + ' drafted again (' + money(r.costUsd || 0) + ').');
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
  $('#pdf').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; e.target.value = ''; readSafe(f); });
  const drop = $('#drop');
  ['dragenter', 'dragover'].forEach(t => drop.addEventListener(t, e => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach(t => drop.addEventListener(t, () => drop.classList.remove('over')));
  drop.addEventListener('drop', e => { e.preventDefault(); const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]; readSafe(f); });
  $('#go').addEventListener('click', startDraft);
  $('#other').addEventListener('click', () => $('#pdf').click());
  $('#title').addEventListener('change', async () => {
    const name = $('#title').value.trim(); if (!name) { $('#title').value = L.title; return; }
    L.title = name; saveSoon();
    const t = fullTitle(classOf(row.title), name); if (t !== row.title) { const {error} = await db.from(T).update({title: t}).eq('id', row.id); if (!error) row.title = t; }
  });
  $('#lfor').addEventListener('change', async e => {
    const t = fullTitle(pickValue(e.target.value), L.title), {error} = await db.from(T).update({title: t}).eq('id', row.id);
    if (error) return toast('Couldn\'t move it: ' + error.message);
    row.title = t; const p = pickValue(e.target.value); toast(p ? 'This lesson now shows in ' + p.c.name + ', Unit ' + (p.u + 1) + '.' : 'This lesson no longer belongs to a class.');
  });
  $('#lnotes').addEventListener('input', e => { L.teacherNotes = e.target.value; saveSoon(); });
  $('#lrules').addEventListener('input', e => { L.rules = e.target.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 10); saveSoon(); });
  $('#lessonview').addEventListener('input', e => {
    const t = e.target; if (t.tagName === 'TEXTAREA') grow(t);
    const art = t.closest('.sl-slide');
    if (art && t.dataset.f && t.dataset.f !== 'ask') {
      const s = L.slides[+art.dataset.i];
      if (!s.edited && s.script) { s.draft = {script: s.script, keyPoints: s.keyPoints, tripUps: s.tripUps, pause: s.pause}; s.edited = true; const c = art.querySelector('.sl-tools .chip'); if (c) { c.textContent = 'Edited by you'; c.classList.remove('ok'); } }
      s[t.dataset.f] = t.dataset.f === 'keyPoints' || t.dataset.f === 'tripUps' ? t.value.split('\n').map(x => x.trim()).filter(Boolean).slice(0, 5) : t.value;
      return saveSoon();
    }
    const g = t.closest('.sl-goal'); if (g && t.dataset.gf) { L.goals[+g.dataset.g][t.dataset.gf] = t.value; return saveSoon(); }
    const q = t.closest('.sl-q'); if (q && t.dataset.qf) { L.check[+q.dataset.q][t.dataset.qf] = t.value; return saveSoon(); }
  });
  $('#lessonview').addEventListener('change', e => { const q = e.target.closest('.sl-q'); if (q && e.target.dataset.qf === 'goal') { L.check[+q.dataset.q].goal = e.target.value; saveSoon(); } });
  $('#lessonview').addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.f === 'ask') { e.preventDefault(); const art = e.target.closest('.sl-slide'); redo(+art.dataset.i, art); } });
  $('#lessonview').addEventListener('click', e => {
    const b = e.target.closest('[data-act]'); if (!b || b.disabled) return;
    const art = b.closest('.sl-slide'), q = b.closest('.sl-q'), g = b.closest('.sl-goal'), k = q ? +q.dataset.q : -1;
    switch (b.dataset.act) {
      case 'resume': return resumeDraft();
      case 'okflag': { const s = L.slides[+art.dataset.i]; s.needsTeacher = false; s.checked = true; art.classList.remove('flag'); b.closest('.sl-flag').remove(); return saveSoon(); }
      case 'redo': { const r = art.querySelector('[data-redo]'); r.hidden = !r.hidden; if (!r.hidden) r.querySelector('input').focus(); return; }
      case 'redogo': return redo(+art.dataset.i, art);
      case 'addgoal': L.goals.push({id: 'g' + (Math.max(0, ...L.goals.map(x => +String(x.id).slice(1) || 0)) + 1), text: '', evidence: ''}); renderGoals(); renderCheck(); saveSoon(); $('#goallist').lastElementChild.querySelector('input').focus(); return;
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
      const {data: r} = await db.from(T).select('id,title,shared').eq('id', id).maybeSingle();
      if (!r) { show('newview'); $('#newview').querySelector('h1').textContent = 'This lesson isn\'t yours or no longer exists'; return; }
      row = r; L = await readLessonFile(id);
      if (L) return openLesson();
      // Its slides never finished saving: choose the PDF again and it is drafted into the same lesson.
      $('#for').innerHTML = classOptions('No class'); $('#for').value = valueOf(classOf(row.title));
      show('newview'); $('#newview').querySelector('h1').textContent = 'Choose the PDF again to finish this lesson'; return;
    }
    $('#for').innerHTML = classOptions('No class');
    const ci = CLS.findIndex(c => c.code === q.get('class')), un = q.get('unit');
    $('#for').value = ci < 0 ? '' : ci + '|' + (un == null || !CLS[ci].units[+un] ? PD.currentUnit(CLS[ci]) : +un);
    show('newview');
  })();
})();
