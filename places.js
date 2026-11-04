/* Places (NAV-203): your university, your classes as term lines, and for each unit the lessons students made.
   Sample data for now (places-data.js), saved only on this device. Real lessons come in by title: a published Teacher Studio
   lesson named "Calculus II, Unit 3: ..." appears in that unit (no backend change yet). */
(() => {
  const esc = s => String(s).replace(/[&<>"']/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'}[c]));
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem('wv-places-' + k)); return v === null ? d : v; } catch (e) { return d; } };
  const save = (k, v) => { try { localStorage.setItem('wv-places-' + k, JSON.stringify(v)); } catch (e) {} };
  const DAY = 864e5, D = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const add = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const key = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MO = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtS = d => MO[d.getMonth()] + ' ' + d.getDate(), fmt = d => WD[d.getDay()] + ' ' + fmtS(d);
  /* The sample term stays current: its dates move by whole weeks, so today always falls in week 11. */
  const now0 = new Date(), TODAY = new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
  const SHIFT = Math.round((add(TODAY, -((TODAY.getDay() + 6) % 7)) - D('2026-11-02')) / DAY / 7) * 7, moved = s => add(D(s), SHIFT);
  const START = moved('2026-08-24'), END = moved('2026-12-11');
  const pos = d => Math.max(0, Math.min(100, (d - START) / (END - START) * 100));
  const WEEK = Math.min(15, Math.floor(Math.round((TODAY - START) / DAY) / 7) + 1);
  const TERM = (m => m < 4 ? 'Spring' : m < 7 ? 'Summer' : 'Fall')(START.getMonth()) + ' ' + START.getFullYear();
  const MONTHS = []; for (let d = new Date(START.getFullYear(), START.getMonth() + 1, 1); d < END; d = new Date(d.getFullYear(), d.getMonth() + 1, 1)) MONTHS.push(d);
  const BREAKS = new Set(['2026-09-07', '2026-10-12', '2026-10-13', '2026-11-25', '2026-11-26', '2026-11-27'].map(s => key(moved(s))));
  const rnd = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
  const ROOF = '<svg class="pl-roof" viewBox="0 0 320 126" aria-hidden="true"><path class="l" d="M160 2v12"/><path class="s" d="M146 40 Q146 19 160 14 Q174 19 174 40 Z"/><rect class="s" x="141" y="40" width="38" height="24"/><rect class="w" x="148" y="45" width="8" height="13" rx="4"/><rect class="w" x="164" y="45" width="8" height="13" rx="4"/><path class="s" d="M24 108 L160 58 L296 108 Z"/><circle class="s" cx="160" cy="91" r="9"/><path class="l" d="M160 91v-6M160 91l4 2"/><rect class="s" x="14" y="108" width="292" height="9"/><rect class="s" x="22" y="117" width="276" height="9"/></svg>';
  const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  const DATA = window.WorldviewPlacesData, DEMOS = DATA.demos;
  const CLASSES = DATA.classes.map(c => {
    let from = START;
    const units = c.units.map(([n, end, exam, tutors], i) => { const e = moved(end), u = {i, n, from, end: e, exam, tutors: tutors.map(t => Object.assign({u: i}, t))}; from = add(e, 1); return u; });
    const k = units.findIndex(u => TODAY <= u.end), hwt = [];
    for (let w = 2; w <= 15; w += c.hw[1]) { const d = add(START, (w - 1) * 7 + c.hw[0] - 1); if (!BREAKS.has(key(d)) && !units.some(u => key(u.end) === key(d))) hwt.push(d); }
    return Object.assign({}, c, {units, cur: k < 0 ? units.length - 1 : k, hwt});
  });
  const cls = code => CLASSES.find(c => c.code === code);
  /* Each teacher has their own lessons, each on its own topic, spread over their days in the unit. */
  function lessonDates(u, t) {
    if (t.plan) return t.plan;
    const all = []; for (let d = u.from; d < u.end; d = add(d, 1)) if (t.days.includes(d.getDay()) && !BREAKS.has(key(d))) all.push(d);
    const n = Math.min(t.lessons.length, all.length);
    return (t.plan = Array.from({length: n}, (_, k) => Object.assign({d: all[Math.floor(k * all.length / n)]}, t.lessons[k])));
  }
  const initials = w => w.split(' ').slice(0, 2).map(x => x[0]).join('');

  /* ---------- state ---------- */
  const P = {scr: 'school', verified: load('verified', false), code: false, query: '', enrolled: load('enrolled', {'MA 132': {2: ['maya']}}), stars: load('stars', {}), cur: 'MA 132', unit: 2, sort: 'rated', whole: false, others: false, done: load('done', {}), day: null, sheet: null, demo: null, ds: {}, demoW: ''};
  let deps = {render() {}, toast() {}, real: () => [], my: () => [], startReal() {}, playLink: id => 'play.html?l=' + id};
  const mine = (c, i) => ((P.enrolled[c.code] || {})[i] || []);
  const myTutors = (c, i) => mine(c, i).map(id => c.units[i].tutors.find(t => t.id === id)).filter(Boolean);
  const myDots = c => { const out = []; c.units.forEach(u => myTutors(c, u.i).forEach(t => lessonDates(u, t).forEach(l => out.push(l.d)))); return out; };
  const realFor = (c, u) => { const pre = (c.name + ', unit ' + (u.i + 1)).toLowerCase(); return (deps.real() || []).filter(l => (l.title || '').toLowerCase().startsWith(pre)); };
  /* The lessons you're building: your own Teacher Studio lessons named for a class and unit (drafts too). */
  const unitPrefix = (c, u) => (c.name + ', unit ' + (u.i + 1)).toLowerCase();
  const myFor = (c, u) => (deps.my() || []).filter(l => { const t = (l.title || '').toLowerCase(), p = unitPrefix(c, u); return t.startsWith(p) && !/\d/.test(t.charAt(p.length)); });
  const shortTitle = (c, u, l) => l.title.slice(unitPrefix(c, u).length).replace(/^[:\s]+/, '') || l.title;
  const studioLink = l => 'studio.html?from=places&l=' + encodeURIComponent(l.id);
  const statusOf = l => l.shared ? 'Published' : 'Draft';
  const myCard = (c, u) => myFor(c, u).map(l => `<a class="pl-mine" href="${studioLink(l)}"><span class="tx"><em class="${l.shared ? 'pub' : ''}">Your lesson · ${statusOf(l)}</em><b>${esc(shortTitle(c, u, l))}</b></span><span class="go">Keep building ›</span></a>`).join('');
  /* Build a lesson for a class: Teacher Studio's New lesson box opens with the class and unit chosen. */
  const buildLink = (c, u) => 'studio.html?from=places&new=1' + (c ? '&class=' + encodeURIComponent(c.code) + '&unit=' + u.i : '');
  function teachCard() {
    const rows = CLASSES.flatMap(c => c.units.flatMap(u => myFor(c, u).map(l => ({c, u, l})))), more = rows.length - 3;
    return `<section class="pl-teach" aria-labelledby="pl-teach-h"><div class="top"><h2 id="pl-teach-h">Teacher Studio</h2><a class="pl-linkb" href="studio.html?from=places">All my lessons</a></div>
      <p>How would you teach your class? Build a lesson with ChatGPT, Claude or any AI you already use.</p>
      <a class="cv-pill" href="${buildLink()}">Build a lesson</a>
      ${rows.length ? `<div class="mine">${rows.slice(0, 3).map(({c, u, l}) => `<a href="${studioLink(l)}"><span><b>${esc(shortTitle(c, u, l))}</b><em>${esc(c.name)}, Unit ${u.i + 1} · ${statusOf(l)}</em></span><i>Keep building ›</i></a>`).join('')}${more > 0 ? `<a href="studio.html?from=places"><span><em>${more} more</em></span><i>›</i></a>` : ''}</div>` : ''}</section>`;
  }

  /* ---------- screens ---------- */
  const back = (act, label) => `<button type="button" class="cv-back" data-pa="${act}" aria-label="${label || 'Back'}">‹</button>`;
  function findS() {
    const q = P.query.trim().toLowerCase(), hit = !q || 'halden university'.includes(q);
    return `<div class="cv-head">${back('school')}<h1 class="sm">Find your university</h1></div>
      <label class="cv-search">${SEARCH}<input id="pl-q" type="search" placeholder="Search schools" value="${esc(P.query)}" autocomplete="off"></label>
      ${hit ? '<button type="button" class="pl-row" data-pa="email"><span><b>Halden University</b><span>Your school’s classes, with lessons students made</span></span><em>›</em></button>' : '<p class="cv-muted">No school by that name in this demo. Try Halden.</p>'}
      <p class="cv-muted cv-center cv-foot">Demo: a made-up school, with sample classes, tutors and prices.</p>`;
  }
  function emailS() {
    return `<div class="cv-head">${back('find')}<h1 class="sm">Halden University</h1></div>
      <div class="pl-narrow">${ROOF}
      ${P.code ? '<p class="cv-center" style="margin:0">Enter the code we sent to your school email.</p><div class="pl-code"><i>4</i><i>8</i><i>2</i><i>1</i></div><button type="button" class="cv-pill wide" data-pa="verified">Confirm</button>' : '<p class="cv-center" style="margin:0">Use your school email so we know you\'re a student here.</p><input class="cv-codein" id="pl-email" type="email" placeholder="you@halden.edu" autocomplete="off"><button type="button" class="cv-pill wide" data-pa="sendcode">Send me a code</button>'}
      <button type="button" class="cv-pill ghost wide" data-pa="look">Just look around</button>
      <p class="cv-muted cv-center" style="margin:0;font-size:12.5px">Demo: no email is sent.</p></div>`;
  }
  function termLine(c) {
    const n = pos(TODAY);
    return `<span class="pl-term" aria-hidden="true"><i class="past" style="width:${n}%"></i><i class="fut" style="width:${100 - n}%"></i>${c.hwt.map(d => `<i class="hw" style="left:${pos(d)}%"></i>`).join('')}${myDots(c).map(d => `<i class="dot" style="left:${pos(d)}%"></i>`).join('')}${c.units.map(u => `<i class="ex${u.end < TODAY ? ' done' : ''}" style="left:${pos(u.end)}%"></i>`).join('')}<i class="now" style="left:${n}%"></i></span>`;
  }
  function nextLine(c) {
    const u = c.units[c.cur], next = myTutors(c, c.cur).flatMap(t => lessonDates(u, t).map(l => ({d: l.d, w: t.w}))).filter(l => l.d >= TODAY).sort((a, b) => a.d - b.d)[0];
    return next ? `Next lesson: <b>${fmt(next.d)}</b> · ${next.w}` : `Next: <b>${u.exam}</b> · ${fmtS(u.end)}`;
  }
  function schoolS() {
    const any = CLASSES.some(c => myDots(c).length);
    return `<div class="cv-head"><h1>Halden University</h1></div>
      <span class="cv-muted pl-week">${TERM} · week ${WEEK} of 15</span>
      <span class="cv-lab" style="margin:0">Your classes</span>
      <div class="pl-lines">${CLASSES.map(c => `<button type="button" class="pl-line" data-pa="open" data-c="${c.code}"><span class="info"><span class="n"><b>${c.name}</b><span>${c.code}</span></span><span class="next">${nextLine(c)}</span></span>${termLine(c)}</button>`).join('')}</div>
      <div class="pl-legend"><span><i class="lx"></i>Exam</span><span><i class="lh"></i>Homework</span><span><i class="ln"></i>Today</span>${any ? '<span><i class="ld"></i>Your lessons</span>' : ''}</div>
      ${teachCard()}
      <div class="pl-under"><button type="button" class="pl-linkb" data-pa="find">Add a place</button></div>
      <p class="cv-muted cv-center cv-foot">Demo: a made-up school, with sample classes, teachers and prices. Saved on this device only.</p>`;
  }
  function termBar(c) {
    const n = pos(TODAY);
    return `<div class="pl-tb">${c.units.map(u => `<button type="button" class="seg${u.i === P.unit ? ' on' : ''}" data-pa="unit" data-u="${u.i}" aria-pressed="${u.i === P.unit}" style="left:${pos(u.from)}%;width:${pos(u.end) - pos(u.from)}%">Unit ${u.i + 1}${myFor(c, u).length ? '<i class="bm" title="You\'re building a lesson here"></i>' : ''}</button>`).join('')}
      <i class="past" style="width:${n}%"></i><i class="fut" style="width:${100 - n}%"></i>${c.hwt.map(d => `<i class="hw" style="left:${pos(d)}%"></i>`).join('')}${myDots(c).map(d => `<i class="dot" style="left:${pos(d)}%"></i>`).join('')}${c.units.map(u => `<i class="ex${u.end < TODAY ? ' done' : ''}" style="left:${pos(u.end)}%"></i>`).join('')}<i class="now" style="left:${n}%"></i>
      ${MONTHS.map(d => `<span class="mo" style="left:${pos(d)}%">${MO[d.getMonth()]}</span>`).join('')}</div>`;
  }
  const sorted = (c, u) => { const by = {rated: (a, b) => b.r - a.r, taken: (a, b) => b.n - a.n, newest: (a, b) => a.age - b.age}[P.sort]; const ids = mine(c, u.i); return u.tutors.slice().sort(by).sort((a, b) => ids.includes(b.id) - ids.includes(a.id)); };
  const row = (c, u, t) => { const on = mine(c, u.i).includes(t.id); return `<button type="button" class="pl-tutor${on ? ' yours' : ''}" data-pa="tutor" data-u="${u.i}" data-id="${esc(t.id)}"><span class="ava">${initials(t.w)}</span><span class="nm"><b>${t.w}</b><span>${t.how}</span></span><span class="sc"><span>★ ${t.r.toFixed(1)}</span><em>${t.n} students</em><span>$${t.p}</span></span></button>`; };
  const isMine = l => (deps.my() || []).some(m => m.id === l.id);
  const realRow = (c, u, l) => `<a class="pl-tutor real" href="${deps.playLink(l.id)}"><span class="ava">▶</span><span class="nm"><b>${esc(l.title.slice((c.name + ', Unit ' + (u.i + 1)).length).replace(/^[:\s]+/, '') || l.title)}</b><span>${isMine(l) ? 'Your lesson, as students see it' : 'A real lesson, built in Teacher Studio'}</span></span><span class="sc"><span>New</span><em>Free for now</em></span></a>`;
  const sortBtns = () => [['rated', 'Top rated'], ['taken', 'Most taken'], ['newest', 'Newest']].map(([k, l]) => `<button type="button" class="${P.sort === k ? 'on' : ''}" data-pa="sort" data-k="${k}">${l}</button>`).join('');
  const listBlock = (c, u, mode) => { const real = realFor(c, u); return `<div class="pl-tlist">${real.map(l => realRow(c, u, l)).join('')}${sorted(c, u).filter(t => mode === 'all' || !mine(c, u.i).includes(t.id)).map(t => row(c, u, t)).join('')}</div>`; };
  const COLORS = ['ok', 'acc', 'vi'];
  /* A unit you've taken: the same line as the term, zoomed to this unit. One lane per teacher; tap a lesson. */
  const doneKey = (t, l) => t.id + '|' + l.t;
  function zoomBar(c, u, tutors) {
    const span = u.end - u.from, zp = d => Math.max(0, Math.min(100, (d - u.from) / span * 100)), n = zp(TODAY), hasNow = TODAY >= u.from && TODAY <= u.end;
    const lanes = tutors.map((t, ti) => {
      const dots = lessonDates(u, t).map(l => { const k = doneKey(t, l), sel = P.day === k, done = P.done[k]; return `<button type="button" class="ldot ${COLORS[ti % 3]}${done ? ' done' : ''}${sel ? ' sel' : ''}" style="left:${zp(l.d)}%" data-pa="day" data-k="${esc(k)}" aria-label="${fmt(l.d)}: ${esc(l.t)}, ${t.w}${done ? ', done' : ''}" aria-pressed="${sel}"><i></i></button>`; }).join('');
      return `<div class="pl-lane">${tutors.length > 1 ? `<span class="who"><i class="${COLORS[ti % 3]}"></i>${t.w}</span>` : ''}<div class="track"><i class="past" style="width:${u.end < TODAY ? 100 : hasNow ? n : 0}%"></i><i class="fut" style="width:${u.end < TODAY ? 0 : hasNow ? 100 - n : 100}%"></i>${dots}<i class="ex${u.end < TODAY ? ' done' : ''}" style="left:100%"></i></div></div>`;
    }).join('');
    const weeks = []; for (let d = u.from, i = 0; d < u.end; d = add(d, 7), i++) weeks.push(d);
    const step = Math.ceil(weeks.length / 4);
    return `<div class="pl-zb"><div class="in">${hasNow ? `<i class="pl-nowline" style="left:${n}%"></i>` : ''}${lanes}
      <div class="axis">${c.hwt.filter(d => d >= u.from && d <= u.end).map(d => `<i class="hw" style="left:${zp(d)}%"></i>`).join('')}${weeks.filter((_, i) => i % step === 0).map(d => `<span style="left:${zp(d)}%">${fmtS(d)}</span>`).join('')}<span class="end">${esc(u.exam)}</span></div></div></div>`;
  }
  /* What's coming for this unit, in plain dates. */
  function whenLine(u) {
    const days = Math.round((u.end - TODAY) / DAY);
    if (u.from > TODAY) return `Starts ${fmtS(u.from)} · ${esc(u.exam)} ${fmtS(u.end)}`;
    if (days < 0) return `${esc(u.exam)} was ${fmtS(u.end)}`;
    return `${esc(u.exam)} ${fmtS(u.end)} · ${days === 0 ? 'today' : days === 1 ? 'tomorrow' : 'in ' + days + ' days'}`;
  }
  /* Every lesson you have in this unit, in date order. The open one says what you do and starts it. */
  function lessonList(u, tutors) {
    const all = tutors.flatMap((t, ti) => lessonDates(u, t).map(l => ({t, ti, l}))).sort((a, b) => a.l.d - b.l.d);
    return `<div class="pl-ll">${all.map(({t, ti, l}) => {
      const k = doneKey(t, l), open = P.day === k, done = P.done[k], today = key(l.d) === key(TODAY);
      return `<div class="item${open ? ' open' : ''}${done ? ' done' : ''}"><button type="button" class="head" data-pa="day" data-k="${esc(k)}" aria-expanded="${open}"><i class="st ${COLORS[ti % 3]}" aria-hidden="true">${done ? '✓' : ''}</i><span class="tx"><b>${esc(l.t)}</b><span>${today ? 'Today' : fmt(l.d)}${l.min ? ' · ' + l.min + ' min' : ''}${tutors.length > 1 ? ' · ' + t.w : ''}${done ? ' · Done' : ''}</span></span></button>
        ${open ? `<div class="body"><p>${esc(l.what || t.how)}</p><div class="acts">${startBtn(t, l)}<button type="button" class="pl-donebtn${done ? ' on' : ''}" data-pa="done" aria-pressed="${!!done}">${done ? '✓ Done' : 'Mark as done'}</button></div></div>` : ''}</div>`;
    }).join('')}</div>`;
  }
  const startBtn = (t, l) => t.demo ? `<button type="button" class="cv-pill" data-pa="demo" data-d="${t.demo}" data-w="${esc(t.w)}">${DEMOS[t.demo].title === l.t ? 'Start' : 'Try a sample lesson'}</button>` : `<button type="button" class="cv-pill" data-pa="voice" data-topic="${esc(cls(P.cur).name + ': ' + l.t)}">Start as a voice lesson</button>`;
  const buildBtn = (c, u) => `<a class="pl-build" href="${buildLink(c, u)}">Build your own</a>`;
  function classS() {
    const c = cls(P.cur), u = c.units[P.unit], tutors = myTutors(c, P.unit), rated = P.stars[c.code + P.unit];
    const todayBtn = P.unit !== c.cur ? `<button type="button" class="pl-todaybtn" data-pa="unit" data-u="${c.cur}"><i></i>Today</button>` : '';
    const head = `<div class="cv-head">${back('school')}<h1 class="sm">${c.name}</h1>${todayBtn}</div>`;
    const title = `<div class="pl-ut"><b>Unit ${u.i + 1} · ${u.n}</b><span>${whenLine(u)}</span></div>`;
    if (tutors.length) {
      const others = u.tutors.length - tutors.length, nav = `<div class="pl-unav"><button type="button" class="cv-back" data-pa="unit" data-u="${P.unit - 1}" aria-label="Previous unit"${P.unit ? '' : ' disabled'}>‹</button>${title}<button type="button" class="cv-back" data-pa="unit" data-u="${P.unit + 1}" aria-label="Next unit"${P.unit < c.units.length - 1 ? '' : ' disabled'}>›</button></div>`;
      const count = tutors.flatMap(t => lessonDates(u, t).map(l => doneKey(t, l))), finished = count.filter(k => P.done[k]).length;
      return `${head}${nav}
        ${P.whole ? termBar(c) : zoomBar(c, u, tutors)}
        <div class="pl-under spread"><div class="pl-mytutors">${tutors.map(t => `<button type="button" class="pl-chip" data-pa="tutor" data-u="${u.i}" data-id="${esc(t.id)}"><span class="ava">${initials(t.w)}</span>${t.w}</button>`).join('')}</div><button type="button" class="pl-linkb" data-pa="whole">${P.whole ? 'Back to this unit' : 'See the whole term'}</button></div>
        <div class="pl-lhead"><span class="cv-lab" style="margin:0">Your lessons</span><span class="pl-count">${finished} of ${count.length} done</span></div>
        ${lessonList(u, tutors)}
        ${u.end < TODAY ? tutors.map(t => `<div class="pl-rate"><b>How was ${t.w}?</b><div class="pl-stars" role="group" aria-label="Rate ${t.w}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${(rated || 0) >= n ? 'on' : ''}" data-pa="star" data-n="${n}" aria-label="${n} stars">★</button>`).join('')}</div></div>`).join('') : ''}
        ${myCard(c, u)}
        <div class="pl-under spread"><button type="button" class="pl-linkb" data-pa="others" aria-expanded="${P.others}">${P.others ? 'Hide other teachers' : `Other teachers for this unit (${others})`}</button>${buildBtn(c, u)}</div>
        ${P.others ? listBlock(c, u, 'others') : ''}`;
    }
    return `${head}${termBar(c)}${title}
      <div class="pl-lhead"><div class="pl-sorts">${sortBtns()}</div>${buildBtn(c, u)}</div>
      ${listBlock(c, u, 'all')}${myCard(c, u)}<p class="cv-muted cv-center cv-foot">Demo: sample teachers, prices and numbers. Nothing is charged.</p>`;
  }
  const tookLine = (c, t) => { const [term, grade] = (t.took || '').split('|'); return (term ? `Took ${c.name} in ${term} and got ${/^A/.test(grade) ? 'an' : 'a'} ${grade}. ` : '') + t.about; };
  function sheetH() {
    if (!P.sheet) return '';
    const c = cls(P.cur), u = c.units[P.sheet.u], t = u.tutors.find(x => x.id === P.sheet.id); if (!t) return '';
    const on = mine(c, u.i).includes(t.id), list = lessonDates(u, t), late = u.end >= TODAY && list.some(l => l.d < TODAY), x = rnd(t.w + u.n), started = u.from <= TODAY;
    return `<div class="cv-ov" data-pa="closesheet"><div class="cv-sheet pl-sheet" role="dialog" aria-modal="true" aria-label="${t.w}"><span class="grab"></span><button type="button" class="cv-x" data-pa="closesheet" aria-label="Close">✕</button>
      <div class="pl-who"><span class="ava">${initials(t.w)}</span><div><h3>${t.w}</h3><p>${esc(tookLine(c, t))}</p></div></div>
      <p class="pl-teaches">${esc(t.how)}</p>
      ${started ? `<div class="pl-stats"><div><b>★ ${t.r.toFixed(1)}</b><span>${t.n} students</span></div><div><b>${Math.round(72 + x * 24)}%</b><span>finished the unit</span></div><div><b>+${Math.round(2 + x * 7)}</b><span>exam points vs. the class</span></div></div>` : ''}
      ${t.quote ? `<p class="pl-quote">“${esc(t.quote)}”<span>Sample review</span></p>` : ''}
      <span class="cv-lab" style="margin:0">${list.length} lessons</span><div class="pl-dates">${list.map(l => `<div class="${l.d < TODAY && u.end >= TODAY ? 'done' : ''}"><time>${fmt(l.d)}</time><span>${esc(l.t)}</span></div>`).join('')}</div>
      ${late && !on ? '<p class="cv-muted" style="margin:0;font-size:12.5px">Starting late? Earlier lessons wait for you.</p>' : ''}
      <div class="cv-row" style="flex-wrap:wrap">${t.demo ? `<button type="button" class="cv-pill ghost" data-pa="demo" data-d="${t.demo}" data-w="${esc(t.w)}">Try a demo</button>` : ''}${on ? '<button type="button" class="cv-pill ghost" data-pa="drop">Leave this teacher</button>' : `<button type="button" class="cv-pill" data-pa="take">Take Unit ${u.i + 1} · $${t.p}</button>`}</div>
      ${started ? '<p class="cv-muted" style="margin:0;font-size:12px">Sample numbers. Exam points would come from students who choose to share their grades.</p>' : ''}
    </div></div>`;
  }
  /* Demo lessons: each teacher's sample, from the `demos` list in places-data.js. */
  const INIT = {sliders: {r: .5}, calc: {terms: 2}, cashsim: {credit: 0}, chat: {step: 0}, bet: {i: 0, pts: 100}, steps: {i: 0}, drill: {h: 0}};
  const muted = t => `<p class="cv-muted" style="margin:0">${t}</p>`;
  /* What a slider changes; redrawn on every move, without redrawing the slider. */
  const LIVE = {
    sliders() { const r = P.ds.r, lim = 1 / (1 - r), m = Math.max(lim, 2) * 1.08; let s = 0, o = ''; for (let n = 0; n < 12; n++) { s += Math.pow(r, n); o += `<i style="height:${s / m * 100}%"></i>`; } return `<div class="pl-bars">${o}<div class="limit" style="bottom:${lim / m * 100}%"><span>Stops at ${lim.toFixed(2)}</span></div></div>` + muted(`Slide r: <b>${r.toFixed(2)}</b>`); },
    calc() {
      const x = 37 * Math.PI / 180, n = P.ds.terms, parts = ['x', '− x³/3!', '+ x⁵/5!', '− x⁷/7!', '+ x⁹/9!']; let s = 0, term = x;
      for (let k = 0; k < n; k++) { s += term; term *= -x * x / ((2 * k + 2) * (2 * k + 3)); }
      const real = Math.sin(x), off = Math.abs(s - real);
      return `<p class="pl-formula">${parts.slice(0, n).join(' ')}</p><div class="pl-reac"><span><b>${s.toFixed(7)}</b> your series</span><span><b>${real.toFixed(7)}</b> your calculator</span></div>` + muted(off < 5e-7 ? 'They match to seven digits, using only adding and multiplying.' : `Off by ${off.toFixed(7)}. Add a term.`);
    },
    cashsim() { const x = P.ds.credit, cash = 400 - 10 * x; return `<div class="pl-reac"><span><b>$300</b> profit this month</span><span><b class="${cash < 0 ? 'bad' : ''}">${cash < 0 ? '−$' + (-cash) : '$' + cash}</b> cash in the bank</span></div>` + muted(`${x}% of customers pay next month.`) + `<p style="margin:0;font-weight:600">${cash < 0 ? 'A $300 profit, and you can’t pay your rent.' : x ? 'Same profit, less cash. Keep going.' : 'Everyone pays today. Now let some pay later.'}</p>`; },
  };
  const slider = (id, min, max, step, label) => `<input type="range" min="${min}" max="${max}" step="${step}" value="${P.ds[id]}" data-dv="${id}" aria-label="${label}">`;
  const live = k => `<div data-live class="pl-live">${LIVE[k]()}</div>`;
  const pickBody = d => { const s = P.ds, chosen = d.opts[s.pick]; return `<p class="pl-q">${d.q}</p>${d.opts.map((o, i) => `<button type="button" class="pl-mis${s.pick === i ? (o.ok ? ' good' : ' miss') : ''}" data-pa="pick" data-i="${i}">${o.t}</button>`).join('')}${chosen ? (chosen.ok ? `<div class="pl-bub">${chosen.fb}</div>` : muted(chosen.fb)) : ''}`; };
  const BODY = {
    sliders: () => `<p class="pl-q">Keep adding forever. Each step adds r times the last step. Does the total ever stop growing?</p>${live('sliders')}${slider('r', .1, .9, .05, 'Ratio r')}` + muted('Now try 0.9. It takes much longer, and it still stops.'),
    calc: () => `<p class="pl-q">A chip mostly adds and multiplies. So how does your calculator get sin 37°? Add terms to the series.</p>${live('calc')}${slider('terms', 1, 5, 1, 'Number of terms')}`,
    cashsim: () => `<p class="pl-q">Your shop sells $1,000 this month and spends $700. You start with $100. What if customers pay later?</p>${live('cashsim')}${slider('credit', 0, 100, 10, 'Percent of customers who pay later')}`,
    chat(d) { const n = P.ds.step; let h = d.orb ? '<div class="pl-orb" aria-hidden="true"></div>' : ''; for (let k = 0; k <= n; k++) { h += `<div class="pl-bub">${d.turns[k][0]}</div>`; if (k < n) h += `<div class="pl-bub you">${d.turns[k][1]}</div>`; } return h + (n < d.turns.length - 1 ? `<button type="button" class="cv-pill wide" data-pa="chatn">${d.btn}</button>` : '') + muted(d.note); },
    pick: pickBody,
    group: d => `<p class="pl-q">${d.q}</p>${d.clips.map(([n, l]) => `<div class="pl-clip"><span class="ava">${n[0]}</span><b>${n}</b><span class="wave" aria-hidden="true"></span><em>${l}</em></div>`).join('')}${P.ds.rec ? `<div class="pl-clip me"><span class="ava">You</span><b>You</b><span class="wave" aria-hidden="true"></span><em>0:47</em></div>` + muted(d.after) : `<button type="button" class="cv-pill wide" data-pa="rec">${d.btn}</button>`}`,
    drill: d => `<span class="pl-pace">${d.pace}</span><p class="pl-q">${d.q}</p>${d.hints.slice(0, P.ds.h).map((t, i) => `<div class="pl-bub"><b>Hint ${i + 1}.</b> ${t}</div>`).join('')}${P.ds.ans ? `<div class="pl-bub you wide">${d.answer}</div>` : `<div class="cv-row" style="flex-wrap:wrap">${P.ds.h < d.hints.length ? '<button type="button" class="cv-pill" data-pa="hint">Give me a hint</button>' : ''}<button type="button" class="cv-pill ghost" data-pa="ans">Show the answer</button></div>`}`,
    bet(d) {
      const s = P.ds, r = d.rounds[s.i];
      if (!r) return `<div class="pl-score"><b>${s.pts}</b><span>points</span></div><p class="pl-q">You finished with ${s.pts} points.</p>` + muted('In the real lesson you bet against classmates, and a bet only pays if you can prove it.');
      const res = s.call == null ? '' : `<div class="pl-bub${s.call === r.conv ? ' you wide' : ''}"><b>${s.call === r.conv ? 'You win 20 points.' : 'You lose 20 points.'}</b> ${r.conv ? 'It converges.' : 'It diverges.'} ${r.why}</div><button type="button" class="cv-pill wide" data-pa="betn">${s.i < d.rounds.length - 1 ? 'Next series' : 'See your score'}</button>`;
      return `<div class="pl-score"><b>${s.pts}</b><span>points · series ${s.i + 1} of ${d.rounds.length}</span></div><p class="pl-q">${r.s}</p>${s.call == null ? '<div class="pl-2"><button type="button" class="cv-pill wide" data-pa="bet" data-v="1">It converges</button><button type="button" class="cv-pill ghost wide" data-pa="bet" data-v="0">It diverges</button></div>' + muted('You stake 20 points. No computing yet. Go with your gut.') : res}`;
    },
    steps(d) { const i = P.ds.i, [a, b] = d.steps[i]; return `<p class="pl-q">${d.q}</p><div class="pl-bub you wide"><b>${a}</b></div><div class="pl-bub">${b}</div>${muted(d.note)}${i < d.steps.length - 1 ? '<button type="button" class="cv-pill wide" data-pa="stepn">Next</button>' : `<p style="margin:0;font-weight:600">${d.end}</p>`}`; },
  };
  function demoS() {
    const d = DEMOS[P.demo]; if (!d) { P.scr = 'class'; return classS(); }
    return `<div class="cv-head pl-dh">${back('closedemo')}<h1 class="sm">${esc(d.title)}</h1></div><span class="cv-muted">A sample lesson from ${esc(P.demoW)}. In this demo, one lesson per teacher is built.</span><div class="pl-demo">${BODY[d.k](d)}</div>`;
  }
  const SCREENS = {find: findS, email: emailS, school: schoolS, class: classS, demo: demoS};

  /* ---------- what Explore borrows ---------- */
  const allTutors = () => CLASSES.flatMap(c => c.units.flatMap(u => u.tutors.map(t => ({c, u, t}))));
  function teachers(cat) {
    const by = {}; allTutors().filter(x => !cat || x.c.cat === cat).forEach(x => { const k = x.t.w; (by[k] = by[k] || {w: k, items: [], n: 0, sum: 0}).items.push(x); by[k].n += x.t.n; by[k].sum += x.t.r * x.t.n; });
    return Object.values(by).map(t => Object.assign(t, {r: t.sum / t.n})).sort((a, b) => b.r - a.r);
  }

  /* ---------- API for courses.js ---------- */
  window.WorldviewPlaces = {
    init(d) { deps = Object.assign(deps, d); },
    initials, teachers, allTutors,
    about: w => { const x = allTutors().find(a => a.t.w === w); return x ? x.t.about : ''; },
    html() { return (SCREENS[P.scr] || schoolS)() + sheetH(); },
    afterRender() {},
    home() { if (P.scr === 'demo' || P.sheet) { P.sheet = null; P.demo = null; } P.scr = 'school'; deps.render(); },
    openTutor(code, u, id) { openClass(code, u); P.sheet = {u, id}; },
    escape() { if (P.sheet) { P.sheet = null; deps.render(); return true; } if (P.scr === 'demo') { act('closedemo'); return true; } return false; },
    input(e) {
      const id = e.target.id;
      if (id === 'pl-q') { P.query = e.target.value; const pos2 = e.target.selectionStart; deps.render(); const i = document.getElementById('pl-q'); if (i) { i.focus(); try { i.setSelectionRange(pos2, pos2); } catch (x) {} } return; }
      if (e.target.matches('[data-dv]')) { P.ds[e.target.dataset.dv] = +e.target.value; const b = document.querySelector('[data-live]'), k = (DEMOS[P.demo] || {}).k; if (b && LIVE[k]) b.innerHTML = LIVE[k](); }
    },
    click(e) {
      const el = e.target.closest('[data-pa]'); if (!el || el.disabled) return false;
      if (el.classList.contains('cv-ov') && e.target !== el) return false;
      act(el.dataset.pa, el.dataset); return true;
    },
  };
  function openClass(code, u) {
    const c = cls(code); P.cur = code; P.unit = u == null ? (mine(c, c.cur).length ? c.cur : Math.min(c.cur, c.units.length - 1)) : u; P.whole = false; P.others = false; P.scr = 'class'; pickDay(c);
  }
  function pickDay(c) {
    const u = c.units[P.unit], all = myTutors(c, P.unit).flatMap(t => lessonDates(u, t).map(l => ({k: doneKey(t, l), d: l.d}))).sort((a, b) => a.d - b.d);
    const next = all.find(x => x.d >= TODAY && !P.done[x.k]) || all[all.length - 1]; P.day = next ? next.k : null;
  }
  function act(a, d = {}) {
    const c = cls(P.cur);
    const top = () => { const v = document.getElementById('courses-view'); if (v) v.scrollTop = 0; };
    switch (a) {
      case 'find': P.scr = 'find'; P.code = false; top(); break;
      case 'email': P.scr = 'email'; top(); break;
      case 'sendcode': P.code = true; break;
      case 'verified': P.verified = true; save('verified', true); P.scr = 'school'; top(); break;
      case 'look': P.scr = 'school'; top(); break;
      case 'school': P.scr = 'school'; P.sheet = null; top(); break;
      case 'open': openClass(d.c); top(); break;
      case 'unit': { const u = +d.u; if (u < 0 || u >= c.units.length) return; P.unit = u; P.whole = false; P.others = false; pickDay(c); P.sheet = null; break; }
      case 'whole': P.whole = !P.whole; break;
      case 'others': P.others = !P.others; break;
      case 'done': if (P.day) { if (P.done[P.day]) delete P.done[P.day]; else { P.done[P.day] = 1; const u = c.units[P.unit], all = myTutors(c, P.unit).flatMap(t => lessonDates(u, t).map(l => ({k: doneKey(t, l), d: l.d}))).sort((a, b) => a.d - b.d), i = all.findIndex(x => x.k === P.day), nx = all.slice(i + 1).find(x => !P.done[x.k]); if (nx) P.day = nx.k; } save('done', P.done); } break;
      case 'day': P.day = P.day === d.k ? null : d.k; break;
      case 'sort': P.sort = d.k; break;
      case 'tutor': P.sheet = {u: +d.u, id: d.id}; break;
      case 'closesheet': P.sheet = null; break;
      case 'take': { const {u, id} = P.sheet; const e = P.enrolled[c.code] = P.enrolled[c.code] || {}; e[u] = (e[u] || []).concat(id); save('enrolled', P.enrolled); P.sheet = null; P.unit = u; P.whole = false; pickDay(c); deps.render(); top(); deps.toast('You\'re in. Your lessons are below. (Demo: nothing was charged.)'); return; }
      case 'drop': { const {u, id} = P.sheet, e = P.enrolled[c.code] || {}; e[u] = (e[u] || []).filter(x => x !== id); P.enrolled[c.code] = e; save('enrolled', P.enrolled); P.sheet = null; pickDay(c); break; }
      case 'star': P.stars[c.code + P.unit] = +d.n; save('stars', P.stars); break;
      case 'demo': P.back = P.sheet; P.demo = d.d; P.demoW = d.w || ''; P.ds = Object.assign({}, INIT[DEMOS[d.d].k]); P.sheet = null; P.scr = 'demo'; top(); break;
      case 'closedemo': P.demo = null; P.scr = 'class'; P.sheet = P.back || null; P.back = null; break;
      case 'voice': deps.startReal(d.topic); return;
      case 'chatn': P.ds.step++; break;
      case 'pick': P.ds.pick = +d.i; break;
      case 'rec': P.ds.rec = true; break;
      case 'hint': P.ds.h++; break;
      case 'ans': P.ds.ans = true; break;
      case 'bet': { const call = d.v === '1', r = DEMOS[P.demo].rounds[P.ds.i]; P.ds.call = call; P.ds.pts += call === r.conv ? 20 : -20; break; }
      case 'betn': P.ds.i++; P.ds.call = null; break;
      case 'stepn': P.ds.i++; break;
    }
    deps.render();
  }
})();
