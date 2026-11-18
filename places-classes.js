/* The teacher's classes for the School tab and the slides page (v3.1.73).
   Classes are sample data for now, so a teacher's edits (name, short code, meeting days, colour) stay on this device (localStorage).
   A lesson is linked to its class by an id in the lesson's note (note.classId). Older lessons carry the class name in their title
   ("Financial Management, Unit 1: ..."); that still works, and a renamed class remembers its old names (aka) so nothing is orphaned. */
window.WorldviewClasses = (() => {
  const K = 'wv-places-myclasses';
  const COLORS = ['#2f7d5b', '#3b6fd4', '#8a5cc2', '#c2703a', '#b8466e', '#2f8f9d'];
  const COLOR_NAMES = ['Green', 'Blue', 'Purple', 'Orange', 'Rose', 'Teal'];
  const DEFAULT = () => [{id: 'fin', name: 'Financial Management', code: 'FI 301', days: [1, 3], color: 0, aka: []}];
  const WD = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const clean = c => ({id: String(c.id), name: String(c.name || 'Class').slice(0, 60), code: String(c.code || '').slice(0, 20), days: (Array.isArray(c.days) ? c.days : []).map(Number).filter(n => n >= 0 && n <= 6).filter((n, i, a) => a.indexOf(n) === i), color: Math.max(0, Math.min(COLORS.length - 1, +c.color || 0)), aka: (Array.isArray(c.aka) ? c.aka : []).map(String)});
  let cache = null;
  function list() {
    if (cache) return cache;
    let v = null; try { v = JSON.parse(localStorage.getItem(K)); } catch (e) {}
    cache = (Array.isArray(v) && v.length ? v : DEFAULT()).map(clean);
    cache.forEach(c => { if (!c.days.length) c.days = [1, 3]; });
    return cache;
  }
  const persist = () => { try { localStorage.setItem(K, JSON.stringify(cache)); } catch (e) {} };
  /* v3.1.87 (NAV-226): a teacher's classes are also kept on the server (worldview_classes), so students can join one with its
     code. The device copy stays the working copy and every change is sent to the server. A student's joined classes come from
     worldview_class_lessons() through setJoined and are kept apart. Only the owner's app calls attach. */
  let db = null, uid = '', codes = {}, members = {}, joined = [], busy = null;
  const row = c => ({owner_id: uid, local_id: c.id, name: c.name, code: c.code, days: c.days, color: c.color, aka: c.aka});
  async function attach(client, userId) {
    if (!client || !userId) return;
    if (db === client && uid === userId && busy) return busy;
    db = client; uid = userId;
    busy = (async () => {
      try {
        let {data, error} = await db.from('worldview_classes').select('id,local_id,join_code').eq('owner_id', uid);
        if (error) return;
        const have = new Set((data || []).map(r => r.local_id)), missing = list().filter(c => !have.has(c.id));
        if (missing.length) { const r = await db.from('worldview_classes').insert(missing.map(row)).select('id,local_id,join_code'); if (!r.error) data = (data || []).concat(r.data || []); }
        const ids = {}; (data || []).forEach(r => { codes[r.local_id] = r.join_code; ids[r.id] = r.local_id; });
        const ro = await db.rpc('worldview_class_roster'); (ro.data || []).forEach(r => { if (ids[r.class_id]) members[ids[r.class_id]] = r.members; });
      } catch (e) {}
    })();
    return busy;
  }
  const push = c => { if (db && uid && c) db.from('worldview_classes').upsert(row(c), {onConflict: 'owner_id,local_id'}).then(() => {}, () => {}); };
  const joinLink = id => codes[id] ? new URL('join.html?c=' + codes[id], location.href).href : '';
  const memberCount = id => members[id] || 0;
  function setJoined(rows) {
    const m = new Map(); (rows || []).forEach(r => { if (r && r.class_id && !m.has(r.class_id)) m.set(r.class_id, clean({id: r.class_id, name: r.class_name, code: r.class_code || '', days: r.days || [], color: r.color || 0, aka: []})); });
    joined = [...m.values()]; joined.forEach(c => { c.joined = true; if (!c.days.length) c.days = [1, 3]; });
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
    if (Array.isArray(patch.days) && patch.days.length) c.days = patch.days.map(Number).filter(n => n >= 0 && n <= 6).filter((n, i, a) => a.indexOf(n) === i);
    if (patch.color != null) c.color = Math.max(0, Math.min(COLORS.length - 1, +patch.color || 0));
    persist(); push(c); return c;
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
  const meetText = c => meetDays(c).map(n => WD[n]).join(' and ');
  const keyOf = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  /* The next day on or after `from` (default today) when the class meets, as "YYYY-MM-DD". */
  function nextMeetKey(c, from) {
    const t = from || new Date();
    for (let i = 0; i < 14; i++) { const d = new Date(t.getFullYear(), t.getMonth(), t.getDate() + i); if (c.days.includes(d.getDay())) return keyOf(d); }
    return keyOf(t);
  }
  return {list, studentList, setJoined, attach, joinLink, memberCount, get, update, ofLesson, plainTitle, meetDays, meetText, nextMeetKey, keyOf, COLORS, COLOR_NAMES, WD};
})();
