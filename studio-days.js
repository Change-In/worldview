/* Teacher Studio: trying a lesson over several days (NAV-198). When the open lesson has a days.json,
   a Day picker appears above the preview. Picking Day 2 plays day-2/index.html; what the teacher
   answered and kept (wv.remember) on earlier practice days is remembered in this browser only, so a
   later day can be tried with earlier days behind it. Nothing here reaches students' records.
   attach(host) wraps host.run, so every place Studio reloads the preview plays the picked day. */
(function () {
  'use strict';
  var FILES = 'https://eqppapoepynjvsfnoodj.supabase.co/storage/v1/object/public/lesson-files/';
  function attach(host) {
    var run = host.run.bind(host), onChange = host.o.onChange, course = null, loadedFor = '', pick = 1, bar = null, gen = 0;
    var key = function () { return 'wv-studio-days-' + host.o.lessonId; };
    var store = function () { try { return JSON.parse(localStorage.getItem(key())) || {}; } catch (e) { return {}; } };
    var keep = function (s) { try { localStorage.setItem(key(), JSON.stringify(s)); } catch (e) {} };
    var day = function (s, n) { s[n] = s[n] || {day: n, notes: {}, answers: [], started_at: new Date().toISOString()}; return s[n]; };
    var earlier = function () { var s = store(), out = []; for (var n = 1; n < pick; n++) if (s[n]) out.push(s[n]); return out; };
    var adapter = {
      info: function () {
        var d = course.days[pick - 1];
        return {enabled: true, day: pick, of: course.days.length, title: d.title, attempt: 1, late: false, practice: true, startedAt: day(store(), pick).started_at,
          days: course.days.map(function (x) { return {day: x.n, title: x.title}; }),
          earlier: earlier().map(function (r) { return {day: r.day, title: (course.days[r.day - 1] || {}).title || 'Day ' + r.day, startedAt: r.started_at, finishedAt: r.finished_at || null, answers: r.answers || [], kept: r.notes || {}}; })};
      },
      recall: function () { var s = store(); return WorldviewDays.recall(earlier(), (s[pick] || {}).notes); },
      remember: function (k, v) { var s = store(); day(s, pick).notes[k] = v; keep(s); }
    };
    host.o.onChange = function (record, done) {
      if (course) { var s = store(), d = day(s, pick); d.answers = record.slice(-200); if (done && !d.finished_at) d.finished_at = new Date().toISOString(); d.finished = d.finished || done; keep(s); }
      if (onChange) onChange(record, done);
    };
    function render() {
      var box = host.o.frame && host.o.frame.closest('.phone');
      if (!course) { if (bar) bar.hidden = true; return; }
      if (!bar && box) {
        bar = document.createElement('div'); bar.className = 'row'; bar.style.cssText = 'margin-bottom:8px';
        bar.innerHTML = '<label class="small" for="wv-daypick"><b>Day</b></label><select id="wv-daypick" style="min-height:36px;border-radius:10px;padding:4px 8px;max-width:260px"></select>' +
          '<span class="small muted grow" id="wv-daynote"></span><button type="button" class="btn ghost small" id="wv-dayclear">Clear practice days</button>';
        box.parentNode.insertBefore(bar, box);
        bar.querySelector('select').addEventListener('change', function (e) { pick = +e.target.value || 1; host.run(''); });
        bar.querySelector('#wv-dayclear').addEventListener('click', function () { try { localStorage.removeItem(key()); } catch (e) {} pick = 1; render(); host.run(''); });
      }
      if (!bar) return;
      bar.hidden = false;
      var s = store();
      bar.querySelector('select').innerHTML = course.days.map(function (d) { return '<option value="' + d.n + '"' + (d.n === pick ? ' selected' : '') + '>' + d.n + ' · ' + d.title.replace(/[<&]/g, '') + (s[d.n] && s[d.n].finished ? ' ✓' : '') + '</option>'; }).join('');
      bar.querySelector('#wv-daynote').textContent = 'Practice only: earlier days you tried here count as done.';
    }
    host.run = function (html, lessonId, prefix, folder) {
      var g = ++gen, lid = lessonId || host.o.lessonId;
      var root = html || host._wvRoot || '';
      if (html) host._wvRoot = html;
      Promise.resolve(lid && lid !== loadedFor ? WorldviewDays.load(FILES + encodeURIComponent(lid) + '/').then(function (c) { course = c; loadedFor = lid; pick = 1; host.o.days = c ? adapter : null; render(); }) : null).then(function () {
        if (g !== gen) return;
        if (!course || pick === 1 || folder !== undefined) return run(root, lessonId, prefix, folder);
        var d = course.days[pick - 1];
        return fetch(FILES + encodeURIComponent(lid) + '/' + d.folder + '/index.html?t=' + Date.now(), {cache: 'no-store'}).then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }).then(function (h) {
          if (g !== gen) return;
          if (!h) { run('<p style="font:16px sans-serif;padding:24px">Day ' + d.n + ' (' + d.folder + '/index.html) isn\'t on Worldview yet. Save it in the lesson folder with the lesson helper window open, then pick the day again.</p>', lessonId, prefix, d.folder); return; }
          run(h, lessonId, prefix, d.folder);
        });
      });
    };
    return {reload: function () { loadedFor = ''; }};
  }
  window.WorldviewStudioDays = {attach: attach};
})();
