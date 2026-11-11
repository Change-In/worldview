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
  const get = id => list().find(c => c.id === id) || null;
  /* Save changes to a class. A new name keeps the old one in `aka` so lessons titled with it still find the class. */
  function update(id, patch) {
    const c = get(id); if (!c) return null;
    const name = (patch.name || '').trim();
    if (name && name !== c.name) { if (!c.aka.includes(c.name)) c.aka.push(c.name); c.name = name.slice(0, 60); }
    if (typeof patch.code === 'string') c.code = patch.code.trim().slice(0, 20);
    if (Array.isArray(patch.days) && patch.days.length) c.days = patch.days.map(Number).filter(n => n >= 0 && n <= 6).filter((n, i, a) => a.indexOf(n) === i);
    if (patch.color != null) c.color = Math.max(0, Math.min(COLORS.length - 1, +patch.color || 0));
    persist(); return c;
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
  return {list, get, update, ofLesson, plainTitle, meetDays, meetText, nextMeetKey, keyOf, COLORS, COLOR_NAMES, WD};
})();
