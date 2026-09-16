/* Native Live teaching. Captions are revisable fragments, never automatic submitted text turns. */
window.WorldviewLiveConversation=(()=>{
 'use strict';
 let host,ui,context,study,session,loadToken=0,loading=false,saving=null,enabled=false,saveTimer;
 let showCaptions=false,paused=false,startError=false,autoAttempts=0,restoreTimer;
 let appliedPhase=0,releasing=null,openingPending=true;
 let fragments=[],prefix=[],textInsertions=[],textSnapshot=null,exportWasText=false,exportStudyId='',ack=0,saveError='',request,scope='',draftKey='';
 const element=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function mount(adapter){
  host=adapter;const root=element('section');root.className='live-conversation';root.hidden=true;
  const note=element('p'),rate=element('span','$0.05/min'),total=element('strong','Est. total —');note.className='live-conversation-cost';note.append(rate,total);
  const actions=element('div');actions.className='live-conversation-actions';
  const enableAudio=element('button','Enable audio');enableAudio.hidden=true;
  const start=element('button','Start GPT Live'),mute=element('button','Mute mic'),end=element('button','Pause voice'),retry=element('button','Retry saving'),captions=element('button','Show transcript');
  for(const b of [start,enableAudio,mute,end,retry,captions])b.type='button';actions.append(start,enableAudio,mute,end,retry,captions);
  const status=element('p','Connecting…');status.setAttribute('role','status');
  const usage=element('small'),progress=element('p');progress.className='live-conversation-progress';
  const audio=element('audio');audio.autoplay=true;audio.controls=false;audio.playsInline=true;audio.hidden=true;
  root.append(note,actions,status,usage,progress);adapter.container.append(root);(document.body||adapter.container).append(audio);
  ui={root,note,rate,total,start,enableAudio,mute,end,retry,captions,status,usage,progress,audio};
  enableAudio.onclick=()=>{const s=session;if(!s||s.closing)return;void(s.gemini?s.gemini.resumeAudio():audio.play()).then(()=>{if(session===s&&!s.closing){enableAudio.hidden=true;message('Listening');}}).catch(()=>{if(session===s&&!s.closing)message('Audio is blocked. Check the browser’s audio permission.');});};
  captions.onclick=()=>{showCaptions=!showCaptions;paint();};
  start.onclick=()=>{openingPending=true;paused=false;startError=false;autoAttempts=0;void(study?begin():prepare());};end.onclick=()=>{paused=true;void stop('Voice paused.',{pause:true});};retry.onclick=()=>void flush();
  mute.onclick=()=>{const s=session;if(!s?.ready||s.closing)return;s.muted=!s.muted;s.mic?.getAudioTracks().forEach(t=>t.enabled=!s.muted);s.gemini?.mute(s.muted);message(s.muted?'Mic muted':'Listening');paint();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void stop('Voice paused in the background.');else maybeStart();});
  window.addEventListener('pagehide',()=>{stash();void stop('Live ended when you left the lesson.');});
  window.addEventListener('worldview-lesson-cost-updated',paintCosts);
  window.addEventListener('storage',e=>{if(e.key?.startsWith(window.WorldviewLessonCost?.prefix))paintCosts();});
  return api;
 }
 function message(text){if(ui)ui.status.textContent=text;}
 function paintCosts(){
  const costs=window.WorldviewLessonCost;if(!ui||!costs)return;
  const summary=costs.summary(context?.owner,context?.runId);
  ui.total.textContent=costs.format(summary);ui.total.title=costs.describe(summary);
  ui.usage.textContent=summary.saved===false?'Device saving unavailable; this estimate may be lost.':'Recorded on this device; some charges may be missing.';ui.usage.title=costs.describe(summary);ui.usage.hidden=!enabled;
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
  ui.start.textContent=paused?'Resume voice':'Try microphone again';
  ui.rate.textContent=(session?.model||context?.model)==='gemini-3.8-live'?'Gemini · $0.005/min in + $0.018/min out + text':'GPT Live · $0.05/min';
  ui.captions.hidden=!session?.ready||context?.car;ui.captions.textContent=showCaptions?'Hide transcript':'Show transcript';ui.captions.setAttribute('aria-pressed',String(showCaptions));
  ui.end.hidden=!session;ui.mute.hidden=!session?.ready;ui.mute.textContent=session?.muted?'Unmute mic':'Mute mic';ui.mute.setAttribute('aria-pressed',String(!!session?.muted));
  ui.retry.hidden=!saveError;ui.retry.disabled=!!saving;
  if(saveError)message(saveError);
  const count=Object.keys(study?.assessment||{}).length,total=study?.packet?.roadmap?.length||0;const phaseName={clarification:'Your direction',extraction:'Your starting point',lesson:'Lesson',quiz:'Final teach-back',complete:'Complete'}[study?.phase]||'Lesson';
  ui.progress.hidden=true;paintCosts();
  if(enabled&&study)renderTranscript();
 }
 function renderTranscript(){
  const root=host.transcript,follow=root.scrollHeight-root.scrollTop-root.clientHeight<40,position=root.scrollTop;
  if(session&&!showCaptions){root.replaceChildren();return;}
  const groups=[];for(const turn of context.history||[])groups.push({role:turn.role,text:turn.content});
  for(const f of fragments){const last=groups.at(-1);if(last?.live&&last.role===f.role)last.text+=f.delta;else groups.push({role:f.role,text:f.delta,live:true});}
  root.replaceChildren();for(const g of groups){const item=element('li');item.className='extraction-turn '+(g.role==='user'?'is-user':'is-assistant');const label=element('small',g.role==='user'?'You':g.live?'Worldview':'Earlier in this lesson');const text=element('p',g.text);item.append(label,text);root.append(item);}
  root.scrollTop=follow?root.scrollHeight:position;
 }
 function sync(next){
  const changed=context?.lineage!==next.lineage;
  let collectText=!enabled;
  if(session&&(changed||!next.enabled||context?.model!==next.model))void stop('Live ended because the lesson or voice model changed.');
  if(changed){openingPending=true;paused=false;startError=false;autoAttempts=0;appliedPhase=0;loadToken++;study=null;fragments=[];prefix=[];textInsertions=[];textSnapshot=null;exportWasText=false;exportStudyId='';ack=0;loading=false;saveError='';scope='';draftKey='';collectText=false;
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
 function closeGeminiReceipt(s){
  if(!s.dispatched||s.receiptClose)return;
  releasing=s.receiptClose=s.request({action:'close',requestId:s.id}).catch(()=>{}).finally(()=>{if(releasing===s.receiptClose){releasing=null;maybeStart();}});
 }
 function place(container,car=false){if(!ui||!container)return;if(ui.root.parentElement!==container)container.append(ui.root);ui.root.classList.toggle('is-car',car);paint();}
 function captureAudioType(type='play-and-record'){try{if(navigator.audioSession&&'type' in navigator.audioSession)navigator.audioSession.type=type;}catch{/* Browsers without this control choose their own route. */}}
 async function acquireMic(s){
  captureAudioType();
  try{return await navigator.mediaDevices.getUserMedia({audio:true});}
  catch(error){if(!/AudioSession category/i.test(error.message||'')||session!==s||s.closing||document.hidden)throw error;
   captureAudioType('auto');captureAudioType();return await navigator.mediaDevices.getUserMedia({audio:true});}
 }
 async function prepare(){
  const token=++loadToken,expected=context.lineage,captured=host.requestForCurrentAccount();loading=true;message('Opening the saved research and conversation…');paint();
  try{
   const ready=await captured({action:'check',model:context.model||'gpt-live-1'});if(!ready.journeyMode)throw Error('Natural Live lessons are awaiting the server update. Standard voice remains available.');
   const result=await captured({action:'journey_prepare',...context.studyInput});
   if(token!==loadToken||context.lineage!==expected)return;
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
 function append(state,event,role){
  if(session!==state||state.scope!==scope)return;
  if(typeof event.delta!=='string'||!event.delta)return;
  const f={seq:fragments.length+1,id:String(event.event_id||state.id+':'+fragments.length),role,delta:event.delta,start_ms:Number.isFinite(event.start_ms)?event.start_ms:null,end_ms:Number.isFinite(event.end_ms)?event.end_ms:null};
  fragments.push(f);state.lastTranscriptAt=performance.now();if(role==='user')state.lastUserSeq=f.seq;stash();paint();clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),1500);if(!state.closing)scheduleCheck(state,4000);
 }
 // This debounce reduces context churn. Captions have no completed-turn event,
 // so elapsed time is never evidence that either speaker has finished speaking.
 function checkDelay(state){return state.lastTranscriptAt==null?0:Math.max(0,4000-(performance.now()-state.lastTranscriptAt));}
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
 function publishStudy(state,delegationId=null){
  if(session!==state||state.closing)return false;
  const signature=JSON.stringify({version:study.phaseVersion,instructions:study.instructions,packet:study.packet});
  if(state.publishedStudy===signature)return false;
  const phaseChanged=state.publishedPhase!==study.phaseVersion;
  if(state.gemini){
   state.gemini.context('APP_HANDOFF. Adopt this saved phase and next focus at the next natural boundary. This is application context, not learner speech. Do not repeat answered questions or speak merely because this update arrived.\n'+(phaseChanged?'Phase policy: '+study.instructions+'\n':'')+'Saved reference packet: '+JSON.stringify(study.packet));
   state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;return true;
  }
  // Silent context is advisory, not a provider-enforced speech boundary.
  inject(state,'APP_HANDOFF_START. Buffer this complete update; do not speak or interrupt because it arrived.',delegationId);
  if(phaseChanged)inject(state,'Replacement phase policy: '+study.instructions,delegationId);
  inject(state,'Saved reference packet: '+JSON.stringify(study.packet),delegationId);
  inject(state,'APP_HANDOFF_END. Adopt this saved phase/outcome at the next natural boundary. Do not repeat a bridge or answer twice. Continue from what the learner just said.',delegationId);
  state.publishedStudy=signature;state.publishedPhase=study.phaseVersion;return true;
 }
 function announceTransition(state){
  // The handoff itself is quick, but the tutor is briefly silent while it adopts the new phase.
  // Name where the lesson is going so the pause reads as progress rather than a stall.
  const next={extraction:'Setting up your starting point…',lesson:'Starting the lesson…',quiz:'Starting the final teach-back…',complete:'Wrapping up…'}[study?.phase];
  if(!next)return;
  message(next+' one moment.');
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
   // A check started against older speech cannot inject a stale next focus over
   // a newer answer. Save and check that answer before publishing the next update.
   if((s.lastUserSeq||0)!==startedUserSeq||checkDelay(s)>0){scheduleCheck(s);return;}
   await applyPhase();
   if(session!==s||s.closing)return;
   if((s.lastUserSeq||0)!==startedUserSeq||checkDelay(s)>0){scheduleCheck(s);return;}
   const pending=[...s.pendingDelegations];s.pendingDelegations.clear();
   const firstDelegation=pending.shift()||null,published=publishStudy(s,firstDelegation);
   if(!published&&firstDelegation)inject(s,'Application state received. The saved phase is unchanged. Continue the current conversation; this is not a new learner turn.',firstDelegation);
   for(const id of pending)inject(s,'Application state received. Use the latest saved phase; this is not a new learner turn.',id);
   if(study.checkError)message('Conversation saved. The understanding check could not finish; Live can keep teaching.');
   else if(study.phaseVersion!==startedPhase)announceTransition(s);
   else if(!saveError)message(paused?'Paused':'Listening');
   paint();
  }catch{if(scope===expected&&session===s&&!s.closing)message('Live can keep teaching. The background understanding check is unavailable; no new progress was recorded.');}
  finally{clearTimeout(s.slowTimer);s.checking=false;}
 }
 // One entry cue, not a learner turn. Acknowledgment is not playback proof.
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
  if(e.type==='session.started'){if(state.closing){send(state,{type:'session.close'});return;}if(state.ready)return;state.ready=true;state.publishedPhase=study.phaseVersion;state.publishedStudy=JSON.stringify({version:study.phaseVersion,instructions:study.instructions,packet:study.packet});clearTimeout(state.startup);message('Listening');requestOpening(state);state.checkTimer=setInterval(()=>{if(session===state&&!state.closing)void check();},25000);paint();}
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
   host.releaseMedia();captureAudioType();message('Waiting for microphone permission…');
   const mic=await acquireMic(s);if(session!==s||s.closing){mic.getTracks().forEach(t=>t.stop());return;}s.mic=mic;
   message('Connecting voice…');s.startup=setTimeout(()=>{if(session!==s||s.closing)return;startError=true;void stop('Voice could not connect. Try again.');},45000);
   if(s.model==='gemini-3.8-live'){
    mic.getAudioTracks().forEach(t=>t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');}));
    if(!await flush())throw Error('Transcript save is pending.');if(session!==s||s.closing||document.hidden)return;
    s.dispatched=true;startVoiceCost(s);
    const result=await s.request({action:'create',mode:'study',model:s.model,requestId:s.id,studyId:s.studyId,consent:'paid-gemini-3.8-live-whole-lesson'});
    if(session!==s||s.closing){void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}
    await window.WorldviewGeminiLive.connect({transport:result.transport,mic,initiate:s.initiate,isCurrent:()=>session===s&&!s.closing,onTransport:value=>{s.gemini=value;},onEvent:e=>event(s,e),onUsage:metadata=>recordVoiceCost(s,{metadata,usageId:s.usageTurn||0}),onStatus:text=>{if(session===s){message(text);if(text==='Tap Enable audio.')ui.enableAudio.hidden=false;}}});
    return;
   }
   const peer=s.peer=new RTCPeerConnection();mic.getAudioTracks().forEach(t=>{peer.addTrack(t,mic);t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');});});
   peer.addEventListener('track',e=>{if(session!==s||s.closing)return;ui.audio.srcObject=new MediaStream([e.track]);void ui.audio.play().catch(()=>{if(session===s&&!s.closing){ui.enableAudio.hidden=false;message('Tap Enable audio.');}});});
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
  const s=session;if(!s||s.closing)return;stopVoiceCost(s);s.closing=true;clearInterval(s.checkTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);s.mic?.getTracks().forEach(t=>t.stop());
  // Keep the channel briefly for final usage, but release audible playback now.
  // Otherwise a paused/replaced session can keep talking for the 8-second grace.
  ui.audio.pause?.();ui.audio.srcObject=null;ui.enableAudio.hidden=true;stash();void flush();message(reason);
  if(s.model==='gemini-3.8-live'){
   closeGeminiReceipt(s);s.gemini?.close();cleanup(s);message(reason);return;
  }
  if(s.ready)send(s,{type:'session.close'});
  if(s.dispatched)void s.request({action:'close',requestId:s.id}).catch(()=>{if(session===s)message('Server close was not confirmed. Ending the voice connection.');});
  if(!s.dispatched){cleanup(s);message(reason);return;}
  s.closeTimer=setTimeout(()=>{if(session===s){cleanup(s);message(reason);maybeStart();}},8000);paint();
 }
 function cleanup(s){stopVoiceCost(s);clearTimeout(s.disconnectTimer);clearTimeout(s.quietTimer);clearTimeout(s.slowTimer);clearTimeout(restoreTimer);s.closing=true;clearTimeout(s.startup);clearTimeout(s.closeTimer);clearInterval(s.checkTimer);s.mic?.getTracks().forEach(t=>t.stop());s.gemini?.dispose();s.channel?.close();s.peer?.close();if(session===s){session=null;captureAudioType('auto');ui.audio.pause?.();ui.audio.srcObject=null;ui.audio.hidden=true;ui.enableAudio.hidden=true;paint();}}
 function transcriptTurns(expectedLineage,currentHistory){
  if(!expectedLineage||scope!==expectedLineage||context?.lineage!==expectedLineage||!(study||exportStudyId))return null;
  if(!enabled&&Array.isArray(currentHistory))rememberTextHistory(currentHistory,true);
  const turns=prefix.map(t=>({...t}));
  let previousNative=false;
  const insert=seq=>{for(const group of textInsertions.filter(s=>s.afterSeq===seq)){turns.push(...group.turns.map(t=>({...t})));previousNative=false;}};
  insert(0);
  // Imports are complete turns; only adjacent native deltas share a turn.
  // Text typed between voice sessions stays at that exact fragment boundary.
  for(const f of fragments){const native=!f.id.startsWith('import:'),last=turns.at(-1);if(native&&previousNative&&last?.role===f.role)last.content+=f.delta;else turns.push({role:f.role,content:f.delta});previousNative=native;insert(f.seq);}
  return turns;
 }
 const api={mount,sync,stop,place,transcriptTurns,ownsAudio:()=>!!session,active:()=>!!session,enabled:()=>enabled};return api;
})();
