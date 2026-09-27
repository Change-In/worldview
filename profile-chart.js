/* PRO-008: a simple daily bar chart on the profile. Each bar is the lessons
   started that day; the filled part is the ones completed that day. Built from
   the saved lesson list only; no new data is collected. */
window.WorldviewProfileChart=(()=>{
 'use strict';
 const DAYS=14;
 const dayKey=time=>{const d=new Date(time);return d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();};
 function series(runs,now=Date.now()){
  const days=[];
  for(let i=DAYS-1;i>=0;i--){const d=new Date(now);d.setHours(12,0,0,0);d.setDate(d.getDate()-i);days.push({key:dayKey(d),date:d,started:0,completed:0});}
  const index=new Map(days.map((d,i)=>[d.key,i]));
  for(const run of runs||[]){
   const time=value=>typeof value==='number'?value:Date.parse(value)||0;
   const started=time(run.startedAt)||time(run.updatedAt);
   const at=index.get(dayKey(started));if(at!==undefined)days[at].started++;
   if(run.phase==='complete'){const done=index.get(dayKey(time(run.updatedAt)||started));if(done!==undefined)days[done].completed++;}
  }
  return days;
 }
 function render(container,runs){
  /* PRO-010: thin axes, no headings or legend text; tapping (or hovering) a
     day shows that day's numbers above the chart, the day stays bright and
     the others fade back. No vertical marker line (owner: "tacky"). */
  const days=series(runs);
  const section=document.createElement('section');section.className='worldview-section profile-chart';
  const readout=document.createElement('div');readout.className='profile-chart-readout';readout.setAttribute('aria-live','polite');
  const day=document.createElement('strong'),counts=document.createElement('span');
  readout.append(day,counts);section.append(readout);
  const max=Math.max(3,...days.map(d=>Math.max(d.started,d.completed)));
  const W=320,H=122,left=20,bottom=18,top=6,plotW=W-left-4,plotH=H-top-bottom,slot=plotW/DAYS,bar=Math.max(6,slot*.56);
  const y=v=>top+plotH-(v/max)*plotH;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.setAttribute('class','profile-chart-svg');svg.setAttribute('role','group');
  svg.setAttribute('aria-label','Lessons per day for the last '+DAYS+' days');
  const add=(tag,attrs,text,parent=svg)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;parent.append(n);return n;};
  add('line',{x1:left,x2:W-4,y1:y(0),y2:y(0),class:'profile-chart-axis'});
  add('line',{x1:left,x2:left,y1:top,y2:y(0),class:'profile-chart-axis'});
  for(const v of [0,Math.round(max/2),max].filter((v,i,a)=>a.indexOf(v)===i))add('text',{x:left-5,y:y(v)+3,class:'profile-chart-tick','text-anchor':'end'},String(v));
  const label=d=>d.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'});
  const groups=[];
  const key=(cls,n,word)=>{const i=document.createElement('i');i.className='profile-chart-key '+cls;return [i,document.createTextNode(n+' '+word+' ')];};
  const pick=i=>{
   groups.forEach((g,j)=>g.classList.toggle('is-selected',j===i));svg.classList.add('has-selection');
   const d=days[i];day.textContent=i===DAYS-1?'Today':label(d);
   counts.replaceChildren(...key('is-started',d.started,'started'),...key('is-completed',d.completed,'finished'));
  };
  days.forEach((d,i)=>{
   const x=left+i*slot+(slot-bar)/2;
   const g=add('g',{class:'profile-chart-day',tabindex:'0',role:'button','aria-label':label(d)+': '+d.started+' started, '+d.completed+' finished'});
   if(d.started)add('rect',{x,y:y(d.started),width:bar,height:y(0)-y(d.started),rx:2,class:'profile-chart-started'},undefined,g);
   if(d.completed)add('rect',{x,y:y(d.completed),width:bar,height:y(0)-y(d.completed),rx:2,class:'profile-chart-completed'},undefined,g);
   add('rect',{x:left+i*slot,y:top,width:slot,height:plotH+bottom,class:'profile-chart-hit'},undefined,g);
   g.addEventListener('click',()=>pick(i));g.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse')pick(i);});
   g.addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();pick(i);}});
   groups.push(g);
   if(i===0||i===DAYS-1)add('text',{x:i===0?x:x+bar,y:H-4,class:'profile-chart-tick','text-anchor':i===0?'start':'end'},i===DAYS-1?'Today':d.date.toLocaleDateString(undefined,{month:'short',day:'numeric'}));
  });
  section.append(svg);
  pick(DAYS-1);
  container.append(section);
 }
 /* LES-242: "How you think". Recognition tags the learner earned in "Your
    thinking", counted across lessons on this device, each with its newest
    reason. Nothing is shown until a reading has earned one. */
 function renderThinking(container,owner){
  if(!owner)return;
  const prefix='worldview-thinking-v1:'+owner+':',tags=new Map();let lessons=0;
  try{
   for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);if(!key||!key.startsWith(prefix))continue;
    const value=JSON.parse(localStorage.getItem(key)||'null'),list=value?.reflection?.tags;if(!Array.isArray(list))continue;
    lessons++;const at=String(value.createdAt||'');
    for(const tag of list){
     if(!tag?.label)continue;const label=String(tag.label).slice(0,40),id=label.toLowerCase();
     const entry=tags.get(id)||{label,count:0,reason:'',at:''};entry.count++;
     if(!entry.at||at>entry.at){entry.reason=String(tag.reason||'').slice(0,300);entry.at=at;}
     tags.set(id,entry);
    }
   }
  }catch{return;}
  if(!tags.size)return;
  const section=document.createElement('section');section.className='worldview-section profile-thinking';
  const head=document.createElement('div');head.className='profile-chart-head';
  const title=document.createElement('h3');title.textContent='How you think';
  const summary=document.createElement('p');summary.className='profile-chart-summary';summary.textContent='Earned in your own words · '+lessons+' lesson'+(lessons===1?'':'s');
  head.append(title,summary);
  const list=document.createElement('ul');list.className='profile-thinking-tags';
  for(const tag of [...tags.values()].sort((a,b)=>b.count-a.count||b.at.localeCompare(a.at)).slice(0,8)){
   const item=document.createElement('li'),name=document.createElement('strong'),why=document.createElement('span');
   name.textContent=tag.label+(tag.count>1?' ×'+tag.count:'');why.textContent=tag.reason;item.append(name,why);list.append(item);
  }
  section.append(head,list);container.append(section);
 }
 return {render,series,renderThinking};
})();
