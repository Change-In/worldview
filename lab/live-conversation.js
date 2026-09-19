/* Native Live teaching. Captions are revisable fragments, never automatic submitted text turns. */
window.WorldviewLiveConversation=(()=>{
 'use strict';
 let host,ui,context,study,session,loadToken=0,loading=false,saving=null,enabled=false,saveTimer;
 let showCaptions=false,paused=false,startError=false,autoAttempts=0,restoreTimer;
 let appliedPhase=0,releasing=null,openingPending=true,output,lastConnectionState='',backgrounded=false;
 const fragmentTimes=new Map();
 let fragments=[],prefix=[],textInsertions=[],textSnapshot=null,exportWasText=false,exportStudyId='',ack=0,saveError='',request,scope='',draftKey='';
 const element=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function mount(adapter){
  host=adapter;const root=element('section');root.className='live-conversation';root.hidden=true;
  const note=element('p'),rate=element('span','$0.05/min'),total=element('strong','Est. total —');note.className='live-conversation-cost';note.append(rate,total);
  const actions=element('div');actions.className='live-conversation-actions';
  const enableAudio=element('button','Enable audio');enableAudio.hidden=true;
  const start=element('button','Start GPT Live'),retry=element('button','Retry saving');
  // Mute, Pause and the transcript toggle are icon-only. Each keeps a real
  // aria-label and title, kept in sync by paint(), so the control is still
  // named for screen readers and on hover once the words are gone.
  const ICONS={
   mic:'<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/><path class="live-icon-slash" d="m4 4 16 16"/>',
   pause:'<rect x="7" y="5" width="3.5" height="14" rx="1.2"/><rect x="13.5" y="5" width="3.5" height="14" rx="1.2"/>',
   transcript:'<path d="M5 6h14M5 10h14M5 14h10M5 18h7"/>'
  };
  const iconButton=(name,label)=>{const b=element('button');b.className='live-icon-button';b.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true">'+ICONS[name]+'</svg>';b.setAttribute('aria-label',label);b.title=label;return b;};
  const mute=iconButton('mic','Mute mic'),end=iconButton('pause','Pause voice'),captions=iconButton('transcript','Show transcript'),textMode=element('button','Aa');
  textMode.className='live-icon-button';textMode.setAttribute('aria-label','Switch to Text');textMode.title='Switch to Text';textMode.onclick=()=>host.onTextMode?.();
  for(const b of [start,enableAudio,mute,end,retry,captions,textMode])b.type='button';actions.append(start,enableAudio,mute,end,retry,captions,textMode);
  const status=element('p','Connecting…');status.setAttribute('role','status');
  const usage=element('small'),progress=element('p');progress.className='live-conversation-progress';
  const audio=element('audio');audio.autoplay=true;audio.controls=false;audio.playsInline=true;audio.hidden=true;
  root.append(note,actions,status,usage,progress);adapter.container.append(root);(document.body||adapter.container).append(audio);
  ui={root,note,rate,total,start,enableAudio,mute,end,retry,captions,status,usage,progress,audio};
  output=window.WorldviewLiveAudioOutput?.create({audio,button:adapter.speakerButton,container:root});
  enableAudio.onclick=()=>{const s=session;if(!s||s.closing)return;const version=s.outputVersion;void output?.apply({user:true});void resumeAudio(s).then(()=>{if(session===s&&!s.closing&&s.outputVersion===version){enableAudio.hidden=true;message('Listening');}}).catch(()=>{if(session===s&&!s.closing&&s.outputVersion===version)message('Audio is blocked. Check the browser’s audio permission.');});};
  captions.onclick=()=>{showCaptions=!showCaptions;paint();};
  start.onclick=()=>{openingPending=true;paused=false;startError=false;autoAttempts=0;void(study?begin():prepare());};end.onclick=()=>{paused=true;void stop('Voice paused.',{pause:true});};retry.onclick=()=>void flush();
  mute.onclick=()=>{const s=session;if(!s?.ready||s.closing)return;s.muted=!s.muted;s.mic?.getAudioTracks().forEach(t=>t.enabled=!s.muted);s.gemini?.mute(s.muted);message(s.muted?'Mic muted':'Listening');paint();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden){backgrounded=!!session&&!paused;void stop('Voice paused in the background.');return;}resumeFromBackground();});
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
 function stash(){if(!draftKey||!(study?.id||exportStudyId))return;try{localStorage.setItem(draftKey,JSON.stringify({studyId:study?.id||exportStudyId,fragments,prefix,textInsertions,textSnapshot,textMode:exportWasText}));}catch{saveError='Device backup is unavailable. Keep this page open until the transcript is saved.';}}
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
 function paint(){
  if(!ui)return;ui.root.hidden=!enabled;ui.start.hidden=!!session||(!paused&&!startError);ui.start.disabled=loading||!!session||!context?.ready||document.hidden;
  if(enabled)output?.paint();
  ui.start.textContent=paused?'Resume voice':'Try microphone again';
  ui.rate.hidden=true;
  ui.captions.hidden=!session?.ready||context?.car;const capsLabel=showCaptions?'Hide transcript':'Show transcript';ui.captions.setAttribute('aria-label',capsLabel);ui.captions.title=capsLabel;ui.captions.setAttribute('aria-pressed',String(showCaptions));
  ui.end.hidden=!session;ui.mute.hidden=!session?.ready;const muteLabel=session?.muted?'Unmute mic':'Mute mic';ui.mute.setAttribute('aria-label',muteLabel);ui.mute.title=muteLabel;ui.mute.classList.toggle('is-muted',!!session?.muted);ui.mute.setAttribute('aria-pressed',String(!!session?.muted));
  ui.retry.hidden=!saveError;ui.retry.disabled=!!saving;
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
   const native=!f.id.startsWith('import:'),last=groups.at(-1),at=fragmentTimes.get(f.id);
   if(native&&previousNative&&last?.live&&last.role===f.role){last.text+=f.delta;if(at&&!last.at)last.at=at;}
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
   if(next.lineage){const key='worldview-live-draft-v2:'+next.lineage,draft=exportDraft(key);if(draft){scope=next.lineage;draftKey=key;exportStudyId=draft.studyId;fragments=draft.fragments;prefix=draft.prefix;textInsertions=draft.textInsertions;textSnapshot=draft.textSnapshot;collectText=draft.textMode===true;}}
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
  backgrounded=false;paint();maybeStart();
 }
 function closeGeminiReceipt(s){
  if(!s.dispatched||s.receiptClose)return;
  releasing=s.receiptClose=s.request({action:'close',requestId:s.id}).catch(()=>{}).finally(()=>{if(releasing===s.receiptClose){releasing=null;maybeStart();}});
 }
 function place(container,car=false){if(!ui||!container)return;if(ui.root.parentElement!==container)container.append(ui.root);ui.root.classList.toggle('is-car',car);paint();}
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
 async function prepare(){
  const token=++loadToken,expected=context.lineage,input=context.studyInput,model=context.model||'gpt-live-1',captured=host.requestForCurrentAccount();loading=true;message('Opening the saved research and conversation…');paint();
  try{
   // Capability and saved-lesson preparation use the same captured account and
   // do not depend on one another. Voice creation waits for both to succeed.
   const [ready,result]=await Promise.all([captured({action:'check',model}),captured({action:'journey_prepare',...input})]);
   if(token!==loadToken||context.lineage!==expected)return;
   if(!ready.journeyMode)throw Error('Natural Live lessons are awaiting the server update. Standard voice remains available.');
   study=result.study;fragments=study.fragments.slice();ack=fragments.length;request=captured;scope=expected;draftKey='worldview-live-draft-v2:'+expected;
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
  const f={seq:fragments.length+1,id:String(event.event_id||state.id+':'+fragments.length),role,delta:event.delta,start_ms:Number.isFinite(event.start_ms)?event.start_ms:null,end_ms:Number.isFinite(event.end_ms)?event.end_ms:null};
  fragments.push(f);state.lastTranscriptAt=performance.now();
  if(role==='user')state.lastUserTranscriptAt=state.lastTranscriptAt;
  else{state.speaking=true;state.lastAssistantAt=state.lastTranscriptAt;clearTimeout(state.speakingTimer);state.speakingTimer=setTimeout(()=>{state.speaking=false;},900);}
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
 async function applyPhase(){
  if(!study||study.phaseVersion===appliedPhase)return;appliedPhase=study.phaseVersion;
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
  const signature=JSON.stringify({version:study.phaseVersion,instructions:study.instructions,packet:study.packet});
  if(state.publishedStudy===signature)return false;
  const phaseChanged=state.publishedPhase!==study.phaseVersion;
  if(state.gemini){
   state.gemini.context('APP_HANDOFF. Adopt this saved phase and next focus at the next natural boundary. This is application context, not learner speech. Do not repeat answered questions or speak merely because this update arrived.\n'+(phaseChanged?'Phase policy: '+changedPolicy(study.instructions)+'\n':'')+'Saved reference packet: '+JSON.stringify(study.packet));
   state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;return true;
  }
  // Silent context is advisory, not a provider-enforced speech boundary.
  inject(state,'APP_HANDOFF_START. Buffer this complete update; do not speak or interrupt because it arrived.',delegationId);
  if(phaseChanged)inject(state,'Replacement phase policy: '+changedPolicy(study.instructions),delegationId);
  inject(state,'Saved reference packet: '+JSON.stringify(study.packet),delegationId);
  inject(state,'APP_HANDOFF_END. Adopt this saved phase/outcome at the next natural boundary. Do not repeat a bridge or answer twice. Continue from what the learner just said.',delegationId);
  state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;return true;
 }
 function announceTransition(state){
  // The handoff itself is quick, but the tutor is briefly silent while it adopts the new phase.
  // Name where the lesson is going so the pause reads as progress rather than a stall.
  const next={extraction:'Setting up your starting point…',lesson:'Starting the lesson…',quiz:'Starting the final teach-back…',complete:'Wrapping up…'}[study?.phase];
  if(!next)return;
  message(next+' the next reply may take a few seconds.');
  clearTimeout(restoreTimer);
  restoreTimer=setTimeout(()=>{if(session===state&&!state.closing&&!saveError&&!state.checking)message(paused?'Paused':'Listening');},8000);
 }
 async function check(delegationId=null){
  const s=session;if(!s?.ready||s.closing)return;
  if(delegationId)s.pendingDelegations.add(delegationId);
  if(checkDelay(s)>0){scheduleCheck(s);return;}
  if(s.checking)return;
  s.checking=true;const expected=scope,id=study.id,captured=request,input=context.studyInput,startedPhase=study.phaseVersion,startedUserSeq=s.lastUserSeq||0;
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
   const advanced=study.phaseVersion!==startedPhase;
   // The saved phase is what the lesson has actually reached, so the roadmap and
   // the visible move to the next outcome follow it straight away. Only the
   // model-facing update is held back, and only for newer learner speech: a focus
   // written against an older answer would talk over what they just said. Holding
   // the whole result back also hid finished progress behind the tutor's own
   // voice, which is why an answer could be accepted without the lesson moving.
   await applyPhase();
   if(session!==s||s.closing)return;
   if(advanced)announceTransition(s);
   if((s.lastUserSeq||0)!==startedUserSeq){scheduleCheck(s);return;}
   const pending=[...s.pendingDelegations];s.pendingDelegations.clear();
   const firstDelegation=pending.shift()||null,published=publishStudy(s,firstDelegation);
   if(!published&&firstDelegation)inject(s,'Application state received. The saved phase is unchanged. Continue the current conversation; this is not a new learner turn.',firstDelegation);
   for(const id of pending)inject(s,'Application state received. Use the latest saved phase; this is not a new learner turn.',id);
   if(advanced)schedulePhaseOpening(s);
   if(study.checkError)message('Conversation saved. The understanding check could not finish; Live can keep teaching.');
   else if(!advanced&&!saveError)message(paused?'Paused':'Listening');
   paint();
  }catch{if(scope===expected&&session===s&&!s.closing)message('Live can keep teaching. The background understanding check is unavailable; no new progress was recorded.');}
  finally{clearTimeout(s.slowTimer);s.checking=false;}
 }
 // One entry cue, not a learner turn. Acknowledgment is not playback proof.
 /* The application moves the lesson to its next part, but nothing asks the tutor
    to open it. The handoff is advisory context and the tutor's own instructions
    say not to speak merely because an update arrived, so it announced the move
    and then waited; the learner waited too and the lesson sat in silence. One cue
    is sent per phase, and only when nobody has spoken since the change. */
 const PHASE_OPENING_INSTRUCTION='PHASE OPENING. The application has moved the lesson to its next part and the learner is waiting in silence. Speak one short opening for the new part now, in English, continuing from what they last said. Do not greet again, re-introduce yourself, or repeat an answered question. Then stop and listen.';
 function schedulePhaseOpening(state){
  if(!study||state.openedPhase===study.phaseVersion)return;
  state.openedPhase=study.phaseVersion;
  const version=study.phaseVersion,changedAt=performance.now(),seq=state.lastUserSeq||0;
  clearTimeout(state.openingTimer);
  state.openingTimer=setTimeout(()=>{
   if(session!==state||state.closing||!state.ready||!study)return;
   if(study.phaseVersion!==version||(state.lastUserSeq||0)!==seq)return;
   // Somebody is already talking, so the handoff is not a dead end after all.
   if(state.speaking||(state.lastAssistantAt||0)>changedAt)return;
   if(state.gemini){state.gemini.prompt?.(PHASE_OPENING_INSTRUCTION);return;}
   send(state,{type:'session.instructions.append',event_id:state.id+':phase-opening:'+version,delegation_id:null,content:PHASE_OPENING_INSTRUCTION});
  },3000);
 }
 const VOICE_ENTRY_INSTRUCTION='VOICE ENTRY. Speak first now in English; do not wait for learner speech. Keep the saved phase and instructions. If topic is unknown or "Topic to be chosen by voice", ask "What would you like to explore today?" Otherwise give one brief opening or continuation from saved context; never repeat answered questions. Then pause and listen. If speech has begun, do not start a second opening.';
 function requestOpening(state){
  if(!state.initiate)return;
  openingPending=false;
  if(state.model==='gemini-3.8-live'||state.lastTranscriptAt!=null)return;
  state.openingEventId=state.id+':voice-entry';
  send(state,{type:'session.instructions.append',event_id:state.openingEventId,delegation_id:null,content:VOICE_ENTRY_INSTRUCTION});
  message('Starting conversation…');
 }
 function event(state,e){
  if(session!==state)return;if(e.event_id){if(state.seen.has(e.event_id))return;state.seen.add(e.event_id);}
  // Caption tails may describe already-captured speech. Retain them for export
  // while closing, but never let them trigger another check or audio operation.
  if(state.closing&&!['session.started','session.input_transcript.delta','session.output_transcript.delta','session.usage.updated','session.closed'].includes(e.type))return;
  if(e.type==='session.started'){if(state.closing){send(state,{type:'session.close'});return;}if(state.ready)return;state.ready=true;autoAttempts=0;state.publishedPhase=study.phaseVersion;state.publishedStudy=JSON.stringify({version:study.phaseVersion,instructions:study.instructions,packet:study.packet});clearTimeout(state.startup);message('Listening');requestOpening(state);state.checkTimer=setInterval(()=>{if(session===state&&!state.closing)void check();},25000);paint();}
  else if(e.type==='session.instructions.appended'&&state.openingEventId&&e.client_event_id===state.openingEventId){state.openingAcknowledged=true;if(state.lastTranscriptAt==null)message('Listening');}
  else if(e.type==='session.input_transcript.delta')append(state,e,'user');
  else if(e.type==='session.output_transcript.delta')append(state,e,'assistant');
  else if(e.type==='gemini.turn.complete'){state.usageTurn=(state.usageTurn||0)+1;if(Date.now()-(state.connectedAt||Date.now())>=60000)autoAttempts=0;}
  else if(e.type==='session.delegation.created'){const id=e.delegation?.id;if(typeof id==='string'&&!state.delegations.has(id)){state.delegations.add(id);void check(id);}}
  else if(e.type==='session.usage.updated'||e.type==='session.closed'){
   if(Number.isFinite(e.usage?.seconds)&&e.usage.seconds>=0)state.seconds=Math.max(state.seconds,e.usage.seconds);if(state.seconds>=60)autoAttempts=0;
   recordVoiceCost(state,{seconds:e.usage?.seconds,final:e.type==='session.closed'});
   if(e.type==='session.closed'){void flush();if(state.model==='gemini-3.8-live')closeGeminiReceipt(state);if(!state.closing&&!['expired','connection_lost'].includes(e.reason))startError=true;cleanup(state);message(paused?'Voice paused.':startError?'Voice stopped. Your conversation is saved.':'Reconnecting…');maybeStart();}
  }else if(e.type==='error'){startError=true;void stop('Voice had a connection error. Try again.');}
 }
 async function begin(){
  if(!enabled||loading||!study||session||releasing||!context?.ready||document.hidden)return;
  if(autoAttempts>=3){startError=true;message('Voice could not reconnect. Try again.');paint();return;}autoAttempts++;
  const s={id:crypto.randomUUID(),initiate:openingPending,request,scope,model:context.model||'gpt-live-1',connectedAt:Date.now(),studyId:study.id,seen:new Set(),delegations:new Set(),pendingDelegations:new Set(),lastUserSeq:fragments.findLast(f=>f.role==='user')?.seq||0,seconds:0,ready:false,closing:false,dispatched:false,muted:false};session=s;paint();
  try{
   host.releaseMedia();captureAudioType();output?.start();message('Waiting for microphone permission…');
   const mic=await acquireMic(s);if(session!==s||s.closing){mic.getTracks().forEach(t=>t.stop());return;}s.mic=mic;void output?.refresh();
   message('Connecting voice…');s.startup=setTimeout(()=>{if(session!==s||s.closing)return;startError=true;void stop('Voice could not connect. Try again.');},45000);
   if(s.model==='gemini-3.8-live'){
    mic.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');}));
    if(!await flush())throw Error('Transcript save is pending.');if(session!==s||s.closing||document.hidden)return;
    s.dispatched=true;startVoiceCost(s);
    const result=await s.request({action:'create',mode:'study',model:s.model,requestId:s.id,studyId:s.studyId,consent:'paid-gemini-3.8-live-whole-lesson'});
    if(session!==s||s.closing){void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}
    await window.WorldviewGeminiLive.connect({transport:result.transport,mic,outputAudio:ui.audio,initiate:s.initiate,isCurrent:()=>session===s&&!s.closing,onTransport:value=>{s.gemini=value;output?.attach({applyRoute:loud=>value.applyRoute?value.applyRoute(loud):'unavailable'});},onEvent:e=>event(s,e),onUsage:metadata=>recordVoiceCost(s,{metadata,usageId:s.usageTurn||0}),onStatus:text=>{if(session===s){message(text);if(text.includes('Tap Enable audio.'))ui.enableAudio.hidden=false;}}});
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
  }catch(error){if(session===s){startError=true;void stop(error.name==='NotAllowedError'?'Allow microphone access, then try again.':s.model==='gemini-3.8-live'?(error.message||'Gemini Live could not connect. Choose GPT Live or try again.'):'The microphone could not connect. Try again.');}}
 }
 async function stop(reason='Voice paused.',options={}){
  if(options.pause)paused=true;
  const s=session;if(!s||s.closing)return;stopVoiceCost(s);s.closing=true;clearTimeout(s.openingTimer);clearInterval(s.checkTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);s.mic?.getTracks().forEach(t=>t.stop());
  // Keep the channel briefly for final usage, but release audible playback now.
  // Otherwise a paused/replaced session can keep talking for the 8-second grace.
  output?.stop();detachOutput(s);ui.audio.pause?.();ui.audio.srcObject=null;ui.enableAudio.hidden=true;stash();void flush();message(reason);
  if(s.model==='gemini-3.8-live'){
   closeGeminiReceipt(s);s.gemini?.close();cleanup(s);message(reason);return;
  }
  if(s.ready)send(s,{type:'session.close'});
  if(s.dispatched)void s.request({action:'close',requestId:s.id}).catch(()=>{if(session===s)message('Server close was not confirmed. Ending the voice connection.');});
  if(!s.dispatched){cleanup(s);message(reason);return;}
  s.closeTimer=setTimeout(()=>{if(session===s){cleanup(s);message(reason);maybeStart();}},8000);paint();
 }
 function cleanup(s){stopVoiceCost(s);clearTimeout(s.openingTimer);clearTimeout(s.speakingTimer);s.speaking=false;clearTimeout(s.disconnectTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);clearTimeout(restoreTimer);s.closing=true;clearTimeout(s.startup);clearTimeout(s.closeTimer);clearInterval(s.checkTimer);s.mic?.getTracks().forEach(t=>t.stop());s.gemini?.dispose();detachOutput(s);s.channel?.close();s.peer?.close();if(session===s){session=null;output?.stop();captureAudioType('auto');ui.audio.pause?.();ui.audio.srcObject=null;ui.audio.hidden=true;ui.enableAudio.hidden=true;paint();}}
 function transcriptTurns(expectedLineage,currentHistory){
  if(!expectedLineage||scope!==expectedLineage||context?.lineage!==expectedLineage||!(study||exportStudyId))return null;
  if(!enabled&&Array.isArray(currentHistory))rememberTextHistory(currentHistory,true);
  const turns=prefix.map(t=>({...t}));
  let previousNative=false;
  const insert=seq=>{for(const group of textInsertions.filter(s=>s.afterSeq===seq)){turns.push(...group.turns.map(t=>({...t})));previousNative=false;}};
  insert(0);
  // Imports are complete turns; only adjacent native deltas share a turn.
  // Text typed between voice sessions stays at that exact fragment boundary.
  for(const f of fragments){if(isControlEcho(f.delta))continue;const native=!f.id.startsWith('import:'),last=turns.at(-1);if(native&&previousNative&&last?.role===f.role)last.content+=f.delta;else turns.push({role:f.role,content:f.delta});previousNative=native;insert(f.seq);}
  for(const t of turns)t.content=cleanCaption(t.content);
  return turns.filter(t=>t.content);
 }
 const api={mount,sync,stop,place,transcriptTurns,connectionState,toggleSpeaker:()=>output?.toggle(),paintSpeaker:()=>output?.paint(),ownsAudio:()=>!!session,active:()=>!!session,enabled:()=>enabled};return api;
})();
