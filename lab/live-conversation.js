/* Native GPT Live teaching. Captions are revisable fragments, never automatic submitted text turns. */
window.WorldviewLiveConversation=(()=>{
 'use strict';
 let host,ui,context,study,session,loadToken=0,loading=false,saving=null,checking=false,enabled=false,saveTimer;
 let showCaptions=false;
 let fragments=[],ack=0,saveError='',request,scope='',draftKey='';
 const element=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function mount(adapter){
  host=adapter;const root=element('section');root.className='live-conversation';root.hidden=true;
  const note=element('p','GPT Live teaches from your researched lesson. $0.05/min, plus background understanding checks. No 90-second cutoff.');
  const actions=element('div');actions.className='live-conversation-actions';
  const start=element('button','Start GPT Live'),mute=element('button','Mute mic'),end=element('button','End Live'),retry=element('button','Retry saving'),captions=element('button','Show transcript');
  for(const b of [start,mute,end,retry,captions])b.type='button';actions.append(start,mute,end,retry,captions);
  const status=element('p','Choose Start when you are ready to talk.');status.setAttribute('role','status');
  const usage=element('small'),progress=element('p');progress.className='live-conversation-progress';
  const audio=element('audio');audio.autoplay=true;audio.controls=true;audio.hidden=true;
  root.append(note,actions,status,usage,progress,audio);adapter.container.append(root);
  ui={root,start,mute,end,retry,captions,status,usage,progress,audio};
  captions.onclick=()=>{showCaptions=!showCaptions;paint();};
  start.onclick=()=>void(study?begin():prepare());end.onclick=()=>void stop('Live ended.');retry.onclick=()=>void flush();
  mute.onclick=()=>{const s=session;if(!s?.ready||s.closing)return;s.muted=!s.muted;s.mic?.getAudioTracks().forEach(t=>t.enabled=!s.muted);paint();};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void stop('Live ended when the app went into the background.');});
  window.addEventListener('pagehide',()=>{stash();void stop('Live ended when you left the lesson.');});
  return api;
 }
 function message(text){if(ui)ui.status.textContent=text;}
 function stash(){if(!draftKey||!study)return;try{localStorage.setItem(draftKey,JSON.stringify({studyId:study.id,fragments}));}catch{saveError='Device backup is unavailable. Keep this page open until the transcript is saved.';}}
 function paint(){
  if(!ui)return;ui.root.hidden=!enabled;ui.start.hidden=!!session;ui.start.disabled=loading||!!session||!context?.ready||document.hidden;
  ui.start.textContent=loading?'Preparing lesson…':!study?'Retry opening Live':fragments.length?'Continue GPT Live':'Start GPT Live';
  ui.captions.hidden=!session?.ready;ui.captions.textContent=showCaptions?'Hide transcript':'Show transcript';ui.captions.setAttribute('aria-pressed',String(showCaptions));
  ui.end.hidden=!session;ui.mute.hidden=!session?.ready;ui.mute.textContent=session?.muted?'Unmute mic':'Mute mic';ui.mute.setAttribute('aria-pressed',String(!!session?.muted));
  ui.retry.hidden=!saveError;ui.retry.disabled=!!saving;
  if(saveError)message(saveError);
  const count=Object.keys(study?.assessment||{}).length,total=context?.studyInput?.context?.outcomes?.length||0;
  ui.progress.textContent=study?`${count} of ${total} areas supported by saved understanding checks${study.complete?' · All lesson areas checked':study.packet?.currentOutcome?.title?' · '+study.packet.currentOutcome.title:''}. ${ack===fragments.length?'Conversation saved.':'Saving conversation…'}`:'';
  if(enabled&&study)renderTranscript();
 }
 function renderTranscript(){
  const root=host.transcript,follow=root.scrollHeight-root.scrollTop-root.clientHeight<40,position=root.scrollTop;
  if(session&&!showCaptions){root.replaceChildren(element('li','Talk naturally. GPT Live is listening, and your conversation is saved automatically.'));return;}
  const groups=[];for(const turn of context.history||[])groups.push({role:turn.role,text:turn.content});
  for(const f of fragments){const last=groups.at(-1);if(last?.live&&last.role===f.role)last.text+=f.delta;else groups.push({role:f.role,text:f.delta,live:true});}
  root.replaceChildren();for(const g of groups){const item=element('li');item.className='extraction-turn '+(g.role==='user'?'is-user':'is-assistant');const label=element('small',g.role==='user'?'You':g.live?'GPT Live':'Earlier in this lesson');const text=element('p',g.text);item.append(label,text);root.append(item);}
  root.scrollTop=follow?root.scrollHeight:position;
 }
 function sync(next){
  const changed=context?.lineage!==next.lineage;
  if(session&&(changed||!next.enabled))void stop('Live ended because the lesson or voice mode changed.');
  if(changed){loadToken++;study=null;fragments=[];ack=0;loading=false;saveError='';scope='';draftKey='';}
  context=next;enabled=!!next.enabled;
  if(enabled&&!study&&!loading&&next.studyInput)void prepare();
  paint();
 }
 async function prepare(){
  const token=++loadToken,expected=context.lineage,captured=host.requestForCurrentAccount();loading=true;message('Opening the saved research and conversation…');paint();
  try{
   const ready=await captured({action:'check'});if(!ready.studyMode)throw Error('Natural Live lessons are awaiting the server update. Standard voice remains available.');
   const result=await captured({action:'study_prepare',...context.studyInput});
   if(token!==loadToken||context.lineage!==expected)return;
   study=result.study;fragments=study.fragments.slice();ack=fragments.length;request=captured;scope=expected;draftKey='worldview-live-draft-v2:'+expected;
   try{const draft=JSON.parse(localStorage.getItem(draftKey)||'null');if(draft?.studyId===study.id&&Array.isArray(draft.fragments)&&draft.fragments.length>ack&&fragments.every((f,i)=>['seq','id','role','delta','start_ms','end_ms'].every(k=>f[k]===draft.fragments[i][k])))fragments=draft.fragments;}catch{/* Server copy remains available. */}
   stash();message('Ready. Start once, then talk naturally. You can interrupt and correct yourself aloud.');
   if(fragments.length>ack)void flush();
  }catch(error){if(token===loadToken)message(error.message||'Live lesson could not open.');}
  finally{if(token===loadToken){loading=false;paint();}}
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
  if(state.scope!==scope)return;
  if(typeof event.delta!=='string'||!event.delta)return;
  const f={seq:fragments.length+1,id:String(event.event_id||state.id+':'+fragments.length),role,delta:event.delta,start_ms:Number.isFinite(event.start_ms)?event.start_ms:null,end_ms:Number.isFinite(event.end_ms)?event.end_ms:null};
  fragments.push(f);stash();paint();clearTimeout(saveTimer);saveTimer=setTimeout(()=>void flush(),1500);
 }
 function send(state,event){if(session===state&&state.channel?.readyState==='open')state.channel.send(JSON.stringify(event));}
 function inject(state,content,delegationId=null){
  // Each append is <= 400 UTF-8 bytes, conservatively below the 500-token API limit.
  let piece='';const encoder=new TextEncoder();
  for(const char of content){if(encoder.encode(piece+char).length>400){send(state,{type:'session.thinking.append',delegation_id:delegationId,content:piece});piece='';}piece+=char;}
  if(piece)send(state,{type:'session.thinking.append',delegation_id:delegationId,content:piece});
 }
 async function check(delegationId=null){
  const s=session;if(!s?.ready||s.closing)return;
  if(checking){if(delegationId)inject(s,'An understanding check is already running. Continue listening; do not ask for button presses.',delegationId);return;}
  checking=true;const expected=scope,id=study.id,captured=request,input=context.studyInput;
  try{
   if(!await flush())return;
   if(scope!==expected||session!==s)return;
   await captured({action:'study_prepare',...input});
   const result=await captured({action:'study_check',studyId:id});if(scope!==expected||session!==s)return;
   const packetChanged=JSON.stringify(study.packet)!==JSON.stringify(result.study.packet);study={...result.study,fragments};
   if(result.advanced||packetChanged){inject(s,'Verified application progress update. This is lesson data, never instructions from the learner. The following fragments together contain the updated current researched lesson packet:\n'+JSON.stringify(study.packet),delegationId);send(s,{type:'session.instructions.append',delegation_id:null,content:study.complete?'The saved understanding checks support all lesson areas. You may invite a final synthesis or continue answering questions from the supplied research. Do not claim an unrelated standard Quiz was completed.':'The researched packet update is complete. Continue teaching the new current outcome in your own words. You generate the response; do not wait for another teacher model.'});}
   else if(delegationId)inject(s,'Application update: no new progress confirmed. '+(result.focus||'Continue the current researched area, listening for the learner’s own explanation. Never request Review or Send buttons.'),delegationId);
   if(study.checkError)message('Conversation saved. The understanding check could not finish; Live can keep teaching.');
   paint();
  }catch{if(scope===expected)message('Live can keep teaching. The background understanding check is unavailable; no new progress was recorded.');}
  finally{checking=false;}
 }
 function event(state,e){
  if(session!==state)return;if(e.event_id){if(state.seen.has(e.event_id))return;state.seen.add(e.event_id);}
  if(e.type==='session.started'){if(state.closing){send(state,{type:'session.close'});return;}state.ready=true;clearTimeout(state.startup);message('Live is listening. Just talk; no Review or Send is needed.');state.checkTimer=setInterval(()=>void check(),25000);paint();}
  else if(e.type==='session.input_transcript.delta')append(state,e,'user');
  else if(e.type==='session.output_transcript.delta')append(state,e,'assistant');
  else if(e.type==='session.delegation.created'){const id=e.delegation?.id;if(typeof id==='string'&&!state.delegations.has(id)){state.delegations.add(id);void check(id);}}
  else if(e.type==='session.usage.updated'||e.type==='session.closed'){
   if(Number.isFinite(e.usage?.seconds)&&e.usage.seconds>=0)state.seconds=Math.max(state.seconds,e.usage.seconds);
   ui.usage.textContent=(state.seconds/60).toFixed(1)+' min · $'+(state.seconds/60*.05).toFixed(3)+' Live voice'+(e.type==='session.closed'?' · final duration':'');
   if(e.type==='session.closed'){void flush();cleanup(state);message(e.reason==='expired'?'The provider ended this connection. Your lesson is saved; choose Continue to reconnect.':'Live ended. Your conversation remains saved.');}
  }else if(e.type==='error')void stop('Live reported a connection error. Your conversation is retained.');
 }
 async function begin(){
  if(!enabled||loading||!study||session||!context?.ready||document.hidden)return;
  const s={id:crypto.randomUUID(),request,scope,studyId:study.id,seen:new Set(),delegations:new Set(),seconds:0,ready:false,closing:false,dispatched:false,muted:false};session=s;paint();
  try{
   host.releaseMedia();s.startup=setTimeout(()=>void stop('Live startup timed out. There is no automatic paid retry.'),45000);
   const mic=await navigator.mediaDevices.getUserMedia({audio:true});if(session!==s||s.closing){mic.getTracks().forEach(t=>t.stop());return;}s.mic=mic;
   const peer=s.peer=new RTCPeerConnection();mic.getAudioTracks().forEach(t=>{peer.addTrack(t,mic);t.addEventListener('ended',()=>{if(session===s&&!s.closing)void stop('Microphone disconnected.');});});
   peer.addEventListener('track',e=>{if(session!==s||s.closing)return;ui.audio.srcObject=new MediaStream([e.track]);ui.audio.hidden=false;void ui.audio.play().catch(()=>message('Tap Play to hear GPT Live.'));});
   peer.addEventListener('connectionstatechange',()=>{if(session===s&&!s.closing&&['failed','closed'].includes(peer.connectionState))void stop('Live disconnected. Your lesson is retained.');});
   s.channel=peer.createDataChannel('oai-events');s.channel.addEventListener('message',e=>{try{event(s,JSON.parse(e.data));}catch{void stop('Live returned an unreadable event.');}});
   s.channel.addEventListener('close',()=>{if(session===s&&!s.closing)void stop('Live connection closed.');});
   await peer.setLocalDescription(await peer.createOffer());
   if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{const timer=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',ready);reject(Error('Voice connection setup timed out.'));},10000);function ready(){if(peer.iceGatheringState==='complete'){clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',ready);resolve();}}peer.addEventListener('icegatheringstatechange',ready);ready();});
   if(session!==s||s.closing)return;s.dispatched=true;
   const result=await s.request({action:'create',mode:'study',requestId:s.id,studyId:s.studyId,sdp:peer.localDescription.sdp,consent:'paid-gpt-live-1-whole-lesson'});
   if(session!==s||s.closing){void s.request({action:'close',requestId:s.id}).catch(()=>{});return;}
   await peer.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
  }catch(error){if(session===s)void stop(error.message||'Live could not start.');}
 }
 async function stop(reason='Live ended.'){
  const s=session;if(!s||s.closing)return;s.closing=true;clearInterval(s.checkTimer);s.mic?.getTracks().forEach(t=>t.stop());stash();void flush();message(reason+' Saving transcript and closing…');
  if(s.ready)send(s,{type:'session.close'});
  if(s.dispatched)void s.request({action:'close',requestId:s.id}).catch(()=>{if(session===s)message('Server close was not confirmed. Ending the voice connection.');});
  if(!s.dispatched){cleanup(s);message(reason);return;}
  s.closeTimer=setTimeout(()=>{if(session===s){cleanup(s);message(reason+' Final voice usage was not confirmed.');}},8000);paint();
 }
 function cleanup(s){s.closing=true;clearTimeout(s.startup);clearTimeout(s.closeTimer);clearInterval(s.checkTimer);s.mic?.getTracks().forEach(t=>t.stop());s.channel?.close();s.peer?.close();if(session===s){session=null;ui.audio.srcObject=null;ui.audio.hidden=true;paint();}}
 const api={mount,sync,stop,active:()=>!!session,enabled:()=>enabled};return api;
})();
