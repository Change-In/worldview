/* GPT Live transports voice; the existing lesson engine alone submits answers and grants progress. */
window.WorldviewLiveLesson = (() => {
 'use strict';
 let host=null,ui=null,active=null,enabled=false,current=null,review=null,lastReply='';
 const seen=new Set();
 const node=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 function mount(adapter){
  host=adapter;
  const root=node('section');root.className='live-lesson';root.hidden=true;root.setAttribute('aria-label','GPT Live lesson voice');
  const note=node('p','GPT Live · $0.05/min + lesson models. Each start runs up to 90 seconds (about $0.075).');
  const actions=node('div');actions.className='live-lesson-actions';
  const start=node('button','Start paid GPT Live'),end=node('button','End Live'),reviewButton=node('button','Review answer');
  for(const b of [start,end,reviewButton])b.type='button';actions.append(start,reviewButton,end);
  const status=node('p','No paid session started.');status.setAttribute('role','status');
  const usage=node('small');const audio=node('audio');audio.autoplay=true;audio.controls=true;audio.hidden=true;
  const form=node('form');form.hidden=true;
  const label=node('label','Check your answer before sending.');label.htmlFor='live-lesson-answer';
  const text=node('textarea');text.id='live-lesson-answer';text.rows=3;text.maxLength=16000;
  const send=node('button','Send answer'),cancel=node('button','Keep speaking');send.type='submit';cancel.type='button';form.append(label,text,send,cancel);
  root.append(note,actions,status,usage,audio,form);adapter.container.append(root);
  ui={root,start,end,reviewButton,status,usage,audio,form,text,send,cancel};
  start.onclick=()=>void begin();end.onclick=()=>void stop('Live ended. Your lesson is saved.');
  reviewButton.onclick=()=>beginReview();cancel.onclick=()=>cancelReview();form.onsubmit=e=>{e.preventDefault();void submit();};
  text.oninput=()=>{if(review)review.edited=true;};
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void stop('Live paused when you left the page.');});
  window.addEventListener('pagehide',()=>{void stop('Live ended.');if(active)cleanup(active);});
  return api;
 }
 function message(text){if(ui)ui.status.textContent=text;}
 function paint(){
  if(!ui)return;
  ui.root.hidden=!enabled;
  ui.start.disabled=!!active||!!review||!current?.ready||document.hidden;
  ui.end.disabled=!active;ui.reviewButton.disabled=!active?.ready||active.closing||active.waiting||!!review;
  ui.form.hidden=!review;ui.send.disabled=!!review?.sending||!current?.ready;
  ui.cancel.textContent=active&&!active.closing?'Keep speaking':'Keep draft';
 }
 function sync(context){
  if(active&&(active.lineage!==context.lineage||!context.enabled))void stop('Live stopped because the lesson or mode changed.');
  if(review&&!review.sending&&(current?.lineage!==context.lineage||!context.enabled)){host.retain(ui.text.value,current?.lineage);if(active)active.draftTransferred=true;review=null;}
  current=context;enabled=!!context.enabled;
  if(context.reply&&context.reply!==lastReply&&active?.ready&&!active.closing&&!review){lastReply=context.reply;deliver(context.reply);}
  paint();
 }
 function sendEvent(state,event){if(active===state&&state.channel?.readyState==='open')state.channel.send(JSON.stringify(event));}
 function deliver(text){
  const state=active;if(!state?.ready||state.closing)return;
  // The append contract allows 500 tokens. <= 350 UTF-8 bytes is a conservative bound.
  let chunk='';const encoder=new TextEncoder();
  for(const char of String(text)){
   if(encoder.encode(chunk+char).length>350){sendEvent(state,{type:'session.commentary.append',delegation_id:null,content:chunk});chunk='';}
   chunk+=char;
  }
  if(chunk)sendEvent(state,{type:'session.commentary.append',delegation_id:null,content:chunk});
  state.waiting=false;state.mic?.getAudioTracks().forEach(t=>t.enabled=true);
  message('Listen or interrupt. When your answer is ready, tap Review answer.');paint();
 }
 function history(items){let remaining=8000;return items.slice(-12).reverse().map(t=>{const content=String(t.content||'').slice(-Math.min(2000,remaining));remaining-=content.length;return {role:t.role,content};}).filter(t=>t.content&&['user','assistant'].includes(t.role)).reverse();}
 async function begin(){
  if(!enabled||active||review||!current?.ready||document.hidden)return;
  const state={id:crypto.randomUUID(),request:host.requestForCurrentAccount(),lineage:current.lineage,context:{...current},ready:false,closing:false,dispatched:false,fragments:[],seconds:0,final:false,delegations:new Set()};
  active=state;ui.audio.muted=false;lastReply=current.reply||'';seen.clear();message('Checking GPT Live access…');paint();
  try{
   const ready=await state.request({action:'check'});
   if(!ready.lessonMode)throw Error('In-lesson GPT Live is not ready on the server yet.');
   if(active!==state||state.closing)return;
   if(!navigator.mediaDevices?.getUserMedia||!window.RTCPeerConnection)throw Error('GPT Live needs a browser with microphone and WebRTC support.');
   state.startup=setTimeout(()=>void stop('GPT Live startup timed out. No automatic retry.'),45000);
   host.releaseMedia();
   const stream=await navigator.mediaDevices.getUserMedia({audio:true});
   if(active!==state||state.closing){stream.getTracks().forEach(t=>t.stop());return;}
   state.mic=stream;const peer=state.peer=new RTCPeerConnection();
   for(const track of stream.getAudioTracks()){peer.addTrack(track,stream);track.addEventListener('ended',()=>{if(active===state&&!state.closing)void stop('Microphone disconnected.');});}
   peer.addEventListener('track',e=>{if(active!==state||state.closing)return;ui.audio.srcObject=new MediaStream([e.track]);ui.audio.hidden=false;void ui.audio.play().catch(()=>message('Tap Play below to hear GPT Live.'));});
   peer.addEventListener('connectionstatechange',()=>{if(active===state&&['failed','closed'].includes(peer.connectionState)&&!state.closing)void stop('GPT Live connection lost. No automatic restart.');});
   const channel=state.channel=peer.createDataChannel('oai-events');
   channel.addEventListener('message',e=>{try{onEvent(state,JSON.parse(e.data));}catch{void stop('GPT Live returned an unreadable event.');}});
   channel.addEventListener('close',()=>{if(active===state&&!state.closing)void stop('GPT Live connection closed.');});
   await peer.setLocalDescription(await peer.createOffer());
   if(peer.iceGatheringState!=='complete')await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>{peer.removeEventListener('icegatheringstatechange',check);reject(Error('Voice connection setup timed out.'));},10000);
    function check(){if(peer.iceGatheringState==='complete'){clearTimeout(timer);peer.removeEventListener('icegatheringstatechange',check);resolve();}}
    peer.addEventListener('icegatheringstatechange',check);check();
   });
   if(active!==state||state.closing)return;
   state.dispatched=true;state.limit=setTimeout(()=>void stop('The 90-second Live session ended. You can start another in this lesson.'),90000);
   const result=await state.request({action:'create',mode:'lesson',requestId:state.id,consent:'paid-90-second-gpt-live-1-lesson',runId:state.context.runId,stage:state.context.stage,topic:String(state.context.topic||'Current lesson').slice(0,500),history:history(state.context.history),sdp:peer.localDescription.sdp});
   if(active!==state||state.closing){void state.request({action:'close',requestId:state.id}).catch(()=>{});return;}
   await peer.setRemoteDescription({type:'answer',sdp:result.transport.sdp});
  }catch(error){if(active===state){message(error.message||'GPT Live failed to start.');await stop(error.message||'GPT Live failed to start.');}}
 }
 function onEvent(state,event){
  if(active!==state)return;
  if(event.event_id){if(seen.has(event.event_id))return;seen.add(event.event_id);}
  if(event.type==='session.started'){
   clearTimeout(state.startup);state.ready=true;
   if(state.closing)sendEvent(state,{type:'session.close'});
   else message('Live is listening. Speak naturally, then tap Review answer.');paint();
  }else if(event.type==='session.input_transcript.delta'){
   if(state.draftTransferred||typeof event.delta!=='string'||!event.delta)return;
   // Never submit transcript fragments or inferred silence as a learner answer.
   state.fragments.push({delta:event.delta,start:event.start_ms,end:event.end_ms});
   if(state.fragments.reduce((n,f)=>n+f.delta.length,0)>16000){void stop('The answer is long. Review and send it before continuing.');return;}
   if(review&&!review.sending){if(!review.edited){ui.text.value=fragmentText(state);review.text=ui.text.value;}else message('More speech arrived after editing. Check your answer before sending.');}
  }else if(event.type==='session.delegation.created'){
   const id=event.delegation?.id;if(typeof id!=='string'||state.delegations.has(id)||state.closing)return;state.delegations.add(id);
   sendEvent(state,{type:'session.commentary.append',delegation_id:id,content:'The application has not submitted an answer or changed progress. Ask the learner to tap Review answer, check the transcript, and tap Send answer. Wait for the application result before teaching or assessing.'});
  }else if(event.type==='session.usage.updated'||event.type==='session.closed'){
   const seconds=event.usage?.seconds;if(typeof seconds==='number'&&Number.isFinite(seconds)&&seconds>=0){state.seconds=Math.max(state.seconds,seconds);state.final=event.type==='session.closed';}
   ui.usage.textContent=(state.seconds/60).toFixed(1)+' min · $'+(state.seconds/60*.05).toFixed(3)+(state.final?' voice, final duration':' voice, latest provider estimate');
   if(event.type==='session.closed'){message(state.endMessage||'Live ended. Review any unsent answer or start again.');cleanup(state);}
  }else if(event.type==='error')void stop('GPT Live reported an error. Your normal lesson remains available.');
 }
 const fragmentText=state=>state.fragments.map(f=>f.delta).join('');
 function beginReview(){
  if(!active?.ready||active.closing||review)return;
  active.mic?.getAudioTracks().forEach(t=>t.enabled=false);
  ui.audio.muted=true;
  review={text:fragmentText(active),edited:false,sending:false,lineage:active.lineage};ui.text.value=review.text;
  message('Microphone paused. Check the transcript; fragments can arrive late. Nothing has been sent yet.');paint();ui.text.focus();
 }
 function cancelReview(){
  if(!review||review.sending)return;
  if(!active||active.closing){host.retain(ui.text.value,review.lineage);if(active)active.draftTransferred=true;review=null;message('Answer kept in the lesson text box.');paint();return;}
  review=null;ui.audio.muted=false;active.mic?.getAudioTracks().forEach(t=>t.enabled=true);message('Live is listening again.');paint();
 }
 async function submit(){
  if(!review||review.sending||!current?.ready||review.lineage!==current.lineage)return;
  const text=ui.text.value.trim();if(!text){message('There is no answer to send yet.');return;}
  const pending=review;pending.sending=true;pending.text=text;paint();
  // Snapshot is explicit learner acceptance. Later audio remains separate and unsent.
  const state=active,count=state?.fragments.length||0;
  let accepted=false;
  try{accepted=await host.submit(text);}catch{message('The answer could not be sent. Your text is retained.');}
  if(review!==pending)return;
  if(accepted){if(state)state.fragments.splice(0,count);review=null;ui.audio.muted=false;if(state)state.waiting=true;message('Answer sent. Waiting for the lesson response…');if(current?.reply&&current.reply!==lastReply&&state?.ready&&!state.closing){lastReply=current.reply;deliver(current.reply);}}
  else{pending.sending=false;message('Answer retained. Resolve the lesson message, then send again.');}
  paint();
 }
 async function stop(reason='Live ended.'){
  const state=active;if(!state||state.closing)return;
  state.closing=true;state.endMessage=reason;state.mic?.getTracks().forEach(t=>t.stop());
  if(!review&&!state.draftTransferred&&fragmentText(state)){review={text:fragmentText(state),edited:false,sending:false,lineage:state.lineage};ui.text.value=review.text;}
  message(reason+' Collecting final usage…');paint();
  if(state.ready)sendEvent(state,{type:'session.close'});
  if(state.dispatched)void state.request({action:'close',requestId:state.id}).catch(()=>{if(active===state)message('Server close is unconfirmed. The session deadline is also active.');});
  if(!state.dispatched){cleanup(state);message(reason);return;}
  state.closeTimer=setTimeout(()=>{if(active===state){message(reason+' Final usage is unconfirmed.');cleanup(state);}},15000);
 }
 function cleanup(state){
  state.closing=true;
  if(!review&&!state.draftTransferred&&fragmentText(state)){
   if(enabled&&current?.lineage===state.lineage){review={text:fragmentText(state),edited:false,sending:false,lineage:state.lineage};ui.text.value=review.text;}
   else host.retain(fragmentText(state),state.lineage);
  }
  clearTimeout(state.limit);clearTimeout(state.startup);clearTimeout(state.closeTimer);
  state.mic?.getTracks().forEach(t=>t.stop());state.channel?.close();state.peer?.close();
  if(active===state){active=null;ui.audio.srcObject=null;ui.audio.hidden=true;paint();}
 }
 const api={mount,sync,stop,enabled:()=>enabled,active:()=>!!active,deliver};return api;
})();
