/* LES-257: the owner's live view of what Jev decided after each learner turn.
   The pill shows the top choice and how sure Jev is; tapping it opens every
   choice with its percentage and the criteria text Jev was judging against,
   plus the note sent to the tutor. It is shown only to admin accounts and
   never carries learner words: the server sends choice names, numbers and
   criteria text only. */
(function(root){
 'use strict';
 const label=name=>String(name||'').replace(/_/g,' ');
 const pct=p=>Number.isFinite(p)?Math.round(p*100)+'%':'—';
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 let host=null,pill=null,panel=null,current=null,enabled=false,open=false,openOption='',ticker=0;

 function mount(){
  if(host&&host.isConnected)return host;
  const shell=document.getElementById('mock-learner-shell');if(!shell)return null;
  host=el('div','jev-readout');host.id='jev-readout';host.hidden=true;
  pill=el('button','jev-readout-pill');pill.type='button';pill.setAttribute('aria-expanded','false');pill.setAttribute('aria-controls','jev-readout-panel');
  panel=el('div','jev-readout-panel');panel.id='jev-readout-panel';panel.hidden=true;
  pill.addEventListener('click',()=>{open=!open;render();});
  host.append(pill,panel);
  const anchor=document.getElementById('mock-learner-journey')||document.getElementById('mock-learner-progress');
  if(anchor&&anchor.parentNode===shell)anchor.after(host);else shell.prepend(host);
  return host;
 }

 function ago(at){
  const t=Date.parse(at);if(!Number.isFinite(t))return '';
  const s=Math.max(0,Math.round((Date.now()-t)/1000));
  return s<60?s+'s ago':Math.round(s/60)+' min ago';
 }

 function bars(list,chosen,{describe=true}={}){
  const wrap=el('div','jev-readout-options');
  for(const option of list||[]){
   const row=el('button','jev-readout-option'+(option.name===chosen?' is-chosen':''));row.type='button';
   const fill=el('span','jev-readout-bar');const inner=el('i');inner.style.width=(Number.isFinite(option.p)?Math.round(option.p*100):0)+'%';fill.append(inner);
   row.append(el('span','jev-readout-name',label(option.name)),fill,el('span','jev-readout-pct',pct(option.p)));
   row.title=option.description||'';
   wrap.append(row);
   if(describe&&option.description){
    const note=el('p','jev-readout-desc',option.description);note.hidden=openOption!==option.name;
    row.setAttribute('aria-expanded',String(!note.hidden));
    row.addEventListener('click',()=>{openOption=openOption===option.name?'':option.name;render();});
    wrap.append(note);
   }
  }
  return wrap;
 }

 function section(title){const s=el('section','jev-readout-section');s.append(el('h4',null,title));return s;}

 function render(){
  if(!mount())return;
  host.hidden=!enabled||!current;
  if(host.hidden){clearInterval(ticker);ticker=0;return;}
  const r=current;
  pill.replaceChildren();
  pill.classList.toggle('is-unavailable',!!r.unavailable);
  pill.classList.toggle('is-forward',!!r.forward);
  pill.append(el('span','jev-readout-dot'),el('span','jev-readout-who',r.unavailable?'Checker':'Jev'),
   el('b',null,label(r.choice)),...(r.unavailable?[]:[el('span','jev-readout-p',pct(r.probability))]));
  pill.setAttribute('aria-expanded',String(open));
  pill.setAttribute('aria-label',(r.unavailable?'Older checker decided ':'Jev chose ')+label(r.choice)+(r.unavailable?'':' at '+pct(r.probability))+'. Show details.');
  panel.hidden=!open;
  if(open){
   panel.replaceChildren();
   const meta=el('p','jev-readout-meta');meta.append(el('span',null,label(r.phase)),el('span','jev-readout-ago',ago(r.at)));
   if(r.version)meta.append(el('span',null,r.version));
   panel.append(meta);
   if(r.unavailable){
    panel.append(el('p','jev-readout-desc is-open','Jev was not used for this check ('+(r.decider||'older checker')+'). Its decision was: '+label(r.choice)+'.'));
   }else{
    if(r.description)panel.append(el('p','jev-readout-desc is-open',r.description));
    if(r.steering){const s=section('Told the tutor');s.append(el('p','jev-readout-steer',r.steering));panel.append(s);}
    const all=section('Every choice');all.append(bars(r.options,r.choice));panel.append(all);
    if(r.kind){const k=section('Kind of lesson');k.append(bars(r.kind.options,r.kind.choice));panel.append(k);}
    const facts=[];
    if(Number.isFinite(r.fitsTime))facts.push('Fits the time: '+pct(r.fitsTime)+' yes');
    if(Number.isInteger(r.learnerTurns))facts.push('Learner turns: '+r.learnerTurns+(r.capApplied?' · question limit reached, offering to start':''));
    if(Number.isFinite(r.mastery)&&Array.isArray(r.masteryLevels)){const i=Math.max(0,Math.min(r.masteryLevels.length-1,Math.round(r.mastery)));facts.push('Understanding: '+r.masteryLevels[i]+' ('+r.mastery+')');}
    if(Number.isFinite(r.recitation))facts.push('Repeating the tutor: '+pct(r.recitation));
    if(facts.length){const f=section('Also judged');for(const t of facts)f.append(el('p',null,t));panel.append(f);}
   }
  }
  if(!ticker)ticker=setInterval(()=>{const a=host&&host.querySelector('.jev-readout-ago');if(a&&current)a.textContent=ago(current.at);},5000);
 }

 function update(readout,options={}){
  enabled=options.enabled===true;
  const next=readout&&typeof readout==='object'?readout:null;
  const fresh=!!next&&(!current||next.at!==current.at||next.choice!==current.choice);
  current=next;render();
  if(fresh&&host&&!host.hidden){host.classList.remove('is-fresh');void host.offsetWidth;host.classList.add('is-fresh');}
 }

 root.WorldviewJevReadout={update};
})(window);
