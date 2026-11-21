/* The teacher's classes for the School tab, the slides page and Teacher Studio (v3.1.73; on the server since v3.1.87, read back on every device since v3.1.91).
   This device keeps a working copy (localStorage); the server copy (worldview_classes) is what every device shows.
   A lesson is linked to its class by an id in the lesson's note (note.classId). Older lessons carry the class name in their title
   ("Financial Management, Unit 1: ..."); that still works, and a renamed class remembers its old names (aka) so nothing is orphaned. */
window.WorldviewClasses = (() => {
  const K = 'wv-places-myclasses';
  const COLORS = ['#2f7d5b', '#3b6fd4', '#8a5cc2', '#c2703a', '#b8466e', '#2f8f9d'];
  const COLOR_NAMES = ['Green', 'Blue', 'Purple', 'Orange', 'Rose', 'Teal'];
  const DEFAULT = () => [{id: 'fin', name: 'Financial Management', code: 'FI 301', days: [1, 3], color: 0, aka: []}];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const day = v => /^\d{4}-\d\d-\d\d$/.test(v || '') ? v : '';
  /* v3.1.94: a course may have no fixed days (days []), a first and last day (start, end, optional) and can be put away (archived). */
  const clean = c => ({id: String(c.id), name: String(c.name || 'Class').slice(0, 60), code: String(c.code || '').slice(0, 20), days: (Array.isArray(c.days) ? c.days : []).map(Number).filter(n => n >= 0 && n <= 6).filter((n, i, a) => a.indexOf(n) === i), color: Math.max(0, Math.min(COLORS.length - 1, +c.color || 0)), aka: (Array.isArray(c.aka) ? c.aka : []).map(String), start: day(c.start), end: day(c.end), archived: !!c.archived});
  let cache = null;
  function list() {
    if (cache) return cache;
    let v = null; try { v = JSON.parse(localStorage.getItem(K)); } catch (e) {}
    cache = (Array.isArray(v) && v.length ? v : DEFAULT()).map(clean);
    return cache;
  }
  const persist = () => { try { localStorage.setItem(K, JSON.stringify(cache)); } catch (e) {} };
  /* v3.1.87 (NAV-226): a teacher's classes are also kept on the server (worldview_classes), so students can join one with its
     code. The device copy stays the working copy and every change is sent to the server. A student's joined classes come from
     worldview_class_lessons() through setJoined and are kept apart. Only the owner's app calls attach. */
  let db = null, uid = '', codes = {}, members = {}, joined = [], busy = null, pulled = null;
  const row = c => ({owner_id: uid, local_id: c.id, name: c.name, code: c.code, days: c.days, color: c.color, aka: c.aka, starts_on: c.start || null, ends_on: c.end || null, archived: !!c.archived});
  const sid = {}; // the server id of each class (local id -> worldview_classes.id), for per-student days and the list of who joined
  /* v3.1.91 (BUG-537): the server copy is what every device shows. A change made on this device is remembered as "not sent yet"
     (wv-places-myclasses-dirty) until the server has it, so a change made offline is sent before the server copy is read back. */
  const DK = K + '-dirty';
  const dirty = () => { try { const v = JSON.parse(localStorage.getItem(DK)); return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const setDirty = v => { try { if (v.length) localStorage.setItem(DK, JSON.stringify(v)); else localStorage.removeItem(DK); } catch (e) {} };
  const COLS = 'id,local_id,name,code,days,color,aka,join_code,starts_on,ends_on,archived';
  /* Take the server's classes as this device's list (names, days, colours). Classes only on this device stay. */
  function adopt(rows) {
    if (!rows || !rows.length) return false;
    const cur = list(), byId = new Map(cur.map(c => [c.id, c])), wait = new Set(dirty());
    let changed = false;
    rows.forEach(r => {
      if (wait.has(r.local_id)) return;
      sid[r.local_id] = r.id;
      const s = clean({id: r.local_id, name: r.name, code: r.code, days: r.days, color: r.color, aka: r.aka, start: r.starts_on, end: r.ends_on, archived: r.archived});
      const c = byId.get(s.id);
      if (!c) { cur.push(s); byId.set(s.id, s); changed = true; return; }
      if (JSON.stringify(c) !== JSON.stringify(s)) { Object.assign(c, s); changed = true; }
    });
    if (changed) persist();
    return changed;
  }
  /* Read only: bring this account's classes from the server (Teacher Studio and the slides page). Never creates a class. */
  async function pull(client, userId) {
    if (!client || !userId) return false;
    if (pulled && db === client && uid === userId) return pulled;
    db = client; uid = userId;
    pulled = (async () => {
      try {
        await sendDirty();
        const {data, error} = await db.from('worldview_classes').select(COLS).eq('owner_id', uid);
        if (error) return false;
        (data || []).forEach(r => { codes[r.local_id] = r.join_code; });
        return adopt(data || []);
      } catch (e) { return false; }
    })();
    return pulled;
  }
  async function sendDirty() {
    const ids = dirty(); if (!ids.length || !db || !uid) return;
    const rows = list().filter(c => ids.includes(c.id)).map(row);
    if (!rows.length) { setDirty([]); return; }
    const {error} = await db.from('worldview_classes').upsert(rows, {onConflict: 'owner_id,local_id'});
    if (!error) setDirty([]);
  }
  /* The owner's School page: send waiting changes, read the server's classes, then put any class that is only on this device on the server. */
  async function attach(client, userId) {
    if (!client || !userId) return;
    if (db === client && uid === userId && busy) return busy;
    db = client; uid = userId;
    busy = (async () => {
      try {
        await sendDirty();
        let {data, error} = await db.from('worldview_classes').select(COLS).eq('owner_id', uid);
        if (error) return;
        adopt(data || []);
        const have = new Set((data || []).map(r => r.local_id)), missing = list().filter(c => !have.has(c.id));
        if (missing.length) { const r = await db.from('worldview_classes').insert(missing.map(row)).select(COLS); if (!r.error) data = (data || []).concat(r.data || []); }
        const ids = {}; (data || []).forEach(r => { codes[r.local_id] = r.join_code; ids[r.id] = r.local_id; sid[r.local_id] = r.id; });
        const ro = await db.rpc('worldview_class_roster'); (ro.data || []).forEach(r => { if (ids[r.class_id]) members[ids[r.class_id]] = r.members; });
      } catch (e) {}
    })();
    return busy;
  }
  const push = c => {
    if (!c) return;
    const d = dirty(); if (!d.includes(c.id)) setDirty(d.concat(c.id));
    if (db && uid) db.from('worldview_classes').upsert(row(c), {onConflict: 'owner_id,local_id'}).then(r => { if (r && !r.error) setDirty(dirty().filter(x => x !== c.id)); }, () => {});
  };
  const joinLink = id => codes[id] ? new URL('join.html?c=' + codes[id], location.href).href : '';
  const memberCount = id => members[id] || 0;
  function setJoined(rows) {
    const m = new Map(); (rows || []).forEach(r => { if (r && r.class_id && !m.has(r.class_id)) m.set(r.class_id, clean({id: r.class_id, name: r.class_name, code: r.class_code || '', days: r.days || [], color: r.color || 0, aka: []})); });
    joined = [...m.values()]; joined.forEach(c => { c.joined = true; });
  }
  /* The classes a student view shows: the owner sees their own (as before) and any they joined; anyone else only what they joined. */
  const studentList = owner => owner ? list().concat(joined.filter(j => !list().some(c => c.id === j.id))) : joined.slice();
  const get = id => list().find(c => c.id === id) || joined.find(c => c.id === id) || null;
  /* Save changes to a class. A new name keeps the old one in `aka` so lessons titled with it still find the class. */
  function update(id, patch) {
    const c = get(id); if (!c) return null;
    const name = (patch.name || '').trim();
    if (name && name !== c.name) { if (!c.aka.includes(c.name)) c.aka.push(c.name); c.name = name.slice(0, 60); }
    if (typeof patch.code === 'string') c.code = patch.code.trim().slice(0, 20);
    if (Array.isArray(patch.days)) c.days = patch.days.map(Number).filter(n => n >= 0 && n <= 6).filter((n, i, a) => a.indexOf(n) === i);
    if (patch.color != null) c.color = Math.max(0, Math.min(COLORS.length - 1, +patch.color || 0));
    if (patch.start !== undefined) c.start = day(patch.start);
    if (patch.end !== undefined) c.end = day(patch.end);
    if (patch.archived !== undefined) c.archived = !!patch.archived;
    persist(); push(c); return c;
  }
  /* v3.1.94: a new course. Its id is made here; the server adds the join code. */
  async function add(p) {
    list();
    const c = clean(Object.assign({id: 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), aka: []}, p));
    cache.push(c); persist(); setDirty(dirty().concat(c.id));
    if (db && uid) { try { const r = await db.from('worldview_classes').upsert(row(c), {onConflict: 'owner_id,local_id'}).select('id,local_id,join_code').single(); if (!r.error && r.data) { codes[c.id] = r.data.join_code; sid[c.id] = r.data.id; members[c.id] = 0; setDirty(dirty().filter(x => x !== c.id)); } } catch (e) {} }
    return c;
  }
  /* v3.1.94: who joined a course (teacher only), and per-student days for one lesson. */
  const PEOPLE = {};
  async function people(id, force) {
    if (PEOPLE[id] && !force) return PEOPLE[id];
    if (!db || !sid[id]) return [];
    try { const {data, error} = await db.rpc('worldview_class_people', {p_class: sid[id]}); if (error) return []; PEOPLE[id] = (data || []).map(r => ({id: r.user_id, name: r.name || 'Student'})); } catch (e) { return []; }
    return PEOPLE[id];
  }
  const peopleNow = id => PEOPLE[id] || null;
  async function dueFor(lessonId) {
    if (!db) return {};
    try { const {data, error} = await db.from('worldview_class_due').select('user_id,on_day').eq('lesson_id', lessonId); if (error) return null; const o = {}; (data || []).forEach(r => { o[r.user_id] = r.on_day; }); return o; } catch (e) { return null; }
  }
  async function setDue(classId, lessonId, userId, k) {
    if (!db || !sid[classId]) return false;
    try {
      const q = k ? db.from('worldview_class_due').upsert({class_id: sid[classId], lesson_id: lessonId, user_id: userId, on_day: k}, {onConflict: 'lesson_id,user_id'})
        : db.from('worldview_class_due').delete().eq('lesson_id', lessonId).eq('user_id', userId);
      const {error} = await q; return !error;
    } catch (e) { return false; }
  }
  const esc = s => String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const prefixRe = c => new RegExp('^(?:' + [c.name].concat(c.aka).map(esc).join('|') + '),\\s*unit\\s*\\d+', 'i');
  /* Which class a lesson row belongs to: its note's classId, else the old title prefix. */
  function ofLesson(l) {
    const n = l && l.note && typeof l.note === 'object' ? l.note : {};
    if (n.classId && get(n.classId)) return get(n.classId);
    return list().find(c => prefixRe(c).test((l && l.title) || '')) || null;
  }
  /* A lesson's name without the old "Class, Unit N:" prefix. */
  function plainTitle(c, t) {
    t = t || '';
    return t.replace(new RegExp('^(?:' + [c.name].concat(c.aka).map(esc).join('|') + '),\\s*unit\\s*\\d+\\s*[:\\-]?\\s*', 'i'), '') || t;
  }
  const meetDays = c => c.days.slice().sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7));
  const meetText = c => c.days.length ? meetDays(c).map(n => WD[n]).join(' and ') : '';
  const keyOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* The next day on or after `from` (default today) when the class meets, as "YYYY-MM-DD". */
  function nextMeetKey(c, from) {
    const t = from || new Date();
    for (let i = 0; i < 14; i++) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i); if (c.days.includes(d.getDay())) return keyOf(d); }
    return keyOf(t);
  }
  return {list, studentList, setJoined, attach, pull, add, people, peopleNow, dueFor, setDue, joinLink, memberCount, get, update, ofLesson, plainTitle, meetDays, meetText, nextMeetKey, keyOf, COLORS, COLOR_NAMES, WD};
})();
