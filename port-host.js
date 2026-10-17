/* The Worldview port host (NAV-171 Phase 1). Runs a teacher's lesson file in a
   sealed frame and answers its port calls: questions the lesson asks appear
   under it and the learner answers in writing; predictions are compared with
   the result; a moment for the teacher is noted for the teacher. Used by
   studio.html (try it as a student) and play.html (the student's link).
   wv.ai asks Worldview's AI for a reply (NAV-171 Phase 2a) through o.ai, which
   the page supplies; the lesson decides how to show the reply. wv.video plays a
   YouTube video in a sheet over the lesson: YouTube can't play inside the sealed
   frame, and the frame stays sealed so a lesson can never read a Worldview sign-in.
   wv.listen records the microphone here (a sealed frame can't use it) and returns
   Worldview's transcript (NAV-176). wv.record (camera + mic, review, save) and
   wv.saveFile work only in Teacher Studio, for the lesson's owner: files go to the
   lesson's Worldview files (and the teacher's lesson folder); wv.readFile reads them
   back for anyone (NAV-178). wv.audio streams on-device pitch and level readings
   (the microphone is captured here, never sent anywhere); wv.state keeps a student's
   place per run; welcome carries capabilities so lessons can check support (NAV-182).
   NAV-187: where a lesson address is set up, the lesson is loaded from that second
   address (the lesson runner) instead of a sealed frame. Browsers keep addresses
   apart, so the lesson can use the microphone, camera and other browser features
   directly, with the browser's own permission prompts, and still can't read a
   Worldview sign-in. If the runner doesn't answer, the sealed frame is used. */
(function () {
  'use strict';
  var SDK = "(function(){window.WorldviewPort=function(manifest,handlers){handlers=handlers||{};var waiting={},aiN=0,audioCb=null,audioEnd=null,inFrame=window.parent!==window;" +
    "function send(type,body){try{parent.postMessage(Object.assign({port:'worldview',v:1,type:type},body||{}),'*');}catch(e){}}" +
    "addEventListener('message',function(e){var m=e.data;if(!m||m.port!=='worldview'||e.source!==parent)return;" +
    "if(m.type==='audioframe'&&audioCb){try{audioCb(m.frame);}catch(x){}}if(m.type==='audioend'){var en=audioEnd;audioCb=null;audioEnd=null;if(en){try{en(m.info||{});}catch(x){}}}if(m.type==='welcome'){api.viewer=m.viewer==='teacher'?'teacher':'student';api.capabilities=m.capabilities||{};if(handlers.onWelcome)handlers.onWelcome(m);}if(m.type==='answer'&&waiting[m.id]){var d=waiting[m.id];delete waiting[m.id];d(m.value);}" +
    "if(m.type==='control'&&handlers.onControl)handlers.onControl(m.key,m.value);});" +
    "function wait(id,type,body){return new Promise(function(res){if(!inFrame)return res(null);waiting[id]=res;send(type,Object.assign({id:id},body));});}" +
    "send('hello',{manifest:manifest});" +
    "var api={viewer:'student',capabilities:{},can:function(n){return !!api.capabilities[n];},audio:{start:function(o,cb){if(typeof o==='function'){cb=o;o={};}o=o||{};audioCb=cb||o.onFrame||null;audioEnd=o.onEnd||null;return wait('a'+(++aiN),'audiostart',{opts:{pitch:o.pitch!==false,minHz:o.minHz||0,maxHz:o.maxHz||0,rate:o.rate||0,silenceDb:o.silenceDb==null?null:o.silenceDb,clarity:o.clarity||0,label:o.label||''}});},stop:function(){audioCb=null;send('audiostop',{});},cents:function(hz,t){return hz>0&&t>0?1200*Math.log(hz/t)/Math.LN2:null;}},state:{get:function(){return wait('s'+(++aiN),'stateget',{});},set:function(v){send('stateset',{value:v});}},videoClose:function(){send('videoclose',{});},say:function(t){send('say',{text:t});},event:function(n,d,s,o){send('event',{name:n,data:d||{},say:s||'',react:!!(o&&o.react)});}," +
    "predict:function(id,q,u,o){return wait(id,'predict',Object.assign({question:q,unit:u||''},o||{}));},result:function(id,a,s){send('result',{id:id,actual:a,say:s||''});}," +
    "ask:function(id,q,o){return wait(id,'ask',Object.assign({question:q},o||{}));},human:function(id,r){return wait(id,'human',Object.assign({to:'teacher',kind:'question'},r||{}));}," +
    "evidence:function(o,t,d){send('evidence',{outcome:o,text:t,data:d||{}});},remember:function(k,v){send('remember',{key:k,value:v});}," +
    "progress:function(v,n){send('progress',{value:v,note:n||''});},video:function(src,o){return wait('v'+(++aiN),'video',Object.assign({src:String(src||'')},o||{}));},ai:function(x,o){o=o||{};return wait('ai'+(++aiN),'ai',{messages:typeof x==='string'?[{role:'user',content:x}]:(x||[]),system:o.system||'',maxTokens:o.maxTokens||0,json:!!o.json,full:!!o.full});},record:function(o){o=o||{};return wait('r'+(++aiN),'record',{kind:o.kind||'video',maxSeconds:o.maxSeconds||0,title:o.title||'',folder:o.folder||'',name:o.name||''});},saveFile:function(p,c){return wait('f'+(++aiN),'savefile',{path:String(p||''),content:c});},readFile:function(p){return wait('g'+(++aiN),'readfile',{path:String(p||'')});},listen:function(o){o=o||{};return wait('l'+(++aiN),'listen',{prompt:o.prompt||'',maxSeconds:o.maxSeconds||0,lang:o.lang||'',full:!!o.full});},done:function(s){send('done',{summary:s||{}});}};return api;};})();" +
    "addEventListener('error',function(e){try{parent.postMessage({port:'worldview',v:1,type:'crash',message:String(e.message||'error').slice(0,200)},'*');}catch(x){}});";

  var FILES = 'https://eqppapoepynjvsfnoodj.supabase.co/storage/v1/object/public/lesson-files/';
  /* The lesson address for each Worldview address (app/lesson-runner, Worker worldview-lessons). '' keeps the sealed frame. On a computer,
     localhost and 127.0.0.1 are two different addresses, so each serves the other's runner. */
  var RUNNERS = {'https://worldview.cristianjperezb.workers.dev': 'https://worldview-lessons.cristianjperezb.workers.dev/'};
  function runnerUrl() {
    try { if (/[?&]runner=off/.test(location.search)) return ''; } catch (e) {}
    var h = location.hostname, p = location.port ? ':' + location.port : '';
    if (h === 'localhost') return 'http://127.0.0.1' + p + '/lesson-runner/runner.html';
    if (h === '127.0.0.1') return 'http://localhost' + p + '/lesson-runner/runner.html';
    return RUNNERS[location.origin] || '';
  }
  var OPEN_SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-modals allow-downloads allow-pointer-lock allow-presentation allow-orientation-lock';
  var OPEN_ALLOW = 'microphone; camera; geolocation; midi; fullscreen; autoplay; clipboard-write; accelerometer; gyroscope; magnetometer; screen-wake-lock; picture-in-picture; encrypted-media; web-share; bluetooth; usb; serial; hid; xr-spatial-tracking; display-capture';
  function filesRoot(lessonId, prefix) { return FILES + encodeURIComponent(lessonId) + '/' + (/^_v\/\d{1,4}\/$/.test(prefix || '') ? prefix : ''); }
  function compose(body, lessonId, prefix) {
    var base = lessonId && !/<base\s/i.test(body) ? '<base href="' + filesRoot(lessonId, prefix) + '">' : '';
    var head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + base + '<script>' + SDK + '<\/script>';
    if (/<head[^>]*>/i.test(body)) return body.replace(/<head[^>]*>/i, function (m) { return m + head; });
    if (/<html[^>]*>/i.test(body)) return body.replace(/<html[^>]*>/i, function (m) { return m + '<head>' + head + '</head>'; });
    return '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>';
  }
  var clip = function (s, n) { return String(s == null ? '' : s).slice(0, n); };
  var clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  var NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  /* One reading: loudness (RMS and dBFS) and, if asked, the pitch with a clarity score
     (the normalised-autocorrelation peak, 0..1). state: 'silence' | 'unclear' | 'signal'. */
  function analyse(x, sr, o) {
    var n = x.length, sum = 0, i;
    for (i = 0; i < n; i++) sum += x[i] * x[i];
    var rms = Math.sqrt(sum / n), db = rms > 0 ? 20 * Math.log10(rms) : -120;
    var f = {state: 'silence', level: Math.round(Math.min(1, rms * 4) * 1000) / 1000, db: Math.round(db * 10) / 10, hz: null, clarity: 0, note: null, noteCents: null};
    if (db < o.silenceDb) return f;
    if (!o.pitch) { f.state = 'signal'; return f; }
    var W = Math.min(2048, n >> 1), minLag = Math.max(2, Math.floor(sr / o.maxHz)), maxLag = Math.min(n - W - 1, Math.ceil(sr / o.minHz));
    var nsdf = new Float32Array(maxLag + 2);
    for (var tau = 0; tau <= maxLag + 1 && tau + W < n; tau++) {
      var acf = 0, m = 0;
      for (var j = 0; j < W; j++) { var a = x[j], b = x[j + tau]; acf += a * b; m += a * a + b * b; }
      nsdf[tau] = m > 0 ? 2 * acf / m : 0;
    }
    // key maxima: the highest point of each positive lobe after the first zero crossing
    var peaks = [], t = 1;
    while (t < maxLag && nsdf[t] > 0) t++;
    while (t < maxLag) {
      while (t < maxLag && nsdf[t] <= 0) t++;
      var best = -1, bi = -1;
      while (t < maxLag && nsdf[t] > 0) { if (nsdf[t] > best) { best = nsdf[t]; bi = t; } t++; }
      if (bi > 0) peaks.push(bi);
    }
    var top = 0; peaks.forEach(function (p) { if (p >= minLag && nsdf[p] > top) top = nsdf[p]; });
    var pick = -1; for (i = 0; i < peaks.length; i++) if (peaks[i] >= minLag && nsdf[peaks[i]] >= 0.9 * top) { pick = peaks[i]; break; }
    if (pick < 0 || top <= 0) { f.state = 'unclear'; return f; }
    var y0 = nsdf[pick - 1], y1 = nsdf[pick], y2 = nsdf[pick + 1], den = y0 - 2 * y1 + y2, shift = den ? 0.5 * (y0 - y2) / den : 0;
    var hz = sr / (pick + clamp(shift, -1, 1)), clarity = Math.min(1, y1 - 0.25 * (y0 - y2) * shift);
    f.clarity = Math.round(clarity * 1000) / 1000;
    if (hz < o.minHz || hz > o.maxHz) { f.state = 'unclear'; return f; }
    f.hz = Math.round(hz * 100) / 100;
    var midi = 69 + 12 * Math.log(hz / 440) / Math.LN2, near = Math.round(midi);
    f.note = NOTES[(near % 12 + 12) % 12] + (Math.floor(near / 12) - 1); f.noteCents = Math.round((midi - near) * 1000) / 10;
    f.state = clarity >= o.clarityMin ? 'signal' : 'unclear';
    return f;
  }

  /* opts: {frame, panel, progress, onChange(record), onTitle(title)} */
  function PortHost(opts) {
    this.o = opts; this.q = []; this.preds = {}; this.record = []; this.connected = false; this.done = false; this.manifest = null; this.aiCount = 0; HOSTS.push(this);
    var self = this, f = this.o.frame;
    this._sealedSandbox = f.getAttribute('sandbox') || 'allow-scripts allow-forms';
    this._runner = opts.runner !== undefined ? opts.runner : runnerUrl();
    try { this._runnerOrigin = this._runner ? new URL(this._runner, location.href).origin : ''; } catch (e) { this._runner = ''; }
    this._listener = function (e) {
      if (e.source !== self.o.frame.contentWindow) return;
      if (self._open) {
        if (e.origin !== self._runnerOrigin) return;
        var d = e.data;
        if (d && d.port === 'worldview-runner') {
          if (d.type === 'ready' && self._pending) { try { e.source.postMessage({port: 'worldview-runner', type: 'load', html: self._pending}, self._runnerOrigin); } catch (er) {} }
          if (d.type === 'accepted') { self._pending = null; clearTimeout(self._rt); }
          if (d.type === 'refused' && self._pending) { var doc = self._pending; self._runnerDown = true; self._load(doc); }
          return;
        }
      } else if (e.origin !== 'null') return;
      self._message(e.data);
    };
    addEventListener('message', this._listener);
  }
  /* run(html, lessonId, filesPrefix): filesPrefix '_v/3/' plays a published version's locked-in files. */
  PortHost.prototype.run = function (html, lessonId, filesPrefix) {
    if (lessonId) this.o.lessonId = lessonId; if (filesPrefix !== undefined) this.o.filesPrefix = filesPrefix || '';
    this._audioStop(null); this._closeDock(null); this._mem = null;
    this.q = []; this.preds = {}; this.record = (this.o.initialRecord || []).slice(); this.o.initialRecord = null; this.connected = false; this.done = false; this.manifest = null; this.aiCount = 0; this.gen = (this.gen || 0) + 1;
    this.o.panel.innerHTML = ''; if (this.o.progress) this.o.progress.style.width = '0';
    this._closeVideo();
    var doc = compose(String(html || ''), this.o.lessonId, this.o.filesPrefix), self = this;
    this._load(doc); clearTimeout(this._t);
    this._t = setTimeout(function () { if (!self.connected) self._line('note', 'This lesson isn\'t connected to Worldview, so its questions won\'t appear here. You can still use it above.'); }, this._open ? 8500 : 3500);
  };
  /* Show the lesson: from the lesson address when there is one, otherwise in the sealed frame. */
  PortHost.prototype._load = function (doc) {
    var self = this; clearTimeout(this._rt); this._pending = null;
    // BUG-520: every load gets a brand-new frame. Re-navigating the same frame (with its sandbox and
    // permissions changed) sometimes left a lesson that ran but never drew until the page was reloaded.
    var old = this.o.frame, f = document.createElement('iframe');
    ['id', 'class', 'style', 'title', 'referrerpolicy'].forEach(function (a) { if (old.hasAttribute(a)) f.setAttribute(a, old.getAttribute(a)); });
    this.o.frame = f;
    if (this._runner && !this._runnerDown) {
      this._open = true; this._pending = doc;
      f.setAttribute('sandbox', OPEN_SANDBOX); f.setAttribute('allow', OPEN_ALLOW);
      f.src = this._runner; old.replaceWith(f);
      // the runner didn't answer (offline, blocked, not set up yet): fall back to the sealed frame
      this._rt = setTimeout(function () { if (self._pending === doc) { self._runnerDown = true; self._load(doc); } }, 5000);
      return;
    }
    this._open = false;
    f.setAttribute('sandbox', this._sealedSandbox); f.srcdoc = doc; old.replaceWith(f);
  };
  function youtubeId(src) {
    var s = String(src || '').trim(), m = s.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([A-Za-z0-9_-]{11})/);
    return m ? m[1] : (/^[A-Za-z0-9_-]{11}$/.test(s) ? s : '');
  }
  PortHost.prototype._closeVideo = function () { if (this._stopRec) { var f = this._stopRec; this._stopRec = null; f(true); } if (this._sheet) { this._sheet.remove(); this._sheet = null; } };
  // Lesson file paths: relative, inside the lesson, never the files Worldview manages itself.
  var MEDIA = /\.(mp4|webm|ogg|ogv|mov|m4v|mp3|m4a|wav|oga|png|jpe?g|gif|webp|svg)$/i, DATA = /\.(json|txt|csv|md)$/i;
  function cleanPath(p) {
    p = String(p || '').trim().replace(/^\.\//, '');
    if (!p || p.length > 160 || /(^|\/)\.|\.\.|\\|^\/|[^A-Za-z0-9._\/ -]/.test(p)) return '';
    if (/^(index\.html?|lesson\.json|claude\.md|agents\.md|gemini\.md)$/i.test(p)) return '';
    return MEDIA.test(p) || DATA.test(p) ? p : '';
  }
  var FILES_BASE = FILES;
  PortHost.prototype._fileReply = function (id, r) { this._send('answer', {id: id, value: r}); };
  PortHost.prototype._saveFile = function (m) {
    var self = this, id = clip(m.id, 40), path = cleanPath(m.path), c = m.content;
    if (!this.o.saveFile) return this._fileReply(id, {ok: false, error: 'Saving files works only in Teacher Studio.', type: 'unsupported'});
    if (!path) return this._fileReply(id, {ok: false, error: 'Use a relative path like map.json or video/clip.webm.', type: 'bad_path'});
    var blob = c instanceof Blob ? c : new Blob([typeof c === 'string' ? c : JSON.stringify(c)], {type: /\.json$/i.test(path) ? 'application/json' : 'text/plain'});
    if (DATA.test(path) && blob.size > 1024 * 1024) return this._fileReply(id, {ok: false, error: 'Text files can be at most 1 MB.', type: 'too_large'});
    if (blob.size >= 50 * 1024 * 1024) return this._fileReply(id, {ok: false, error: 'Files must be under 50 MB.', type: 'too_large'});
    Promise.resolve(this.o.saveFile(path, blob)).catch(function () { return null; }).then(function (r) { self._fileReply(id, r || {ok: false, error: 'Saving failed.', type: 'save_failed'}); });
  };
  PortHost.prototype._readFile = function (m) {
    var self = this, id = clip(m.id, 40), path = cleanPath(m.path), lid = this.o.lessonId;
    if (!path || !lid) return this._fileReply(id, null);
    fetch(filesRoot(lid, this.o.filesPrefix) + path.split('/').map(encodeURIComponent).join('/') + '?t=' + Date.now(), {cache: 'no-store'})
      .then(function (r) { return r.ok ? r.text() : null; }).catch(function () { return null; }).then(function (t) { self._fileReply(id, t); });
  };
  PortHost.prototype._record = function (m) {
    var self = this, id = clip(m.id, 40), gen = this.gen, finished = false, stream = null, rec = null, blob = null, url = '', tick = 0;
    var done = function (r) {
      if (finished) return; finished = true; self._stopRec = null; clearInterval(tick);
      if (stream) stream.getTracks().forEach(function (t) { t.stop(); }); if (url) URL.revokeObjectURL(url);
      if (self._sheet) { self._sheet.remove(); self._sheet = null; }
      if (gen === self.gen) self._fileReply(id, r);
    };
    if (!this.o.saveFile) return done({ok: false, error: 'Recording works only in Teacher Studio.', type: 'unsupported'});
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return done({ok: false, error: 'This browser can\'t record video.', type: 'unsupported'});
    this._closeVideo();
    var folder = cleanPath((m.folder || 'video') + '/x.webm') ? (m.folder || 'video') : 'video';
    var max = Math.max(5, Math.min(240, +m.maxSeconds || 90));
    var box = this.o.frame.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var sheet = document.createElement('div'); sheet.className = 'ph-video ph-record';
    sheet.style.cssText = 'position:absolute;inset:0;z-index:6;background:#0d0b09;color:#fff;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:12px;border-radius:inherit';
    var h = document.createElement('p'); h.style.cssText = 'margin:0;font-weight:700'; h.textContent = clip(m.title, 120) ? 'Record: ' + clip(m.title, 120) : 'Record a video';
    var v = document.createElement('video'); v.muted = true; v.playsInline = true; v.autoplay = true; v.style.cssText = 'width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;object-fit:cover';
    var st = document.createElement('p'); st.style.cssText = 'margin:0;font-size:14px;opacity:.85'; st.textContent = 'Asking for the camera and microphone…';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap';
    var b = function (t, cls) { var x = document.createElement('button'); x.type = 'button'; x.className = cls || 'btn'; x.textContent = t; x.hidden = true; row.appendChild(x); return x; };
    var bRec = b('● Record'), bStop = b('■ Stop'), bSave = b('Save'), bRetake = b('Retake', 'btn ghost'), bCancel = b('Cancel', 'btn ghost');
    bRetake.style.color = bCancel.style.color = '#fff'; bCancel.hidden = false;
    sheet.appendChild(h); sheet.appendChild(v); sheet.appendChild(st); sheet.appendChild(row); box.appendChild(sheet); this._sheet = sheet;
    this._stopRec = function () { done({ok: false, error: 'Cancelled.', type: 'cancelled'}); };
    bCancel.onclick = function () { done({ok: false, error: 'Cancelled.', type: 'cancelled'}); };
    function live() {
      blob = null; if (url) { URL.revokeObjectURL(url); url = ''; } v.removeAttribute('src'); v.controls = false; v.muted = true; v.srcObject = stream; v.play().catch(function () {});
      st.textContent = 'Ready. Press Record (up to ' + max + ' seconds).'; bRec.hidden = false; bStop.hidden = bSave.hidden = bRetake.hidden = true;
    }
    navigator.mediaDevices.getUserMedia({video: {width: {ideal: 1280}, height: {ideal: 720}}, audio: true}).then(function (s2) {
      if (finished) { s2.getTracks().forEach(function (t) { t.stop(); }); return; }
      stream = s2; live();
    }).catch(function (e) {
      var denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'), none = e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError');
      done({ok: false, error: denied ? 'Worldview needs the camera and microphone. Allow them for this site and try again.' : none ? 'No camera or microphone was found.' : 'The camera couldn\'t start.', type: denied ? 'camera_denied' : none ? 'no_camera' : 'camera_failed'});
    });
    bRec.onclick = function () {
      var types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'], type = '';
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { type = types[i]; break; }
      var chunks = [], bytes = 0, t0 = Date.now();
      rec = new MediaRecorder(stream, Object.assign(type ? {mimeType: type} : {}, {videoBitsPerSecond: 1500000, audioBitsPerSecond: 96000}));
      rec.ondataavailable = function (e) { if (e.data && e.data.size) { chunks.push(e.data); bytes += e.data.size; if (bytes >= 48 * 1024 * 1024 && rec.state === 'recording') rec.stop(); } };
      rec.onstop = function () {
        clearInterval(tick); if (finished) return;
        blob = new Blob(chunks, {type: (rec.mimeType || type || 'video/webm').split(';')[0]});
        v.srcObject = null; url = URL.createObjectURL(blob); v.src = url; v.muted = false; v.controls = true;
        st.textContent = 'Review it. Save attaches it to the lesson; Retake records again.' + (blob.size >= 50 * 1024 * 1024 ? ' It is too large to save: record a shorter clip.' : '');
        bStop.hidden = true; bSave.hidden = false; bSave.disabled = blob.size >= 50 * 1024 * 1024 || !blob.size; bRetake.hidden = false;
      };
      rec.start(500); bRec.hidden = true; bStop.hidden = false;
      tick = setInterval(function () { var sec = Math.round((Date.now() - t0) / 1000); st.textContent = '● Recording ' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2) + ' / ' + Math.floor(max / 60) + ':' + ('0' + max % 60).slice(-2); if (sec >= max && rec.state === 'recording') rec.stop(); }, 250);
    };
    bStop.onclick = function () { if (rec && rec.state === 'recording') rec.stop(); };
    bRetake.onclick = function () { live(); };
    bSave.onclick = function () {
      if (!blob) return;
      var ext = /mp4/.test(blob.type) ? '.mp4' : '.webm', base = String(m.name || m.title || 'clip').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'clip';
      var path = folder + '/' + base + '-' + new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14) + ext;
      bSave.disabled = bRetake.disabled = bCancel.disabled = true; st.textContent = 'Saving to the lesson…';
      Promise.resolve(self.o.saveFile(path, blob)).catch(function () { return null; }).then(function (r) {
        if (r && r.ok) return done(Object.assign({}, r, {seconds: Math.round(v.duration) || null, mime: blob.type}));
        bSave.disabled = bRetake.disabled = bCancel.disabled = false;
        st.textContent = (r && r.error) || 'Saving failed.'; st.textContent += ' Try Save again, or Cancel.';
      });
    };
  };
  PortHost.prototype._listen = function (m) {
    var self = this, id = clip(m.id, 40), full = !!m.full, gen = this.gen, finished = false;
    var done = function (r) {
      if (finished) return; finished = true; self._stopRec = null; if (self._sheet) { self._sheet.remove(); self._sheet = null; }
      if (gen !== self.gen) return;
      if (r && r.ok && r.text) { self.record.push({kind: 'voice', question: clip(m.prompt, 300), answer: clip(r.text, 500), outcome: ''}); self._changed(); }
      self._send('answer', {id: id, value: full ? r : (r && r.ok ? r.text : null)});
    };
    if (!this.o.transcribe || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !window.MediaRecorder) return done({ok: false, error: 'Voice isn\'t available in this browser.', type: 'unsupported'});
    this._closeVideo();
    var box = this.o.frame.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var sheet = document.createElement('div'); sheet.className = 'ph-video ph-listen';
    sheet.style.cssText = 'position:absolute;left:0;right:0;bottom:0;z-index:5;background:rgba(20,16,12,.94);color:#fff;display:grid;gap:10px;padding:16px;border-radius:0 0 22px 22px;text-align:center';
    var p = document.createElement('p'); p.style.cssText = 'margin:0;font-weight:700;font-size:15px'; p.textContent = clip(m.prompt, 160) || 'Speak now';
    var st = document.createElement('p'); st.style.cssText = 'margin:0;font-size:14px;opacity:.85'; st.textContent = 'Starting the microphone…';
    var row = document.createElement('div'); row.style.cssText = 'display:flex;gap:8px;justify-content:center';
    var stop = document.createElement('button'); stop.type = 'button'; stop.className = 'btn'; stop.textContent = 'Done'; stop.disabled = true;
    var cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn ghost'; cancel.textContent = 'Cancel'; cancel.style.color = '#fff';
    row.appendChild(stop); row.appendChild(cancel); sheet.appendChild(p); sheet.appendChild(st); sheet.appendChild(row); box.appendChild(sheet); this._sheet = sheet;
    var max = Math.max(5, Math.min(120, +m.maxSeconds || 60)), lang = /^[a-z]{2}(-[A-Z]{2})?$/.test(m.lang || '') ? m.lang : '';
    navigator.mediaDevices.getUserMedia({audio: true}).then(function (stream) {
      if (finished) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      var types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'], type = '';
      for (var i = 0; i < types.length; i++) if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(types[i])) { type = types[i]; break; }
      var rec = new MediaRecorder(stream, type ? {mimeType: type} : undefined), chunks = [], t0 = Date.now(), cancelled = false;
      var tick = setInterval(function () { var sec = Math.round((Date.now() - t0) / 1000); st.textContent = '● Listening… ' + Math.floor(sec / 60) + ':' + ('0' + sec % 60).slice(-2); if (sec >= max) stopNow(false); }, 250);
      function stopNow(cancel) { cancelled = cancel; clearInterval(tick); if (rec.state !== 'inactive') rec.stop(); }
      self._stopRec = stopNow;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onstop = function () {
        stream.getTracks().forEach(function (t) { t.stop(); });
        if (cancelled) return done({ok: false, error: 'Cancelled.', type: 'cancelled'});
        st.textContent = 'Turning it into text…'; stop.disabled = true;
        Promise.resolve(self.o.transcribe(new Blob(chunks, {type: rec.mimeType || type || 'audio/webm'}), lang)).catch(function () { return null; }).then(function (r) { done(r || {ok: false, error: 'Worldview couldn\'t turn that recording into text.', type: 'network'}); });
      };
      rec.start(250); stop.disabled = false;
      stop.onclick = function () { stopNow(false); };
      cancel.onclick = function () { stopNow(true); };
    }).catch(function () { done({ok: false, error: 'Worldview needs the microphone. Allow it for this site and try again.', type: 'mic_denied'}); });
    cancel.onclick = function () { done({ok: false, error: 'Cancelled.', type: 'cancelled'}); };
  };
  PortHost.prototype._audioUI = function (a, text, tap) {
    var box = this.o.frame.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    if (!a.bar) {
      a.bar = document.createElement('div'); a.bar.className = 'ph-audio'; a.bar.setAttribute('role', 'status');
      a.bar.style.cssText = 'position:absolute;top:10px;left:10px;z-index:7;display:flex;gap:8px;align-items:center;background:rgba(20,16,12,.85);color:#fff;border-radius:999px;padding:5px 6px 5px 12px;font:600 13px system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.3)';
      box.appendChild(a.bar);
    }
    var self = this; a.bar.innerHTML = '';
    var sp = document.createElement('span'); sp.textContent = text; a.bar.appendChild(sp);
    var b = document.createElement('button'); b.type = 'button'; b.className = 'btn small'; b.style.cssText = 'padding:3px 10px;font-size:12px';
    b.textContent = tap ? 'Tap to start' : 'Stop'; b.onclick = tap || function () { self._audioStop('stopped_by_user'); };
    a.bar.appendChild(b);
  };
  PortHost.prototype._audioStop = function (reason, info) {
    var a = this._audio; if (!a) return; this._audio = null;
    clearInterval(a.timer); clearTimeout(a.wait);
    if (a.stream) a.stream.getTracks().forEach(function (t) { try { t.stop(); } catch (e) {} });
    if (a.ctx) { try { a.ctx.close(); } catch (e) {} }
    if (a.bar) a.bar.remove();
    if (reason && a.started && a.gen === this.gen) this._send('audioend', {info: Object.assign({reason: reason}, info || {})});
  };
  PortHost.prototype._audioStart = function (m) {
    var self = this, id = clip(m.id, 40), o = m.opts || {};
    this._audioStop('replaced');
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia || !AC) return this._send('answer', {id: id, value: {ok: false, error: 'This browser can\'t listen to the microphone. Try Chrome, Edge, Safari or Firefox.', type: 'unsupported'}});
    var cfg = {pitch: o.pitch !== false, minHz: clamp(+o.minHz || 60, 30, 2000), maxHz: 0, silenceDb: o.silenceDb == null ? -55 : clamp(+o.silenceDb, -90, -10), clarityMin: clamp(+o.clarity || 0.8, 0.5, 0.99)};
    cfg.maxHz = clamp(+o.maxHz || 1200, cfg.minHz + 10, 4000);
    var rate = clamp(Math.round(+o.rate || 20), 5, 30), a = this._audio = {gen: this.gen, started: false};
    this._audioUI(a, 'Asking for the microphone…');
    navigator.mediaDevices.getUserMedia({audio: {echoCancellation: false, noiseSuppression: false, autoGainControl: false}}).then(function (stream) {
      if (self._audio !== a) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      a.stream = stream;
      var ctx = a.ctx = new AC(), src = ctx.createMediaStreamSource(stream), an = ctx.createAnalyser(); an.fftSize = 4096; src.connect(an);
      var buf = new Float32Array(an.fftSize);
      stream.getAudioTracks().forEach(function (t) { t.addEventListener('ended', function () { if (self._audio === a) self._audioStop('interrupted', {error: 'The microphone stopped (unplugged or taken by another app).'}); }); });
      var begin = function () {
        if (self._audio !== a || a.started) return; a.started = true; clearTimeout(a.wait);
        var t0 = performance.now();
        self._audioUI(a, '🎙 ' + (clip(o.label, 40) || (cfg.pitch ? 'Listening for pitch' : 'Listening')));
        a.timer = setInterval(function () { an.getFloatTimeDomainData(buf); var f = analyse(buf, ctx.sampleRate, cfg); f.t = Math.round(performance.now() - t0); self._send('audioframe', {frame: f}); }, Math.round(1000 / rate));
        self._send('answer', {id: id, value: {ok: true, sampleRate: ctx.sampleRate, rate: rate, windowMs: Math.round(an.fftSize / ctx.sampleRate * 1000), minHz: cfg.minHz, maxHz: cfg.maxHz}});
      };
      var needTap = function () { if (self._audio === a && !a.started) self._audioUI(a, '🎙 Ready', function () { ctx.resume().then(begin); }); };
      if (ctx.state === 'running') begin();
      else { ctx.resume().then(function () { if (ctx.state === 'running') begin(); }).catch(function () {}); a.wait = setTimeout(needTap, 600); }
    }).catch(function (e) {
      var denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError'), none = e && (e.name === 'NotFoundError' || e.name === 'OverconstrainedError');
      if (self._audio === a) self._audioStop(null);
      self._send('answer', {id: id, value: {ok: false, error: denied ? 'Worldview needs the microphone. Allow it for this site in the browser settings, then try again.' : none ? 'No microphone was found on this device.' : 'The microphone couldn\'t start. Close other apps using it and try again.', type: denied ? 'mic_denied' : none ? 'no_mic' : 'audio_failed'}});
    });
  };
  // a page in the background, or leaving it, always releases the microphone
  var HOSTS = [];
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') HOSTS.forEach(function (h) { if (h._audio) h._audioStop('interrupted', {error: 'Listening stopped because the page was in the background.'}); }); });
  addEventListener('pagehide', function () { HOSTS.forEach(function (h) { h._audioStop(null); }); });
  /* Docked video: a small player in the corner; the lesson stays usable (and listening). */
  PortHost.prototype._closeDock = function (reason) { var d = this._dock; if (!d) return; this._dock = null; removeEventListener('message', d.onmsg); clearInterval(d.ping); d.el.remove(); if (reason && d.gen === this.gen) this._send('answer', {id: d.id, value: {ok: true, reason: reason}}); };
  PortHost.prototype._videoDock = function (m, vid, q) {
    var self = this; this._closeDock('replaced');
    var box = this.o.frame.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var el = document.createElement('div'); el.className = 'ph-dock';
    el.style.cssText = 'position:absolute;top:10px;right:10px;z-index:6;width:min(46%,340px);background:#000;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(0,0,0,.4)';
    var bar = document.createElement('div'); bar.style.cssText = 'display:flex;align-items:center;gap:6px;padding:4px 6px 4px 10px;color:#fff;font:600 12px system-ui,sans-serif';
    var tt = document.createElement('span'); tt.style.cssText = 'flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap'; tt.textContent = clip(m.title, 80) || 'Video';
    var x = document.createElement('button'); x.type = 'button'; x.textContent = '✕'; x.setAttribute('aria-label', 'Close the video'); x.style.cssText = 'all:unset;cursor:pointer;padding:2px 6px;font-size:14px';
    bar.appendChild(tt); bar.appendChild(x);
    var v = document.createElement('iframe'); v.src = 'https://www.youtube-nocookie.com/embed/' + vid + q + '&enablejsapi=1&origin=' + encodeURIComponent(location.origin);
    v.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; v.allowFullscreen = true; v.referrerPolicy = 'strict-origin-when-cross-origin';
    v.style.cssText = 'display:block;width:100%;height:auto;min-height:0;aspect-ratio:16/9;border:0;border-radius:0'; v.title = tt.textContent;
    el.appendChild(bar); el.appendChild(v); box.appendChild(el);
    var d = this._dock = {id: clip(m.id, 40), el: el, gen: this.gen};
    // YouTube's player reports its state by message once asked to; state 0 means the segment ended
    d.onmsg = function (e) { if (e.source !== v.contentWindow) return; var data; try { data = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch (er) { return; } if (!data) return; clearInterval(d.ping); var st = data.event === 'onStateChange' ? data.info : data.info && data.info.playerState; if (st === 0) self._closeDock('ended'); };
    addEventListener('message', d.onmsg);
    d.ping = setInterval(function () { try { v.contentWindow.postMessage(JSON.stringify({event: 'listening', id: 'wv', channel: 'widget'}), '*'); } catch (er) {} }, 500);
    x.onclick = function () { self._closeDock('closed'); };
  };
  PortHost.prototype._video = function (m) {
    var self = this, id = clip(m.id, 40), vid = youtubeId(m.src);
    if (!vid) { this._line('note', 'This video link isn\'t a YouTube video Worldview can play.'); this._send('answer', {id: id, value: m.dock ? {ok: false, error: 'Only YouTube links play here; play lesson files with a <video> in the lesson.', type: 'bad_link'} : false}); return; }
    var q = '?rel=0&playsinline=1', st = Math.max(0, Math.floor(+m.start || 0)), en = Math.max(0, Math.floor(+m.end || 0));
    if (st) q += '&start=' + st; if (en > st) q += '&end=' + en;
    if (m.dock) return this._videoDock(m, vid, q + (m.autoplay ? '&autoplay=1' : ''));
    this._closeVideo();
    var box = this.o.frame.parentNode; if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
    var sheet = document.createElement('div'); sheet.className = 'ph-video';
    sheet.style.cssText = 'position:absolute;inset:0;z-index:5;background:#000;display:flex;flex-direction:column;justify-content:center;gap:10px;padding:10px;border-radius:inherit';
    if (m.title) { var t = document.createElement('p'); t.textContent = clip(m.title, 120); t.style.cssText = 'color:#fff;margin:0;font-weight:700;font-size:15px'; sheet.appendChild(t); }
    var v = document.createElement('iframe'); v.src = 'https://www.youtube-nocookie.com/embed/' + vid + q; v.title = clip(m.title, 120) || 'Video';
    v.allow = 'autoplay; encrypted-media; fullscreen; picture-in-picture'; v.allowFullscreen = true; v.referrerPolicy = 'strict-origin-when-cross-origin';
    v.style.cssText = 'flex:none;width:100%;height:auto;min-height:0;aspect-ratio:16/9;border:0;border-radius:10px;background:#111';
    var b = document.createElement('button'); b.type = 'button'; b.textContent = 'Done watching'; b.className = 'btn';
    b.addEventListener('click', function () { self._closeVideo(); self._send('answer', {id: id, value: true}); });
    sheet.appendChild(v); sheet.appendChild(b); box.appendChild(sheet); this._sheet = sheet;
  };
  PortHost.prototype.destroy = function () { clearTimeout(this._rt); this._audioStop(null); this._closeDock(null); removeEventListener('message', this._listener); clearTimeout(this._t); HOSTS = HOSTS.filter(function (h) { return h !== this; }, this); };
  PortHost.prototype.capabilities = function () {
    return {ask: true, predict: true, video: true, videoDock: true, ai: !!this.o.ai, listen: !!this.o.transcribe,
      audio: !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext)),
      record: !!this.o.saveFile, saveFile: !!this.o.saveFile, readFile: !!this.o.lessonId, state: true, persistentState: !!this.o.state, teacherTools: !!this.o.saveFile, direct: !!this._open};
  };
  PortHost.prototype._send = function (type, body) { try { this.o.frame.contentWindow.postMessage(Object.assign({port: 'worldview', v: 1, type: type}, body || {}), this._open ? this._runnerOrigin : '*'); } catch (e) {} };
  PortHost.prototype._changed = function () { if (this.o.onChange) this.o.onChange(this.record.slice(), this.done); };
  PortHost.prototype._line = function (kind, text) {
    var d = document.createElement('div'); d.className = 'ph-line ph-' + kind; d.textContent = text;
    this.o.panel.appendChild(d); d.scrollIntoView({block: 'nearest', behavior: 'smooth'}); return d;
  };
  PortHost.prototype._askBox = function (item) {
    var self = this, box = document.createElement('form'); box.className = 'ph-ask';
    var q = document.createElement('p'); q.className = 'ph-q'; q.textContent = item.question + (item.kind === 'predict' ? ' (a number' + (item.unit ? ', in ' + item.unit : '') + ')' : '');
    var input = document.createElement(item.kind === 'predict' ? 'input' : 'textarea');
    if (item.kind === 'predict') { input.type = 'text'; input.inputMode = 'decimal'; } else input.rows = 3;
    input.placeholder = item.kind === 'predict' ? 'Your guess' : 'Your answer';
    input.setAttribute('aria-label', item.question);
    var btn = document.createElement('button'); btn.type = 'submit'; btn.textContent = 'Send';
    box.appendChild(q); box.appendChild(input); box.appendChild(btn);
    box.addEventListener('submit', function (e) {
      e.preventDefault(); var text = input.value.trim(); if (!text) { input.focus(); return; }
      box.remove(); self._line('me', text); self._answer(item, text);
    });
    this.o.panel.appendChild(box); box.scrollIntoView({block: 'nearest', behavior: 'smooth'});
    setTimeout(function () { try { input.focus({preventScroll: true}); } catch (e) {} }, 50);
  };
  PortHost.prototype._queue = function (item) { this.q.push(item); if (this.q.length === 1) this._askBox(item); };
  PortHost.prototype._answer = function (item, text) {
    this.q.shift();
    if (item.kind === 'predict') {
      var n = parseFloat((text.replace(/,/g, '').match(/-?\d+(\.\d+)?/) || [''])[0]); n = isNaN(n) ? null : n;
      this.preds[item.id] = {value: n, unit: item.unit, question: item.question, outcome: item.outcome};
      this.record.push({kind: 'prediction', question: item.question, answer: text, outcome: item.outcome || ''});
      if (item.source === 'lesson') this._send('answer', {id: item.id, value: n});
    } else {
      this.record.push({kind: item.source === 'host' ? 'explanation' : 'answer', question: item.question, answer: text, outcome: item.outcome || ''});
      if (item.source === 'lesson') this._send('answer', {id: item.id, value: text});
    }
    this._changed();
    if (this.q.length) this._askBox(this.q[0]);
  };
  PortHost.prototype._message = function (m) {
    if (!m || m.port !== 'worldview' || typeof m.type !== 'string') return;
    var self = this;
    switch (m.type) {
      case 'hello': {
        var man = m.manifest && typeof m.manifest === 'object' ? m.manifest : {};
        this.connected = true; clearTimeout(this._t);
        this.manifest = {title: clip(man.title, 120), by: clip(man.by, 80), outcomes: Array.isArray(man.outcomes) ? man.outcomes.slice(0, 6).map(function (o, i) { return {id: clip(o && o.id || 'o' + (i + 1), 20), text: clip(o && o.text || o, 200)}; }) : []};
        if (this.o.onTitle && this.manifest.title) this.o.onTitle(this.manifest.title);
        this._send('welcome', {memory: [], viewer: this.o.viewer === 'teacher' ? 'teacher' : 'student', capabilities: this.capabilities()});
        break;
      }
      case 'say': this._line('tutor', clip(m.text, 500)); break;
      case 'ask': this._queue({source: 'lesson', kind: 'ask', id: clip(m.id, 40), question: clip(m.question, 400), outcome: clip(m.outcome, 20)}); break;
      case 'predict': this._queue({source: 'lesson', kind: 'predict', id: clip(m.id, 40), question: clip(m.question, 400), unit: clip(m.unit, 20), outcome: clip(m.outcome, 20)}); break;
      case 'result': {
        var p = this.preds[clip(m.id, 40)], actual = parseFloat(m.actual); delete this.preds[clip(m.id, 40)];
        if (m.say) this._line('note', clip(m.say, 300));
        if (p && p.value != null && isFinite(actual)) {
          var unit = p.unit ? ' ' + p.unit : '', close = Math.abs(actual - p.value) <= Math.max(0.5, Math.abs(actual) * 0.05);
          this.record.push({kind: 'result', question: p.question, answer: 'Guessed ' + p.value + unit + '; it was ' + actual + unit, outcome: p.outcome || ''}); this._changed();
          this._queue({source: 'host', kind: 'ask', id: 'why', outcome: p.outcome, question: close ? 'You guessed ' + p.value + unit + ' and it was ' + actual + unit + '. What told you it would be about that?' : 'You guessed ' + p.value + unit + '; it was ' + actual + unit + '. What do you think explains the difference?'});
        }
        break;
      }
      case 'human': {
        var text = clip(m.text, 600);
        this.record.push({kind: 'for the teacher', question: text, answer: '', outcome: clip(m.outcome, 20)}); this._changed();
        this._line('note', 'Sent to your teacher. They will read it later in Worldview.');
        setTimeout(function () { self._send('answer', {id: clip(m.id, 40), value: 'Your teacher will read this and reply later.'}); }, 400);
        break;
      }
      case 'evidence': { var lv = m.data && m.data.level != null ? Math.max(0, Math.min(3, Math.round(+m.data.level) || 0)) : null; this.record.push({kind: 'evidence', question: '', answer: clip(m.text, 400), outcome: clip(m.outcome, 20), level: lv}); this._changed(); break; }
      case 'progress': if (this.o.progress) this.o.progress.style.width = Math.round(Math.max(0, Math.min(1, +m.value || 0)) * 100) + '%'; break;
      case 'done': this.done = true; if (m.summary && typeof m.summary === 'object' && m.summary.levels && typeof m.summary.levels === 'object') { var L = {}; Object.keys(m.summary.levels).slice(0, 8).forEach(function (k) { L[clip(k, 20)] = Math.max(0, Math.min(3, Math.round(+m.summary.levels[k]) || 0)); }); this.record.push({kind: 'understanding', question: '', answer: '', outcome: '', levels: L}); } if (this.o.progress) this.o.progress.style.width = '100%'; this._line('done', 'Finished. Nice work.'); this._changed(); break;
      case 'video': this._video(m); break;
      case 'videoclose': this._closeDock('closed'); break;
      case 'audiostart': this._audioStart(m); break;
      case 'audiostop': this._audioStop('stopped'); break;
      case 'stateget': { var sv = null; try { sv = this.o.state ? this.o.state.load() : this._mem; } catch (e) {} this._send('answer', {id: clip(m.id, 40), value: sv == null ? null : sv}); break; }
      case 'stateset': { var js = ''; try { js = JSON.stringify(m.value); } catch (e) {} if (!js || js.length > 65536) { this._line('note', 'The lesson tried to save more than 64 KB of progress; it wasn\'t saved.'); break; } var val = JSON.parse(js); if (this.o.state) { try { this.o.state.save(val); } catch (e) {} } else this._mem = val; break; }
      case 'listen': this._listen(m); break;
      case 'record': this._record(m); break;
      case 'savefile': this._saveFile(m); break;
      case 'readfile': this._readFile(m); break;
      case 'ai': {
        var aid = clip(m.id, 40), gen = this.gen, t0 = Date.now();
        var msgs = (Array.isArray(m.messages) ? m.messages : []).slice(-40).map(function (x) { return {role: x && x.role === 'assistant' ? 'assistant' : 'user', content: clip(x && x.content, 4000)}; });
        if (!this.o.ai || !msgs.length) { this._send('answer', {id: aid, value: null}); break; }
        var wait = this._line('note', 'Thinking…');
        var full = !!m.full, asJson = !!m.json;
        Promise.resolve(this.o.ai({system: clip(m.system, 8000), messages: msgs, maxTokens: +m.maxTokens || 0, json: asJson})).catch(function () { return null; }).then(function (r) {
          wait.remove(); if (gen !== self.gen) return;
          r = r || {ok: false, error: 'The AI couldn\'t answer just now.', type: 'network'};
          if (full) { if (r.ok && self.aiCount < 40) { self.aiCount++; self.record.push({kind: 'ai', question: clip(msgs[msgs.length - 1].content, 300), answer: clip(r.text, 500), outcome: ''}); self._changed(); } return self._send('answer', {id: aid, value: r}); }
          if (r.ok && r.text) {
            if (self.aiCount < 40) { self.aiCount++; self.record.push({kind: 'ai', question: clip(msgs[msgs.length - 1].content, 300), answer: clip(r.text, 500), outcome: ''}); self._changed(); }
            if (self.o.showTiming) self._line('note', 'AI replied in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' + (r.ms ? ' (the AI itself took ' + (r.ms / 1000).toFixed(1) + ' s)' : '') + '. Only you see this line.');
            self._send('answer', {id: aid, value: asJson ? (r.json === undefined ? null : r.json) : r.text});
          } else {
            self._line('note', (r && r.error) || 'The AI couldn\'t answer just now.');
            self._send('answer', {id: aid, value: null});
          }
        });
        break;
      }
      case 'crash': this._line('note', 'The lesson hit a problem: ' + clip(m.message, 160)); break;
      // A request this player doesn't know (a newer lesson, an older page): answer it, so the lesson never waits forever.
      default: if (m.id != null && ['evidence', 'remember', 'progress', 'done', 'say', 'event', 'result', 'hello', 'audiostop', 'stateset', 'videoclose'].indexOf(m.type) < 0) this._send('answer', {id: clip(m.id, 40), value: {ok: false, error: 'This Worldview page doesn\'t support ' + clip(m.type, 30) + ' yet. Reload the page.', type: 'unsupported'}});
    }
  };

  /* Plain-language checks a teacher can act on. */
  function checkLesson(html) {
    var h = String(html || ''), out = [];
    function add(ok, label, detail) { out.push({ok: ok, label: label, detail: detail || ''}); }
    add(/WorldviewPort\s*\(/.test(h), 'Connects to Worldview', 'Without it, students can use the page but Worldview can\'t ask its questions or save their answers.');
    add(!/(sk-[A-Za-z0-9_-]{12,}|api\.openai\.com|generativelanguage\.googleapis\.com|api\.anthropic\.com|openrouter\.ai\/api|Bearer\s+[A-Za-z0-9._-]{12,})/i.test(h), 'No AI keys and no other AI', 'Remove any key: Worldview runs the AI.');
    add(!/(fetch\s*\(|XMLHttpRequest|WebSocket|<script[^>]+src=["']https?:|<link[^>]+href=["']https?:|@import\s+url\(["']?https?:)/i.test(h), 'Everything is inside the file', 'Lessons can\'t load code or styles from other websites.');
    add(/outcomes\s*:/.test(h), 'Says what students will be able to do', 'Add outcomes like "Can explain why…".');
    add(/\.(ask|predict)\s*\(/.test(h), 'Asks students something', 'Use wv.ask or wv.predict so their thinking is saved for you.');
    add(/\.done\s*\(/.test(h), 'Says when it\'s finished', 'Call wv.done() at the end.');
    add(!/getUserMedia/.test(h), 'Recording works', 'Lessons can\'t use the camera themselves. Use wv.record() instead.');
    add(!/(webkit)?SpeechRecognition/.test(h), 'Voice works everywhere', 'Browser speech recognition doesn\'t work in Worldview lessons. Use wv.listen() instead.');
    add(!/<iframe[^>]+(youtube\.com|youtube-nocookie\.com|youtu\.be)/i.test(h), 'Videos play', 'YouTube can\'t play inside the lesson itself. Use wv.video(\'YouTube link\') instead.');
    var wide = (h.match(/(?:^|[;{\s"'])(?:min-)?width\s*:\s*(\d{3,4})px/g) || []).map(function (x) { return +x.match(/(\d{3,4})px/)[1]; }).filter(function (n) { return n >= 480; });
    add(!wide.length, 'Fits a phone', wide.length ? 'It sets a fixed width of ' + Math.max.apply(null, wide) + 'px; phones are about 360–430px wide.' : '');
    return out;
  }

  window.WorldviewPortHost = {PortHost: PortHost, checkLesson: checkLesson, compose: compose};
})();
