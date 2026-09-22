/* LES-236: a finished lesson ends with something to keep. The card quotes only
   what the learner actually said in the final teach-back (the saved evidence),
   lists any part they moved past without showing it, and links the verified
   sources. Nothing is generated here; it reads saved lesson state. */
window.WorldviewLessonCard=(()=>{
 'use strict';
 const SHOWN='worldview-lesson-card-shown-v1:';
 function data(){
  let selection=null,journey=null,outcomes=[];
  try{selection=selectedPipelineMapRecord(selectedPipelineArtifact());journey=mockLearnerLiveJourney(selection);outcomes=pipelineLessonOutcomes(selection);}catch{return null;}
  if(!journey?.complete||!outcomes.length)return null;
  const gaps=new Map((journey.packet?.gaps||[]).map(g=>[g.outcomeId,g.gap]));
  const parts=outcomes.map(o=>({number:o.number,title:o.title,quotes:(journey.assessment?.[o.id]?.quotes||[]).filter(q=>typeof q==='string'&&q.trim()).slice(0,2),gap:gaps.get(o.id)||''}));
  const seen=new Set(),sources=[];
  for(const o of outcomes)for(const s of o.verifiedSupport?.sources||[]){if(!s.url||seen.has(s.url))continue;seen.add(s.url);sources.push({title:s.title||s.publisher||s.url,url:s.url});}
  return {runId:journey.runId,title:selection?.map?.lessonTitle||labState?.clarification?.topic||'Your lesson',parts,sources:sources.slice(0,8)};
 }
 function text(card=data()){
  if(!card)return '';
  const lines=['Lesson card: '+card.title,''];
  for(const p of card.parts){
   lines.push(p.number+' '+p.title);
   for(const q of p.quotes)lines.push('  In my words: "'+q.trim()+'"');
   if(p.gap)lines.push('  Still open: '+p.gap);
  }
  if(card.sources.length){lines.push('','Sources');for(const s of card.sources)lines.push('- '+s.title+' '+s.url);}
  return lines.join('\n');
 }
 function close(){const node=document.getElementById('lesson-card');if(node)node.hidden=true;}
 function show(card=data()){
  if(!card)return false;
  let node=document.getElementById('lesson-card');
  if(!node){node=document.createElement('section');node.id='lesson-card';node.className='lesson-card-sheet';node.setAttribute('role','dialog');node.setAttribute('aria-modal','true');node.setAttribute('aria-labelledby','lesson-card-title');(document.getElementById('mock-learner-shell')||document.body).append(node);}
  node.replaceChildren();
  const box=document.createElement('div');box.className='lesson-card-box';
  const head=document.createElement('header');
  const kicker=document.createElement('p');kicker.className='lesson-card-kicker';kicker.textContent='Lesson complete';
  const h=document.createElement('h2');h.id='lesson-card-title';h.textContent=card.title;
  head.append(kicker,h);box.append(head);
  const list=document.createElement('ol');list.className='lesson-card-parts';
  for(const p of card.parts){
   const li=document.createElement('li');const t=document.createElement('strong');t.textContent=p.title;li.append(t);
   for(const q of p.quotes){const b=document.createElement('blockquote');b.textContent='“'+q.trim()+'”';li.append(b);}
   if(p.gap){const g=document.createElement('p');g.className='lesson-card-gap';g.textContent='Still open: '+p.gap;li.append(g);}
   if(!p.quotes.length&&!p.gap){const g=document.createElement('p');g.className='lesson-card-gap';g.textContent='Covered in the lesson.';li.append(g);}
   list.append(li);
  }
  box.append(list);
  if(card.sources.length){
   const s=document.createElement('details');s.className='lesson-card-sources';const sum=document.createElement('summary');sum.textContent='Sources ('+card.sources.length+')';s.append(sum);
   for(const src of card.sources){const a=document.createElement('a');a.href=src.url;a.target='_blank';a.rel='noopener noreferrer nofollow';a.textContent=src.title;s.append(a);}
   box.append(s);
  }
  const actions=document.createElement('div');actions.className='lesson-card-actions';
  const copy=document.createElement('button');copy.type='button';copy.textContent='Copy lesson card';
  copy.onclick=async()=>{try{await navigator.clipboard.writeText(text(card));copy.textContent='Copied';}catch{copy.textContent='Copy not available here';}};
  const done=document.createElement('button');done.type='button';done.className='is-primary';done.textContent='Done';done.onclick=close;
  actions.append(copy,done);box.append(actions);
  node.append(box);node.hidden=false;done.focus({preventScroll:true});
  try{localStorage.setItem(SHOWN+card.runId,'1');}catch{}
  return true;
 }
 // Shown once, the moment a lesson is saved as complete; reachable again from Copy.
 function maybeShow(){
  const card=data();if(!card)return false;
  try{if(localStorage.getItem(SHOWN+card.runId))return false;}catch{}
  window.WorldviewLessonCues?.chime('pause');
  return show(card);
 }
 return {data,text,show,maybeShow,close};
})();
