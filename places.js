/* Places (NAV-203): your university, your classes as term lines, and for each unit the lessons students made.
   Sample data for now, saved only on this device. Real lessons come in by title: a published Teacher Studio
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
  const START = D('2026-08-24'), END = D('2026-12-11');
  const now0 = new Date(), TODAY = now0 < START ? START : now0 > END ? END : new Date(now0.getFullYear(), now0.getMonth(), now0.getDate());
  const pos = d => Math.max(0, Math.min(100, (d - START) / (END - START) * 100));
  const WEEK = Math.min(15, Math.floor(Math.round((TODAY - START) / DAY) / 7) + 1);
  const BREAKS = new Set(['2026-09-07', '2026-10-12', '2026-10-13', '2026-11-25', '2026-11-26', '2026-11-27']);
  const rnd = str => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; };
  const NAMES = ['Maya R. ’27', 'Jordan K. ’26', 'Priya S. ’27', 'Liam T. ’26', 'Ava M. ’28', 'Noah B. ’27', 'Sofia L. ’26', 'Ethan W. ’27', 'Grace H. ’26', 'Owen P. ’28'];
  const ROOF = '<svg class="pl-roof" viewBox="0 0 320 126" aria-hidden="true"><path class="l" d="M160 2v12"/><path class="s" d="M146 40 Q146 19 160 14 Q174 19 174 40 Z"/><rect class="s" x="141" y="40" width="38" height="24"/><rect class="w" x="148" y="45" width="8" height="13" rx="4"/><rect class="w" x="164" y="45" width="8" height="13" rx="4"/><path class="s" d="M24 108 L160 58 L296 108 Z"/><circle class="s" cx="160" cy="91" r="9"/><path class="l" d="M160 91v-6M160 91l4 2"/><rect class="s" x="14" y="108" width="292" height="9"/><rect class="s" x="22" y="117" width="276" height="9"/></svg>';
  const LOT = '<svg class="pl-roof" viewBox="0 0 320 126" aria-hidden="true"><path class="l" d="M24 118 L160 54 L296 118" stroke-dasharray="7 7"/><path class="l" d="M160 74v30M145 89h30"/></svg>';
  const SEARCH = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';

  const CLASSES = [
    {code: 'MA 132', name: 'Calculus II', cat: 'science', days: [1, 3, 5], hw: [5, 1], nowU: 2, units: [['Integration techniques', '2026-09-25', 'Exam 1', ['integration by parts', 'trig integrals', 'trig substitution', 'partial fractions', 'improper integrals']], ['Applications of integrals', '2026-10-23', 'Exam 2', ['area between curves', 'volumes of revolution', 'arc length', 'work and force']], ['Sequences and series', '2026-11-20', 'Exam 3', ['sequences', 'geometric series', 'convergence tests', 'alternating series', 'power series', 'Taylor series']], ['Parametric and polar', '2026-12-09', 'Final', ['parametric curves', 'polar coordinates', 'area in polar', 'conic sections']]],
      now: [
        ['maya', 'Maya R. ’27', 'Move a slider and watch the series settle, before any formula.', 4.9, 212, 2, 40, [1, 4], 'sliders', ['Watch a sequence settle', 'Drag the ratio of a geometric series', 'When adding forever explodes', 'The integral test, seen as area', 'Race two series side by side', 'Alternating series on a number line', 'Build a power series, term by term', 'Fit a curve with Taylor polynomials']],
        ['jordan', 'Jordan K. ’26', 'A tutor that only asks questions and makes you explain.', 4.7, 340, 2, 90, [2, 5], 'voice', ['What does it mean to converge?', 'Explain geometric series out loud', 'Why the harmonic series diverges', 'Defend your choice of test', 'Ratio test or root test? Argue it', 'Find the interval of convergence, aloud', 'Where does a Taylor series come from?']],
        ['priya', 'Priya S. ’27', 'Real wrong answers. You find what went wrong.', 4.8, 156, 1, 12, [3], 'mistake', ['The limit that isn’t', 'Whose geometric sum is wrong?', 'The test that doesn’t apply', 'The Taylor series with a bad center']],
        ['sofia', 'Sofia L. ’26', 'Study group: everyone records one minute, then replies to a classmate.', 4.6, 64, 1, 5, [4], 'group', ['Convergence, in your own words', 'Which test would you pick, and why?', 'Group problem: the tricky series', 'Group review before Exam 3']],
        ['liam', 'Liam T. ’26', 'Old-exam problems, harder every day.', 4.4, 98, 1, 200, [1, 3], '', ['Drill: limits of sequences', 'Drill: geometric and telescoping', 'Drill: the integral test', 'Drill: comparison tests', 'Drill: the ratio test', 'Drill: power series', 'Drill: Taylor series', 'Timed practice for Exam 3']]]},
    {code: 'PH 132', name: 'Physics II', cat: 'science', days: [2, 4], hw: [1, 1], nowU: 2, units: [['Charge and fields', '2026-09-24', 'Exam 1', ['Coulomb’s law', 'electric fields', 'Gauss’s law']], ['Potential', '2026-10-15', 'Exam 2', ['electric potential', 'capacitors', 'dielectrics']], ['Circuits', '2026-11-12', 'Exam 3', ['current and resistance', 'DC circuits', 'Kirchhoff’s rules', 'RC circuits']], ['Magnetism and waves', '2026-12-10', 'Final', ['magnetic force', 'Faraday’s law', 'electromagnetic waves']]],
      now: [
        ['noah', 'Noah B. ’27', 'A parts kit comes in the mail. Build it for real, or use my simulation.', 4.9, 88, 2, 30, [2, 4], 'circuit', ['Light your first LED', 'Measure current with a meter', 'Series and parallel on a breadboard', 'Why your bulbs go dim', 'Build a voltage divider', 'Charge a capacitor and time it', 'Find the fault in my circuit']],
        ['ethan', 'Ethan W. ’27', 'A tutor guides you through each problem and never gives the answer.', 4.8, 190, 2, 70, [2, 5], '', ['Why does current flow at all?', 'Reduce this network, step by step', 'Set up Kirchhoff’s loops', 'When your loop equations disagree', 'A capacitor at the first instant', 'What the RC time constant means', 'An exam-style circuit, guided', 'Explain your hardest problem']],
        ['ava', 'Ava M. ’28', 'A short video each day, then one hard question.', 4.3, 41, 1, 9, [3], '', ['Video: charge moving through a wire', 'Video: what a resistor does', 'Video: Kirchhoff’s two rules', 'Video: the RC curve']]]},
    {code: 'FI 301', name: 'Financial Management', cat: 'money', days: [1, 3], hw: [3, 1], nowU: 1, units: [['Time value of money', '2026-10-01', 'Exam 1', ['present value', 'annuities', 'loans']], ['Reading a company', '2026-11-05', 'Exam 2', ['income statements', 'cash flow', 'debt', 'ratios']], ['Valuation', '2026-12-10', 'Final', ['discounted cash flow', 'risk and return', 'capital structure']]],
      now: [
        ['grace', 'Grace H. ’26', 'My uncle reads company statements for a living. He recorded how he does it. Then you try.', 4.9, 124, 2, 25, [1, 3], 'statement', ['How my uncle opens an annual report', 'Revenue: what’s really in it?', 'Why profit isn’t cash', 'Reading the cash flow statement', 'Debt: can they pay it?', 'The footnotes people skip', 'The few ratios he actually uses', 'Compare two retailers', 'Your turn: read one alone']],
        ['owenf', 'Owen P. ’28', 'A group picks one company and argues about it, in recorded replies.', 4.5, 52, 1, 15, [2], '', ['Pick your company', 'Argue: is the revenue real?', 'Argue: too much debt?', 'Argue: where is the cash going?', 'Group verdict: would you buy it?']],
        ['liamf', 'Liam T. ’26', 'Old-exam problems, harder every day.', 4.2, 87, 1, 150, [1, 4], '', ['Drill: building an income statement', 'Drill: indirect cash flow', 'Drill: common-size statements', 'Drill: liquidity ratios', 'Drill: leverage ratios', 'Drill: return on equity', 'Timed practice for Exam 2']]]},
    {code: 'ES 220', name: 'Statics', cat: 'science', days: [1, 3, 5], hw: [3, 1], nowU: 1, units: [['Forces and moments', '2026-10-02', 'Exam 1', ['force vectors', 'moments', 'couples', 'equivalent systems']], ['Rigid bodies and structures', '2026-11-06', 'Exam 2', ['free-body diagrams', 'equilibrium', 'trusses', 'frames and machines']], ['Friction and centroids', '2026-12-08', 'Final', ['dry friction', 'centroids', 'moments of inertia']]],
      now: [
        ['owen', 'Owen P. ’28', 'Build a small truss at home, load it until it breaks, then work out why.', 4.8, 76, 2, 20, [2, 4], 'beam', ['Move the load along a beam', 'Free-body diagrams from real photos', 'Two-force members', 'Build a popsicle-stick truss', 'Method of joints on your truss', 'Method of sections', 'Why your truss failed', 'Frames and machines at home', 'Redesign and test again', 'Show your best truss']],
        ['priyas', 'Priya S. ’27', 'Real wrong answers. You find what went wrong.', 4.7, 133, 1, 18, [3], '', ['The free-body diagram with a force missing', 'The sign that flipped', 'The truss solved from the wrong joint', 'The frame taken apart wrong', 'The moment taken about the wrong point']],
        ['sofias', 'Sofia L. ’26', 'Record your solution. Classmates and I reply with what to try next.', 4.5, 47, 1, 11, [5], '', ['Record your free-body diagram', 'Reply: is this equilibrium right?', 'Record a truss, joint by joint', 'Reply: find the zero-force members', 'Group review before Exam 2']]]},
  ];
  const STYLES = [['A short video each day, then one hard question.', t => 'Video: ' + t], ['A group discussion with recorded replies.', t => 'Group: ' + t], ['You teach it to an AI student that keeps getting confused.', t => 'Teach back: ' + t], ['Old-exam problems, harder every day.', t => 'Drill: ' + t], ['The story of who needed this idea, and why.', t => 'Where this came from: ' + t], ['A mentor from the field walks through real work.', t => 'In real work: ' + t]];
  CLASSES.forEach(c => {
    let from = START;
    c.units = c.units.map(([n, end, exam, topics], i) => { const e = D(end), u = {i, n, from, end: e, exam, topics}; from = add(e, 1); return u; });
    const k = c.units.findIndex(u => TODAY <= u.end); c.cur = k < 0 ? c.units.length - 1 : k;
    c.hwt = []; for (let w = 2; w <= 15; w += c.hw[1]) { const d = add(START, (w - 1) * 7 + c.hw[0] - 1); if (!BREAKS.has(key(d)) && !c.units.some(u => key(u.end) === key(d))) c.hwt.push(d); }
    c.units.forEach(u => {
      if (u.i === c.nowU) { u.tutors = c.now.map(([id, w, how, r, n, p, age, days, demo, lessons]) => ({id, u: u.i, w, how, r, n, p, age, days, demo, lessons})); return; }
      const seed = c.code + u.n, later = u.end > TODAY && u.i > c.cur, count = later ? 2 : 4, base = Math.floor(rnd(seed) * 10);
      u.tutors = Array.from({length: count}, (_, i) => {
        const x = rnd(seed + i), s = STYLES[(base + i) % 6], picks = u.topics.filter((t, j) => rnd(seed + i + t) > .25 || j < 2);
        return {id: seed + i, u: u.i, w: NAMES[(base + i * 3) % 10], how: s[0], r: +(4.2 + x * .7).toFixed(1), n: Math.round((later ? 8 : 40) + x * (later ? 30 : 260)), p: x > .5 ? 2 : 1, age: Math.round(5 + x * 260), days: i % 2 ? [2, 5] : [1, 4], lessons: picks.map(s[1])};
      });
    });
  });
  const cls = code => CLASSES.find(c => c.code === code);
  /* Each teacher has their own lessons, each on its own topic, spread over their days in the unit. */
  function lessonDates(u, t) {
    if (t.plan) return t.plan;
    const all = []; for (let d = u.from; d < u.end; d = add(d, 1)) if (t.days.includes(d.getDay()) && !BREAKS.has(key(d))) all.push(d);
    const titles = t.lessons || u.topics, n = Math.min(titles.length, all.length);
    return (t.plan = Array.from({length: n}, (_, k) => ({d: all[Math.floor(k * all.length / n)], t: titles[k]})));
  }
    const initials = w => w.split(' ').slice(0, 2).map(x => x[0]).join('');

  /* ---------- state ---------- */
  const P = {scr: load('joined', false) ? 'school' : 'find', joined: load('joined', false), verified: load('verified', false), code: false, query: '', cquery: '', classes: load('classes', []).filter(k => CLASSES.some(c => c.code === k)), enrolled: load('enrolled', {}), stars: load('stars', {}), cur: 'MA 132', unit: 2, sort: 'rated', whole: false, others: false, done: load('done', {}), day: null, sheet: null, demo: null, r: .5, ohm: 470, read: 0, pos: 5, rec: false, said: false, wrong: '', solved: false};
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
  const myStrip = () => { const rows = CLASSES.flatMap(c => c.units.flatMap(u => myFor(c, u).map(l => ({c, u, l})))); return rows.length ? `<span class="cv-lab" style="margin:0">What you're building</span><div class="pl-list">${rows.map(({c, u, l}) => `<a class="pl-mine" href="${studioLink(l)}"><span class="tx"><em class="${l.shared ? 'pub' : ''}">${esc(c.name)}, Unit ${u.i + 1} · ${statusOf(l)}</em><b>${esc(shortTitle(c, u, l))}</b></span><span class="go">Keep building ›</span></a>`).join('')}</div>` : ''; };
  const buildLink = (c, u) => 'studio.html?from=places&new=' + encodeURIComponent(c.name + ', Unit ' + (u.i + 1) + ': my way');

  /* ---------- screens ---------- */
  const back = (act, label) => `<button type="button" class="cv-back" data-pa="${act}" aria-label="${label || 'Back'}">‹</button>`;
  function placesS() {
    return `<div class="cv-head"><h1>Places</h1></div><div class="pl-cards">
      <button type="button" class="pl-card" data-pa="school">${ROOF}<b>Halden University</b><span>Fall 2026</span></button>
      <button type="button" class="pl-card add" data-pa="find">${LOT}<b>Add a place</b><span>A school, a company, a club</span></button></div>
      ${myStrip()}
      <p class="cv-muted cv-center cv-foot">Demo: a made-up school, with sample classes, tutors and prices.</p>`;
  }
  function findS() {
    const q = P.query.trim().toLowerCase(), hit = !q || 'halden university'.includes(q);
    return `<div class="cv-head">${P.joined ? back('places') : ''}<h1${P.joined ? ' class="sm"' : ''}>Find your university</h1></div>
      <label class="cv-search">${SEARCH}<input id="pl-q" type="search" placeholder="Search schools" value="${esc(P.query)}" autocomplete="off"></label>
      ${hit ? '<button type="button" class="pl-row" data-pa="email"><span><b>Halden University</b><span>38 classes have student-made lessons</span></span><em>›</em></button>' : '<p class="cv-muted">No school by that name in this demo. Try Halden.</p>'}
      <p class="cv-muted cv-center cv-foot">Demo: a made-up school, with sample classes, tutors and prices.</p>`;
  }
  function emailS() {
    return `<div class="cv-head">${back('find')}<h1 class="sm">Halden University</h1></div>
      <div class="pl-narrow">${ROOF}
      ${P.code ? '<p class="cv-center" style="margin:0">Enter the code we sent to your school email.</p><div class="pl-code"><i>4</i><i>8</i><i>2</i><i>1</i></div><button type="button" class="cv-pill wide" data-pa="verified">Confirm</button>' : '<p class="cv-center" style="margin:0">Use your school email so we know you\'re a student here.</p><input class="cv-codein" id="pl-email" type="email" placeholder="you@halden.edu" autocomplete="off"><button type="button" class="cv-pill wide" data-pa="sendcode">Send me a code</button>'}
      <button type="button" class="cv-pill ghost wide" data-pa="look">Just look around</button>
      <p class="cv-muted cv-center" style="margin:0;font-size:12.5px">Demo: no email is sent.</p></div>`;
  }
  function addS() {
    const q = P.cquery.trim().toLowerCase(), list = CLASSES.filter(c => !q || (c.name + ' ' + c.code).toLowerCase().includes(q));
    return `<div class="cv-head">${back(P.classes.length ? 'school' : 'find')}<h1 class="sm">What are you taking?</h1></div>
      <label class="cv-search">${SEARCH}<input id="pl-cq" type="search" placeholder="Search a class or code" value="${esc(P.cquery)}" autocomplete="off"></label>
      <div id="pl-clist" class="pl-list">${classRows(list)}</div>
      <button type="button" class="cv-pill wide" data-pa="school"${P.classes.length ? '' : ' disabled'}>Done</button>`;
  }
  const classRows = list => list.length ? list.map(c => `<button type="button" class="pl-row${P.classes.includes(c.code) ? ' pick' : ''}" data-pa="pickc" data-c="${c.code}" aria-pressed="${P.classes.includes(c.code)}"><span><b>${c.name}</b><span>${c.code}</span></span><i class="pl-tick">${P.classes.includes(c.code) ? '✓' : ''}</i></button>`).join('') : '<p class="cv-muted">No class by that name in this demo.</p>';
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
    return `<div class="cv-head">${back('places')}<h1 class="sm">Halden University</h1></div>
      <div class="pl-sub">${ROOF}<span class="cv-muted">Fall 2026 · week ${WEEK} of 15</span></div>
      ${myStrip()}
      <span class="cv-lab" style="margin:0">Your classes</span>
      <div class="pl-lines">${CLASSES.filter(c => P.classes.includes(c.code)).map(c => `<button type="button" class="pl-line" data-pa="open" data-c="${c.code}"><span class="info"><span class="n"><b>${c.name}</b><span>${c.code}</span></span><span class="next">${nextLine(c)}</span></span>${termLine(c)}</button>`).join('')}</div>
      <div class="pl-legend"><span><i class="lx"></i>Exam</span><span><i class="lh"></i>Homework</span><span><i class="ln"></i>Today</span>${any ? '<span><i class="ld"></i>Your lessons</span>' : ''}</div>
      <button type="button" class="cv-pill ghost" style="justify-self:start" data-pa="add">Add a class</button>
      <p class="cv-muted cv-center cv-foot">Demo: a made-up school, with sample classes, tutors and prices. Saved on this device only.</p>`;
  }
  function termBar(c) {
    const n = pos(TODAY), mo = [['Sep', '2026-09-01'], ['Oct', '2026-10-01'], ['Nov', '2026-11-01'], ['Dec', '2026-12-01']];
    return `<div class="pl-tb">${c.units.map(u => `<button type="button" class="seg${u.i === P.unit ? ' on' : ''}" data-pa="unit" data-u="${u.i}" aria-pressed="${u.i === P.unit}" style="left:${pos(u.from)}%;width:${pos(u.end) - pos(u.from)}%">Unit ${u.i + 1}${myFor(c, u).length ? '<i class="bm" title="You\'re building a lesson here"></i>' : ''}</button>`).join('')}
      <i class="past" style="width:${n}%"></i><i class="fut" style="width:${100 - n}%"></i>${c.hwt.map(d => `<i class="hw" style="left:${pos(d)}%"></i>`).join('')}${myDots(c).map(d => `<i class="dot" style="left:${pos(d)}%"></i>`).join('')}${c.units.map(u => `<i class="ex${u.end < TODAY ? ' done' : ''}" style="left:${pos(u.end)}%"></i>`).join('')}<i class="now" style="left:${n}%"></i>
      ${mo.map(([l, d]) => `<span class="mo" style="left:${pos(D(d))}%">${l}</span>`).join('')}</div>`;
  }
  const sorted = (c, u) => { const by = {rated: (a, b) => b.r - a.r, taken: (a, b) => b.n - a.n, newest: (a, b) => a.age - b.age}[P.sort]; const ids = mine(c, u.i); return u.tutors.slice().sort(by).sort((a, b) => ids.includes(b.id) - ids.includes(a.id)); };
  const row = (c, u, t) => { const on = mine(c, u.i).includes(t.id); return `<button type="button" class="pl-tutor${on ? ' yours' : ''}" data-pa="tutor" data-u="${u.i}" data-id="${esc(t.id)}"><span class="ava">${initials(t.w)}</span><span class="nm"><b>${t.w}</b><span>${t.how}</span></span><span class="sc"><span>★ ${t.r.toFixed(1)}</span><em>${t.n} students</em><span>$${t.p}</span></span></button>`; };
  const isMine = l => (deps.my() || []).some(m => m.id === l.id);
  const realRow = (c, u, l) => `<a class="pl-tutor real" href="${deps.playLink(l.id)}"><span class="ava">▶</span><span class="nm"><b>${esc(l.title.slice((c.name + ', Unit ' + (u.i + 1)).length).replace(/^[:\s]+/, '') || l.title)}</b><span>${isMine(l) ? 'Your lesson, as students see it' : 'A real lesson, built in Teacher Studio'}</span></span><span class="sc"><span>New</span><em>Free for now</em></span></a>`;
  const sortBtns = () => [['rated', 'Top rated'], ['taken', 'Most taken'], ['newest', 'Newest']].map(([k, l]) => `<button type="button" class="${P.sort === k ? 'on' : ''}" data-pa="sort" data-k="${k}">${l}</button>`).join('');
  const listBlock = (c, u, mode) => { const real = realFor(c, u); return `<div class="pl-tlist">${real.map(l => realRow(c, u, l)).join('')}${sorted(c, u).filter(t => mode === 'all' || !mine(c, u.i).includes(t.id)).map(t => row(c, u, t)).join('')}</div>`; };
  const COLORS = ['ok', 'acc', 'vi'];
  /* A unit you've taken: the same line as the term, zoomed to this unit. One lane per teacher; tap a lesson. */
  const doneKey = (t, d) => t.id + '|' + key(d);
  function zoomBar(c, u, tutors) {
    const span = u.end - u.from, zp = d => Math.max(0, Math.min(100, (d - u.from) / span * 100)), n = zp(TODAY), hasNow = TODAY >= u.from && TODAY <= u.end;
    const lanes = tutors.map((t, ti) => {
      const dots = lessonDates(u, t).map(l => { const k = doneKey(t, l.d), sel = P.day === k, done = P.done[k]; return `<button type="button" class="ldot ${COLORS[ti % 3]}${done ? ' done' : ''}${sel ? ' sel' : ''}" style="left:${zp(l.d)}%" data-pa="day" data-k="${k}" aria-label="${fmt(l.d)}: ${esc(l.t)}, ${t.w}${done ? ', done' : ''}" aria-pressed="${sel}"><i></i></button>`; }).join('');
      return `<div class="pl-lane">${tutors.length > 1 ? `<span class="who"><i class="${COLORS[ti % 3]}"></i>${t.w}</span>` : ''}<div class="track"><i class="past" style="width:${u.end < TODAY ? 100 : hasNow ? n : 0}%"></i><i class="fut" style="width:${u.end < TODAY ? 0 : hasNow ? 100 - n : 100}%"></i>${dots}<i class="ex${u.end < TODAY ? ' done' : ''}" style="left:100%"></i></div></div>`;
    }).join('');
    const weeks = []; for (let d = u.from, i = 0; d < u.end; d = add(d, 7), i++) weeks.push(d);
    const step = Math.ceil(weeks.length / 4);
    return `<div class="pl-zb"><div class="in">${hasNow ? `<i class="pl-nowline" style="left:${n}%"></i>` : ''}${lanes}
      <div class="axis">${c.hwt.filter(d => d >= u.from && d <= u.end).map(d => `<i class="hw" style="left:${zp(d)}%"></i>`).join('')}${weeks.filter((_, i) => i % step === 0).map(d => `<span style="left:${zp(d)}%">${fmtS(d)}</span>`).join('')}<span class="end">${esc(u.exam)}</span></div></div></div>`;
  }
  function lessonCard(c, u, tutors) {
    const all = tutors.flatMap(t => lessonDates(u, t).map(l => ({t, l}))), x = all.find(a => doneKey(a.t, a.l.d) === P.day); if (!x) return '';
    const k = P.day, done = P.done[k], today = key(x.l.d) === key(TODAY);
    return `<article class="pl-lesson"><span class="when">${fmt(x.l.d)}${today ? ' · Today' : ''}</span><h2>${esc(x.l.t)}</h2><div class="by"><span class="ava">${initials(x.t.w)}</span><span>${x.t.w}</span></div>
      <p class="how">${x.t.how}</p>
      <div class="acts">${startBtn(x.t, x.l.t)}<button type="button" class="pl-donebtn${done ? ' on' : ''}" data-pa="done" aria-pressed="${!!done}">${done ? '✓ Done' : 'Mark as done'}</button></div></article>`;
  }
  const startBtn = (t, topic) => { return t.demo ? `<button type="button" class="cv-pill" data-pa="demo" data-d="${t.demo}">Start</button>` : `<button type="button" class="cv-pill" data-pa="voice" data-topic="${esc(cls(P.cur).name + ': ' + topic)}">Start</button>`; };
  const buildBtn = (c, u) => `<a class="pl-build" href="${buildLink(c, u)}">Build your own</a>`;
  function classS() {
    const c = cls(P.cur), u = c.units[P.unit], tutors = myTutors(c, P.unit), rated = P.stars[c.code + P.unit];
    const todayBtn = P.unit !== c.cur ? `<button type="button" class="pl-todaybtn" data-pa="unit" data-u="${c.cur}"><i></i>Today</button>` : '';
    const head = `<div class="cv-head">${back('school')}<h1 class="sm">${c.name}</h1><span style="flex:1"></span>${todayBtn}</div>`;
    const title = `<div class="pl-ut"><b>Unit ${u.i + 1} · ${u.n}</b><span>${fmtS(u.from)} to ${esc(u.exam)}, ${fmtS(u.end)}</span></div>`;
    if (tutors.length) {
      const others = u.tutors.length - tutors.length, nav = `<div class="pl-unav"><button type="button" class="cv-back" data-pa="unit" data-u="${P.unit - 1}" aria-label="Previous unit"${P.unit ? '' : ' disabled'}>‹</button>${title}<button type="button" class="cv-back" data-pa="unit" data-u="${P.unit + 1}" aria-label="Next unit"${P.unit < c.units.length - 1 ? '' : ' disabled'}>›</button></div>`;
      return `${head}${nav}
        ${myCard(c, u)}
        ${P.whole ? termBar(c) : zoomBar(c, u, tutors)}
        <div class="pl-under"><button type="button" class="pl-linkb" data-pa="whole">${P.whole ? 'Back to this unit' : 'See the whole term'}</button></div>
        ${lessonCard(c, u, tutors)}
        ${u.end < TODAY ? tutors.map(t => `<div class="pl-rate"><b>How was ${t.w}?</b><div class="pl-stars" role="group" aria-label="Rate ${t.w}">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${(rated || 0) >= n ? 'on' : ''}" data-pa="star" data-n="${n}" aria-label="${n} stars">★</button>`).join('')}</div></div>`).join('') : ''}
        <div class="pl-under spread"><button type="button" class="pl-linkb" data-pa="others" aria-expanded="${P.others}">${P.others ? 'Hide other teachers' : `Other teachers for this unit (${others})`}</button>${buildBtn(c, u)}</div>
        ${P.others ? listBlock(c, u, 'others') : ''}`;
    }
    return `${head}${termBar(c)}${title}
      ${myCard(c, u)}
      <div class="pl-lhead"><div class="pl-sorts">${sortBtns()}</div>${buildBtn(c, u)}</div>
      ${listBlock(c, u, 'all')}<p class="cv-muted cv-center cv-foot">Demo: sample teachers, prices and numbers. Nothing is charged.</p>`;
  }
  function sheetH() {
    if (!P.sheet) return '';
    const c = cls(P.cur), u = c.units[P.sheet.u], t = u.tutors.find(x => x.id === P.sheet.id); if (!t) return '';
    const on = mine(c, u.i).includes(t.id), list = lessonDates(u, t), late = u.end >= TODAY && list.some(l => l.d < TODAY), x = rnd(t.w + u.n), started = u.from <= TODAY;
    return `<div class="cv-ov" data-pa="closesheet"><div class="cv-sheet pl-sheet" role="dialog" aria-modal="true" aria-label="${t.w}"><span class="grab"></span><button type="button" class="cv-x" data-pa="closesheet" aria-label="Close">✕</button>
      <div class="pl-who"><span class="ava">${initials(t.w)}</span><h3>${t.w}</h3></div><p style="margin:0">${t.how}</p>
      ${started ? `<div class="pl-stats"><div><b>★ ${t.r.toFixed(1)}</b><span>${t.n} students</span></div><div><b>${Math.round(72 + x * 24)}%</b><span>finished the unit</span></div><div><b>+${Math.round(2 + x * 7)}</b><span>exam points vs. the class</span></div></div><p class="cv-muted" style="margin:0;font-size:12.5px">Exam points come from students who chose to share their grades. Sample numbers.</p>` : ''}
      <span class="cv-lab" style="margin:0">${list.length} lessons</span><div class="pl-dates">${list.map(l => `<div class="${l.d < TODAY && u.end >= TODAY ? 'done' : ''}"><time>${fmt(l.d)}</time><span>${esc(l.t)}</span></div>`).join('')}</div>
      ${late && !on ? '<p class="cv-muted" style="margin:0;font-size:12.5px">Starting late? Earlier lessons wait for you.</p>' : ''}
      <div class="cv-row" style="flex-wrap:wrap">${t.demo ? `<button type="button" class="cv-pill ghost" data-pa="demo" data-d="${t.demo}">Try a demo</button>` : ''}${on ? '<button type="button" class="cv-pill ghost" data-pa="drop">Leave this tutor</button>' : `<button type="button" class="cv-pill" data-pa="take">Take Unit ${u.i + 1} · $${t.p}</button>`}</div>
    </div></div>`;
  }
  const barsH = () => { const r = P.r, lim = 1 / (1 - r), m = Math.max(lim, 2) * 1.08; let s = 0, o = ''; for (let n = 0; n < 12; n++) { s += Math.pow(r, n); o += `<i style="height:${s / m * 100}%"></i>`; } return o + `<div class="limit" style="bottom:${lim / m * 100}%"><span>Stops at ${lim.toFixed(2)}</span></div>`; };
  const circOut = () => { const I = 7 / P.ohm * 1000, hot = I > 20; return `<div class="led" style="opacity:${Math.max(.15, Math.min(1, I / 20))}"></div><p class="cv-center" style="margin:0"><b>${P.ohm} Ω</b> · ${I.toFixed(0)} mA</p><p class="cv-muted cv-center" style="margin:0">${hot ? 'Too much current. A real LED would burn out above about 20 mA.' : 'Safe. Now build it with the parts in your kit.'}</p>`; };
  const STATEMENT = [['Cash from operations $420M. Net income $610M.', 'Profit looks great, but less cash came in. I always ask why first.'], ['Debt due this year $900M. Cash on hand $300M.', 'Can they pay it? This is the second thing I look at.'], ['Footnote 4: revenue is now counted earlier.', 'Did the rules change, or did the business? People skip the footnotes. Don’t.']];
  const beamOut = () => { const x = P.pos, l = 10 - x, r = x; return `<div class="pl-beam"><i class="load" style="left:${x * 10}%"><b>10 kN</b></i><i class="bar"></i><i class="sup l"></i><i class="sup r"></i></div><div class="pl-reac"><span><b>${l.toFixed(1)} kN</b> left support</span><span><b>${r.toFixed(1)} kN</b> right support</span></div><p class="cv-muted" style="margin:0">${x === 5 ? 'In the middle, each support carries half.' : 'The closer support carries more. Why?'}</p>`; };
    const TITLES = {sliders: 'Geometric series', voice: 'Geometric series', mistake: 'Geometric series', group: 'Study group', circuit: 'Your first circuit', statement: 'Reading a company', beam: 'Move the load'};
  function demoS() {
    const d = P.demo; let b;
    if (d === 'voice') b = `<div class="pl-orb" aria-hidden="true"></div><div class="pl-bub">Add 1/2 + 1/4 + 1/8 and keep going forever. Why doesn't it blow up?</div>${P.said ? `<div class="pl-bub you">Because the pieces keep getting smaller.</div><div class="pl-bub">So do the pieces of 1 + 1/2 + 1/3 + 1/4, and that one never stops growing. So what's different?</div>` : '<button type="button" class="cv-pill wide" data-pa="said">Hold to talk</button>'}<p class="cv-muted cv-center" style="margin:0">Sample conversation. No sound in this demo.</p>`;
    else if (d === 'mistake') b = `<p class="pl-q">Someone added 3 + 3/2 + 3/4 + … and got 2. Tap the line that's wrong.</p>${[['a', 'First term: a = 3'], ['b', 'Each term is half the last: r = 1/2'], ['c', 'Sum = a / (1 + r)'], ['d', '3 / 1.5 = 2']].map(([k, l]) => `<button type="button" class="pl-mis${P.solved && k === 'c' ? ' good' : ''}" data-pa="mis" data-k="${k}">${l}</button>`).join('')}${P.solved ? '<div class="pl-bub">Yes. It\'s a / (1 − r), so the sum is 6. The first term alone is already 3, so 2 was never possible.</div>' : P.wrong ? '<p class="cv-muted" style="margin:0">That line is fine. Keep looking.</p>' : ''}`;
    else if (d === 'group') b = `<p class="pl-q">In one minute: why can adding forever give a finite total?</p>${[['Ana', '0:52'], ['Ben', '1:00']].map(([n, l]) => `<div class="pl-clip"><span class="ava">${n[0]}</span><b>${n}</b><span class="wave" aria-hidden="true"></span><em>${l}</em></div>`).join('')}${P.rec ? '<div class="pl-clip me"><span class="ava">You</span><b>You</b><span class="wave" aria-hidden="true"></span><em>0:47</em></div><p class="cv-muted" style="margin:0">Now reply to one classmate. Sample: nothing was recorded.</p>' : '<button type="button" class="cv-pill wide" data-pa="rec">Record your minute</button>'}`;
    else if (d === 'circuit') b = `<p class="pl-q">9-volt battery, one LED, one resistor. Pick the resistor.</p><div data-circ class="pl-narrow" style="gap:6px">${circOut()}</div><input type="range" min="100" max="1000" step="10" value="${P.ohm}" data-ohm aria-label="Resistor in ohms"><p class="cv-muted" style="margin:0">Noah's simulation. The real lesson also mails you the parts.</p>`;
    else if (d === 'statement') b = `<p class="pl-q">What I read first, in order.</p><div class="pl-bub you wide"><b>${STATEMENT[P.read][0]}</b></div><div class="pl-bub">${STATEMENT[P.read][1]}</div><p class="cv-muted" style="margin:0">Grace's uncle, recorded. Made-up company.</p>${P.read < 2 ? '<button type="button" class="cv-pill wide" data-pa="readn">Next</button>' : '<p style="margin:0;font-weight:600">Now you read one on your own.</p>'}`;
    else if (d === 'beam') b = `<p class="pl-q">A 10 kN load sits on a 10-meter beam. Move it. What does each support carry?</p><div data-beamout>${beamOut()}</div><input type="range" min="0" max="10" step="0.5" value="${P.pos}" data-beam aria-label="Where the load sits, in meters"><p class="cv-muted" style="margin:0">Owen's first lesson. Later you build a truss at home and test it.</p>`;
    else b = `<p class="pl-q">Keep adding forever. Each step adds r times the last step. Does the total ever stop growing?</p><div class="pl-bars" data-bars>${barsH()}</div><p class="cv-muted" style="margin:0">Slide r: <b data-rv>${P.r.toFixed(2)}</b></p><input type="range" min="0.1" max="0.9" step="0.05" value="${P.r}" data-range aria-label="Ratio r"><p class="cv-muted" style="margin:0">Now try 0.9. It takes much longer, and it still stops.</p>`;
    return `<div class="cv-head">${back('closedemo')}<h1 class="sm">${TITLES[d]}</h1></div><span class="cv-muted">Demo of a student's lesson</span><div class="pl-demo">${b}</div>`;
  }
  const SCREENS = {places: placesS, find: findS, email: emailS, add: addS, school: schoolS, class: classS, demo: demoS};

  /* ---------- what Explore borrows ---------- */
  const allTutors = () => CLASSES.flatMap(c => c.now.map(n => { const u = c.units[c.nowU]; return u.tutors.find(t => t.id === n[0]) && {c, u, t: u.tutors.find(t => t.id === n[0])}; }));
  function teachers(cat) {
    const by = {}; allTutors().filter(x => !cat || x.c.cat === cat).forEach(x => { const k = x.t.w; (by[k] = by[k] || {w: k, items: [], n: 0, sum: 0}).items.push(x); by[k].n += x.t.n; by[k].sum += x.t.r * x.t.n; });
    return Object.values(by).map(t => Object.assign(t, {r: t.sum / t.n})).sort((a, b) => b.r - a.r);
  }

  /* ---------- API for courses.js ---------- */
  window.WorldviewPlaces = {
    init(d) { deps = Object.assign(deps, d); },
    initials, teachers, allTutors,
    html() { return (SCREENS[P.scr] || findS)() + sheetH(); },
    afterRender() {},
    home() { if (P.scr === 'demo' || P.sheet) { P.sheet = null; P.demo = null; } P.scr = P.joined ? 'places' : 'find'; deps.render(); },
    openTutor(code, u, id) { P.joined = true; save('joined', true); if (!P.classes.includes(code)) { P.classes = P.classes.concat(code); save('classes', P.classes); } openClass(code, u); P.sheet = {u, id}; },
    escape() { if (P.sheet) { P.sheet = null; deps.render(); return true; } if (P.scr === 'demo') { act('closedemo'); return true; } return false; },
    input(e) {
      const id = e.target.id;
      if (id === 'pl-q') { P.query = e.target.value; const pos2 = e.target.selectionStart; deps.render(); const i = document.getElementById('pl-q'); if (i) { i.focus(); try { i.setSelectionRange(pos2, pos2); } catch (x) {} } return; }
      if (id === 'pl-cq') { P.cquery = e.target.value; const q = P.cquery.trim().toLowerCase(), o = document.getElementById('pl-clist'); if (o) o.innerHTML = classRows(CLASSES.filter(c => !q || (c.name + ' ' + c.code).toLowerCase().includes(q))); return; }
      if (e.target.matches('[data-beam]')) { P.pos = +e.target.value; const b = document.querySelector('[data-beamout]'); if (b) b.innerHTML = beamOut(); return; }
      if (e.target.matches('[data-ohm]')) { P.ohm = +e.target.value; const b = document.querySelector('[data-circ]'); if (b) b.innerHTML = circOut(); return; }
      if (e.target.matches('[data-range]')) { P.r = +e.target.value; const b = document.querySelector('[data-bars]'), v = document.querySelector('[data-rv]'); if (b) b.innerHTML = barsH(); if (v) v.textContent = P.r.toFixed(2); }
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
    const u = c.units[P.unit], all = myTutors(c, P.unit).flatMap(t => lessonDates(u, t).map(l => ({k: doneKey(t, l.d), d: l.d}))).sort((a, b) => a.d - b.d);
    const next = all.find(x => x.d >= TODAY && !P.done[x.k]) || all[all.length - 1]; P.day = next ? next.k : null;
  }
  function act(a, d = {}) {
    const c = cls(P.cur);
    const top = () => { const v = document.getElementById('courses-view'); if (v) v.scrollTop = 0; };
    switch (a) {
      case 'places': P.scr = 'places'; top(); break;
      case 'find': P.scr = 'find'; P.code = false; top(); break;
      case 'email': P.scr = 'email'; top(); break;
      case 'sendcode': P.code = true; break;
      case 'verified': P.verified = true; save('verified', true); P.joined = true; save('joined', true); P.scr = P.classes.length ? 'school' : 'add'; top(); break;
      case 'look': P.joined = true; save('joined', true); P.scr = P.classes.length ? 'school' : 'add'; top(); break;
      case 'add': P.scr = 'add'; P.cquery = ''; top(); break;
      case 'pickc': { const k = d.c; P.classes = P.classes.includes(k) ? P.classes.filter(x => x !== k) : P.classes.concat(k); save('classes', P.classes); break; }
      case 'school': if (!P.classes.length) { P.scr = 'add'; break; } P.scr = 'school'; P.sheet = null; top(); break;
      case 'open': openClass(d.c); top(); break;
      case 'unit': { const u = +d.u; if (u < 0 || u >= c.units.length) return; P.unit = u; P.whole = false; P.others = false; pickDay(c); P.sheet = null; break; }
      case 'whole': P.whole = !P.whole; break;
      case 'others': P.others = !P.others; break;
      case 'done': if (P.day) { if (P.done[P.day]) delete P.done[P.day]; else { P.done[P.day] = 1; const u = c.units[P.unit], all = myTutors(c, P.unit).flatMap(t => lessonDates(u, t).map(l => ({k: doneKey(t, l.d), d: l.d}))).sort((a, b) => a.d - b.d), i = all.findIndex(x => x.k === P.day), nx = all.slice(i + 1).find(x => !P.done[x.k]); if (nx) P.day = nx.k; } save('done', P.done); } break;
      case 'day': P.day = d.k; break;
      case 'sort': P.sort = d.k; break;
      case 'tutor': P.sheet = {u: +d.u, id: d.id}; break;
      case 'closesheet': P.sheet = null; break;
      case 'take': { const {u, id} = P.sheet; const e = P.enrolled[c.code] = P.enrolled[c.code] || {}; e[u] = (e[u] || []).concat(id); save('enrolled', P.enrolled); P.sheet = null; P.unit = u; P.whole = false; pickDay(c); deps.render(); top(); deps.toast('You\'re in. Tap a day to see its lesson. (Demo: nothing was charged.)'); return; }
      case 'drop': { const {u, id} = P.sheet, e = P.enrolled[c.code] || {}; e[u] = (e[u] || []).filter(x => x !== id); P.enrolled[c.code] = e; save('enrolled', P.enrolled); P.sheet = null; pickDay(c); break; }
      case 'star': P.stars[c.code + P.unit] = +d.n; save('stars', P.stars); break;
      case 'demo': P.back = P.sheet; P.demo = d.d; P.sheet = null; P.said = false; P.wrong = ''; P.solved = false; P.read = 0; P.pos = 5; P.rec = false; P.scr = 'demo'; top(); break;
      case 'closedemo': P.demo = null; P.scr = 'class'; P.sheet = P.back || null; P.back = null; break;
      case 'voice': deps.startReal(d.topic); return;
      case 'said': P.said = true; break;
      case 'rec': P.rec = true; break;
      case 'readn': P.read = Math.min(2, P.read + 1); break;
      case 'mis': if (d.k === 'c') P.solved = true; else P.wrong = d.k; break;
    }
    deps.render();
  }
})();
