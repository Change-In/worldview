/* Native Live teaching. Captions are revisable fragments, never automatic submitted text turns. */
window.WorldviewLiveConversation=(()=>{
 'use strict';
 let host,ui,context,study,session,loadToken=0,loading=false,saving=null,enabled=false,saveTimer;
 let showCaptions=false,paused=false,startError=false,autoAttempts=0,restoreTimer;
 let appliedPhase=0,releasing=null,openingPending=true,output,lastConnectionState='',backgrounded=false;
 /* A glance at the clock, a notification pulled down or a low-battery alert
    hides the page for a moment. Ending the voice session on every hide made
    each of those a full reconnect, so a short absence is now ridden out and
    only a real departure stops the session. */
 const BACKGROUND_GRACE_MS=30000,IDLE_PAUSE_MS=60000,IDLE_LISTEN_MS=10*60*1000,REFRESH_WAIT_MS=45000;
 let hiddenAt=0,hiddenTimer=null,nextStart=null,starting=null,prepareTiming=null;const timingLog=[];
 const fragmentTimes=new Map();
 // VOI-144: a spoken fragment keeps the clock time it arrived (start_ms, epoch
 // milliseconds, when the provider sends no timing of its own), so a reopened
 // lesson and the copied transcript both show when each thing was said.
 const fragmentAt=f=>fragmentTimes.get(f.id)||(Number.isFinite(f.start_ms)&&f.start_ms>1e12?f.start_ms:null);
 let fragments=[],prefix=[],textInsertions=[],textSnapshot=null,exportWasText=false,exportStudyId='',ack=0,saveError='',request,scope='',draftKey='';
 const element=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function mount(adapter){
  host=adapter;const root=element('section');root.className='live-conversation';root.hidden=true;
  const note=element('p'),rate=element('span','$0.05/min'),total=element('strong','Est. total —');note.className='live-conversation-cost';note.append(rate,total);
  const actions=element('div');actions.className='live-conversation-actions';
  const enableAudio=element('button','Enable audio');enableAudio.hidden=true;
  const start=element('button','Start GPT Live'),retry=element('button','Retry saving');retry.hidden=true;
  // Mute, Pause and the transcript toggle are icon-only. Each keeps a real
  // aria-label and title, kept in sync by paint(), so the control is still
  // named for screen readers and on hover once the words are gone.
  const ICONS={
   mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/><path class="live-icon-slash" d="m4 4 16 16"/>',
   pause:'<rect x="7" y="5" width="3.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2"/>',
   play:'<path d="M8 5.5v13l10.5-6.5z"/>',
   transcript:'<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>'
  };
  const iconButton=(name,label)=>{const b=element('button');b.className='live-icon-button';b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>';b.setAttribute('aria-label',label);b.title=label;return b;};
  const mute=iconButton('mic','Mute mic'),end=iconButton('pause','Pause voice'),captions=iconButton('transcript','Show transcript'),textMode=element('button','Aa');
  /* Voice is the only mode being taken to release, so the switch to Text and
     the manual save retry are not on the learner's screen. Both stay built so
     nothing that references them breaks, and both stay hidden. */
  textMode.className='live-icon-button';textMode.hidden=true;textMode.setAttribute('aria-label','Switch to Text');textMode.title='Switch to Text';textMode.onclick=()=>host.onTextMode?.();
  for(const b of [start,enableAudio,mute,end,retry,captions,textMode])b.type='button';actions.append(start,enableAudio,mute,end,retry,captions,textMode);
  const status=element('p','Connecting…');status.setAttribute('role','status');
  const usage=element('small'),progress=element('p');progress.className='live-conversation-progress';
  const audio=element('audio');audio.autoplay=true;audio.controls=false;audio.playsInline=true;audio.hidden=true;
  /* The running cost is the owner's reference, not part of the lesson, so it
     sits at the foot of the lesson map rather than under the conversation. */
  const costHost=document.getElementById('mock-learner-map-cost');
  if(costHost)costHost.append(note);
  root.append(...(costHost?[]:[note]),actions,status,usage,progress);adapter.container.append(root);(document.body||adapter.container).append(audio);
  ui={root,note,rate,total,start,enableAudio,mute,end,retry,captions,status,usage,progress,audio};
  output=window.WorldviewLiveAudioOutput?.create({audio,button:adapter.speakerButton,container:root});
  enableAudio.onclick=()=>{const s=session;if(!s||s.closing)return;const version=s.outputVersion;void output?.apply({user:true});void resumeAudio(s).then(()=>{if(session===s&&!s.closing&&s.outputVersion===version){enableAudio.hidden=true;message('Listening');}}).catch(()=>{if(session===s&&!s.closing&&s.outputVersion===version)message('Audio is blocked. Check the browser’s audio permission.');});};
  captions.onclick=()=>{showCaptions=!showCaptions;paint();};
  start.onclick=()=>{if(session?.softPaused){softResume(session);return;}openingPending=true;paused=false;startError=false;autoAttempts=0;void(study?begin():prepare());};end.onclick=()=>{if(session?.softPaused){softResume(session);return;}if(!session){start.onclick();return;}paused=true;void stop('Voice paused.',{pause:true});};retry.onclick=()=>void flush();
  mute.onclick=()=>{const s=session;if(!s?.ready||s.closing)return;if(s.softPaused){s.softPaused=false;s.lastActivityAt=performance.now();}s.muted=!s.muted;s.mic?.getAudioTracks().forEach(t=>t.enabled=!s.muted);s.gemini?.mute(s.muted);message(s.muted?'Mic muted':'Listening');paint();};
  document.addEventListener('visibilitychange',()=>{
   if(document.hidden){
    if(!session||paused)return;
    backgrounded=true;hiddenAt=Date.now();clearTimeout(hiddenTimer);
    hiddenTimer=setTimeout(()=>{if(document.hidden&&session)void stop('Voice paused in the background.');},BACKGROUND_GRACE_MS);
    return;
   }
   clearTimeout(hiddenTimer);
   // A suspended page may never have run the timer above; judge the absence
   // by the clock instead.
   const away=hiddenAt?Date.now()-hiddenAt:0;hiddenAt=0;
   if(session&&away>=BACKGROUND_GRACE_MS)void stop('Voice reconnecting.');
   resumeFromBackground();
  });
  window.addEventListener('pagehide',()=>{stash();void stop('Live ended when you left the lesson.');});
  window.addEventListener('worldview-lesson-cost-updated',paintCosts);
  window.addEventListener('storage',e=>{if(e.key?.startsWith(window.WorldviewLessonCost?.prefix))paintCosts();});
  return api;
 }
 function message(text){if(ui)ui.status.textContent=text;}
 function connectionState(){
  const current=session?.scope===context?.lineage&&session?.model===(context?.model||'gpt-live-1')?session:null;
  const state=!enabled?'disabled':startError?'error':paused?'paused':current?.closing?'stopped':current?.ready?'ready':loading?'preparing':current?'connecting':'idle';
  return {state,lineage:context?.lineage||'',owner:context?.owner||'',runId:context?.runId||'',model:context?.model||'',message:ui?.status.textContent||''};
 }
 function publishConnectionState(){
  const next=connectionState(),key=JSON.stringify(next);
  if(key===lastConnectionState)return;
  lastConnectionState=key;host?.onConnectionState?.(next);
 }
 function paintCosts(){
  const costs=window.WorldviewLessonCost;if(!ui||!costs)return;
  const summary=costs.summary(context?.owner,context?.runId);
  ui.total.textContent=costs.format(summary);ui.total.title=costs.describe(summary);
  ui.usage.textContent='';ui.usage.hidden=true;
 }
 function recordVoiceCost(s,value={}){
  const costs=window.WorldviewLessonCost;if(!costs)return;
  s.costOwner??=context?.owner;s.costRunId??=context?.runId;
  if(value.metadata){
   const estimate=costs.geminiUsage(value.metadata);
   costs.report(s.costOwner,s.costRunId,'voice:'+s.id+':turn:'+(value.usageId??s.usageTurn??0),{...estimate,model:s.model,atLeast:true});
  }else if((s.model||'gpt-live-1')==='gpt-live-1'&&s.dispatched){
   const final=value.final===true&&typeof value.seconds==='number'&&Number.isFinite(value.seconds)&&value.seconds>=0;
   if(final)s.costFinal=true;
   if(typeof value.seconds==='number'&&Number.isFinite(value.seconds)&&value.seconds>=0){s.costConfirmed=true;s.seconds=Math.max(s.seconds||0,value.seconds);s.costProviderAt=performance.now();}
   if(!s.costConfirmed){costs.report(s.costOwner,s.costRunId,'voice:'+s.id,{usd:null,model:'gpt-live-1',partial:true});paintCosts();return;}
   const elapsed=s.costStartedAt==null?0:Math.max(0,((s.costStoppedAt??performance.now())-s.costStartedAt)/1000);
   const sinceProvider=s.costProviderAt==null?0:Math.max(0,((s.costStoppedAt??performance.now())-s.costProviderAt)/1000);
   const seconds=final?Math.max(15,value.seconds):Math.max(15,elapsed,(s.seconds||0)+sinceProvider);
   costs.report(s.costOwner,s.costRunId,'voice:'+s.id,{usd:seconds/60*.05,model:'gpt-live-1',final,partial:!final});
  }
  paintCosts();
 }
 function startVoiceCost(s){
  s.costOwner??=context?.owner;s.costRunId??=context?.runId;
  if((s.model||'gpt-live-1')!=='gpt-live-1'){window.WorldviewLessonCost?.report(s.costOwner,s.costRunId,'voice:'+s.id+':pending',{usd:0,partial:true,model:s.model});return;}
  s.costStartedAt??=performance.now();recordVoiceCost(s);
  if(!s.costTimer)s.costTimer=setInterval(()=>{if(session===s&&!s.closing)recordVoiceCost(s);},1000);
 }
 function stopVoiceCost(s){if(!s)return;if(s.costStartedAt!=null)s.costStoppedAt??=performance.now();clearInterval(s.costTimer);s.costTimer=null;if(!s.costFinal)recordVoiceCost(s);}
 const exportTurns=value=>Array.isArray(value)?value.filter(t=>['user','assistant'].includes(t?.role)&&typeof t.content==='string').map(t=>({role:t.role,content:t.content})):[];
 function exportDraft(key){
  try{
   const draft=JSON.parse(localStorage.getItem(key)||'null');
   if(typeof draft?.studyId!=='string'||!Array.isArray(draft.fragments)||!draft.fragments.every(f=>Number.isInteger(f?.seq)&&typeof f.id==='string'&&['user','assistant'].includes(f.role)&&typeof f.delta==='string'))return null;
   return {...draft,prefix:exportTurns(draft.prefix),textSnapshot:Array.isArray(draft.textSnapshot)?exportTurns(draft.textSnapshot):null,textInsertions:Array.isArray(draft.textInsertions)?draft.textInsertions.filter(s=>Number.isInteger(s?.afterSeq)&&s.afterSeq>=0&&Array.isArray(s.turns)).map(s=>({afterSeq:s.afterSeq,turns:exportTurns(s.turns)})):[]};
  }catch{return null;}
 }
 /* Every finished lesson leaves its whole transcript in a draft entry and
    nothing ever removed one, so the origin quota fills and every later write
    fails - including the ones that create a Lesson Map and its research. When a
    write is refused, drop the drafts belonging to other lessons, oldest first,
    and try again. Only this lesson's own draft is ever kept. */
 function sweepOtherDrafts(){
  let removed=0;
  try{
   const keys=[];
   for(let i=0;i<localStorage.length;i++){const k=localStorage.key(i);if(k&&k.startsWith('worldview-live-draft-v2:')&&k!==draftKey)keys.push(k);}
   for(const k of keys){try{localStorage.removeItem(k);removed++;}catch{/* Keep sweeping the rest. */}}
  }catch{/* A browser that will not enumerate storage cannot be swept. */}
  return removed;
 }
 function stash(){
  if(!draftKey||!(study?.id||exportStudyId))return;
  const payload=JSON.stringify({studyId:study?.id||exportStudyId,fragments,prefix,textInsertions,textSnapshot,textMode:exportWasText});
  try{localStorage.setItem(draftKey,payload);return;}catch{/* Fall through to the sweep. */}
  if(sweepOtherDrafts()){
   try{localStorage.setItem(draftKey,payload);return;}catch{/* Still refused. */}
  }
  saveError='This transcript is not saved on the device yet. It is still saved on the server.';
 }
 function rememberTextHistory(value,collect=false){
  const next=exportTurns(value);
  if(collect&&textSnapshot){
   // A history still loading after refresh is not deletion. Wait for its saved
   // prefix before attaching newly typed turns; never guess from repeated words.
   if(textSnapshot.length>next.length||!textSnapshot.every((t,i)=>next[i]?.role===t.role&&next[i]?.content===t.content))return;
   const tail=next.slice(textSnapshot.length);
   if(tail.length)textInsertions.push({afterSeq:fragments.at(-1)?.seq||0,turns:tail});
  }
  textSnapshot=next;stash();
 }
 /* "Paused" is only true when the Resume button is showing: with no
    session, or a Gemini session holding the microphone. A new connection
    that is live again says Listening, whatever an earlier pause left behind. */
 function restingStatus(){if(session?.softPaused)return 'Paused. Just start talking, or tap play.';if(session&&!session.closing)return session.muted?'Mic muted':'Listening';return paused?'Paused. Tap play to carry on.':'Listening';}
 const PAUSE_ICON='<rect x="7" y="5" width="3.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2"/>',PLAY_ICON='<path d="M8 5.5v13l10.5-6.5z"/>';
 function paint(){
  if(!ui)return;ui.root.hidden=!enabled;
  /* Mute, pause and the transcript stay as three centred buttons. When voice
     is paused or stopped, pause becomes play, and play resumes or retries. */
  const resumable=!!session?.softPaused||(!session&&(paused||startError));
  ui.end.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+(resumable?PLAY_ICON:PAUSE_ICON)+'</svg>';const endLabel=resumable?(startError&&!paused?'Try microphone again':'Resume voice'):'Pause voice';ui.end.setAttribute('aria-label',endLabel);ui.end.title=endLabel;ui.end.classList.toggle('is-resume',resumable);
  ui.start.hidden=true;ui.start.disabled=!session?.softPaused&&(loading||!!session||!context?.ready||document.hidden);
  if(enabled)output?.paint();
  ui.start.textContent=paused||session?.softPaused?'Resume voice':'Try microphone again';
  ui.rate.hidden=true;ui.note.hidden=!context?.showCost;
const capsLabel=showCaptions?'Hide transcript':'Show transcript';ui.captions.setAttribute('aria-label',capsLabel);ui.captions.title=capsLabel;ui.captions.setAttribute('aria-pressed',String(showCaptions));
  ui.end.hidden=false;ui.end.disabled=!session&&!resumable;ui.mute.hidden=false;ui.mute.disabled=!session?.ready||!!session?.softPaused;ui.captions.hidden=false;const muteLabel=session?.muted?'Unmute mic':'Mute mic';ui.mute.setAttribute('aria-label',muteLabel);ui.mute.title=muteLabel;ui.mute.classList.toggle('is-muted',!!session?.muted);ui.mute.setAttribute('aria-pressed',String(!!session?.muted));
  ui.retry.hidden=true;ui.retry.disabled=!!saving;
  if(saveError)message(saveError);
  const count=Object.keys(study?.assessment||{}).length,total=study?.packet?.roadmap?.length||0;const phaseName={clarification:'Your direction',extraction:'Your starting point',lesson:'Lesson',quiz:'Final teach-back',complete:'Complete'}[study?.phase]||'Lesson';
  ui.progress.hidden=true;paintCosts();
  if(enabled&&study)renderTranscript();
  publishConnectionState();
 }
 function renderTranscript(){
  const root=host.transcript,follow=root.scrollHeight-root.scrollTop-root.clientHeight<40,position=root.scrollTop;
  if(session&&!showCaptions){root.replaceChildren();return;}
  const clock=at=>{const d=new Date(at);const pad=n=>String(n).padStart(2,'0');return pad(d.getHours())+':'+pad(d.getMinutes())+':'+pad(d.getSeconds());};
  /* One transcript, assembled exactly as the copied one is. Drawing the spoken
     fragments alone left out the conversation that happened before this study
     opened and anything typed between voice sessions, so reopening a lesson
     showed less of it than had actually been said. */
  const groups=[];
  for(const turn of context.history||[])groups.push({role:turn.role,text:turn.content});
  for(const turn of prefix)groups.push({role:turn.role,text:turn.content});
  const insert=seq=>{for(const group of textInsertions.filter(entry=>entry.afterSeq===seq))for(const turn of group.turns)groups.push({role:turn.role,text:turn.content});};
  insert(0);
  let previousNative=false;
  for(const f of fragments){
   if(isControlEcho(f.delta))continue;
   const native=!f.id.startsWith('import:'),last=groups.at(-1),at=fragmentAt(f);
   if(native&&previousNative&&last?.live&&last.role===f.role){last.text=joinDelta(last.text,f.delta);if(at&&!last.at)last.at=at;}
   else groups.push({role:f.role,text:f.delta,live:true,at});
   previousNative=native;insert(f.seq);
  }
  for(const g of groups)g.text=cleanCaption(g.text);
  root.replaceChildren();for(const g of groups){if(!g.text)continue;const item=element('li');item.className='extraction-turn '+(g.role==='user'?'is-user':'is-assistant');item.dataset.role=g.role;const label=element('strong',g.role==='user'?'You':g.live?'Worldview':'Earlier in this lesson');const text=element('p',g.text);item.append(label,text);if(g.at){const stamp=element('time',clock(g.at));stamp.className='turn-time';stamp.dateTime=new Date(g.at).toISOString();item.append(stamp);}root.append(item);}
  root.scrollTop=follow?root.scrollHeight:position;
 }
 function sync(next){
  const changed=context?.lineage!==next.lineage;
  let collectText=!enabled;
  if(session&&(changed||!next.enabled||context?.model!==next.model))void stop('Live ended because the lesson or voice model changed.');
  if(changed){openingPending=true;paused=false;startError=false;autoAttempts=0;appliedPhase=0;loadToken++;loading=false;study=null;fragments=[];prefix=[];textInsertions=[];textSnapshot=null;exportWasText=false;exportStudyId='';ack=0;loading=false;saveError='';scope='';draftKey='';collectText=false;
   if(next.lineage){const key='worldview-live-draft-v2:'+next.lineage,draft=exportDraft(key);if(draft){scope=next.lineage;draftKey=key;exportStudyId=draft.studyId;fragments=draft.fragments;prefix=draft.prefix;textInsertions=draft.textInsertions;textSnapshot=draft.textSnapshot;collectText=draft.textMode===true;if(!next.enabled)setTimeout(()=>host.onTranscript?.(),0);}
    else if(!next.enabled&&next.runId)void readSaved(next);}
  }
  // Hydrated phase artifacts can contain the same native speech. Only a saved
  // ordinary-mode snapshot permits collecting their growth as new Text turns.
  exportWasText=!next.enabled;
  if((study||exportStudyId)&&Array.isArray(next.priorHistory))rememberTextHistory(next.priorHistory,collectText);
  const returning=!enabled&&next.enabled;context=next;enabled=!!next.enabled;if(returning){openingPending=true;paused=false;startError=false;autoAttempts=0;}
  if(enabled&&!study&&!loading&&!startError&&!paused&&next.studyInput)void prepare();
  paint();maybeStart();
 }
 function maybeStart(){if(context?.autoStart&&enabled&&context.ready&&!loading&&!session&&!releasing&&!paused&&!startError&&!document.hidden&&study)void begin();}
 /* A suspended page does not run its own timers, so the grace period that ends a
    stopped session can never arrive: the session object stays in place, the
    microphone stays held, and maybeStart refuses because a session still exists.
    That is a lesson showing a live microphone indicator and answering nothing.
    Returning to the app is the one moment we know the page is running again, so
    finish the dead session here instead of waiting for a timer that may not come. */
 function transportDead(state){
  if(!state||state.closing)return false;
  if(state.model==='gemini-3.8-live')return state.gemini?state.gemini.alive?.()===false:false;
  if(state.peer&&['failed','closed','disconnected'].includes(state.peer.connectionState))return true;
  return !!state.channel&&['closing','closed'].includes(state.channel.readyState);
 }
 function resumeFromBackground(){
  const s=session,recovering=!!s&&(s.closing||transportDead(s));
  if(recovering){if(!s.closing)void stop('Voice reconnecting.');cleanup(s);}
  // Coming back deliberately is intent to continue, so a background stop no
  // longer counts against the reconnect budget or leaves a stale error state.
  if((backgrounded||recovering)&&!session&&!paused){autoAttempts=0;startError=false;message('Reconnecting...');}
  // A short absence kept the connection. The phone may still have suspended
  // playback while the page was hidden, so ask for it back; if the browser
  // insists on a tap, say so rather than leaving the tutor silent.
  if(session&&!session.closing&&session.ready){
   const s=session;s.lastActivityAt=performance.now();
   void resumeAudio(s).then(()=>{if(session===s&&!s.closing)message(s.muted?'Mic muted':'Listening');}).catch(()=>{if(session===s&&!s.closing){ui.enableAudio.hidden=false;message('Tap Enable audio.');}});
  }
  backgrounded=false;paint();maybeStart();
 }
 function closeGeminiReceipt(s){
  if(!s.dispatched||s.receiptClose)return;
  releasing=s.receiptClose=s.request({action:'close',requestId:s.id}).catch(()=>{}).finally(()=>{if(releasing===s.receiptClose){releasing=null;maybeStart();}});
 }
 function place(container){if(!ui||!container)return;if(ui.root.parentElement!==container)container.append(ui.root);paint();}
 function captureAudioType(type='play-and-record'){try{if(navigator.audioSession&&'type' in navigator.audioSession&&navigator.audioSession.type!==type)navigator.audioSession.type=type;}catch{/* Browsers without this control choose their own route. */}}
 async function resumeAudio(s){
  if(s.gemini)return s.gemini.resumeAudio();
  // Both calls occur in the tap, before awaiting either browser permission.
  await Promise.all([s.outputContext?.resume(),ui.audio.play()]);
 }
 function detachOutput(s){
  s.outputVersion=(s.outputVersion||0)+1;
  clearInterval(s.outputWatch);s.outputWatch=null;
  s.outputSource?.disconnect();s.outputGain?.disconnect();s.outputAnalyser?.disconnect();
  if(s.outputContext){void s.outputContext.close().catch(()=>{});s.outputContext=null;}
  s.outputSource=null;s.outputGain=null;s.outputAnalyser=null;s.outputRoute='';s.hardwareSilent=false;
  if(ui)ui.audio.muted=false;
 }
 /* Two places can play the tutor. The media element is the proven remote-track
    path, but iOS demotes it to the receiver while the microphone holds a
    play-and-record session. A Web Audio tap into the context's hardware
    destination stays on the loudspeaker side of that same session, so both are
    built and one is silenced, never torn down and rebuilt mid-conversation. */
 function attachOutput(s,track){
  if(session!==s||s.closing)return;detachOutput(s);
  const stream=new MediaStream([track]),Audio=window.AudioContext||window.webkitAudioContext;
  ui.audio.srcObject=stream;ui.audio.muted=false;
  try{
   if(Audio){
    const ctx=s.outputContext=new Audio({latencyHint:'interactive'});
    s.outputSource=ctx.createMediaStreamSource(stream);
    s.outputGain=ctx.createGain();s.outputGain.gain.value=0;
    s.outputAnalyser=ctx.createAnalyser();s.outputAnalyser.fftSize=256;
    s.outputSource.connect(s.outputAnalyser);s.outputSource.connect(s.outputGain);s.outputGain.connect(ctx.destination);
   }
  }catch{ // No hardware tap on this browser. The element still plays normally.
   s.outputContext=null;s.outputSource=null;s.outputGain=null;s.outputAnalyser=null;}
  const version=s.outputVersion;
  output?.attach(outputTransport(s));
  void resumeAudio(s).catch(()=>{if(session===s&&!s.closing&&s.outputVersion===version){ui.enableAudio.hidden=false;message('Tap Enable audio.');}});
 }
 function setHardwareRoute(s,on){
  if(!s.outputGain)return;
  try{s.outputGain.gain.value=on?1:0;}catch{}
  ui.audio.muted=!!on;
  if(!on){
   clearInterval(s.outputWatch);s.outputWatch=null;
   // The element carries the audio now. A running context left attached keeps
   // its own claim on the route, which made the off state barely audible as a
   // change; suspending it hands the choice back to the phone.
   void s.outputContext?.suspend().catch(()=>{});
  }
 }
 function outputTransport(s){
  return{applyRoute:async loud=>{
   if(session!==s||s.closing)return'unavailable';
   if(!loud||!s.outputGain||s.hardwareSilent){setHardwareRoute(s,false);s.outputRoute='element';return s.outputGain?'element':'unavailable';}
   // A suspended context produces nothing, so it is not a route we can promise.
   await s.outputContext?.resume().catch(()=>{});
   if(session!==s||s.closing)return'unavailable';
   if(s.outputContext?.state!=='running'){setHardwareRoute(s,false);s.outputRoute='element';return'element';}
   s.outputRoute='hardware';setHardwareRoute(s,true);watchHardwareRoute(s);return'hardware';
  }};
 }
 // Some WebKit builds hand back a silent node for a remote track. Silence while
 // the tutor is audibly speaking is the only reliable signal for that, so give
 // playback straight back to the element rather than leaving the learner deaf.
 function watchHardwareRoute(s){
  if(!s.outputAnalyser||s.outputWatch)return;
  const data=new Uint8Array(s.outputAnalyser.frequencyBinCount);let quiet=0;
  s.outputWatch=setInterval(()=>{
   if(session!==s||s.closing||s.outputRoute!=='hardware'){clearInterval(s.outputWatch);s.outputWatch=null;return;}
   if(!s.speaking){quiet=0;return;}
   s.outputAnalyser.getByteFrequencyData(data);
   quiet=data.some(value=>value>2)?0:quiet+1;
   if(quiet<6)return;
   clearInterval(s.outputWatch);s.outputWatch=null;
   s.hardwareSilent=true;setHardwareRoute(s,false);s.outputRoute='element';
   message('Audio moved back to the phone output.');
   void output?.refresh();
  },250);
 }
 async function acquireMic(s){
  captureAudioType();
  try{return await navigator.mediaDevices.getUserMedia({audio:true});}
  catch(error){if(!/AudioSession category/i.test(error.message||'')||session!==s||s.closing||document.hidden)throw error;
   captureAudioType('auto');captureAudioType();return await navigator.mediaDevices.getUserMedia({audio:true});}
 }
 /* A lesson reopened in text mode on a device without this lesson's voice
    draft (another phone, or the draft was cleared to free space) still shows
    everything said by voice: read the server copy without opening voice. */
 async function readSaved(next){
  const token=loadToken,expected=next.lineage;let result;
  try{result=await host.requestForCurrentAccount()({action:'journey_read',runId:next.runId});}catch{return;}
  const saved=result?.study;
  if(token!==loadToken||context?.lineage!==expected||enabled||study||exportStudyId||!Array.isArray(saved?.fragments)||!saved.fragments.some(f=>!String(f.id).startsWith('import:')))return;
  const earlier=exportTurns(context.priorHistory||[]),imported=saved.fragments.filter(f=>f.id.startsWith('import:'));
  let at=-1;for(let i=earlier.length-imported.length;i>=0;i--){if(imported.every((f,j)=>earlier[i+j]?.role===f.role&&earlier[i+j]?.content===f.delta)){at=i;break;}}
  // Text turns before the voice started lead; any after it follow the voice.
  // With no clean match, keep every text turn first rather than lose any.
  const before=at<0?earlier:earlier.slice(0,at),after=at<0?[]:earlier.slice(at+imported.length);
  scope=expected;draftKey='worldview-live-draft-v2:'+expected;exportStudyId=saved.id;fragments=saved.fragments.slice();prefix=before;
  textInsertions=after.length?[{afterSeq:fragments.at(-1)?.seq||0,turns:after}]:[];textSnapshot=earlier;exportWasText=true;stash();
  host.onTranscript?.();
 }
 async function prepare(){
  const token=++loadToken,expected=context.lineage,input=context.studyInput,model=context.model||'gpt-live-1',captured=host.requestForCurrentAccount(),began=performance.now();loading=true;message('Opening the saved research and conversation…');paint();
  try{
   // Capability and saved-lesson preparation use the same captured account and
   // do not depend on one another. Voice creation waits for both to succeed.
   const [ready,result]=await Promise.all([captured({action:'check',model}),captured({action:'journey_prepare',...input})]);
   if(token!==loadToken||context.lineage!==expected)return;
   prepareTiming={start:Math.round(began),end:Math.round(performance.now())};
   if(!ready.journeyMode)throw Error('Natural Live lessons are awaiting the server update. Standard voice remains available.');
   study=result.study;host.onJev?.(study.jev||null);fragments=study.fragments.slice();ack=fragments.length;request=captured;scope=expected;draftKey='worldview-live-draft-v2:'+expected;
   const imported=fragments.filter(f=>f.id.startsWith('import:')),earlier=context.priorHistory||[];
   let at=-1;for(let i=earlier.length-imported.length;imported.length&&i>=0;i--){if(imported.every((f,j)=>earlier[i+j]?.role===f.role&&earlier[i+j]?.content===f.delta)){at=i;break;}}
   prefix=at>0?earlier.slice(0,at).map(t=>({role:t.role,content:t.content})):[];
   const prior=exportDraft(draftKey);exportStudyId=study.id;textInsertions=[];textSnapshot=exportTurns(earlier);
   if(prior?.studyId===study.id){if(!prefix.length)prefix=prior.prefix;textInsertions=prior.textInsertions;}
   try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft?.studyId===study.id&&Array.isArray(draft.fragments)&&draft.fragments.length>ack&&fragments.every((f,i)=>['seq','id','role','delta','start_ms','end_ms'].every(k=>f[k]===draft.fragments[i][k])))fragments=draft.fragments;}catch{/* Server copy remains available. */}
   await applyPhase();stash();message('Connecting…');
   if(fragments.length>ack)void flush();
  }catch(error){if(token===loadToken){startError=true;message(error.message||'Voice could not open. Try again.');}}
  finally{if(token===loadToken){loading=false;paint();maybeStart();}}
 }
 async function flush(){
  if(saving)return saving;if(!study||!request||ack>=fragments.length)return true;
  const id=study.id,expected=scope,captured=request,source=fragments,startAck=ack;
  saving=(async()=>{let cursor=startAck;try{
   while(cursor<source.length){const batch=source.slice(cursor,cursor+80);const result=await captured({action:'study_save',studyId:id,fragments:batch});cursor=result.revision;if(!Number.isInteger(cursor)||cursor<batch.at(-1).seq)throw Error('Transcript save was not confirmed.');if(scope===expected){ack=cursor;saveError='';stash();paint();}}
   return true;
  }catch(error){if(scope===expected){saveError='Transcript not yet saved. Your device draft is retained. '+(error.message||'Tap Retry saving.');stash();paint();}return false;}
  finally{saving=null;}})();return saving;
 }
 // Application control messages are injected into the session as context, not
 // as speech. A provider can echo that injected text back on a transcript
 // channel, where it would otherwise be recorded as a turn and shown to the
 // learner as something they said. These markers are the app's own vocabulary
 // and are always uppercase, so real speech never transcribes as one.
 const CONTROL_MARKERS=['APP_HANDOFF'];
 /* GPT Live emits harmony channel markup, and on device it reaches the caption
    stream as literal text: |channel|commentary|> and its variants. The commentary
    channel is the model's internal side, is not spoken, and restates what the
    spoken channel says - which is the markup and the repetition seen on screen.
    Markers are cleaned from joined turn text rather than from each delta, because
    a streamed marker can be split across two deltas. */
 const CHANNEL_MARKER=new RegExp('<?\\|channel\\|>?[ ]*([a-z_]*)[ ]*(?:<?\\|message\\|>?|\\|>|>)?','gi');
 const CHANNEL_STRAY=new RegExp('<?\\|(?:message|start|end|return|constrain)\\|>?','gi');
 function cleanCaption(text){
  const raw=String(text||'');if(!raw)return '';
  const parts=[];let last=0,keep=true,m;CHANNEL_MARKER.lastIndex=0;
  while((m=CHANNEL_MARKER.exec(raw))){
   if(keep)parts.push(raw.slice(last,m.index));
   keep=(m[1]||'').toLowerCase()!=='commentary';
   last=m.index+m[0].length;
  }
  if(keep)parts.push(raw.slice(last));
  return parts.join(' ').replace(CHANNEL_STRAY,' ').replace(/[ 	]{2,}/g,' ').trim();
 }
 function isControlEcho(text){const t=String(text||'').trimStart();return CONTROL_MARKERS.some(marker=>t.startsWith(marker));}
 function append(state,event,role){
  if(session!==state||state.scope!==scope)return;
  if(typeof event.delta!=='string'||!event.delta)return;
  if(isControlEcho(event.delta))return;
  const f={seq:fragments.length+1,id:String(event.event_id||state.id+':'+fragments.length),role,delta:event.delta,start_ms:Number.isFinite(event.start_ms)?event.start_ms:Date.now(),end_ms:Number.isFinite(event.end_ms)?event.end_ms:null};
  fragments.push(f);if(role==='assistant')mark(state,'words');state.lastTranscriptAt=performance.now();state.lastActivityAt=state.lastTranscriptAt;
  if(role==='user')state.lastUserTranscriptAt=state.lastTranscriptAt;
  else{
   state.speaking=true;state.lastAssistantAt=state.lastTranscriptAt;
   if(state.retiringQuestionStep===studyStep(study))state.retiredQuestionSeq=f.seq;
   // The tutor may open the new part naturally after receiving the handoff.
   // Count that output once, rather than forcing another opening on a poll.
   if(!state.deferredStudy&&state.publishedStep===studyStep(study)&&state.pendingOpeningStep===studyStep(study)){state.openedPhase=studyStep(study);state.pendingOpeningStep=null;clearTimeout(state.openingTimer);}
   clearTimeout(state.speakingTimer);state.speakingTimer=setTimeout(()=>{state.speaking=false;resumeHandoff(state);},900);
  }
  // Deliver deferred reference data when the learner takes their next turn,
  // before the tutor answers. Otherwise a tutor that always ends in a question
  // could prevent an accepted outcome from ever reaching the speaking model.
  if(role==='user'){state.pendingOpeningStep=null;clearTimeout(state.openingTimer);if(state.deferredStudy){state.speaking=false;deliverStudy(state);}}
  // The first thing the learner actually says is what a topic-free Voice lesson
  // is about. Report it once so the saved card can stop carrying a placeholder.
  if(role==='user'&&!fragments.some(other=>other.seq!==f.seq&&other.role==='user'))host?.onLearnerTopic?.(f.delta);
  fragmentTimes.set(f.id,Date.now());
  if(role==='user')state.lastUserSeq=f.seq;stash();paint();clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),1500);
  // Only learner speech schedules a check. The tutor's own output carries
  // nothing new to assess, and a check can publish a saved phase into the
  // session; injected context is advisory, not a provider-enforced speech
  // boundary, so it can prompt another reply. Letting the tutor's captions
  // schedule that check closes the loop: it answers, hears itself, checks,
  // is injected into, and answers again with nobody having spoken.
  if(!state.closing&&role==='user')scheduleCheck(state,4000);
 }
 // This debounce reduces context churn. Captions have no completed-turn event,
 // so elapsed time is never evidence that either speaker has finished speaking.
 // It counts from the learner's own speech only. Counting the tutor's captions
 // too starved the check: a tutor that teaches for half a minute reset the
 // window on every caption, so the answer that should have advanced the outcome
 // was never assessed and the same question came back.
 function checkDelay(state){return state.lastUserTranscriptAt==null?0:Math.max(0,4000-(performance.now()-state.lastUserTranscriptAt));}
 function scheduleCheck(state,delay=checkDelay(state)){clearTimeout(state.quietTimer);state.quietTimer=setTimeout(()=>{if(session===state&&!state.closing)void check();},delay);}
 function send(state,event){if(session===state&&state.channel?.readyState==='open')state.channel.send(JSON.stringify(event));}
 function inject(state,content,delegationId=null){
  if(state.gemini){state.gemini.context(content);return;}
  // Each append is <= 400 UTF-8 bytes, conservatively below the 500-token API limit.
  let piece='';const encoder=new TextEncoder();
  for(const char of content){if(encoder.encode(piece+char).length>400){send(state,{type:'session.thinking.append',delegation_id:delegationId,content:piece});piece='';}piece+=char;}
  if(piece)send(state,{type:'session.thinking.append',delegation_id:delegationId,content:piece});
 }
 function studyStep(value){
  if(!value)return '';
  // Research readiness updates context; it does not start another conversation.
  return JSON.stringify([value.id,value.phaseVersion,value.phase,value.currentIndex,value.packet?.currentOutcome?.id||'',value.complete===true]);
 }
 function studyPublication(value){
  // Captions/revision changes alone must not inject another packet into a model
  // that has just asked a question. Only a new decision or research changes it.
  const packet={...value.packet};delete packet.conversationState;
  return JSON.stringify({step:studyStep(value),instructions:value.instructions,packet,focus:value.packet?.conversationState?.nextFocus||'',waiting:value.packet?.conversationState?.waitingForResearch===true});
 }
 function unansweredQuestion(afterSeq=0){
  let text='';
  for(let i=fragments.length-1;i>=0&&fragments[i].role==='assistant'&&fragments[i].seq>afterSeq;i--)text=fragments[i].delta+text;
  return /[?？]/.test(text)||/\b(?:tell me|explain in your|describe in your|walk me through)\b/i.test(text);
 }
 function protectedQuestion(state){
  // A checked lesson/quiz advance retires questions from the accepted outcome.
  // Map/research updates never do. A question spoken after the handoff remains
  // the learner's turn, even if it resembles an earlier question.
  return unansweredQuestion(state.retiredQuestionSeq||0);
 }
 function resumeHandoff(state){
  if(session!==state||state.closing||state.speaking||checkDelay(state)>0)return;
  if(state.deferredStudy&&!protectedQuestion(state))deliverStudy(state);
  if(!state.deferredStudy&&state.pendingOpeningStep===studyStep(study))schedulePhaseOpening(state);
 }
 async function applyPhase(){
  if(!study)return;
  const signature=JSON.stringify([studyStep(study),study.checkedRevision,study.checkError,study.packet?.lastCheck]);
  if(signature===appliedPhase)return;appliedPhase=signature;
  await host.onStudy?.(study);
 }
/* The turn-taking policy is static and is already in the session instructions
   from the moment the session is created. Re-sending it on a phase change put a
   block of prose in front of the model at the one moment it had nothing else to
   answer, and it was spoken: the learner heard a description of how to handle a
   pause and the word "um" instead of the lesson. Only the changed part of the
   brief is sent now. If the brief ever stops carrying this block, neither marker
   is found and the whole brief is sent exactly as before. */
 const POLICY_MARK='PACING AND TURN-TAKING.';
 const POLICY_TAIL='Continue from the saved conversationState';
 function changedPolicy(text){
  const value=String(text||''),at=value.indexOf(POLICY_MARK);
  const tail=at<0?-1:value.indexOf(POLICY_TAIL,at+POLICY_MARK.length);
  return at<0||tail<0?value:(value.slice(0,at)+value.slice(tail)).trim();
 }
 function publishStudy(state,delegationId=null){
  if(session!==state||state.closing)return false;
  if(protectedQuestion(state)||state.speaking){state.deferredStudy=true;return false;}
  state.deferredStudy=false;state.retiringQuestionStep=null;
  const signature=studyPublication(study);
  if(state.publishedStudy===signature)return false;
  const phaseChanged=state.publishedPhase!==study.phaseVersion;
  if(state.gemini){
   state.gemini.context('APP_HANDOFF. Adopt this saved phase and next focus at the next natural boundary. This is application context, not learner speech. Do not repeat answered questions or speak merely because this update arrived.\n'+(phaseChanged?'Phase policy: '+changedPolicy(study.instructions)+'\n':'')+'Saved reference packet: '+JSON.stringify(study.packet));
   state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;state.publishedStep=studyStep(study);return true;
  }
  // Silent context is advisory, not a provider-enforced speech boundary.
  inject(state,'APP_HANDOFF_START. Buffer this complete update; do not speak or interrupt because it arrived.',delegationId);
  if(phaseChanged)inject(state,'Replacement phase policy: '+changedPolicy(study.instructions),delegationId);
  inject(state,'Saved reference packet: '+JSON.stringify(study.packet),delegationId);
  inject(state,'APP_HANDOFF_END. Adopt this saved phase/outcome at the next natural boundary. Do not repeat a bridge or answer twice. Continue from what the learner just said.',delegationId);
  state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;state.publishedStep=studyStep(study);return true;
 }
 function announceTransition(state){
  // The handoff itself is quick, but the tutor is briefly silent while it adopts the new phase.
  // Name where the lesson is going so the pause reads as progress rather than a stall.
  const next={extraction:'Setting up your starting point…',lesson:'Starting the lesson…',quiz:'Starting the final teach-back…',complete:'Wrapping up…'}[study?.phase];
  if(!next)return;
  message(next+' the next reply may take a few seconds.');
  clearTimeout(restoreTimer);
  restoreTimer=setTimeout(()=>{if(session===state&&!state.closing&&!saveError&&!state.checking)message(restingStatus());},8000);
 }
 function deliverStudy(state){
  const pending=[...state.pendingDelegations],first=pending.shift()||null;
  const published=publishStudy(state,first);
  if(state.deferredStudy)return false;
  state.pendingDelegations.clear();
  if(!published&&first)inject(state,'Application state received. Continue from the saved state; this is not a new learner turn.',first);
  for(const id of pending)inject(state,'Application state received. Use the latest saved phase; this is not a new learner turn.',id);
  return published;
 }
 async function check(delegationId=null){
  const s=session;if(!s?.ready||s.closing)return;
  if(delegationId)s.pendingDelegations.add(delegationId);
  if(checkDelay(s)>0){scheduleCheck(s);return;}
  if(s.checking)return;
  s.checking=true;const expected=scope,id=study.id,captured=request,input=context.studyInput,startedStep=studyStep(study),startedPhase=study.phase,startedUserSeq=s.lastUserSeq||0;
  // A routine check is fast and should stay invisible. Only say something once the learner has
  // actually been left waiting, so the status never flickers on every answer.
  clearTimeout(s.slowTimer);s.slowTimer=setTimeout(()=>{if(s.checking&&session===s&&!s.closing&&!saveError)message('Checking in…');},1500);
  try{
   if(!await flush())return;
   if(scope!==expected||session!==s||s.closing)return;
   const prepared=await captured({action:'journey_prepare',...input});if(scope!==expected||session!==s||s.closing)return;
   // Polling may discover newly finished research without new learner speech.
   // An unchanged poll does not need another coordinator request or instruction.
   const changed=JSON.stringify(prepared.study.packet)!==JSON.stringify(study.packet);
   // Only the server's checked revision acknowledges assessment. A throttled,
   // pending or failed response must remain eligible for the next bounded poll.
   const checked=Number.isInteger(prepared.study.checkedRevision)?prepared.study.checkedRevision:-1;
   const needsCheck=startedUserSeq>checked||changed||!!prepared.study.checkError||s.pendingDelegations.size>0;
   const result=needsCheck?await captured({action:'journey_check',studyId:id}):prepared;
   host.onCheckerUsage?.(s.costOwner,s.costRunId,result.checkerUsage);if(scope!==expected||session!==s||s.closing)return;
   study={...result.study,fragments};
   // LES-257: the owner's live Jev readout follows every check, including a
   // check that saved nothing because the learner kept talking.
   host.onJev?.(study.jev||null);
   const advanced=studyStep(study)!==startedStep;
   // The saved phase is what the lesson has actually reached, so the roadmap and
   // the visible move to the next outcome follow it straight away. Only the
   // model-facing update is held back, and only for newer learner speech: a focus
   // written against an older answer would talk over what they just said. Holding
   // the whole result back also hid finished progress behind the tutor's own
   // voice, which is why an answer could be accepted without the lesson moving.
   await applyPhase();
   if(session!==s||s.closing)return;
   if(advanced){
    announceTransition(s);
    s.pendingOpeningStep=studyStep(study);
    // Tutor questions generated before receiving this accepted state belong to
    // the old outcome, including tails arriving while a newer comment is saved.
    // New learner speech below still cancels the automatic spoken opening.
    // An accepted outcome no longer retires the tutor's open question (v3.1.1):
    // opening the next part on top of it asked two questions in a row.
   }
   // A new phase gets a fresh connection whose startup carries that phase,
   // instead of a quiet note appended to a conversation that began in an
   // earlier one. Outcome changes inside a phase stay on this connection.
   // Except the step into preparation: the tutor has usually just asked for the
   // starting picture, so a new connection had nothing to say (the Sept 23
   // "groan") and the learner's answer during the swap was lost. It stays on
   // this connection and receives the new phase as an update.
   const intoPreparation=startedPhase==='clarification'&&study.phase==='extraction'&&!study.complete;
   if(advanced&&!intoPreparation&&(study.phase!==startedPhase||study.complete===true)){scheduleRefresh(s);paint();return;}
   if((s.lastUserSeq||0)!==startedUserSeq){s.deferredStudy=true;s.pendingOpeningStep=null;scheduleCheck(s);return;}
   deliverStudy(s);
   if(advanced||s.pendingOpeningStep===studyStep(study))schedulePhaseOpening(s);
   if(study.checkError)message('Conversation saved. The understanding check could not finish; Live can keep teaching.');
   else if(!advanced&&!saveError)message(restingStatus());
   paint();
  }catch{if(scope===expected&&session===s&&!s.closing)message('Live can keep teaching. The background understanding check is unavailable; no new progress was recorded.');}
  finally{clearTimeout(s.slowTimer);s.checking=false;}
 }
 /* Phase refresh. The session that opened in one phase keeps that phase in its
    startup, and later phases only arrived as appended context that a long
    conversation can trim away; that is how the tutor drifted back into an
    earlier job or ran a teach-back the application never started. At a phase
    change the next connection is prepared in the background (Gemini) and taken
    over at the first quiet moment, with its own opening, so the pause is about
    a second and the learner hears the new part begin. */
 function scheduleRefresh(s){
  if(session!==s||s.closing)return;
  const step=studyStep(study);if(s.refreshStep===step)return;
  s.refreshStep=step;s.refreshSince=performance.now();s.deferredStudy=false;s.pendingOpeningStep=null;clearTimeout(s.openingTimer);
  announceTransition(s);
  if(study?.phase==='lesson'&&!study.complete)inject(s,'PREPARATION COMPLETE. Do not speak because of this note. When the learner finishes their current answer, respond to it in one short sentence and ask nothing more; the lesson starts right after.');
  if(s.model==='gemini-3.8-live')void prepareNext(s);
  clearInterval(s.refreshTimer);
  s.refreshTimer=setInterval(()=>{
   if(session!==s||s.closing){clearInterval(s.refreshTimer);return;}
   const now=performance.now(),quiet=now-Math.max(s.lastUserTranscriptAt||0,s.lastAssistantAt||0);
   const prepared=s.model!=='gemini-3.8-live'||!!s.nextTransport||s.nextFailed||now-s.refreshSince>REFRESH_WAIT_MS;
   // The learner answers the tutor's open question before the next part starts.
   const waitingForAnswer=protectedQuestion(s)&&now-s.refreshSince<90000;
   if(s.speaking||s.checking||quiet<1500||!prepared||waitingForAnswer)return;
   clearInterval(s.refreshTimer);void refresh(s);
  },300);
 }
 async function prepareNext(s){
  if(s.nextTransport||s.nextCreating)return;
  s.nextCreating=true;const id=crypto.randomUUID();
  try{
   if(!await flush())throw Error('save-pending');
   if(session!==s||s.closing)return;
   const ackAt=ack;
   const result=await s.request({action:'create',mode:'study',model:s.model,requestId:id,studyId:s.studyId,consent:'paid-gemini-3.8-live-whole-lesson'});
   if(session!==s||s.closing){void s.request({action:'close',requestId:id}).catch(()=>{});return;}
   s.nextTransport={id,transport:result.transport,createdAt:Date.now(),ackAt};
  }catch{s.nextFailed=true;}
  finally{s.nextCreating=false;}
 }
 function recentTurns(list){
  const groups=[];
  for(const f of list){if(isControlEcho(f.delta))continue;const last=groups.at(-1);if(last?.role===f.role)last.text=joinDelta(last.text,f.delta);else groups.push({role:f.role,text:f.delta});}
  return groups.slice(-6).map(g=>({role:g.role==='user'?'learner':'tutor',text:cleanCaption(g.text).slice(0,800)})).filter(g=>g.text);
 }
 async function refresh(s){
  if(session!==s||s.closing)return;
  const phase=study?.complete?'complete':study?.phase;
  // A single-use Gemini credential must open its session within a minute.
  const fresh=s.nextTransport&&Date.now()-s.nextTransport.createdAt<50000?s.nextTransport:null;
  if(s.nextTransport&&!fresh)void s.request({action:'close',requestId:s.nextTransport.id}).catch(()=>{});
  // A connection created on the spot saves the conversation first; only a prepared
  // one can be missing the last few turns.
  const recent=fresh?recentTurns(fragments.slice(fresh.ackAt)):[];
  const opening=(recent.length?'MOST RECENT CONVERSATION, already heard and not new speech: '+JSON.stringify(recent)+'\n':'')+phaseOpeningInstruction(true);
  nextStart={mic:s.mic,transport:fresh?.transport||null,id:fresh?.id||null,opening,phase};
  s.keepMic=true;
  if(phase!=='extraction')window.WorldviewLessonCues?.chime(phase==='complete'?'pause':'begin');
  await stop({lesson:'Starting your lesson…',quiz:'Starting the final teach-back…',complete:'Wrapping up…'}[phase]||'Moving on…',{refresh:true});
  openingPending=true;autoAttempts=0;startError=false;
  void begin();
 }
 /* VOI-136 revised (v2.1.74). After a quiet minute a Gemini session holds
    the microphone: nothing is sent, so nothing is billed, but the capture that
    already works keeps measuring the room. Speaking resumes at once on the same
    connection, and the held second and a half is sent first so the opening
    words are heard. A separate listener started for this in v2.1.71 could not
    run on iPhone Safari without a tap, which is why "start talking" failed.
    GPT Live bills by the minute, so it closes and asks for a tap instead. After
    ten held minutes the connection closes too. */
 const RESUME_INSTRUCTION='RESUMING THE SAVED LESSON after a pause. In the selected language, begin with a two-word welcome back. If the learner spoke last, respond briefly to what they said. If you spoke last and asked a question they have not answered, repeat that one question in one short sentence; do not turn it into a new question. Otherwise remind them in one sentence where you left off and invite them to carry on. Never start a new topic. Then listen.';
 function recordTalk(s){if(s?.talkStartedAt)window.WorldviewLessonCost?.recordTalk?.(s.costOwner||context?.owner,s.costRunId||context?.runId,s.id,(Date.now()-s.talkStartedAt)/1000);}
 function idleCheck(s){
  recordTalk(s);
  if(session!==s||s.closing||!s.ready||document.hidden)return;
  if(s.softPaused){if(performance.now()-s.softPausedAt>IDLE_LISTEN_MS)void stop('Voice paused. Tap play when you are ready.',{pause:true});return;}
  if(s.speaking||s.checking||s.refreshStep===studyStep(study))return;
  if(performance.now()-(s.lastActivityAt||0)<IDLE_PAUSE_MS)return;
  void idlePause(s);
 }
 async function idlePause(s){
  if(session!==s||s.closing)return;
  window.WorldviewLessonCues?.chime('pause');
  if(s.gemini&&!s.muted){
   s.softPaused=true;s.softPausedAt=performance.now();s.levelFloor=[];s.loudSince=0;
   s.gemini.mute(true,{hold:true});
   message('Paused after a quiet minute. Just start talking, or tap play.');paint();return;
  }
  await stop('Paused after a quiet minute. Tap play to carry on.',{pause:true});
 }
 function softResume(s){
  if(session!==s||!s.softPaused)return;
  s.softPaused=false;s.lastActivityAt=performance.now();
  s.gemini?.mute(false,{flush:true});
  message(s.muted?'Mic muted':'Listening');paint();
 }
 // Speech is judged against the room measured in the first second of the
 // pause, so steady road noise does not count as talking.
 function inputLevel(s,level){
  if(session!==s||!s.softPaused)return;
  if(s.levelFloor.length<10){s.levelFloor.push(level);return;}
  const threshold=Math.max(.02,s.levelFloor.slice().sort((a,b)=>a-b)[5]*3);
  const now=performance.now();
  if(level<=threshold){s.loudSince=0;return;}
  if(!s.loudSince)s.loudSince=now;
  if(now-s.loudSince>=250)softResume(s);
 }
 // One entry cue, not a learner turn. Acknowledgment is not playback proof.
 /* The application moves the lesson to its next part, but nothing asks the tutor
    to open it. The handoff is advisory context and the tutor's own instructions
    say not to speak merely because an update arrived, so it announced the move
    and then waited; the learner waited too and the lesson sat in silence. One cue
    is sent per phase, and only when nobody has spoken since the change. */
 function phaseOpeningInstruction(fresh=false){
  const shared='PHASE OPENING. Use the saved phase in the selected language. Continue from the learner\'s thinking; no greeting, repeated question, or readiness offer. ';
  if(study.complete||study.phase==='complete')return shared+'The final teach-back is saved as complete. Briefly connect their takeaway to the original purpose, acknowledge the finish once, then stop. Ask no question and do not begin another quiz.';
  if(study.phase==='quiz')return shared+(study.currentIndex>0?'Continue the final teach-back with one plain-language application question for the saved current outcome.':(fresh?'Say in one short sentence that the lesson is covered and the final teach-back starts now. Then begin':'Begin')+' the final teach-back now with one plain-language application question for its current outcome.')+' Do not announce completion or offer to restart. Then listen.';
  if(study.phase==='extraction')return shared+'While the lesson is being prepared, invite one broad own-words perspective on the learner\'s concern. Do not test researched facts. Then listen.';
  const chapter=study.packet?.journeyContext?.chapter?.title;
  const start=fresh&&study.currentIndex===0?'The researched lesson begins now. In one short sentence tell the learner their lesson is starting'+(chapter?' and name the first chapter, "'+chapter+'"':'')+'. Then ':'';
  return shared+(start?start+'open':'Open')+' only the saved current outcome: connect briefly to the lesson purpose, share its key verified idea in a few plain, vivid sentences, then ask one question that asks them to use it. Do not offer the quiz before its saved phase. Then listen.';
 }
 function schedulePhaseOpening(state){
  if(!study||state.openedPhase===studyStep(study))return;
  state.pendingOpeningStep=studyStep(study);
  const version=studyStep(study),changedAt=performance.now(),seq=state.lastUserSeq||0;
  clearTimeout(state.openingTimer);
  state.openingTimer=setTimeout(()=>{
   if(session!==state||state.closing||!state.ready||!study)return;
   if(studyStep(study)!==version||(state.lastUserSeq||0)!==seq)return;
   // A question asked BEFORE map completion still belongs to the learner.
   // Silence while they think is not permission for a second opening.
   if(protectedQuestion(state)){state.openedPhase=version;state.pendingOpeningStep=null;return;}
   // Somebody is already talking, so the handoff is not a dead end after all.
   if(state.speaking||(state.lastAssistantAt||0)>changedAt||state.deferredStudy)return;
   const instruction=phaseOpeningInstruction();
   if(state.gemini){if(state.gemini.prompt?.(instruction)){state.openedPhase=version;state.pendingOpeningStep=null;}return;}
   state.openingCount=(state.openingCount||0)+1;
   send(state,{type:'session.instructions.append',event_id:state.id+':phase-opening:'+state.openingCount,delegation_id:null,content:instruction});
   state.openedPhase=version;state.pendingOpeningStep=null;
  },3000);
 }
 const VOICE_ENTRY_INSTRUCTION='VOICE ENTRY. Speak first in the selected language; do not wait for learner speech. Keep the saved phase and instructions. If the topic is unknown, ask what they would like to explore. Otherwise give one brief continuation from saved context; never repeat answered questions. Then pause and listen. If speech has begun, do not start a second opening.';
 function requestOpening(state){
  if(!state.initiate)return;
  openingPending=false;
  if(state.model==='gemini-3.8-live'||state.lastTranscriptAt!=null)return;
  state.openingEventId=state.id+':voice-entry';
  send(state,{type:'session.instructions.append',event_id:state.openingEventId,delegation_id:null,content:state.openingText||VOICE_ENTRY_INSTRUCTION});
  message('Starting conversation…');
 }
 function event(state,e){
  if(session!==state)return;if(e.event_id){if(state.seen.has(e.event_id))return;state.seen.add(e.event_id);}
  // Caption tails may describe already-captured speech. Retain them for export
  // while closing, but never let them trigger another check or audio operation.
  if(state.closing&&!['session.started','session.input_transcript.delta','session.output_transcript.delta','session.usage.updated','session.closed'].includes(e.type))return;
  if(e.type==='session.started'){if(state.closing){send(state,{type:'session.close'});return;}if(state.ready)return;state.ready=true;mark(state,'ready');autoAttempts=0;paused=false;startError=false;state.publishedPhase=study.phaseVersion;state.publishedStudy=studyPublication(study);state.publishedStep=studyStep(study);
   // A refreshed connection opens its phase itself; do not schedule a second opening.
   if(state.openingText)state.openedPhase=studyStep(study);
   state.lastActivityAt=performance.now();state.talkStartedAt=Date.now();state.idleTimer=setInterval(()=>idleCheck(state),5000);
   clearTimeout(state.startup);message('Listening');requestOpening(state);state.checkTimer=setInterval(()=>{if(session===state&&!state.closing)void check();},25000);paint();}
  else if(e.type==='session.instructions.appended'&&state.openingEventId&&e.client_event_id===state.openingEventId){state.openingAcknowledged=true;if(state.lastTranscriptAt==null)message('Listening');}
  else if(e.type==='session.input_transcript.delta')append(state,e,'user');
  else if(e.type==='session.output_transcript.delta')append(state,e,'assistant');
  else if(e.type==='gemini.turn.complete'){state.usageTurn=(state.usageTurn||0)+1;if(Date.now()-(state.connectedAt||Date.now())>=60000)autoAttempts=0;}
  else if(e.type==='session.delegation.created'){const id=e.delegation?.id;if(typeof id==='string'&&!state.delegations.has(id)){state.delegations.add(id);void check(id);}}
  else if(e.type==='session.usage.updated'||e.type==='session.closed'){
   if(Number.isFinite(e.usage?.seconds)&&e.usage.seconds>=0)state.seconds=Math.max(state.seconds,e.usage.seconds);if(state.seconds>=60)autoAttempts=0;
   recordVoiceCost(state,{seconds:e.usage?.seconds,final:e.type==='session.closed'});
   // A held pause that the provider ends becomes an ordinary pause, never a
   // spoken reconnect in a quiet car.
   if(e.type==='session.closed'){if(state.softPaused)paused=true;void flush();if(state.model==='gemini-3.8-live')closeGeminiReceipt(state);if(!state.closing&&!['expired','connection_lost'].includes(e.reason))startError=true;cleanup(state);message(paused?'Voice paused. Tap Resume voice when you are ready.':startError?'Voice stopped. Your conversation is saved.':'Reconnecting…');maybeStart();}
  }else if(e.type==='error'){startError=true;void stop('Voice had a connection error. Try again.');}
 }
 async function begin(){
  // A prepared start (phase refresh or resuming after a quiet pause) carries the
  // microphone this page already holds and, for Gemini, a connection that was
  // authorized in the background. It does not wait for the old receipt to close:
  // the server closes a stale session itself when this one is created.
  const start=nextStart;nextStart=null;
  const release=()=>{start?.mic?.getTracks().forEach(t=>t.stop());if(start?.id)void request?.({action:'close',requestId:start.id}).catch(()=>{});};
  if(!enabled||loading||!study||session||(releasing&&!start)||!context?.ready||document.hidden){release();return;}
  if(autoAttempts>=3){release();startError=true;message('Voice could not reconnect. Try again.');paint();return;}autoAttempts++;
  // Voice that returns after a pause, or on a lesson reopened later, says a
  // short welcome back and repeats its own unanswered question once; it does
  // not open the phase again.
  const resuming=!start&&fragments.some(f=>!f.id.startsWith('import:'));
  const s={id:start?.id||crypto.randomUUID(),initiate:openingPending,openingText:start?.opening||(resuming?RESUME_INSTRUCTION:''),refreshed:!!start?.phase,resumed:resuming,request,scope,model:context.model||'gpt-live-1',connectedAt:Date.now(),studyId:study.id,seen:new Set(),delegations:new Set(),pendingDelegations:new Set(),lastUserSeq:fragments.findLast(f=>f.role==='user')?.seq||0,seconds:0,ready:false,closing:false,dispatched:false,muted:false,t0:performance.now(),marks:{}};session=s;paint();
  try{
   host.releaseMedia();captureAudioType();output?.start();
   let mic=start?.mic?.getAudioTracks().some(t=>t.readyState==='live')?start.mic:null;
   // VOI-142: a Gemini lesson asks the server for its connection while the
   // microphone opens, instead of one after the other.
   let created=null;
   if(s.model==='gemini-3.8-live'&&!start?.transport){
    created=(async()=>{
     if(!await flush())throw Error('Transcript save is pending.');
     if(session!==s||s.closing)return null;
     s.dispatched=true;startVoiceCost(s);
     const result=await s.request({action:'create',mode:'study',model:s.model,requestId:s.id,studyId:s.studyId,consent:'paid-gemini-3.8-live-whole-lesson'});
     s.serverAt=Date.now();mark(s,'server');return result;
    })();
    created.catch(()=>{});
   }
   if(!mic){start?.mic?.getTracks().forEach(t=>t.stop());message('Waiting for microphone permission…');mic=await acquireMic(s);}
   mark(s,'mic');
   if(session!==s||s.closing){mic.getTracks().forEach(t=>t.stop());if(start?.id)void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}s.mic=mic;void output?.refresh();
   message(start?.phase?{lesson:'Starting your lesson…',quiz:'Starting the final teach-back…',complete:'Wrapping up…'}[start.phase]||'Moving on…':'Connecting voice…');
   s.startup=setTimeout(()=>{if(session!==s||s.closing)return;startError=true;void stop('Voice could not connect. Try again.');},45000);
   if(s.model==='gemini-3.8-live'){
    mic.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');}));
    let result=start?.transport?{transport:start.transport}:null;
    if(result){s.dispatched=true;startVoiceCost(s);}
    else{
     result=await created;if(!result||session!==s||s.closing)return;
     // A connection has to open within a minute of being authorized, and a
     // long microphone prompt can outlast that.
     if(Date.now()-s.serverAt>45000)throw Error('The microphone took a while to open. Tap play to try again.');
    }
    if(session!==s||s.closing){void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}
    await window.WorldviewGeminiLive.connect({transport:result.transport,mic,outputAudio:ui.audio,initiate:s.initiate,openingText:s.openingText,onInputLevel:level=>inputLevel(s,level),isCurrent:()=>session===s&&!s.closing,onTransport:value=>{s.gemini=value;output?.attach({applyRoute:loud=>value.applyRoute?value.applyRoute(loud):'unavailable'});},onEvent:e=>event(s,e),onUsage:metadata=>recordVoiceCost(s,{metadata,usageId:s.usageTurn||0}),onStatus:text=>{if(session===s){message(text);if(text.includes('Tap Enable audio.'))ui.enableAudio.hidden=false;}}});
    return;
   }
   const peer=s.peer=new RTCPeerConnection();mic.getAudioTracks().forEach(t=>{peer.addTrack(t,mic);t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');});});
   peer.addEventListener('track',e=>attachOutput(s,e.track));
   peer.addEventListener('connectionstatechange',()=>{clearTimeout(s.disconnectTimer);if(session!==s||s.closing)return;if(['failed','closed'].includes(peer.connectionState))void stop('Reconnecting…');else if(peer.connectionState==='disconnected')s.disconnectTimer=setTimeout(()=>{if(session===s&&!s.closing&&peer.connectionState==='disconnected')void stop('Reconnecting…');},15000);});
   s.channel=peer.createDataChannel('oai-events');s.channel.addEventListener('message',e=>{if(session!==s)return;try{event(s,JSON.parse(e.data));}catch{if(!s.closing)void stop('Live returned an unreadable event.');}});
   s.channel.addEventListener('close',()=>{if(session===s&&!s.closing)void stop('Live connection closed.');});
   await peer.setLocalDescription(await peer.createOffer());
   if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',ready);reject(Error('Voice connection setup timed out.'));},10000);function ready(){if(peer.iceGatheringState==='complete'){clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',ready);resolve();}}peer.addEventListener('icegatheringstatechange',ready);ready();});
   if(session!==s||s.closing)return;if(!await flush())throw Error('save-pending');if(session!==s||s.closing||document.hidden)return;s.dispatched=true;startVoiceCost(s);
   const result=await s.request({action:'create',mode:'study',requestId:s.id,studyId:s.studyId,sdp:peer.localDescription.sdp,consent:'paid-gpt-live-1-whole-lesson'});
   s.costConfirmed=true;recordVoiceCost(s);
   if(session!==s||s.closing){void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}
   await peer.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
  }catch(error){if(session===s){startError=true;void stop(error.name==='NotAllowedError'?'Voice stopped. Tap play to carry on.':s.model==='gemini-3.8-live'?(error.message||'Gemini Live could not connect. Choose GPT Live or try again.'):'The microphone could not connect. Try again.');}}
 }
 async function stop(reason='Voice paused.',options={}){
  if(options.pause)paused=true;
  const s=session;if(!s||s.closing)return;stopVoiceCost(s);s.closing=true;clearTimeout(s.openingTimer);clearInterval(s.checkTimer);clearInterval(s.idleTimer);clearInterval(s.refreshTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);if(!s.keepMic)s.mic?.getTracks().forEach(t=>t.stop());
  // A background connection that was never taken over is closed with this one.
  if(s.nextTransport&&!options.refresh)void s.request({action:'close',requestId:s.nextTransport.id}).catch(()=>{});
  // Keep the channel briefly for final usage, but release audible playback now.
  // Otherwise a paused/replaced session can keep talking for the 8-second grace.
  output?.stop();detachOutput(s);ui.audio.pause?.();ui.audio.srcObject=null;ui.enableAudio.hidden=true;stash();void flush();message(reason);
  if(s.model==='gemini-3.8-live'){
   closeGeminiReceipt(s);s.gemini?.close();cleanup(s);message(reason);return;
  }
  if(s.ready)send(s,{type:'session.close'});
  if(s.dispatched)void s.request({action:'close',requestId:s.id}).catch(()=>{if(session===s)message('Server close was not confirmed. Ending the voice connection.');});
  // A refresh or quiet-minute pause hands over at once; waiting eight seconds
  // for final usage would be eight seconds of silence.
  if(!s.dispatched||options.refresh||options.pause&&s.keepMic){cleanup(s);message(reason);return;}
  s.closeTimer=setTimeout(()=>{if(session===s){cleanup(s);message(reason);maybeStart();}},8000);paint();
 }
 function cleanup(s){recordTalk(s);stopVoiceCost(s);clearTimeout(s.openingTimer);clearTimeout(s.speakingTimer);s.speaking=false;clearTimeout(s.disconnectTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);clearTimeout(restoreTimer);s.closing=true;clearTimeout(s.startup);clearTimeout(s.closeTimer);clearInterval(s.checkTimer);clearInterval(s.idleTimer);clearInterval(s.refreshTimer);if(!s.keepMic)s.mic?.getTracks().forEach(t=>t.stop());s.gemini?.dispose();detachOutput(s);s.channel?.close();s.peer?.close();if(session===s){session=null;output?.stop();captureAudioType('auto');ui.audio.pause?.();ui.audio.srcObject=null;ui.audio.hidden=true;ui.enableAudio.hidden=true;paint();}}
 /* Two replies in one Live session arrive as adjacent native deltas and merge
    into one turn, so a finished sentence runs straight into the next reply:
    "...late nineties?Moving into our first chapter...". A delta that opens a
    new sentence immediately after a finished one, with no whitespace at the
    join, is a new reply rather than a continuation. Within a single streamed
    reply the delta carries its own leading space, so that case is untouched. */
 function joinDelta(text,delta){
  if(!text)return delta;
  if(/\s$/.test(text)||/^\s/.test(delta))return text+delta;
  if(/[.!?\"\')\]]$/.test(text)&&/^[\"\'(\[]?[A-Z]/.test(delta))return text+String.fromCharCode(10,10)+delta;
  return text+delta;
 }
 /* VOI-141. The learner's Start button is their go-ahead. From "Your
    question" one tap moves the lesson to preparation and asks, in the same tap,
    for the lesson to begin as soon as its first part is researched; the tutor
    keeps talking meanwhile. The server holds that go-ahead until research is
    ready, so talking in the meantime does not cancel it. */
 function startLesson(){
  if(starting)return starting;
  if(!study||!request||!['clarification','extraction'].includes(study.phase))return Promise.resolve(false);
  const expected=scope,captured=request,id=study.id,before=studyStep(study),fromPhase=study.phase;
  starting=(async()=>{try{
   message('Starting your lesson…');
   if(!await flush())throw Error('Your conversation is still saving. Try again in a moment.');
   const once=async()=>{
    for(let tries=0;tries<12;tries++){
     const result=await captured({action:'journey_start',studyId:id});
     if(scope!==expected)return null;
     if(!result.busy)return result;
     await new Promise(resolve=>setTimeout(resolve,1500));
    }
    throw Error('The lesson is still checking. Try Start again in a moment.');
   };
   let result=await once();if(!result)return false;
   if(fromPhase==='clarification'&&result.study?.phase==='extraction'){const held=await once();if(held?.study)result=held;}
   if(scope!==expected||!result?.study)return false;
   study={...result.study,fragments};await applyPhase();
   const s=session,advanced=studyStep(study)!==before;
   if(advanced&&s?.ready&&!s.closing){if(study.phase==='extraction'&&!study.complete){deliverStudy(s);s.pendingOpeningStep=studyStep(study);schedulePhaseOpening(s);}else scheduleRefresh(s);}
   else if(s?.ready&&!s.closing)message('Listening');
   paint();return advanced||study.packet?.conversationState?.approvalSaved===true;
  }catch(error){if(scope===expected)message(error.message||'The lesson could not start. Try again.');return false;}
  finally{starting=null;}})();
  return starting;
 }
 /* VOI-142. Where the seconds go between opening a lesson and hearing the
    tutor. Page-relative times, kept for the last few connections, copied into
    the transcript for the owner and testers only. */
 function mark(s,name){
  if(!s?.marks||s.marks[name]!=null)return;
  s.marks[name]=performance.now();
  if(name!=='words')return;
  timingLog.push({kind:s.refreshed?'Next part':s.resumed?'Resumed':'Opened',model:s.model,t0:s.t0,...s.marks,prepare:timingLog.length?null:prepareTiming});
  if(timingLog.length>6)timingLog.shift();
 }
 function timingSummary(){
  if(!timingLog.length)return '';
  const secs=ms=>(ms/1000).toFixed(1)+' s';
  const lines=timingLog.map(t=>{
   const steps=[];
   if(t.prepare)steps.push('saved lesson '+secs(t.prepare.end-t.prepare.start));
   if(t.mic!=null)steps.push('microphone '+secs(t.mic-t.t0));
   if(t.server!=null)steps.push('voice server '+secs(t.server-t.t0));
   if(t.ready!=null)steps.push('connected '+secs(t.ready-t.t0));
   steps.push('first words '+secs(t.words-t.t0));
   const lead=t.kind==='Opened'&&t.prepare?' ('+secs(t.words)+' after the page opened)':'';
   return t.kind+lead+': '+steps.join(' · ');
  });
  return 'Voice start timing ('+(timingLog.at(-1).model==='gemini-3.8-live'?'Gemini Live':'GPT Live')+')\n'+lines.join('\n');
 }
 function transcriptTurns(expectedLineage,currentHistory){
  if(!expectedLineage||scope!==expectedLineage||context?.lineage!==expectedLineage||!(study||exportStudyId))return null;
  if(!enabled&&Array.isArray(currentHistory))rememberTextHistory(currentHistory,true);
  const turns=prefix.map(t=>({...t}));
  let previousNative=false;
  const insert=seq=>{for(const group of textInsertions.filter(s=>s.afterSeq===seq)){turns.push(...group.turns.map(t=>({...t})));previousNative=false;}};
  insert(0);
  // Imports are complete turns; only adjacent native deltas share a turn.
  // Text typed between voice sessions stays at that exact fragment boundary.
  for(const f of fragments){if(isControlEcho(f.delta))continue;const native=!f.id.startsWith('import:'),last=turns.at(-1);if(native&&previousNative&&last?.role===f.role)last.content=joinDelta(last.content,f.delta);else{const at=fragmentAt(f);turns.push(at?{role:f.role,content:f.delta,at}:{role:f.role,content:f.delta});}previousNative=native;insert(f.seq);}
  for(const t of turns)t.content=cleanCaption(t.content);
  return turns.filter(t=>t.content);
 }
 const api={mount,sync,stop,place,transcriptTurns,startLesson,timingSummary,connectionState,freeStorage:sweepOtherDrafts,toggleSpeaker:()=>output?.toggle(),paintSpeaker:()=>output?.paint(),ownsAudio:()=>!!session,active:()=>!!session,enabled:()=>enabled};return api;
})();
