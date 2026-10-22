/* Lessons over several days (NAV-198). A lesson folder can hold Day 1 (its index.html),
   day-2/index.html, day-3/index.html … and a days.json the teacher's AI keeps:
     {"days": [{"title": "Your starting views"}, {"title": "Chips", "folder": "day-2"}],
      "timing": {"waitHours": 20, "withinDays": 3, "graceDays": 1, "missed": "restart"}}
   waitHours: how long after finishing a day the next one opens. withinDays: the next day must be
   started within this many days (0 = no deadline). graceDays: extra days that still count, marked
   late. missed: "restart" (start again from Day 1) or "continue" (carry on, marked late).
   Used by play.html (students) and studio.html (the teacher trying each day). The official record
   lives on Worldview (worldview_teacher_lesson_day_save); the student's own copy (a download, or a
   folder on a computer) is theirs to change and is never read back. */
(function () {
  'use strict';
  var HOUR = 3600e3, DAY = 24 * HOUR;
  var num = function (v, lo, hi, d) { v = +v; return isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d; };
  var clip = function (s, n) { return String(s == null ? '' : s).slice(0, n); };

  // days.json → {days: [{n, title, folder}], timing}, or null when the lesson isn't over several days.
  function normalize(j) {
    if (!j || !Array.isArray(j.days) || !j.days.length) return null;
    var days = j.days.slice(0, 60).map(function (d, i) {
      d = d && typeof d === 'object' ? d : {title: d};
      var n = i + 1, f = String(d.folder || '');
      return {n: n, title: clip(d.title, 80).trim() || 'Day ' + n, folder: n === 1 ? '' : (/^day-\d{1,2}$/.test(f) ? f : 'day-' + n)};
    });
    var t = j.timing && typeof j.timing === 'object' ? j.timing : {};
    return {days: days, timing: {waitHours: num(t.waitHours, 0, 336, 0), withinDays: num(t.withinDays, 0, 60, 0), graceDays: num(t.graceDays, 0, 14, 0), missed: t.missed === 'continue' ? 'continue' : 'restart'}};
  }
  function load(base) {
    return fetch(base + 'days.json?t=' + Date.now(), {cache: 'no-store'}).then(function (r) { return r.ok ? r.json() : null; }).then(normalize).catch(function () { return null; });
  }

  /* Where the student stands. saved: the server's rows for this attempt ({day, finished, finished_at, started_at, …});
     now: the server's clock (ms). Every date comes from Worldview, never from the device. */
  function status(course, saved, now) {
    var byDay = {}; (saved || []).forEach(function (r) { byDay[r.day] = r; });
    var t = course.timing, next = 0, rows = course.days.map(function (d) {
      var r = byDay[d.n] || null;
      return {n: d.n, title: d.title, folder: d.folder, saved: r, finished: !!(r && r.finished), finishedAt: r && r.finished_at ? Date.parse(r.finished_at) : null, state: 'later'};
    });
    for (var i = 0; i < rows.length; i++) { if (rows[i].finished) rows[i].state = 'done'; else { next = rows[i].n; break; } }
    var out = {rows: rows, next: next, allDone: !next, state: next ? 'open' : 'all_done', openAt: null, dueAt: null, graceEnd: null, late: false};
    if (!next) return out;
    var cur = rows[next - 1], prev = next > 1 ? rows[next - 2] : null;
    cur.state = cur.saved ? 'continue' : 'open';
    if (prev && prev.finishedAt) {
      out.openAt = prev.finishedAt + t.waitHours * HOUR;
      if (t.withinDays) { out.dueAt = prev.finishedAt + t.withinDays * DAY; out.graceEnd = out.dueAt + t.graceDays * DAY; }
      if (!cur.saved) {
        if (now < out.openAt) { out.state = cur.state = 'waiting'; }
        else if (out.graceEnd && now > out.graceEnd) { out.late = true; out.state = cur.state = t.missed === 'continue' ? 'open' : 'missed'; }
        else if (out.dueAt && now > out.dueAt) { out.late = true; }
      }
    }
    return out;
  }

  // Everything kept for later days (wv.remember), earlier days first, so a later day's value wins.
  function recall(saved, today) {
    var all = {};
    (saved || []).slice().sort(function (a, b) { return a.day - b.day; }).forEach(function (r) { if (r.notes && typeof r.notes === 'object') Object.assign(all, r.notes); });
    return Object.assign(all, today || {});
  }

  /* The student's own copy, as plain text a person (or an AI) can read. */
  function itemLine(a) {
    var q = clip(a && a.question, 400).trim(), x = clip(a && a.answer, 2000).trim();
    if (!q && !x) return '';
    return q && x ? '- **' + q + '**\n  ' + x.replace(/\n/g, '\n  ') : '- ' + (q || x);
  }
  function valueText(v) { return typeof v === 'string' ? v : JSON.stringify(v, null, 2); }
  // h: the heading level for the day's title ('#' in its own file, '##' inside the notebook)
  function dayMarkdown(title, row, saved, h) {
    h = h || '#';
    var when = row.finishedAt ? 'finished ' + new Date(row.finishedAt).toLocaleString() : saved ? 'started ' + new Date(saved.started_at).toLocaleString() + ', not finished' : 'not started';
    var out = [h + ' Day ' + row.n + ': ' + row.title, '', title + ' · ' + when, ''];
    var items = (saved && saved.answers || []).map(itemLine).filter(Boolean);
    if (items.length) out.push(h + '# What I answered and said', '', items.join('\n'), '');
    var notes = saved && saved.notes || {}, keys = Object.keys(notes);
    if (keys.length) { out.push(h + '# Kept for later days', ''); keys.forEach(function (k) { out.push(h + '## ' + k, '', valueText(notes[k]), ''); }); }
    return out.join('\n');
  }
  function notebook(title, course, saved, now) {
    var st = status(course, saved, now), byDay = {}; (saved || []).forEach(function (r) { byDay[r.day] = r; });
    var md = ['# ' + title + ': my notebook', '', 'Saved from Worldview on ' + new Date().toLocaleString() + '. This copy is yours: add notes, make flash cards, change anything. Worldview keeps its own record separately.', ''];
    st.rows.forEach(function (r) { if (byDay[r.n]) md.push(dayMarkdown(title, r, byDay[r.n], '##')); });
    var kept = recall(saved), keys = Object.keys(kept);
    if (keys.length) { md.push('## Everything kept so far', ''); keys.forEach(function (k) { md.push('- **' + k + '**: ' + valueText(kept[k]).replace(/\n/g, ' ')); }); md.push(''); }
    return {markdown: md.join('\n'), json: JSON.stringify({lesson: title, saved_at: new Date().toISOString(), days: st.rows.map(function (r) { var s = byDay[r.n]; return {day: r.n, title: r.title, finished_at: s && s.finished_at || null, started_at: s && s.started_at || null, answers: s && s.answers || [], kept: s && s.notes || {}}; })}, null, 2),
      days: st.rows.filter(function (r) { return byDay[r.n]; }).map(function (r) { return {name: 'Day ' + r.n + ' - ' + safeName(r.title) + '.md', text: dayMarkdown(title, r, byDay[r.n])}; })};
  }
  function safeName(s) { return clip(String(s || '').replace(/[<>:"\/\\|?*\x00-\x1f]/g, '').trim(), 60) || 'Lesson'; }
  function download(name, text, type) {
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([text], {type: type || 'text/markdown'})); a.download = name;
    document.body.appendChild(a); a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  }

  /* A folder on a computer (Chrome and Edge): picked once, then updated after each day. The folder handle
     stays in this browser (IndexedDB); the browser may ask again before writing. */
  var canFolder = typeof window.showDirectoryPicker === 'function';
  function idb(fn) {
    return new Promise(function (res) {
      try { var q = indexedDB.open('worldview-days', 1); q.onupgradeneeded = function () { q.result.createObjectStore('folders'); };
        q.onsuccess = function () { try { var tx = q.result.transaction('folders', 'readwrite'), r = fn(tx.objectStore('folders')); tx.oncomplete = function () { res(r && r.result); }; tx.onerror = function () { res(null); }; } catch (e) { res(null); } };
        q.onerror = function () { res(null); }; } catch (e) { res(null); }
    });
  }
  function folderGet(lessonId) { return idb(function (s) { return s.get(lessonId); }); }
  function folderSet(lessonId, h) { return idb(function (s) { return s.put(h, lessonId); }); }
  async function writeFolder(root, title, nb) {
    var dir = await root.getDirectoryHandle(safeName(title), {create: true});
    var put = async function (d, name, text) { var f = await d.getFileHandle(name, {create: true}), w = await f.createWritable(); await w.write(text); await w.close(); };
    await put(dir, 'Notebook.md', nb.markdown); await put(dir, 'notebook.json', nb.json);
    var days = await dir.getDirectoryHandle('Days', {create: true});
    for (var i = 0; i < nb.days.length; i++) await put(days, nb.days[i].name, nb.days[i].text);
  }
  // ask: true when the student pressed a button (the browser only shows a prompt then).
  async function saveToFolder(lessonId, title, nb, ask) {
    if (!canFolder) return {ok: false, type: 'unsupported'};
    try {
      var h = await folderGet(lessonId);
      if (h && h.queryPermission) { var p = await h.queryPermission({mode: 'readwrite'}); if (p !== 'granted') { if (!ask) return {ok: false, type: 'needs_ok'}; p = await h.requestPermission({mode: 'readwrite'}); if (p !== 'granted') h = null; } }
      if (!h) { if (!ask) return {ok: false, type: 'no_folder'}; h = await window.showDirectoryPicker({id: 'worldview-days', mode: 'readwrite'}); await folderSet(lessonId, h); }
      await writeFolder(h, title, nb);
      return {ok: true, folder: h.name + '/' + safeName(title)};
    } catch (e) { return {ok: false, type: e && e.name === 'AbortError' ? 'cancelled' : 'failed', error: e && e.message}; }
  }
  async function hasFolder(lessonId) { return canFolder && !!(await folderGet(lessonId)); }

  function when(ms) { var d = new Date(ms); return d.toLocaleDateString([], {weekday: 'short', month: 'short', day: 'numeric'}) + ', ' + d.toLocaleTimeString([], {hour: 'numeric', minute: '2-digit'}); }

  window.WorldviewDays = {normalize: normalize, load: load, status: status, recall: recall, notebook: notebook, download: download, safeName: safeName,
    canFolder: canFolder, saveToFolder: saveToFolder, hasFolder: hasFolder, when: when};
})();
