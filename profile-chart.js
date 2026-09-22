/* PRO-001: a simple daily bar chart on the profile. Each bar is the lessons
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
  const days=series(runs);
  const total=days.reduce((n,d)=>n+d.started,0),finished=days.reduce((n,d)=>n+d.completed,0);
  const section=document.createElement('section');section.className='worldview-section profile-chart';
  const head=document.createElement('div');head.className='profile-chart-head';
  const title=document.createElement('h3');title.textContent='Your last two weeks';
  const summary=document.createElement('p');summary.className='profile-chart-summary';
  summary.textContent=total?`${total} lesson${total===1?'':'s'} started · ${finished} completed`:'Lessons you start will show up here, day by day.';
  head.append(title,summary);section.append(head);
  const max=Math.max(3,...days.map(d=>Math.max(d.started,d.completed)));
  const W=320,H=128,left=22,bottom=18,top=8,plotW=W-left-4,plotH=H-top-bottom,slot=plotW/DAYS,bar=Math.max(6,slot*.56);
  const y=v=>top+plotH-(v/max)*plotH;
  const ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg');
  svg.setAttribute('viewBox',`0 0 ${W} ${H}`);svg.setAttribute('class','profile-chart-svg');svg.setAttribute('role','img');
  svg.setAttribute('aria-label',`Lessons per day for the last ${DAYS} days: ${total} started, ${finished} completed.`);
  const add=(tag,attrs,text)=>{const n=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);if(text!==undefined)n.textContent=text;svg.append(n);return n;};
  const ticks=max<=4?[1,2,3,4].filter(v=>v<=max):[Math.round(max/3),Math.round(2*max/3),max];
  for(const v of ticks){add('line',{x1:left,x2:W-4,y1:y(v),y2:y(v),class:'profile-chart-grid'});add('text',{x:left-6,y:y(v)+3.5,class:'profile-chart-tick','text-anchor':'end'},String(v));}
  add('line',{x1:left,x2:W-4,y1:y(0),y2:y(0),class:'profile-chart-axis'});
  days.forEach((d,i)=>{
   const x=left+i*slot+(slot-bar)/2;
   if(d.started)add('rect',{x,y:y(d.started),width:bar,height:y(0)-y(d.started),rx:2,class:'profile-chart-started'});
   if(d.completed)add('rect',{x,y:y(d.completed),width:bar,height:y(0)-y(d.completed),rx:2,class:'profile-chart-completed'});
   if(i===0||i===DAYS-1||i===Math.floor(DAYS/2))add('text',{x:x+bar/2,y:H-4,class:'profile-chart-tick','text-anchor':'middle'},i===DAYS-1?'Today':d.date.toLocaleDateString(undefined,{month:'short',day:'numeric'}));
   const tip=add('title',{});tip.textContent=`${d.date.toLocaleDateString(undefined,{weekday:'short',month:'short',day:'numeric'})}: ${d.started} started, ${d.completed} completed`;
  });
  section.append(svg);
  const legend=document.createElement('p');legend.className='profile-chart-legend';
  legend.innerHTML='<span class="profile-chart-key is-started"></span>Started <span class="profile-chart-key is-completed"></span>Completed';
  section.append(legend);
  container.append(section);
 }
 return {render,series};
})();
