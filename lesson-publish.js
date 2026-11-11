/* Publishing a teacher lesson, shared by Teacher Studio (studio.html) and the Places day panel (places.js) since v3.1.72.
   One copy of the rules, so a lesson published from either place is locked the same way:
   1. worldview_teacher_lesson_publish copies the lesson page into a numbered release.
   2. lockInFiles copies the lesson's files (slide pictures, lesson.json, videos, map) into lesson-files/<id>/_v/<n>/,
      so editing the draft later never changes what students have (NAV-179).
   Also: ensureSlidesStyle puts the current student page (slides-lesson.html) into a lesson made from slides (LES-340). */
(() => {
  const BUCKET = 'lesson-files', T = 'worldview_teacher_lessons';
  const STYLE_URL = new URL('slides-lesson.html', document.currentScript ? document.currentScript.src : location.href).href;
  const MEDIA_REF = /["'(\s]((?:[\w -]+\/)*[\w .-]+\.(?:mp4|webm|ogg|ogv|mov|m4v|mp3|m4a|wav|png|jpe?g|gif|webp|svg|json))(?=["')?#\s])/gi;
  const styleVersion = html => { const m = /name="worldview-style"\s+content="slides-v1 (\d+)"/.exec(html || ''); return m ? +m[1] : 0; };

  // A lesson's files on Worldview (paths inside the lesson), leaving out published versions' locked copies (_v).
  async function listLessonFiles(db, id, prefix, depth) {
    const out = [], {data, error} = await db.storage.from(BUCKET).list(prefix, {limit: 1000});
    if (error) throw error;
    for (const it of data || []) {
      if (it.name.startsWith('.')) continue;
      const p = prefix + '/' + it.name;
      if (!it.id) { if (depth === 0 && it.name === '_v') continue; if (depth < 4) out.push(...await listLessonFiles(db, id, p, depth + 1)); }
      else out.push(p.slice(id.length + 1));
    }
    return out;
  }
  async function removeFolder(db, prefix, depth) {
    const {data} = await db.storage.from(BUCKET).list(prefix, {limit: 1000}); const files = [];
    for (const it of data || []) { const p = prefix + '/' + it.name; if (!it.id) { if (depth < 5) await removeFolder(db, p, depth + 1); } else files.push(p); }
    for (let i = 0; i < files.length; i += 100) await db.storage.from(BUCKET).remove(files.slice(i, i + 100));
  }
  async function lockInFiles(db, id, html, version, onProgress) {
    const files = await listLessonFiles(db, id, id, 0);
    let copied = 0;
    for (const f of files) {
      if (onProgress) onProgress('Locking files into v' + version + ' (' + (copied + 1) + ' of ' + files.length + ')…');
      const {error} = await db.storage.from(BUCKET).copy(id + '/' + f, id + '/_v/' + version + '/' + f);
      if (error && !/exist/i.test(error.message)) throw new Error('Couldn\'t lock in ' + f + ': ' + error.message);
      copied++;
    }
    const {error} = await db.rpc('worldview_teacher_lesson_release_files_done', {p_lesson: id, p_version: version});
    if (error) throw error;
    // keep the two newest versions' copies (students mid-lesson on the previous one keep working)
    try { const {data} = await db.storage.from(BUCKET).list(id + '/_v', {limit: 1000}); for (const it of data || []) if (!it.id && /^\d+$/.test(it.name) && +it.name < version - 1) await removeFolder(db, id + '/_v/' + it.name, 0); } catch (e) {}
    // anything the lesson uses that isn't on Worldview
    let mapText = ''; try { const r = await fetch(db.storage.from(BUCKET).getPublicUrl(id + '/map.json').data.publicUrl + '?t=' + Date.now(), {cache: 'no-store'}); if (r.ok) mapText = await r.text(); } catch (e) {}
    const used = new Set(); // a lesson made from slides plays through slides-lesson.html, whose own code is not a list of the lesson's files
    const scan = (styleVersion(html) ? '' : (html || '')) + ' ' + mapText;
    for (const m of scan.matchAll(MEDIA_REF)) { const p = m[1].trim().replace(/^\.\//, ''); if (!/^https?:/i.test(p) && !p.includes('..')) used.add(p); }
    const missing = [...used].filter(p => !files.includes(p) && p !== 'map.json');
    return {files, missing};
  }
  /* Publish: {db, id, shared, html (the draft's page), latest (newest release or undefined), setShared(bool) → ok, onVersion(v), onProgress(text)}.
     Returns {version, files, missing} or {version, again: true} when an unchanged, unpublished version is simply opened again. Throws with .version set when
     the version was published but its files could not be locked in (the teacher presses Lock in to try again). */
  async function publish(o) {
    const latest = o.latest, relock = !!(latest && !latest.files_frozen && latest.html === o.html);
    if (latest && !o.shared && latest.html === o.html) {
      if (!(await o.setShared(true))) return {cancelled: true};
      if (!relock) return {version: latest.version, again: true};
    }
    let version = relock ? latest.version : null;
    try {
      if (!relock) { const {data, error} = await o.db.rpc('worldview_teacher_lesson_publish', {p_lesson: o.id}); if (error) throw error; version = data; if (o.onVersion) o.onVersion(version); }
      const r = await lockInFiles(o.db, o.id, o.html, version, o.onProgress);
      return {version, files: r.files, missing: r.missing};
    } catch (e) { e.version = version; throw e; }
  }
  async function setShared(db, id, shared) { const {error} = await db.from(T).update({shared}).eq('id', id); return !error; }
  async function latestRelease(db, id) {
    const {data} = await db.from('worldview_teacher_lesson_releases').select('version,html,published_at,files_frozen').eq('lesson_id', id).order('version', {ascending: false}).limit(1);
    return (data || [])[0];
  }
  /* A lesson made from slides plays through slides-lesson.html. Put the current copy into the lesson when it has none or an older one; returns the lesson's page. */
  async function ensureSlidesStyle(db, id, html) {
    if (html == null) { const {data, error} = await db.from(T).select('html').eq('id', id).single(); if (error) throw new Error('Couldn\'t open the lesson: ' + error.message); html = data.html; }
    const r = await fetch(STYLE_URL + '?t=' + Date.now(), {cache: 'no-store'});
    if (!r.ok) throw new Error('Couldn\'t load the lesson page. Check the internet connection.');
    const tpl = await r.text();
    if (styleVersion(html) >= styleVersion(tpl)) return html;
    const {error} = await db.from(T).update({html: tpl}).eq('id', id);
    if (error) throw new Error('Couldn\'t update the lesson page: ' + error.message);
    return tpl;
  }
  window.WorldviewPublish = {publish, lockInFiles, listFiles: (db, id) => listLessonFiles(db, id, id, 0), setShared, latestRelease, ensureSlidesStyle, styleVersion};
})();
