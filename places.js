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
  const P = {scr: 'school', verified: load('verified', false), role: load('role', 'student') === 'teacher' ? 'teacher' : 'student', month: new Date(TODAY.getFullYear(), TODAY.getMonth(), 1), sel: null, code: false, query: '', enrolled: load('enrolled', {'MA 132': {2: ['maya']}}), stars: load('stars', {}), cur: 'MA 132', unit: 2, sort: 'rated', whole: false, others: false, done: load('done', {}), day: null, sheet: null, demo: null, ds: {}, demoW: ''};
  let deps = {render() {}, toast() {}, real: () => [], my: () => [], startReal() {}, saveNote: async () => false, playLink: id => 'play.html?l=' + id, db: () => null, reload: async () => {}};
  const mine = (c, i) => ((P.enrolled[c.code] || {})[i] || []);
  const myTutors = (c, i) => mine(c, i).map(id => c.units[i].tutors.find(t => t.id === id)).filter(Boolean);
  const myDots = c => { const out = []; c.units.forEach(u => myTutors(c, u.i).forEach(t => lessonDates(u, t).forEach(l => out.push(l.d)))); return out; };
  const realFor = (c, u) => { const pre = (c.name + ', unit ' + (u.i + 1)).toLowerCase(); return (deps.real() || []).filter(l => (l.title || '').toLowerCase().startsWith(pre)); };
  /* The lessons you're building: your own Teacher Studio lessons named for a class and unit (drafts too). */
  const unitPrefix = (c, u) => (c.name + ', unit ' + (u.i + 1)).toLowerCase();
  const myFor = (c, u) => (deps.my() || []).filter(l => { const t = (l.title || '').toLowerCase(), p = unitPrefix(c, u); return t.startsWith(p) && !/\d/.test(t.charAt(p.length)); });
  const shortTitle = (c, u, l) => l.title.slice(unitPrefix(c, u).length).replace(/^[:\s]+/, '') || l.title;
  /* A lesson made from slides (LES-338, v3.1.70) opens on its slides page; any other lesson in Teacher Studio. */
  const studioLink = l => (l.note && l.note.format === 'slides-v1' ? 'slides.html?l=' : 'studio.html?from=places&l=') + encodeURIComponent(l.id);
  const slidesLink = (c, u) => 'slides.html' + (c ? '?class=' + encodeURIComponent(c.code) + '&unit=' + u.i : '');
  const statusOf = l => l.shared ? 'Published' : 'Draft';
  const myCard = (c, u) => myFor(c, u).map(l => `<a class="pl-mine" href="${studioLink(l)}"><span class="tx"><em class="${l.shared ? 'pub' : ''}">Your lesson · ${statusOf(l)}</em><b>${esc(shortTitle(c, u, l))}</b></span><span class="go">Keep building ›</span></a>`).join('');
  /* Build a lesson for a class: Teacher Studio's New lesson box opens with the class and unit chosen. */
  const buildLink = (c, u) => 'studio.html?from=places&new=1' + (c ? '&class=' + encodeURIComponent(c.code) + '&unit=' + u.i : '');
  function teachCard() {
    const rows = CLASSES.flatMap(c => c.units.flatMap(u => myFor(c, u).map(l => ({c, u, l})))), more = rows.length - 3;
    return `<section class="pl-teach" aria-labelledby="pl-teach-h"><div class="top"><h2 id="pl-teach-h">Teacher Studio</h2><a class="pl-linkb" href="studio.html?from=places">All my lessons</a></div>
      <p>Turn your class presentations into lessons: Worldview writes what the AI says on each slide, and you edit it. Or build a lesson with any AI you already use.</p>
      <div class="cv-row" style="flex-wrap:wrap"><a class="cv-pill" href="${slidesLink()}">Add presentations</a><a class="cv-pill ghost" href="${buildLink()}">Build a lesson</a></div>
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
  const buildBtn = (c, u) => `<span class="pl-builds"><a class="pl-build" href="${slidesLink(c, u)}">Add presentations</a><a class="pl-build" href="${buildLink(c, u)}">Build your own</a></span>`;
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
    const d = DEMOS[P.demo]; if (!d) { P.scr = 'class'; return classCal(); }
    return `<div class="cv-head pl-dh">${back('closedemo')}<h1 class="sm">${esc(d.title)}</h1></div><span class="cv-muted">A sample lesson from ${esc(P.demoW)}. In this demo, one lesson per teacher is built.</span><div class="pl-demo">${BODY[d.k](d)}</div>`;
  }

  /* ---------- the simple school page (v3.1.73) ----------
     Student: one month calendar of the published lessons of all the student's classes, each class in its own colour, with filter chips.
     Teacher: class cards, then one class: its calendar, a Drafts list (lessons with no date yet), and an editable class.
     Classes come from places-classes.js (sample data, edits kept on this device). The old sample classes, lessons and teachers
     in places-data.js are no longer shown here. A real lesson's date is its note.date; a lesson with no date is a draft and is never put on a day by itself. */
  const WC = window.WorldviewClasses;
  const DOWH = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const monthOf = d => new Date(d.getFullYear(), d.getMonth(), 1);
  const validKey = v => /^\d{4}-\d\d-\d\d$/.test(v || '') && key(D(v)) === v;
  const ucls = id => WC.get(id), UC = () => WC.list();
  const ccolor = c => WC.COLORS[c.color] || WC.COLORS[0];
  const meetText = c => WC.meetText(c);
  const nextMeetKey = c => WC.nextMeetKey(c, TODAY);
  const hidden = () => P.hide || (P.hide = load('hide', []));
  const curClass = () => ucls(P.cur) || UC()[0];
  /* Real lessons of one class: the teacher's own (drafts too) and, for students, the published catalog. No sample lessons. */
  function itemsFor(c) {
    const out = [], teacher = P.role === 'teacher', seen = new Set();
    const real = (l, mine) => {
      if (seen.has(l.id) || WC.ofLesson(l) !== c) return; seen.add(l.id);
      const pub = mine ? !!l.shared : true; if (!teacher && !pub) return;
      const n = l.note && typeof l.note === 'object' ? l.note : {};
      out.push({kind: 'real', key: 'r|' + l.id, id: l.id, cid: c.id, title: WC.plainTitle(c, l.title), d: validKey(n.date) ? D(n.date) : null, pub, mine, slides: n.format === 'slides-v1', row: l});
    };
    (deps.my() || []).forEach(l => real(l, true));
    if (!teacher) (deps.real() || []).forEach(l => real(l, false));
    return out;
  }
  /* Everything the current view shows: the class (teacher) or every class not filtered out (student). */
  const viewItems = () => P.role === 'teacher' ? itemsFor(curClass()) : UC().filter(c => !hidden().includes(c.id)).flatMap(c => itemsFor(c));
  const byDay = items => { const m = {}; items.forEach(it => it.d && (m[key(it.d)] = m[key(it.d)] || []).push(it)); return m; };
  const scCard = (it, sel) => `<div class="sc-lc${sel === it.key ? ' on' : ''}" style="--cc:${ccolor(ucls(it.cid))}" role="button" tabindex="0" data-pa="pick" data-k="${esc(it.key)}"${P.role === 'teacher' && it.mine ? ' draggable="true"' : ''}><b>${esc(it.title)}</b>${P.role === 'teacher' ? `<span class="sc-tag ${it.pub ? 'p' : 'd'}">${it.pub ? 'Published' : 'Draft'}</span>` : ''}${countLine(it)}</div>`;
  const switchH = () => `<div class="sc-switch" role="group" aria-label="View as">${['student', 'teacher'].map(r => `<button type="button" data-pa="role" data-r="${r}" class="${P.role === r ? 'on' : ''}" aria-pressed="${P.role === r}">${r[0].toUpperCase() + r.slice(1)}</button>`).join('')}</div>`;
  /* The month grid (laptop) and the day list (phone) for a set of items. */
  function calHtml(items) {
    const by = byDay(items), y = P.month.getFullYear(), m = P.month.getMonth(), days = new Date(y, m + 1, 0).getDate(), lead = (new Date(y, m, 1).getDay() + 6) % 7, inNow = key(P.month) === key(monthOf(TODAY));
    let grid = DOWH.map(d => `<div class="sc-dow">${d}</div>`).join('') + '<div class="sc-blank"></div>'.repeat(lead), list = '', n = 0;
    for (let i = 1; i <= days; i++) {
      const d = new Date(y, m, i), k = key(d), its = by[k] || [], isT = k === key(TODAY);
      grid += `<div class="sc-cell${isT ? ' today' : ''}" data-dk="${k}"><div class="sc-dn">${isT ? `<span>${i}</span>` : i}</div>${its.map(x => scCard(x, P.sel)).join('')}</div>`;
      if (its.length) { n += its.length; list += `<div class="sc-ld"><div class="sc-dh${isT ? ' today' : ''}">${isT ? 'Today · ' : ''}${fmt(d)}</div>${its.map(x => scCard(x, P.sel)).join('')}</div>`; }
    }
    const label = P.month.toLocaleDateString([], {month: 'long', year: 'numeric'});
    return {n, html: `<div class="sc-mon"><button type="button" class="sc-nav" data-pa="mon" data-n="-1" aria-label="Previous month">‹</button><b>${label}</b><button type="button" class="sc-nav" data-pa="mon" data-n="1" aria-label="Next month">›</button>${inNow ? '' : '<button type="button" class="sc-link" data-pa="monnow">This month</button>'}</div>
      <div class="sc-cal">${grid}</div><div class="sc-list">${list}</div>`};
  }
  const ensureSel = items => { if (P.sel && !items.some(x => x.key === P.sel)) P.sel = null; };
  /* School home. Student: the one calendar for all classes. Teacher: class cards. */
  function schoolHome() {
    const teacher = P.role === 'teacher', all = UC();
    if (teacher) {
      return `${switchH()}<div class="sc-main"><h1 class="sc-h">School</h1><p class="sc-sub">Your classes. Pick one to plan its days.</p>
        <div class="sc-classes">${all.map(c => { const its = itemsFor(c), dr = its.filter(x => !x.d).length, on = its.length - dr; return `<button type="button" class="sc-class" style="--cc:${ccolor(c)}" data-pa="open" data-c="${esc(c.id)}"><b>${esc(c.name)}</b><span>${esc(c.code)}${c.code ? ' · ' : ''}meets ${meetText(c)}</span><span>${on} on the calendar · ${dr} in drafts</span></button>`; }).join('')}</div>
        <a class="sc-link" href="studio.html?from=places">Build your own in Teacher Studio</a></div>`;
    }
    const items = viewItems(); ensureSel(items);
    const everything = all.flatMap(c => itemsFor(c)), cal = calHtml(items), anytime = items.filter(x => !x.d);
    const chips = `<div class="sc-chips" role="group" aria-label="Show classes">${all.map(c => { const on = !hidden().includes(c.id); return `<button type="button" class="sc-chip${on ? ' on' : ''}" style="--cc:${ccolor(c)}" data-pa="filter" data-c="${esc(c.id)}" aria-pressed="${on}"><i></i>${esc(c.name)}</button>`; }).join('')}</div>`;
    const empty = !everything.length ? 'No lessons yet. When a teacher publishes a lesson for your class, it shows up here.' : !items.length ? 'Every class is hidden. Turn one back on above.' : !cal.n && !anytime.length ? 'No lessons this month.' : '';
    return `${switchH()}<div class="sc-layout"><div class="sc-main"><h1 class="sc-h">School</h1><p class="sc-sub">All your classes on one calendar. Open a lesson to start it.</p>${chips}
      ${cal.html}${empty ? `<p class="cv-muted sc-none">${empty}</p>` : ''}
      ${anytime.length ? `<div class="sc-any"><h2 class="sc-h2">Not on the calendar yet</h2><p class="cv-muted">Published, but the teacher hasn't picked a day. You can start these any time.</p>${anytime.map(x => scCard(x, P.sel)).join('')}</div>` : ''}</div>${panelH(items)}</div>`;
  }
  function panelH(items) {
    const it = items.find(x => x.key === P.sel); if (!it) return '';
    const c = ucls(it.cid), teacher = P.role === 'teacher', close = '<button type="button" class="sc-x" data-pa="closeday">Close</button>';
    let h = `<aside class="sc-panel" style="--cc:${ccolor(c)}" aria-label="Lesson">${close}<h2>${esc(it.title)}</h2><p class="sc-sub">${esc(c.name)} · ${it.d ? fmt(it.d) : 'No day yet'}</p>`;
    h += teacher ? teacherPanel(it, c) : `<div class="sc-acts"><a class="cv-pill" href="${esc(deps.playLink(it.id))}">Start</a></div>`;
    return h + '</aside>';
  }
  /* ---------- the teacher's panel for a real lesson (v3.1.72): ways to learn, try it as a student, publish ----------
     lesson.json holds the lesson and a small `styles` setting; publishing uses lesson-publish.js, the same code as Teacher Studio. */
  const LX = {del: false, id: '', loading: false, L: null, styles: {conversation: true, lecture: true, voice: true, alwaysListen: false}, msg: '', busy: '', sure: false};
  const BUCKET = 'lesson-files';
  const readLesson = async (db, id) => { const {data, error} = await db.storage.from(BUCKET).download(id + '/lesson.json'); if (error || !data) return null; try { const j = JSON.parse(await data.text()); return j && j.format === 'slides-v1' ? j : null; } catch (e) { return null; } };
  async function loadLx(it) {
    Object.assign(LX, {del: false, id: it.id, loading: !!it.slides, L: null, msg: '', busy: '', sure: false, styles: {conversation: true, lecture: true, voice: true, alwaysListen: false}});
    if (!it.slides) return;
    const db = deps.db(); let L = null; try { L = db ? await readLesson(db, it.id) : null; } catch (e) {}
    if (LX.id !== it.id) return;
    LX.loading = false; LX.L = L;
    if (L) LX.styles = {conversation: !(L.styles && L.styles.conversation === false), lecture: !(L.styles && L.styles.lecture === false), voice: !(L.styles && L.styles.voice === false), alwaysListen: !!(L.styles && L.styles.alwaysListen === true)};
    deps.render();
  }
  async function saveStyles(id, st) {
    const db = deps.db(); if (!db) return false;
    try {
      const L = await readLesson(db, id); if (!L) return false;
      L.styles = {conversation: !!st.conversation, lecture: !!st.lecture, voice: !!st.voice, alwaysListen: !!st.voice && !!st.alwaysListen}; L.updated = new Date().toISOString();
      const {error} = await db.storage.from(BUCKET).upload(id + '/lesson.json', new Blob([JSON.stringify(L)], {type: 'application/json'}), {upsert: true, contentType: 'application/json', cacheControl: '10'});
      return !error;
    } catch (e) { return false; }
  }
  function teacherPanel(it, c) {
    const ready = !it.slides || !!(LX.L && LX.L.status !== 'drafting' && LX.L.slides && LX.L.slides.every(s => s.script));
    const st = LX.styles, busy = LX.busy, id = esc(it.id), off = busy || LX.loading ? ' disabled' : '', pubOff = busy || LX.loading || !ready ? ' disabled' : '';
    let h = `<p><span class="sc-tag ${it.pub ? 'p' : 'd'}">${it.pub ? 'Published' : 'Draft'}</span></p>
      ${it.pub && it.mine ? resultsH(it) : ''}<label class="sc-f" for="sc-mv">${it.d ? 'Move to' : 'Put on a day'}</label><div class="sc-row"><input type="date" id="sc-mv" value="${it.d ? key(it.d) : nextMeetKey(c)}"><button type="button" class="cv-pill ghost" data-pa="move" data-id="${id}"${busy ? ' disabled' : ''}>${it.d ? 'Move' : 'Put on this day'}</button></div>${it.d ? `<button type="button" class="sc-link" data-pa="todrafts" data-id="${id}"${busy ? ' disabled' : ''}>Move back to drafts</button>` : ''}`;
    if (it.slides) {
      const ck = (k, label) => `<label class="sc-ck"><input type="checkbox" data-pa="style" data-s="${k}"${st[k] ? ' checked' : ''}${busy ? ' disabled' : ''}> ${label}</label>`;
      /* v3.1.75: each way of learning opens what is behind it: Lecture with pauses its slides and scripts, Conversation its map. */
      const sp = 'slides.html?l=' + encodeURIComponent(it.id), M = LX.L && LX.L.map, nch = M && Array.isArray(M.chapters) ? M.chapters.length : 0;
      const way = (k, label, href, what, sub) => `<div class="sc-way">${ck(k, label)}<a class="sc-open" href="${href}" aria-label="Open ${what}">Open</a>${sub ? `<span class="cv-muted sc-wsub">${sub}</span>` : ''}</div>`;
      h += `<div class="sc-ways" role="group" aria-label="Ways students may learn this"><span class="sc-f">Ways students may learn this</span>${LX.loading ? '<p class="cv-muted">Loading…</p>' : !LX.L ? '<p class="cv-muted">This lesson\'s file couldn\'t be read. Reload and try again.</p>' :
        way('lecture', 'Lecture with pauses', sp + '#slides', 'the slides and scripts', 'Slides and scripts') +
        way('conversation', 'Conversation', sp + '#map', 'the conversation map', nch ? 'Map: ' + nch + ' chapter' + (nch === 1 ? '' : 's') : st.conversation ? 'No map yet: open it to build one' : 'No map yet') +
        `<a class="sc-link sc-goals" href="${sp}#goals">Goals and the check</a>` +
        ck('voice', 'Voice: speaks, and students press Talk (or hold Space) to answer; typing always works') + (st.voice ? ck('alwaysListen', 'Always listening, adult classes only (the microphone stays on during the lesson)') : '')}</div>`;
    }
    h += `<div class="sc-acts"><button type="button" class="cv-pill" data-pa="try" data-id="${id}"${off}>Try it as a student</button>${it.slides ? '' : `<a class="cv-pill ghost" href="studio.html?from=places&l=${encodeURIComponent(it.id)}">Open in Teacher Studio</a>`}</div>
      <p class="cv-muted">Try it opens your latest draft. Nothing you do there is saved or shown to anyone.</p>
      <div class="sc-acts">${it.pub ? `<button type="button" class="cv-pill ghost" data-pa="unpub" data-id="${id}"${busy ? ' disabled' : ''}>${LX.sure ? 'Press again: students lose access' : 'Unpublish'}</button><button type="button" class="cv-pill" data-pa="publish" data-id="${id}"${pubOff}>Publish changes</button>` : `<button type="button" class="cv-pill" data-pa="publish" data-id="${id}"${pubOff}>Publish to students</button>`}</div>
      ${!ready && !LX.loading ? '<p class="cv-muted">Finish drafting every slide (Lecture with pauses › Open), then you can publish.</p>' : ''}
      <p class="sc-note" role="status">${esc(busy || LX.msg)}</p>
      <p class="cv-muted"><a class="sc-link" href="studio.html?from=places&l=${encodeURIComponent(it.id)}">More in Teacher Studio</a></p>
      <div class="sc-danger">${LX.del ? `<p><b>Delete "${esc(it.title)}"?</b> The lesson, its slides and scripts are removed for good. This can't be undone.</p><div class="sc-acts"><button type="button" class="cv-pill sc-del" data-pa="delyes" data-id="${id}"${busy ? ' disabled' : ''}>Yes, delete this lesson</button><button type="button" class="cv-pill ghost" data-pa="delno">Keep it</button></div>` : `<button type="button" class="cv-pill ghost sc-del" data-pa="del" data-id="${id}"${busy || it.pub ? ' disabled' : ''}>Delete lesson</button>${it.pub ? '<p class="cv-muted">Unpublish this lesson before you can delete it.</p>' : ''}`}</div>`;
    return h;
  }
  /* ---------- v3.1.77 (LES-342): students' results in the teacher's day panel ----------
     Reads worldview_teacher_lesson_runs (only the lesson's owner can) the way Teacher Studio does. Shows evidence, never a score:
     where each student is, what they said, and the explain-it-back verdicts as the lesson recorded them. No polling; Refresh reloads. */
  const RES = {id: '', rows: null, loading: false, err: '', open: '', at: null, all: false, stack: '', cost: null}, RC = {key: '', n: {}};
  const RATE = {'gemini-3.8-flash': [0.75, 3.75], 'claude-haiku-4-5': [1, 5]}, PER_SEC = {'deepgram-nova-3': 0.0043 / 60, 'gpt-live-1': 0.05 / 60};
  const STYLE = {lecture: 'Lecture with pauses', conversation: 'Conversation'};
  const SHORT = /^(next|ok(ay)?|yes|yeah|yep|sure|continue|go on|got it|again|say it again|mhm+|uh huh|right|done|ready)\W*$/i;
  const RUN_COLS = 'id,learner_name,answers,finished,updated_at,created_at,finished_at,version,day,attempt';
  const placeOf = r => { const a = (Array.isArray(r.answers) ? r.answers : []).find(x => x && x.kind === 'place' && x.place && typeof x.place === 'object'); return a ? a.place : null; };
  const isDone = r => !!r.finished || (placeOf(r) || {}).phase === 'end';
  const sayCount = (n, w) => n + ' ' + w + (n === 1 ? '' : 's');
  function ago(t) {
    const ms = Date.now() - new Date(t).getTime(); if (!(ms >= 0)) return t ? new Date(t).toLocaleDateString([], {month: 'short', day: 'numeric'}) : '';
    const m = Math.round(ms / 60000); if (m < 1) return 'just now'; if (m < 60) return m + ' min ago';
    const h = Math.round(m / 60); if (h < 24) return h + ' h ago'; const d = Math.round(h / 24); if (d < 8) return d + ' d ago';
    return new Date(t).toLocaleDateString([], {month: 'short', day: 'numeric'});
  }
  /* One student's row: name, style, progress (0-1) and words, from the run and its place entry. Runs saved before v3.1.76 (no place) still list. */
  function summarize(r, n) {
    const p = placeOf(r), done = isDone(r);
    let frac = 0, text = 'Started', style = '';
    if (p) {
      style = STYLE[p.style] || '';
      if (done) { frac = 1; text = 'Finished'; }
      else if (p.phase === 'check') { frac = 0.95; text = 'In the check' + (p.question && p.questions ? ' · question ' + p.question + ' of ' + p.questions : ''); }
      else if (p.phase === 'lecture' && p.slide && p.slides) { frac = Math.max(0.03, (p.slide - 1) / p.slides); text = 'Slide ' + p.slide + ' of ' + p.slides; }
      else if (p.phase === 'conv' && p.chapter && p.chapters) { frac = Math.max(0.03, (p.chapter - 1) / p.chapters); text = 'Chapter ' + p.chapter + ' of ' + p.chapters; }
      else if (p.phase === 'conv') { frac = 0.03; text = 'Getting started'; }
      else text = p.label || 'Started';
    } else if (done) { frac = 1; text = 'Finished'; }
    else text = 'Started · no progress saved';
    const nm = String(r.learner_name || '').trim();
    return {r, p, done, frac, text, style, name: nm || 'Student ' + n, anon: !nm, at: (p && p.at) || r.updated_at};
  }
  /* The explain-it-back lines the lesson recorded: "Question 2: partly (stopped: nothing_more). Said: ..." */
  function checkOf(r) {
    const out = {};
    (Array.isArray(r.answers) ? r.answers : []).forEach(a => {
      if (!a || a.kind !== 'evidence' || typeof a.answer !== 'string') return;
      const m = /^Question (\d+): (shown|partly|not_yet) \(stopped: (\w+)\)([\s\S]*)$/.exec(a.answer); if (!m) return;
      const said = /Said: ([\s\S]*)$/.exec(m[4]);
      out[+m[1]] = {v: m[2], why: m[3], said: said ? said[1] : '', unjudged: /could not judge/.test(m[4])};
    });
    return out;
  }
  const VERDICT = {shown: ['Shown', 'ok'], partly: ['Partly', 'mid'], not_yet: ['Not yet', 'no']};
  const WHY = {shown: 'Stopped because their explanation showed it.', nothing_more: 'Stopped because they had nothing more to add.'};
  function turnsByWhere(s) {
    const g = [], idx = {};
    ((s.p && Array.isArray(s.p.said) && s.p.said) || []).forEach(x => { if (!x || !x.text) return; const k = String(x.where || 'conversation').replace(/ point \d+$/, ''); if (!(k in idx)) { idx[k] = g.length; g.push({k, t: []}); } g[idx[k]].t.push(x.text); });
    return g;
  }
  const whereLabel = k => /^slide \d+$/.test(k) ? 'Slide ' + k.slice(6) : /^chapter \d+$/.test(k) ? 'Chapter ' + k.slice(8) : /^question \d+$/.test(k) ? 'Explain it back, question ' + k.slice(9) : k === 'conversation' ? 'Conversation' : k;
  function detailH(s, L) {
    const ck = checkOf(s.r), keys = Object.keys(ck).map(Number).sort((a, b) => a - b);
    const groups = turnsByWhere(s).filter(g => { const m = /^question (\d+)$/.exec(g.k); return !(m && ck[+m[1]]); });
    let h = '<div class="rs-det">';
    if (!s.p) h += '<p class="cv-muted">This student took the lesson before Worldview saved progress, so only the explain-it-back record (if any) is below.</p>';
    if (groups.length) h += '<h4>What they said</h4>' + groups.map(g => `<div class="rs-g"><b>${esc(whereLabel(g.k))}</b>${g.t.map(t => `<q>${esc(t)}</q>`).join('')}</div>`).join('') + (((s.p && s.p.said) || []).length >= 30 ? '<p class="cv-muted">Shows their last 30 lines.</p>' : '');
    else if (s.p) h += '<p class="cv-muted">Nothing said yet.</p>';
    if (keys.length) h += '<h4>Explain it back</h4>' + keys.map(n => { const c = ck[n], v = VERDICT[c.v], q = L && L.check && L.check[n - 1] && L.check[n - 1].question; return `<div class="rs-g"><div class="rs-q"><b>Question ${n}${q ? ': ' + esc(q) : ''}</b><span class="rs-v ${v[1]}">${v[0]}</span></div>${c.said ? `<q>${esc(c.said)}</q>` : '<p class="cv-muted">Said nothing.</p>'}<p class="cv-muted">${c.unjudged ? 'The AI could not judge this one. Please read their words.' : esc(WHY[c.why] || '')}</p></div>`; }).join('');
    return h + '<p class="rs-rule">Worldview shows evidence. You decide the grade.</p></div>';
  }
  /* v3.1.78: one lesson line instead of a bar per student. Each student is a small V above the track at their place;
     students at the same place stack into one numbered V. Hover or focus shows who; tap or Enter opens a side panel. */
  const ZL = 74, ZC = 88; /* the lesson fills 0-74% of the track, the check 74-88%, "Finished" 88-100% */
  function spotOf(s, N, C) {
    const p = s.p; if (!p || !STYLE[p.style]) return null;
    if (s.done) return {k: 'end', x: 94};
    if (p.phase === 'check') { const q = p.question || 0, Q = Math.max(p.questions || 0, q); return {k: 'q' + q, x: ZL + (q && Q ? (q - 0.5) / Q * (ZC - ZL) : (ZC - ZL) / 2)}; }
    if (p.phase === 'lecture' && p.slide) return {k: 's' + p.slide, x: (p.slide - 0.5) / Math.max(N, p.slide) * ZL};
    if (p.phase === 'conv' && p.chapter) return {k: 'c' + p.chapter, x: (p.chapter - 0.5) / Math.max(C, p.chapter) * ZL};
    if (p.phase === 'conv') return {k: 'c0', x: 2};
    return null;
  }
  const money = n => '$' + (n === 0 ? '0' : n < 0.01 ? n.toFixed(4) : n.toFixed(2));
  function trackH(label, style, group, ticks) {
    const spots = {};
    group.forEach(x => (spots[x.sp.k] = spots[x.sp.k] || {sp: x.sp, who: []}).who.push(x.s));
    const tk = []; for (let i = 0; i <= ticks; i++) tk.push(`<i class="rs-tick" style="left:${(i / ticks * ZL).toFixed(2)}%"></i>`);
    const gs = Object.keys(spots).map(k => spots[k]);
    const marks = gs.map(g => {
      const w = g.who.slice().sort((a, b) => new Date(b.at) - new Date(a.at)), one = w.length === 1, x = g.sp.x, side = x < 28 ? ' l' : x > 72 ? ' r' : '', key = style + g.sp.k;
      const tip = one ? `<b>${esc(w[0].name)}</b><span>${esc(w[0].text)}</span><span>Active ${esc(ago(w[0].at))}</span>` : `<b>${w.length} students · ${esc(w[0].text)}</b><span>${esc(w.slice(0, 6).map(s => s.name).join(', '))}${w.length > 6 ? ' and ' + (w.length - 6) + ' more' : ''}</span>`;
      const isOpen = one ? RES.open === w[0].r.id : RES.stack === key;
      const att = one ? `data-pa="resopen" data-r="${esc(w[0].r.id)}"` : `data-pa="resstack" data-k="${esc(key)}"`;
      return `<button type="button" class="rs-mk${g.sp.k === 'end' ? ' fin' : ''}${isOpen ? ' on' : ''}${side}" style="left:${x.toFixed(2)}%" ${att} aria-label="${esc(one ? w[0].name + ', ' + w[0].text : w.length + ' students, ' + w[0].text)}" aria-expanded="${isOpen}">${one ? '' : `<em>${w.length}</em>`}<u></u><span class="rs-tip" role="presentation">${tip}</span></button>`;
    }).join('');
    const op = gs.find(g => g.who.length > 1 && RES.stack === style + g.sp.k);
    return `<div class="rs-lane"><div class="rs-lh"><b>${esc(label)}</b><span>${sayCount(group.length, 'student')}</span></div>
      <div class="rs-track">${marks}<div class="rs-rail"><span class="rs-z chk" style="left:${ZL}%;width:${ZC - ZL}%"></span><span class="rs-z fin" style="left:${ZC}%;width:${100 - ZC}%"></span>${tk.join('')}</div>
      <div class="rs-lab"><span>Start</span><span class="c">Check</span><span class="f">Finished</span></div></div>
      ${op ? `<div class="rs-stack"><b>${esc(op.who[0].text)}:</b> ${op.who.map(s => `<button type="button" class="rs-chip" data-pa="resopen" data-r="${esc(s.r.id)}">${esc(s.name)}</button>`).join('')}</div>` : ''}</div>`;
  }
  function lineH(sums, L) {
    const sl = Math.max((L && L.slides && L.slides.length) || 0, ...sums.map(s => (s.p && s.p.slides) || 0));
    const ch = Math.max((L && L.map && Array.isArray(L.map.chapters) && L.map.chapters.length) || 0, ...sums.map(s => (s.p && s.p.chapters) || 0));
    const by = {lecture: [], conversation: []};
    sums.forEach(s => { const sp = spotOf(s, sl, ch); if (sp) by[s.p.style].push({s, sp}); });
    const off = sums.filter(s => !spotOf(s, sl, ch));
    let h = '<div class="rs-lanes">';
    if (by.lecture.length) h += trackH(STYLE.lecture, 'lecture', by.lecture, Math.max(sl, 1));
    if (by.conversation.length) h += trackH(STYLE.conversation, 'conversation', by.conversation, Math.max(ch, 1));
    h += '</div>';
    if (!by.lecture.length && !by.conversation.length) h += '<p class="cv-muted">Nobody has a place on the line yet. Everyone who started is in All students.</p>';
    else h += '<p class="cv-muted rs-hint">Each V is a student. Hover or tab to a V to see who; tap it to open their detail.</p>';
    h += `<button type="button" class="rs-allb" data-pa="resall" aria-expanded="${!!RES.all}"><span aria-hidden="true">${RES.all ? '▾' : '▸'}</span> All students (${sums.length})</button>`;
    if (RES.all) {
      const ord = sums.slice().sort((a, b) => new Date(b.at) - new Date(a.at));
      h += `<div class="rs-list">${ord.map(s => `<button type="button" class="rs-li${RES.open === s.r.id ? ' on' : ''}" data-pa="resopen" data-r="${esc(s.r.id)}"><b>${esc(s.name)}</b><span>${esc(s.text)}</span><small>${esc(ago(s.at))}</small></button>`).join('')}</div>`;
    } else if (off.length) h += `<p class="cv-muted">${sayCount(off.length, 'student')} ${off.length === 1 ? 'has' : 'have'} no place on the line (see All students).</p>`;
    return h;
  }
  function sideH(s, L) {
    return `<aside class="rs-side" role="dialog" aria-modal="false" aria-label="${esc(s.name)}, progress"><div class="rs-sh"><div><h3>${esc(s.name)}</h3><p class="cv-muted">${esc([s.style, s.text, 'active ' + ago(s.at)].filter(Boolean).join(' · '))}</p></div><button type="button" class="cv-pill ghost rs-x" data-pa="resclose">Close</button></div>${detailH(s, L)}</aside>`;
  }
  function resultsH(it) {
    const ready = RES.id === it.id && RES.rows, L = LX.id === it.id ? LX.L : null;
    let h = `<section class="rs" aria-label="Results"><div class="rs-top"><h3>Results</h3><button type="button" class="sc-link" data-pa="resrefresh" data-id="${esc(it.id)}"${RES.loading ? ' disabled' : ''}>${RES.loading ? 'Loading…' : 'Refresh'}</button></div>`;
    if (RES.err && RES.id === it.id) h += `<p class="cv-muted">${esc(RES.err)}</p>`;
    if (!ready) return h + (RES.err ? '' : '<p class="cv-muted">Loading results…</p>') + '</section>';
    const rows = RES.rows, sorted = rows.slice().sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    let n = 0; const sums = sorted.map(r => summarize(r, String(r.learner_name || '').trim() ? 0 : ++n));
    const fin = sums.filter(s => s.done).length;
    h += `<div class="rs-tiles"><div><b>${sums.length}</b><span>started</span></div><div><b>${fin}</b><span>finished</span></div></div>`;
    if (RES.cost && RES.cost.id === it.id) h += `<p class="rs-cost cv-muted">AI cost so far: ${money(RES.cost.students)}${RES.cost.draft ? ' · drafting ' + money(RES.cost.draft) : ''}${RES.cost.testing ? ' · your testing ' + money(RES.cost.testing) : ''}</p>`;
    if (!sums.length) return h + '<p class="cv-muted">No results yet. Results appear when students take the published lesson. Your own “Try it as a student” previews are not saved, so they never show here.</p></section>';
    sums.sort((a, b) => new Date(b.at) - new Date(a.at));
    h += lineH(sums, L);
    const open = sums.find(s => s.r.id === RES.open);
    if (open) h += sideH(open, L);
    if (rows.length >= 200) h += '<p class="cv-muted">Showing the 200 most recent.</p>';
    if (sums.some(s => s.anon)) h += '<p class="cv-muted">Students who gave no name are numbered in the order they started.</p>';
    /* where the class got stuck: students' turns per slide (or chapter), counting real questions, not "next" or "okay" */
    const per = {};
    sums.forEach(s => ((s.p && Array.isArray(s.p.said) && s.p.said) || []).forEach(x => { const m = x && /^(slide|chapter) (\d+)/.exec(x.where || ''); if (!m || !x.text || SHORT.test(String(x.text).trim())) return; const k = m[1] + ' ' + m[2], e = per[k] = per[k] || {k, kind: m[1], n: +m[2], turns: 0, who: new Set()}; e.turns++; e.who.add(s.r.id); }));
    const list = Object.values(per).sort((a, b) => b.turns - a.turns || a.n - b.n);
    h += '<h4>Where the class got stuck</h4>';
    if (!list.length) h += '<p class="cv-muted">Nothing yet. This counts what students ask on each slide.</p>';
    else {
      const max = list[0].turns, top = new Set(list.slice(0, 3).map(x => x.k));
      h += `<div class="rs-stuck">${list.slice(0, 12).map(x => { const t = x.kind === 'slide' && L && L.slides && L.slides[x.n - 1] && L.slides[x.n - 1].title; return `<div class="rs-s${top.has(x.k) ? ' hot' : ''}"><span class="rs-sl">${x.kind === 'slide' ? 'Slide' : 'Chapter'} ${x.n}${t ? ` <small>${esc(String(t).slice(0, 40))}</small>` : ''}</span><span class="rs-bar"><i style="width:${Math.max(6, Math.round(x.turns / max * 100))}%"></i></span><span class="rs-c">${sayCount(x.who.size, 'student')} · ${sayCount(x.turns, 'turn')}</span></div>`; }).join('')}</div><p class="cv-muted">The top three are marked. This counts what students said on each slide (their last 30 lines each), not short replies like “next”.</p>`;
    }
    return h + '</section>';
  }
  async function loadRuns(it, force) {
    const db = deps.db(); if (!db || !it) return;
    if (RES.id === it.id && (RES.loading || ((RES.rows || RES.err) && !force))) return;
    if (RES.id !== it.id) Object.assign(RES, {id: it.id, rows: null, err: '', open: '', all: false, stack: '', cost: null});
    RES.loading = true; RES.err = ''; deps.render();
    try {
      const {data, error} = await db.from('worldview_teacher_lesson_runs').select(RUN_COLS).eq('lesson_id', it.id).order('updated_at', {ascending: false}).limit(200);
      if (RES.id !== it.id) return;
      if (error) RES.err = 'Couldn\'t load results (' + (error.message || 'error') + '). Press Refresh to try again.';
      else { RES.rows = data || []; RES.at = new Date(); RC.n[it.id] = {started: RES.rows.length, finished: RES.rows.filter(isDone).length}; }
    } catch (e) { if (RES.id === it.id) RES.err = 'Couldn\'t load results. Check the internet connection and press Refresh.'; }
    try { /* what this lesson has cost in AI so far, added up the way Teacher Studio's Published side does (counts only, no words) */
      const {data, error} = await db.from('worldview_teacher_lesson_ai_calls').select('kind,by_owner,model,input_tokens,output_tokens,audio_seconds,cost_usd').eq('lesson_id', it.id).eq('state', 'ok').limit(5000);
      if (!error && RES.id === it.id) {
        const c = r => { if (r.cost_usd != null) return +r.cost_usd || 0; if (PER_SEC[r.model]) return (+r.audio_seconds || 0) * PER_SEC[r.model]; const k = RATE[r.model] || [1, 5]; return ((r.input_tokens || 0) * k[0] + (r.output_tokens || 0) * k[1]) / 1e6; };
        const sum = f => (data || []).filter(f).reduce((t, r) => t + c(r), 0);
        RES.cost = {id: it.id, students: sum(r => !r.by_owner && r.kind !== 'draft'), draft: sum(r => r.kind === 'draft'), testing: sum(r => r.by_owner && r.kind !== 'draft')};
      }
    } catch (e) {}
    RES.loading = false; deps.render();
  }
  /* The calendar cards' "3 started · 1 finished": one small query for the class's published lessons, once per class view. */
  async function loadCounts(ids) {
    const db = deps.db(), key = ids.join(','); if (!db || !ids.length || RC.key === key) return;
    RC.key = key;
    try {
      const {data, error} = await db.from('worldview_teacher_lesson_runs').select('lesson_id,finished,answers').in('lesson_id', ids).limit(2000);
      if (error) return;
      ids.forEach(i => RC.n[i] = {started: 0, finished: 0});
      (data || []).forEach(r => { const c = RC.n[r.lesson_id]; if (!c) return; c.started++; if (isDone(r)) c.finished++; });
      deps.render();
    } catch (e) {}
  }
  const countLine = it => { const c = P.role === 'teacher' && it.pub && it.mine && RC.n[it.id]; return c ? `<span class="sc-rs">${c.started ? c.started + ' started · ' + c.finished + ' finished' : 'No one has started'}</span>` : ''; };
  /* After each render: fetch what the teacher's view needs once (counts for the class, results for the open published lesson). */
  function syncResults() {
    if (P.role !== 'teacher' || P.scr !== 'class') return;
    const items = itemsFor(curClass()), pubs = items.filter(x => x.mine && x.pub);
    loadCounts(pubs.map(x => x.id).sort());
    const sel = P.sel && items.find(x => x.key === P.sel);
    if (sel && sel.mine && sel.pub) loadRuns(sel);
  }
  const mineItem = id => itemsFor(curClass()).find(x => x.kind === 'real' && x.id === id);
  async function tryAsStudent(id) {
    const db = deps.db(), it = mineItem(id); if (!db || !it) return;
    LX.busy = 'Opening your draft…'; deps.render();
    try { if (it.slides) await window.WorldviewPublish.ensureSlidesStyle(db, id); } catch (e) { LX.busy = ''; LX.msg = e.message || String(e); deps.render(); return; }
    location.href = deps.playLink(id) + '&preview=1';
  }
  async function publishLx(id) {
    const db = deps.db(), it = mineItem(id), PB = window.WorldviewPublish; if (!db || !it || !PB) return;
    LX.busy = 'Publishing…'; LX.msg = ''; deps.render();
    try {
      const html = it.slides ? await PB.ensureSlidesStyle(db, id) : (await db.from('worldview_teacher_lessons').select('html').eq('id', id).single()).data.html;
      const latest = await PB.latestRelease(db, id);
      const r = await PB.publish({db, id, shared: it.pub, html, latest, setShared: v => PB.setShared(db, id, v), onProgress: t => { LX.busy = t; deps.render(); }});
      if (r.cancelled) LX.msg = 'Couldn\'t publish it. Check the internet connection and try again.';
      else LX.msg = (r.again ? 'v' + r.version + ' is published again. ' : 'v' + r.version + ' is live for students. ') + 'They can open it from this calendar.' + (r.missing && r.missing.length ? ' Warning: it uses ' + r.missing.length + ' file' + (r.missing.length === 1 ? '' : 's') + ' that aren\'t on Worldview (' + r.missing.slice(0, 4).join(', ') + ').' : '');
    } catch (e) { LX.msg = (e.version ? 'v' + e.version + ' is published, but its files aren\'t locked in yet: ' : 'Couldn\'t publish it: ') + (e.message || e) + (e.version ? ' Press Publish changes to try again.' : ''); }
    LX.busy = ''; await deps.reload(); deps.render();
  }
  async function unpublishLx(id) {
    const db = deps.db(); if (!db) return;
    if (!LX.sure) { LX.sure = true; clearTimeout(unpublishLx.t); unpublishLx.t = setTimeout(() => { LX.sure = false; deps.render(); }, 4000); deps.render(); return; }
    LX.sure = false; LX.busy = 'Unpublishing…'; deps.render();
    const ok = await window.WorldviewPublish.setShared(db, id, false);
    LX.busy = ''; LX.msg = ok ? 'Unpublished. Students can\'t open it now; their results are kept. You can publish again any time.' : 'Couldn\'t unpublish it. Check the internet connection and try again.';
    await deps.reload(); deps.render();
  }
  async function changeStyle(id, which, on) {
    if (!id) return;
    const next = Object.assign({}, LX.styles, {[which]: on});
    if (!next.conversation && !next.lecture) { LX.msg = 'Keep at least one way on, so students have a way to start.'; deps.render(); return; }
    LX.styles = next; LX.msg = 'Saving…'; deps.render();
    const ok = await saveStyles(id, next), it = mineItem(id);
    LX.msg = ok ? 'Saved. ' + (it && it.pub ? 'Students get this when you publish changes.' : 'Students get this when you publish.') : 'Couldn\'t save that. Check the internet connection and try again.';
    deps.render();
  }
  /* The teacher's class page: month calendar, the Drafts list beside it (below it on a phone), and the lesson panel. */
  function editForm(c) {
    return `<form class="sc-edit" data-form="class" novalidate><h2 class="sc-h2">Edit this class</h2>
      <label class="sc-f" for="ce-name">Name</label><input id="ce-name" type="text" maxlength="60" value="${esc(c.name)}" autocomplete="off">
      <label class="sc-f" for="ce-code">Short code</label><input id="ce-code" type="text" maxlength="20" value="${esc(c.code)}" autocomplete="off">
      <span class="sc-f" id="ce-dl">Meeting days</span><div class="sc-days" role="group" aria-labelledby="ce-dl">${[1, 2, 3, 4, 5, 6, 0].map(n => `<label class="sc-day"><input type="checkbox" name="ce-day" value="${n}"${c.days.includes(n) ? ' checked' : ''}><span>${WC.WD[n]}</span></label>`).join('')}</div>
      <span class="sc-f" id="ce-cl">Colour</span><div class="sc-sw" role="radiogroup" aria-labelledby="ce-cl">${WC.COLORS.map((h, i) => `<label class="sc-swl" title="${WC.COLOR_NAMES[i]}"><input type="radio" name="ce-color" value="${i}"${c.color === i ? ' checked' : ''} aria-label="${WC.COLOR_NAMES[i]}"><i style="background:${h}"></i></label>`).join('')}</div>
      <p class="sc-note" id="ce-msg" role="status"></p>
      <div class="sc-acts"><button type="button" class="cv-pill" data-pa="saveclass">Save class</button><button type="button" class="cv-pill ghost" data-pa="cancelclass">Cancel</button></div>
      <p class="cv-muted">Class details are saved on this device only. Your lessons stay with the class if you rename it.</p></form>`;
  }
  function classCal() {
    const c = curClass(), items = itemsFor(c); ensureSel(items);
    const cal = calHtml(items), drafts = items.filter(x => !x.d);
    const dr = `<section class="sc-drafts" aria-labelledby="sc-dh"><h2 class="sc-h2" id="sc-dh">Drafts <span>${drafts.length}</span></h2>
      ${drafts.length ? `<p class="cv-muted">Lessons with no day yet. Open one and choose a day. On a laptop you can also drag it onto a day.</p>${drafts.map(x => scCard(x, P.sel)).join('')}` : '<p class="cv-muted">Nothing waiting. A lesson you make from slides lands here until you give it a day.</p>'}</section>`;
    return `${switchH()}<div class="sc-layout two"><div class="sc-main"><button type="button" class="sc-link" data-pa="school">← All classes</button>
      <div class="sc-top"><div><h1 class="sc-h"><i class="sc-dot" style="background:${ccolor(c)}"></i>${esc(c.name)}</h1><p class="sc-sub">${esc(c.code)}${c.code ? ' · ' : ''}meets ${meetText(c)}</p></div><div class="sc-acts"><a class="cv-pill" href="slides.html?class=${encodeURIComponent(c.id)}">Add presentations</a><button type="button" class="cv-pill ghost" data-pa="editclass">Edit class</button></div></div>
      ${P.edit ? editForm(c) : ''}${cal.html}${items.length ? (cal.n || drafts.length ? '' : '<p class="cv-muted sc-none">No lessons this month.</p>') : '<p class="cv-muted sc-none">No lessons in this class yet. Press Add presentations to make one from your slides.</p>'}</div>
      <div class="sc-side">${dr}${panelH(items)}</div></div>`;
  }
  async function moveLesson(id, k) {
    const l = (deps.my() || []).find(x => x.id === id); if (!l || !validKey(k)) { deps.toast('Pick a valid date.'); return; }
    const had = !!(l.note && validKey(l.note.date)), ok = await deps.saveNote(id, Object.assign({}, l.note || {}, {date: k}));
    deps.toast(ok ? (had ? 'Moved to ' : 'Put on ') + fmt(D(k)) + '.' : 'Could not save the day. Check your connection and try again.'); deps.render();
  }
  async function backToDrafts(id) {
    const l = (deps.my() || []).find(x => x.id === id); if (!l) return;
    const n = Object.assign({}, l.note || {}); delete n.date;
    const ok = await deps.saveNote(id, n);
    deps.toast(ok ? 'Moved back to drafts.' : 'Could not do that. Check your connection and try again.'); deps.render();
  }
  /* Delete a lesson through the same table call Teacher Studio uses. A published lesson must be unpublished first. */
  async function deleteLesson(id) {
    const db = deps.db(), it = mineItem(id); if (!db || !it) return;
    if (it.pub) { LX.msg = 'Unpublish this lesson first, then you can delete it.'; LX.del = false; deps.render(); return; }
    LX.busy = 'Deleting…'; deps.render();
    let ok = false; try { const {error} = await db.from('worldview_teacher_lessons').delete().eq('id', id); ok = !error; } catch (e) {}
    LX.busy = ''; LX.del = false;
    if (!ok) { LX.msg = 'Couldn\'t delete it. Check the internet connection and try again.'; deps.render(); return; }
    P.sel = null; LX.id = ''; await deps.reload(); deps.toast('Lesson deleted.'); deps.render();
  }
  const SCREENS = {school: schoolHome, class: classCal};

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
    html() { if (P.scr === 'class' && P.role !== 'teacher') P.scr = 'school'; return (SCREENS[P.scr] || schoolHome)(); },
    goClass(id) { if (!ucls(id)) return; P.role = 'teacher'; save('role', 'teacher'); P.cur = id; P.scr = 'class'; P.sel = null; P.edit = false; P.month = monthOf(TODAY); deps.render(); },
    afterRender(root) {
      if (P.scr !== 'class' && P.scr !== 'school') return;
      syncResults();
      root.querySelectorAll('.sc-lc').forEach(el => {
        el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); el.click(); } });
        if (el.draggable) el.addEventListener('dragstart', e => { e.dataTransfer.setData('text/plain', el.dataset.k); e.dataTransfer.effectAllowed = 'move'; });
      });
      root.querySelectorAll('.sc-cell[data-dk]').forEach(c => {
        c.addEventListener('dragover', e => { e.preventDefault(); c.classList.add('over'); });
        c.addEventListener('dragleave', () => c.classList.remove('over'));
        c.addEventListener('drop', e => { e.preventDefault(); c.classList.remove('over'); const k = e.dataTransfer.getData('text/plain'); if (k.startsWith('r|')) moveLesson(k.slice(2), c.dataset.dk); });
      });
    },
    home() { P.scr = 'school'; P.sel = null; P.edit = false; deps.render(); },
    openTutor() { P.scr = 'school'; },
    escape() { if (RES.open) { RES.open = ''; deps.render(); return true; } if (P.sel) { P.sel = null; deps.render(); return true; } return false; },
    input(e) {
      const id = e.target.id;
      if (id === 'pl-q') { P.query = e.target.value; const pos2 = e.target.selectionStart; deps.render(); const i = document.getElementById('pl-q'); if (i) { i.focus(); try { i.setSelectionRange(pos2, pos2); } catch (x) {} } return; }
      if (e.target.matches('[data-dv]')) { P.ds[e.target.dataset.dv] = +e.target.value; const b = document.querySelector('[data-live]'), k = (DEMOS[P.demo] || {}).k; if (b && LIVE[k]) b.innerHTML = LIVE[k](); }
    },
    click(e) {
      const el = e.target.closest('[data-pa]'); if (!el || el.disabled) return false;
      if (el.classList.contains('cv-ov') && e.target !== el) return false;
      act(el.dataset.pa, el.type === 'checkbox' ? Object.assign({}, el.dataset, {checked: el.checked}) : el.dataset); return true;
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
    const c = curClass();
    const top = () => { const v = document.getElementById('courses-view'); if (v) v.scrollTop = 0; };
    switch (a) {
      case 'find': P.scr = 'find'; P.code = false; top(); break;
      case 'email': P.scr = 'email'; top(); break;
      case 'sendcode': P.code = true; break;
      case 'verified': P.verified = true; save('verified', true); P.scr = 'school'; top(); break;
      case 'look': P.scr = 'school'; top(); break;
      case 'school': P.scr = 'school'; P.sheet = null; P.sel = null; P.edit = false; top(); break;
      case 'open': if (!ucls(d.c)) return; P.cur = d.c; P.scr = 'class'; P.edit = false; P.sel = null; P.month = monthOf(TODAY); top(); break;
      case 'filter': { const h = hidden(), i = h.indexOf(d.c); if (i < 0) h.push(d.c); else h.splice(i, 1); save('hide', h); P.sel = null; break; }
      case 'editclass': P.edit = true; break;
      case 'cancelclass': P.edit = false; break;
      case 'saveclass': {
        const f = document.querySelector('[data-form=class]'); if (!f) return;
        const name = f.querySelector('#ce-name').value.trim(), days = [...f.querySelectorAll('[name=ce-day]:checked')].map(x => +x.value), col = f.querySelector('[name=ce-color]:checked'), msg = f.querySelector('#ce-msg');
        if (!name) { msg.textContent = 'Give the class a name.'; return; }
        if (!days.length) { msg.textContent = 'Pick at least one meeting day.'; return; }
        WC.update(c.id, {name, code: f.querySelector('#ce-code').value, days, color: col ? +col.value : c.color}); P.edit = false; deps.toast('Class saved on this device.'); break;
      }
      case 'todrafts': backToDrafts(d.id); return;
      case 'del': LX.del = true; LX.msg = ''; break;
      case 'delno': LX.del = false; break;
      case 'delyes': deleteLesson(d.id); return;
      case 'role': if (d.r !== P.role) { P.role = d.r; save('role', d.r); } break;
      case 'pick': { P.sel = P.sel === d.k ? null : d.k; const it = P.sel && viewItems().find(x => x.key === P.sel); if (it && it.mine && P.role === 'teacher' && LX.id !== it.id) loadLx(it); break; }
      case 'try': tryAsStudent(d.id); return;
      case 'publish': publishLx(d.id); return;
      case 'unpub': unpublishLx(d.id); return;
      case 'style': changeStyle(P.sel && (viewItems().find(x => x.key === P.sel) || {}).id, d.s, d.checked === true || d.checked === 'true'); return;
      case 'resopen': RES.open = RES.open === d.r ? '' : d.r; RES.stack = ''; if (RES.open) setTimeout(() => { const x = document.querySelector('.rs-x'); if (x) x.focus(); }, 30); break;
      case 'resclose': { const was = RES.open; RES.open = ''; deps.render(); setTimeout(() => { const m = [...document.querySelectorAll('[data-r]')].find(x => x.dataset.r === was); if (m) m.focus(); }, 30); return; }
      case 'resstack': RES.stack = RES.stack === d.k ? '' : d.k; break;
      case 'resall': RES.all = !RES.all; break;
      case 'resrefresh': { const it = mineItem(d.id); RC.key = ''; if (it) { loadRuns(it, true); return; } break; }
      case 'closeday': P.sel = null; break;
      case 'mon': P.month = new Date(P.month.getFullYear(), P.month.getMonth() + (+d.n), 1); break;
      case 'monnow': P.month = monthOf(TODAY); break;
      case 'move': { const v = (document.getElementById('sc-mv') || {}).value; moveLesson(d.id, v); return; }
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
