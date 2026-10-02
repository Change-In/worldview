/* NAV-157: tools for the lesson map panel that opens from a lesson card.
   "Show everything" opens every chapter note and learning outcome at once,
   "Full screen" gives the map the whole screen, and "Copy as text" copies the
   whole map so it can be pasted next to notes or a recording. The chapter the
   learner is on is marked. Works from the panel's own content; reads no other
   data. Loaded at the end of index.html. */
(() => {
  'use strict';
  const panel = document.getElementById('lesson-path-panel');
  const nodes = document.getElementById('lesson-path-nodes');
  const head = panel?.querySelector('.lesson-path-head');
  if (!panel || !nodes || !head) return;
  const bar = document.createElement('div');
  bar.className = 'map-tools';
  bar.innerHTML = '<button type="button" data-mt="all" aria-pressed="false">Show everything</button><button type="button" data-mt="full" aria-pressed="false">Full screen</button><button type="button" data-mt="copy">Copy as text</button>';
  head.appendChild(bar);
  let all = false;
  const say = msg => { try { if (typeof toast === 'function') toast(msg, 3000); } catch (e) {} };
  function applyAll() {
    nodes.querySelectorAll('details').forEach(d => { d.open = all; });
    nodes.querySelectorAll('.lesson-path-node').forEach(n => { n.classList.toggle('expanded', all); n.querySelector('button')?.setAttribute('aria-expanded', all ? 'true' : 'false'); });
  }
  function labels() {
    const a = bar.querySelector('[data-mt="all"]'), f = bar.querySelector('[data-mt="full"]'), full = panel.classList.contains('map-full');
    a.textContent = all ? 'Collapse' : 'Show everything'; a.setAttribute('aria-pressed', String(all));
    f.textContent = full ? 'Exit full screen' : 'Full screen'; f.setAttribute('aria-pressed', String(full));
  }
  function markCurrent() {
    let id = '';
    try { id = String(typeof lessonPathLessonId !== 'undefined' ? lessonPathLessonId || '' : ''); } catch (e) {}
    if (!id.startsWith('learner:')) return;
    let row = null;
    try { row = typeof homeLearnerRuns === 'function' ? homeLearnerRuns().find(r => r.runId === id.slice(8)) : null; } catch (e) {}
    const n = Number(row?.chapterNumber ?? row?.chapter?.number) || 0, complete = row?.phase === 'complete';
    nodes.querySelectorAll('.saved-map-chapter').forEach((sec, i) => {
      sec.classList.toggle('mt-done', complete || (n > 0 && i + 1 < n));
      sec.classList.toggle('mt-here', !complete && n === i + 1);
    });
  }
  function text() {
    const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
    const out = [];
    const title = clean(document.getElementById('lesson-path-title')?.textContent);
    const goal = clean(document.getElementById('lesson-path-overview')?.textContent);
    if (title) out.push(title);
    if (goal) out.push(goal);
    out.push('');
    const field = p => { const s = p.querySelector('strong'); const label = clean(s?.textContent); const body = clean(p.textContent.slice((s?.textContent || '').length)); return label ? (body ? `${label}: ${body}` : '') : clean(p.textContent); };
    nodes.querySelectorAll('.saved-map-chapter').forEach(sec => {
      const here = sec.classList.contains('mt-here') ? ' (you are here)' : sec.classList.contains('mt-done') ? ' (done)' : '';
      out.push(`${clean(sec.querySelector('small')?.textContent)}: ${clean(sec.querySelector('h3')?.textContent)}${here}`);
      sec.querySelectorAll('details').forEach(d => {
        const isContext = d.classList.contains('saved-map-context');
        out.push(isContext ? '  Why this chapter belongs' : '  ' + clean(d.querySelector('summary')?.textContent));
        d.querySelectorAll(':scope > p').forEach(p => { const f = field(p); if (f) out.push('    ' + f); });
        const items = [...d.querySelectorAll(':scope > ul > li')].map(li => clean(li.textContent));
        if (items.length) { out.push('    Research questions:'); items.forEach(i => out.push('      - ' + i)); }
      });
      out.push('');
    });
    nodes.querySelectorAll('.lesson-path-node').forEach((n, i) => {
      out.push(`${i + 1}. ${clean(n.querySelector('strong')?.textContent)}`);
      n.querySelectorAll('p').forEach(p => { const t = clean(p.textContent); if (t) out.push('   ' + t); });
    });
    return out.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  }
  bar.addEventListener('click', e => {
    const b = e.target.closest('[data-mt]'); if (!b) return;
    if (b.dataset.mt === 'all') { all = !all; applyAll(); }
    if (b.dataset.mt === 'full') panel.classList.toggle('map-full');
    if (b.dataset.mt === 'copy') {
      const t = text();
      if (!t) { say('The map is still loading.'); return; }
      try { navigator.clipboard.writeText(t).then(() => say('Lesson map copied.'), () => say('Copy did not work on this device.')); } catch (err) { say('Copy did not work on this device.'); }
    }
    labels();
  });
  // Keep "Show everything" and the chapter marker when the map re-renders.
  new MutationObserver(() => { if (all) applyAll(); markCurrent(); }).observe(nodes, {childList:true});
  // A closed panel starts fresh next time.
  new MutationObserver(() => {
    if (!panel.classList.contains('open')) { if (all || panel.classList.contains('map-full')) { all = false; if (panel.classList.contains('map-full')) panel.classList.remove('map-full'); labels(); } }
    else markCurrent();
  }).observe(panel, {attributes:true, attributeFilter:['class']});
  labels();
})();
