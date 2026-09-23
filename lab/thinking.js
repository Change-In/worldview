/* LES-242 "Your thinking". An AI reading of the learner's own ideas in one
   lesson: a short summary, the ideas they put forward, their strengths, the
   questions their thinking leaves open, and up to three recognition tags they
   earned in this conversation, each with its reason. It is shown to the
   learner only and kept on this device with the lesson, so reopening it does
   not ask again. The server reads the conversation and stores nothing. */
window.WorldviewThinking=(()=>{
 'use strict';
 const PREFIX='worldview-thinking-v1:',MAX_TURNS=150,MAX_CHARS=38000;
 let sheet=null,box=null,busy=false,current=null;
 const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n;};
 const key=(owner,runId)=>PREFIX+owner+':'+runId;
 function load(owner,runId){try{const value=JSON.parse(localStorage.getItem(key(owner,runId))||'null');return value?.reflection?.summary?value:null;}catch{return null;}}
 function store(owner,runId,value){try{localStorage.setItem(key(owner,runId),JSON.stringify(value));}catch{/* Still shown; only not kept. */}}
 // The newest part of a long lesson matters most, so a long one is trimmed from the start.
 function recent(turns){
  const list=(Array.isArray(turns)?turns:[]).filter(t=>['user','assistant'].includes(t?.role)&&typeof t.content==='string'&&t.content.trim()).map(t=>({role:t.role,text:t.content.trim().slice(0,6000)}));
  let total=0,start=list.length;
  while(start>0&&list.length-start<MAX_TURNS&&total+list[start-1].text.length<=MAX_CHARS){start--;total+=list[start].text.length;}
  return list.slice(start);
 }
 function plain(value,topic){
  const r=value.reflection,lines=['Your thinking'+(topic?': '+topic:''),'',r.summary];
  if(r.ideas.length){lines.push('','Ideas you put forward');for(const idea of r.ideas)lines.push('• '+idea.title+(idea.detail?' — '+idea.detail:''));}
  if(r.strengths.length){lines.push('','Strengths');for(const strength of r.strengths)lines.push('• '+strength);}
  if(r.openQuestions.length){lines.push('','Questions to explore next');for(const question of r.openQuestions)lines.push('• '+question);}
  if(r.tags.length){lines.push('','Recognition');for(const tag of r.tags)lines.push('• '+tag.label+' — '+tag.reason);}
  return lines.join('\n');
 }
 function ensure(){
  if(sheet)return;
  sheet=el('div','thinking-sheet');sheet.hidden=true;sheet.setAttribute('role','dialog');sheet.setAttribute('aria-modal','true');sheet.setAttribute('aria-labelledby','thinking-title');
  box=el('div','thinking-box');sheet.append(box);
  sheet.addEventListener('click',event=>{if(event.target===sheet)close();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&sheet&&!sheet.hidden)close();});
  window.addEventListener('pagehide',close);
  document.body.append(sheet);
 }
 function close(){if(sheet){sheet.hidden=true;box.replaceChildren();}current=null;}
 function frame(topic){
  box.replaceChildren();
  const title=el('h2','',topic||'This conversation');title.id='thinking-title';
  box.append(el('p','thinking-kicker','Your thinking'),title);
 }
 function actions(buttons){
  const row=el('div','thinking-actions');
  for(const [label,run,primary] of buttons){const button=el('button',primary?'is-primary':'',label);button.type='button';button.onclick=run;row.append(button);}
  box.append(row);row.querySelector('button')?.focus({preventScroll:true});
 }
 function section(title,items,render){
  if(!items.length)return;
  const part=el('section','thinking-section'),list=el('ul');
  for(const item of items)list.append(render(item));
  part.append(el('h3','',title),list);box.append(part);
 }
 function pair(title,detail){const item=el('li');item.append(el('strong','',title));if(detail)item.append(el('span','',detail));return item;}
 function showResult(value,input){
  const r=value.reflection;frame(input.topic);
  if(r.tags.length){const tags=el('div','thinking-tags');for(const tag of r.tags){const chip=el('span','thinking-tag',tag.label);chip.title=tag.reason;tags.append(chip);}box.append(tags);}
  box.append(el('p','thinking-summary',r.summary));
  section('Ideas you put forward',r.ideas,idea=>pair(idea.title,idea.detail));
  section('Strengths',r.strengths,strength=>el('li','',strength));
  section('Questions to explore next',r.openQuestions,question=>el('li','',question));
  section('Why these tags',r.tags,tag=>pair(tag.label,tag.reason));
  box.append(el('p','thinking-note','Written by AI from your own words in this lesson. Only you can see it.'));
  const status=el('p','thinking-status');status.setAttribute('role','status');
  actions([
   ['Copy',async()=>{try{await navigator.clipboard.writeText(plain(value,input.topic));status.textContent='Copied.';}catch{status.textContent='Copying is not available here.';}},true],
   ['Read again',()=>void run(input,{fresh:true})],
   ['Done',close]
  ]);
  box.append(status);
 }
 async function run(input,{fresh=false}={}){
  if(!input||busy)return;
  ensure();current=input;sheet.hidden=false;
  const kept=!fresh&&load(input.owner,input.runId);
  if(kept){showResult(kept,input);return;}
  let turns=[];try{turns=recent(input.turns?.());}catch{/* Treated as nothing said yet. */}
  if(!turns.some(t=>t.role==='user'&&t.text.split(/\s+/).length>=4)){
   frame(input.topic);box.append(el('p','thinking-error','Say a little more in the lesson first. Your thinking is read from your own words.'));actions([['Close',close,true]]);return;
  }
  busy=true;frame(input.topic);
  const loading=el('p','thinking-loading','Reading what you said…');loading.setAttribute('role','status');box.append(loading);actions([['Close',close]]);
  try{
   const result=await input.request({action:'reflect',topic:input.topic||'',turns});
   const value={reflection:result.reflection,createdAt:new Date().toISOString(),turns:turns.length};
   store(input.owner,input.runId,value);
   if(current===input)showResult(value,input);
  }catch(error){
   if(current===input){frame(input.topic);const problem=el('p','thinking-error',error?.message||'Your thinking could not be read right now.');problem.setAttribute('role','alert');box.append(problem);actions([['Try again',()=>void run(input,{fresh}),true],['Close',close]]);}
  }finally{busy=false;}
 }
 return {open:run,load,plain,close,PREFIX};
})();
