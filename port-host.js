/* The Worldview port host (NAV-171 Phase 1). Runs a teacher's lesson file in a
   sealed frame and answers its port calls: questions the lesson asks appear
   under it and the learner answers in writing; predictions are compared with
   the result; a moment for the teacher is noted for the teacher. Used by
   studio.html (try it as a student) and play.html (the student's link).
   wv.ai asks Worldview's AI for a reply (NAV-171 Phase 2a) through o.ai, which
   the page supplies; the lesson decides how to show the reply. */
(function () {
  'use strict';
  var SDK = "(function(){window.WorldviewPort=function(manifest,handlers){handlers=handlers||{};var waiting={},aiN=0,inFrame=window.parent!==window;" +
    "function send(type,body){try{parent.postMessage(Object.assign({port:'worldview',v:1,type:type},body||{}),'*');}catch(e){}}" +
    "addEventListener('message',function(e){var m=e.data;if(!m||m.port!=='worldview'||e.source!==parent)return;" +
    "if(m.type==='welcome'&&handlers.onWelcome)handlers.onWelcome(m);if(m.type==='answer'&&waiting[m.id]){var d=waiting[m.id];delete waiting[m.id];d(m.value);}" +
    "if(m.type==='control'&&handlers.onControl)handlers.onControl(m.key,m.value);});" +
    "function wait(id,type,body){return new Promise(function(res){if(!inFrame)return res(null);waiting[id]=res;send(type,Object.assign({id:id},body));});}" +
    "send('hello',{manifest:manifest});" +
    "return{say:function(t){send('say',{text:t});},event:function(n,d,s,o){send('event',{name:n,data:d||{},say:s||'',react:!!(o&&o.react)});}," +
    "predict:function(id,q,u,o){return wait(id,'predict',Object.assign({question:q,unit:u||''},o||{}));},result:function(id,a,s){send('result',{id:id,actual:a,say:s||''});}," +
    "ask:function(id,q,o){return wait(id,'ask',Object.assign({question:q},o||{}));},human:function(id,r){return wait(id,'human',Object.assign({to:'teacher',kind:'question'},r||{}));}," +
    "evidence:function(o,t,d){send('evidence',{outcome:o,text:t,data:d||{}});},remember:function(k,v){send('remember',{key:k,value:v});}," +
    "progress:function(v,n){send('progress',{value:v,note:n||''});},ai:function(x,o){o=o||{};return wait('ai'+(++aiN),'ai',{messages:typeof x==='string'?[{role:'user',content:x}]:(x||[]),system:o.system||'',maxTokens:o.maxTokens||0});},done:function(s){send('done',{summary:s||{}});}};};})();" +
    "addEventListener('error',function(e){try{parent.postMessage({port:'worldview',v:1,type:'crash',message:String(e.message||'error').slice(0,200)},'*');}catch(x){}});";

  var FILES = 'https://eqppapoepynjvsfnoodj.supabase.co/storage/v1/object/public/lesson-files/';
  function compose(body, lessonId) {
    var base = lessonId && !/<base\s/i.test(body) ? '<base href="' + FILES + encodeURIComponent(lessonId) + '/">' : '';
    var head = '<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' + base + '<script>' + SDK + '<\/script>';
    if (/<head[^>]*>/i.test(body)) return body.replace(/<head[^>]*>/i, function (m) { return m + head; });
    if (/<html[^>]*>/i.test(body)) return body.replace(/<html[^>]*>/i, function (m) { return m + '<head>' + head + '</head>'; });
    return '<!doctype html><html><head>' + head + '</head><body>' + body + '</body></html>';
  }
  var clip = function (s, n) { return String(s == null ? '' : s).slice(0, n); };

  /* opts: {frame, panel, progress, onChange(record), onTitle(title)} */
  function PortHost(opts) {
    this.o = opts; this.q = []; this.preds = {}; this.record = []; this.connected = false; this.done = false; this.manifest = null; this.aiCount = 0;
    var self = this;
    this._listener = function (e) { if (e.source === self.o.frame.contentWindow) self._message(e.data); };
    addEventListener('message', this._listener);
  }
  PortHost.prototype.run = function (html, lessonId) {
    this.q = []; this.preds = {}; this.record = []; this.connected = false; this.done = false; this.manifest = null; this.aiCount = 0; this.gen = (this.gen || 0) + 1;
    this.o.panel.innerHTML = ''; if (this.o.progress) this.o.progress.style.width = '0';
    this.o.frame.srcdoc = compose(String(html || ''), lessonId || this.o.lessonId);
    var self = this; clearTimeout(this._t);
    this._t = setTimeout(function () { if (!self.connected) self._line('note', 'This lesson isn\'t connected to Worldview, so its questions won\'t appear here. You can still use it above.'); }, 3500);
  };
  PortHost.prototype.destroy = function () { removeEventListener('message', this._listener); clearTimeout(this._t); };
  PortHost.prototype._send = function (type, body) { try { this.o.frame.contentWindow.postMessage(Object.assign({port: 'worldview', v: 1, type: type}, body || {}), '*'); } catch (e) {} };
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
        this._send('welcome', {memory: []});
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
      case 'ai': {
        var aid = clip(m.id, 40), gen = this.gen, t0 = Date.now();
        var msgs = (Array.isArray(m.messages) ? m.messages : []).slice(-40).map(function (x) { return {role: x && x.role === 'assistant' ? 'assistant' : 'user', content: clip(x && x.content, 4000)}; });
        if (!this.o.ai || !msgs.length) { this._send('answer', {id: aid, value: null}); break; }
        var wait = this._line('note', 'Thinking…');
        Promise.resolve(this.o.ai({system: clip(m.system, 8000), messages: msgs, maxTokens: +m.maxTokens || 0})).catch(function () { return null; }).then(function (r) {
          wait.remove(); if (gen !== self.gen) return;
          if (r && r.text) {
            if (self.aiCount < 40) { self.aiCount++; self.record.push({kind: 'ai', question: clip(msgs[msgs.length - 1].content, 300), answer: clip(r.text, 500), outcome: ''}); self._changed(); }
            if (self.o.showTiming) self._line('note', 'AI replied in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s' + (r.ms ? ' (the AI itself took ' + (r.ms / 1000).toFixed(1) + ' s)' : '') + '. Only you see this line.');
            self._send('answer', {id: aid, value: r.text});
          } else {
            self._line('note', (r && r.error) || 'The AI couldn\'t answer just now.');
            self._send('answer', {id: aid, value: null});
          }
        });
        break;
      }
      case 'crash': this._line('note', 'The lesson hit a problem: ' + clip(m.message, 160)); break;
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
    var wide = (h.match(/(?:^|[;{\s"'])(?:min-)?width\s*:\s*(\d{3,4})px/g) || []).map(function (x) { return +x.match(/(\d{3,4})px/)[1]; }).filter(function (n) { return n >= 480; });
    add(!wide.length, 'Fits a phone', wide.length ? 'It sets a fixed width of ' + Math.max.apply(null, wide) + 'px; phones are about 360–430px wide.' : '');
    return out;
  }

  window.WorldviewPortHost = {PortHost: PortHost, checkLesson: checkLesson, compose: compose};
})();
