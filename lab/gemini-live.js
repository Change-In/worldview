/* Native Gemini Live transport. Credentials and audio are held in memory only. */
window.WorldviewGeminiLive=(()=>{
 'use strict';
 const model='gemini-3.8-live';
 const endpoint='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
 function encodePcm(buffer){let bytes='';for(const value of new Uint8Array(buffer))bytes+=String.fromCharCode(value);return btoa(bytes);}
 function decodePcm(data){const raw=atob(data),view=new DataView(new ArrayBuffer(raw.length));for(let i=0;i<raw.length;i++)view.setUint8(i,raw.charCodeAt(i));const samples=new Float32Array(Math.floor(raw.length/2));for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;return samples;}
 async function connect({transport,mic,outputAudio,initiate=true,openingText='',onInputLevel=null,reacquireMic=null,onMicReplaced=null,onEvent,onUsage,onStatus,onTransport,isCurrent}){
  if(transport?.type!=='gemini-websocket'||transport.setup?.model!==`models/${model}`||!transport.token?.startsWith('auth_tokens/'))throw Error('Gemini authorization was invalid.');
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio||!window.AudioWorkletNode)throw Error('Gemini Live needs a browser with AudioWorklet support.');
  const audio=new Audio({latencyHint:'interactive'}),sources=new Set();
  window.WorldviewLessonCues?.useContext?.(audio);
  /* A phone alert (low battery, a call, Siri) interrupts the page's audio and
     can leave the context suspended after the alert is gone, so the tutor is
     heard no more although the connection is fine. Ask for it back while the
     page is visible; a browser that insists on a tap gets the existing prompt. */
  let revive=null;
  audio.addEventListener?.('statechange',()=>{
   if(audio.state==='running'&&stalled&&!closed){stalled=false;onEvent({type:'gemini.audio.playing'});}
   if(closed||audio.state==='running'||audio.state==='closed'){clearInterval(revive);revive=null;return;}
   if(revive)return;let tries=0;
   revive=setInterval(()=>{if(closed||audio.state==='running'||++tries>40){clearInterval(revive);revive=null;return;}if(!document.hidden)void audio.resume().catch(()=>{});},500);
  });
  let socket,ready=false,closed=false,started=false,muted=false,holding=false,held=[],modelActive=false,processor,input,silent,playAt=0,resumeHandle='',resumeAttempts=0,closingReason='connection_lost',expiryTimer,openTimer;
  let received=Promise.resolve(),pendingContext='',connectResolve,connectReject,output,mix,hardGain,elementGain;
  /* BUG-488: a note sent while the learner is talking, or just as they begin an
     answer, can swallow their words. Notes wait for a quiet moment: nothing
     heard for 1.5 s (captions) and no voice on the microphone for 0.8 s; right
     after the tutor finishes, the learner gets 2.5 s to start answering; and an
     answer the tutor has not replied to yet waits up to 4 s for that reply.
     VOI-156 (changed by VOI-160): when the microphone clearly hears speech but the
     server sends nothing for 6 s, the screen says so and the input watchdog repairs
     the connection; the tutor is no longer made to talk over a thinking learner. */
  let pendingSince=0,heardAt=0,tutorDoneAt=0,flushTimer=null,burstStart=0,burstVoiced=0,unheardAt=0,interruptedAt=0,playedAt=0,stalled=false,stallTimer=null,setupAt=0;
  /* VOI-160 / BUG-510. Voice is judged from the microphone level against the room
     (voice-activity.js), never from captions: the provider captions a long answer
     only when the turn ends. The input watchdog below notices when audio stops
     reaching the tutor, repairs it step by step, and says so. */
  const Voice=window.WorldviewVoiceActivity;
  if(!Voice)throw Error('Voice activity module did not load.');
  const det=Voice.createDetector();
  let serverAt=0,frameAt=Date.now(),nonZeroAt=Date.now(),bufferedSince=0,ring=[],replayFrom=0,watchTimer=null,troubled=false,lastActionAt=0,recoveries=[],tickFault='',tickCount=0,micTrack=null;
  const VOICE_QUIET_PROMPT_MS=2500,VOICE_QUIET_NOTE_MS=2000,HELD_CHUNKS=30,RING_CHUNKS=80,REPLAY_MS=8000;
  const connected=new Promise((resolve,reject)=>{connectResolve=resolve;connectReject=reject;});
  // Cancellation can precede the asynchronous worklet load and its later await.
  // Observe this promise immediately; awaiting the original still propagates errors.
  void connected.catch(()=>{});
  const active=()=>!closed&&isCurrent();
  const send=payload=>{if(active()&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));};
  const ownsOutput=()=>!!output&&outputAudio?.srcObject===output.stream;
  function playbackFailure(error){if(active()&&(!outputAudio||ownsOutput()))onStatus(error?.name==='NotAllowedError'?'Tap to hear the tutor.':'Audio playback failed. Tap to hear the tutor.');}
  const outputError=()=>playbackFailure(outputAudio?.error);
  function resumeAudio(){
   if(!active()||outputAudio&&!ownsOutput())return Promise.reject(Error('This voice output is no longer active.'));
   // Start both operations on the original tap: awaiting resume first would
   // lose the media element's user activation in browsers that require it.
   const start=operation=>{try{return Promise.resolve(operation());}catch(error){return Promise.reject(error);}};
   const tasks=[start(()=>audio.resume())];if(outputAudio)tasks.push(start(()=>outputAudio.play()));
   return Promise.all(tasks).then(()=>{if(!active()||outputAudio&&!ownsOutput())throw Error('This voice output is no longer active.');if(stalled){stalled=false;onEvent({type:'gemini.audio.playing'});}});
  }
  /* VOI-159 safety net. The tutor's words can arrive while the phone plays
     nothing, because it would not start audio without a tap. After 2.5 s of
     queued speech that is not playing, the learner is asked for one tap. */
  function watchSound(){
   if(stallTimer||stalled||closed)return;
   const from=audio.currentTime;
   stallTimer=setTimeout(()=>{
    stallTimer=null;if(closed||!sources.size)return;
    const silent=audio.state!=='running'||audio.currentTime-from<.5||(!!hardGain&&hardGain.gain.value===0&&!!outputAudio?.paused);
    if(silent){stalled=true;onEvent({type:'gemini.audio.stalled'});}
   },2500);
  }
  function clearAudio(){for(const source of sources){try{source.stop();}catch{}}sources.clear();playAt=audio.currentTime;}
  function finish(reason){
   if(closed)return;closed=true;clearInterval(revive);clearInterval(watchTimer);ready=false;clearTimeout(expiryTimer);clearTimeout(openTimer);clearTimeout(flushTimer);clearTimeout(stallTimer);clearAudio();
   processor?.disconnect();input?.disconnect();silent?.disconnect();if(processor)processor.port.onmessage=null;
   if(outputAudio){outputAudio.removeEventListener?.('error',outputError);if(ownsOutput()){outputAudio.pause();outputAudio.srcObject=null;}}
   output?.stream.getTracks().forEach(track=>track.stop());output?.disconnect();
   mix?.disconnect();hardGain?.disconnect();elementGain?.disconnect();
   window.WorldviewLessonCues?.releaseContext?.(audio);socket?.close();void audio.close().catch(()=>{});
   if(!started)connectReject(Error('Gemini Live did not complete its connection.'));
   onEvent({type:'session.closed',reason});
  }
  function failure(text){onStatus(text);closingReason='provider_error';finish(closingReason);}
  function play(data,mimeType){
   const samples=decodePcm(data),rate=Number(/rate=(\d+)/.exec(mimeType||'')?.[1]||24000);
   if(!samples.length||rate<8000||rate>96000)return;
   const buffer=audio.createBuffer(1,samples.length,rate);buffer.copyToChannel(samples,0);
   const source=audio.createBufferSource();source.buffer=buffer;source.connect(mix||audio.destination);sources.add(source);
   source.onended=()=>{sources.delete(source);if(!sources.size)playedAt=Date.now();flushContext();};playAt=Math.max(audio.currentTime+.02,playAt);source.start(playAt);playAt+=buffer.duration;
   if(audio.state==='suspended'||outputAudio?.paused)onStatus('Tap to hear the tutor.');
   watchSound();
  }
  function context(text){
   if(!pendingContext)pendingSince=Date.now();
   pendingContext=text;flushContext();
  }
  function quietWait(now=Date.now()){
   // A note held for 20 s goes at the next gap in captions even if the room is noisy.
   const local=now-pendingSince>20000?0:Math.max(0,det.lastVoiceAt()+VOICE_QUIET_NOTE_MS-now);
   const answering=heardAt>tutorDoneAt&&!modelActive?Math.max(0,heardAt+4000-now):0;
   const opening=heardAt<=tutorDoneAt?Math.max(0,tutorDoneAt+2500-now):0;
   return Math.max(heardAt+1500-now,local,answering,opening,0);
  }
  function flushContext(){
   // Generic API references warn clientContent can interrupt generation even
   // with turnComplete false. Wait for completion AND local playback drainage.
   if(!pendingContext||!ready||modelActive||sources.size)return;
   const wait=quietWait();
   if(wait>0){clearTimeout(flushTimer);flushTimer=setTimeout(()=>{flushTimer=null;flushContext();},Math.min(wait+50,4000));return;}
   const text=pendingContext;pendingContext='';
   send({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:false}});
  }
  /* Every microphone frame passes through here, even while paused or muted, so the
     room's level is always known. The tutor's own voice can leak into the
     microphone; only the learner's turn counts. A long answer is captioned only when
     it ends, so "no words yet" during speech proves nothing. The learner is judged
     unheard only after 6 s of quiet with nothing at all from the server since the
     speech began, and then the tutor is NOT made to talk (that cut off people who
     were thinking): the watchdog repairs the input and the screen says so. */
  function hearMic(level,now){
   const frame=det.push(level,now,{ignore:sources.size>0||now-playedAt<400});
   if(frame.ignored||frame.noise){burstStart=0;burstVoiced=0;return;}
   if(muted||!ready)return;
   if(det.voiceMs(now)>=200){if(!burstStart)burstStart=now-det.voiceMs(now);if(frame.strong)burstVoiced+=1;return;}
   if(!burstStart||now-det.lastVoiceAt()<Voice.UNHEARD_QUIET_MS)return;
   const unheard=Voice.unheardSpeech({now,burstStart,burstVoiced,lastVoiceAt:det.lastVoiceAt(),serverAt,askedAt:unheardAt});
   burstStart=0;burstVoiced=0;
   if(unheard){unheardAt=now;trouble('server_silent');}
  }
  async function receive(event,source){
   const raw=typeof event.data==='string'?event.data:await event.data.text();
   if(!active()||source!==socket)return;
   const message=JSON.parse(raw);
   if(message.error){failure('The voice connection was refused. Tap play to try again.');return;}
   if(message.usageMetadata)onUsage(message.usageMetadata);
   // Any sign the server is alive and working on what it was sent.
   if(message.serverContent||message.toolCall||message.setupComplete)serverAt=Date.now();
   if(message.setupComplete){
    clearTimeout(openTimer);ready=true;setupAt=Date.now();
    // After a repair that reconnected, the last few seconds are sent again so
    // nothing the learner said while the link was down is lost.
    if(replayFrom){const from=replayFrom;replayFrom=0;if(!muted)for(const chunk of ring)if(chunk.t>=from)send({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:encodePcm(chunk.d)}}});onEvent({type:'gemini.recovered'});}
    if(!started){
     send({clientContent:{turns:transport.history||[],turnComplete:false}});
     started=true;connectResolve();onEvent({type:'session.started'});
     if(audio.state==='suspended'||outputAudio?.paused)onStatus('Tap to hear the tutor.');
     // Give a fresh conversation its opening; resumed lessons continue from the
     // saved current phase/question rather than running Clarification again.
     if(initiate){modelActive=true;send({clientContent:{turns:[{role:'user',parts:[{text:openingText||'APP_START. Begin or resume the saved lesson now. Use the saved phase and conversation. Do not re-ask a question already answered. Speak first now in the selected language. If no subject is chosen, ask what they would like to explore today. Ask at most one relevant next question, then listen.'}]}],turnComplete:true}});}
    }else onStatus('Listening');
    flushContext();
   }
   if(message.sessionResumptionUpdate?.resumable&&message.sessionResumptionUpdate.newHandle)resumeHandle=message.sessionResumptionUpdate.newHandle;
   // LES-302: the tutor calls next_card to move the lesson on. Its turn is still
   // in progress, so nothing else is sent until the application answers.
   if(Array.isArray(message.toolCall?.functionCalls)&&message.toolCall.functionCalls.length){modelActive=true;onEvent({type:'gemini.tool.call',calls:message.toolCall.functionCalls});}
   if(Array.isArray(message.toolCallCancellation?.ids))onEvent({type:'gemini.tool.cancel',ids:message.toolCallCancellation.ids});
   const content=message.serverContent;
   if(content){
    if(content.interrupted){modelActive=false;interruptedAt=Date.now();clearAudio();onEvent({type:'gemini.interrupted'});}
    if(content.modelTurn||content.outputTranscription)modelActive=true;
    // The server answered after a repair: the learner is being heard again.
    if(troubled&&(content.inputTranscription||content.modelTurn||content.turnComplete)){troubled=false;onEvent({type:'gemini.input.ok'});}
    if(content.inputTranscription?.text){heardAt=Date.now();onEvent({type:'session.input_transcript.delta',delta:content.inputTranscription.text});}
    if(content.outputTranscription?.text)onEvent({type:'session.output_transcript.delta',delta:content.outputTranscription.text});
    for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data&&part.inlineData.mimeType?.startsWith('audio/pcm'))play(part.inlineData.data,part.inlineData.mimeType);
    if(content.turnComplete){modelActive=false;tutorDoneAt=Date.now();onEvent({type:'gemini.turn.complete'});flushContext();}
   }
   // Let the current turn finish; reconnect on the provider's socket close using
   // its opaque resumption handle. No repeated startup prompt or history replay.
   if(message.goAway)onStatus('Refreshing the voice connection…');
  }
  function open(resume=false){
   if(!active())return;
   ready=false;modelActive=false;const ws=new WebSocket(endpoint+'?access_token='+encodeURIComponent(transport.token));socket=ws;
   openTimer=setTimeout(()=>failure('Gemini Live connection timed out.'),20000);
   ws.addEventListener('open',()=>{if(!active()||socket!==ws){ws.close();return;}send({setup:{...transport.setup,...(resume?{sessionResumption:{handle:resumeHandle}}:{})}});});
   ws.addEventListener('message',e=>{received=received.then(()=>receive(e,ws)).catch(()=>failure('Gemini Live returned an unreadable event.'));});
   ws.addEventListener('error',()=>{/* close provides the single cleanup path */});
   ws.addEventListener('close',()=>{
    if(closed||socket!==ws)return;ready=false;clearTimeout(openTimer);
    // VOI-159: one connection now lasts the whole lesson, and Google asks for a
    // resume about every 10 minutes. Three failures in a row still end it; a
    // resumed socket that stayed up a minute starts the count again.
    if(setupAt&&Date.now()-setupAt>60000)resumeAttempts=0;
    if(active()&&resumeHandle&&Date.now()<Date.parse(transport.expiresAt)-10000&&resumeAttempts++<3){onStatus('Reconnecting Gemini Live…');open(true);return;}
    finish(closingReason);
   });
  }
  async function applyRoute(loud){
   if(closed||!mix)return'unavailable';
   await audio.resume().catch(()=>{});
   if(closed)return'unavailable';
   if(audio.state!=='running')return'unavailable';
   if(!outputAudio||!hardGain||!elementGain)return'hardware';
   hardGain.gain.value=loud?1:0;elementGain.gain.value=loud?0:1;outputAudio.muted=!!loud;
   return loud?'hardware':'element';
  }
  // Quiet context cannot make the model speak, so an application-owned opening
  // needs a completed turn. Never sent while the model already holds the floor.
  /* BUG-502: on Sept 28 the tutor was cut off mid-sentence and the chapter's
     first question started at once. Gemini stops itself when it thinks it hears
     the learner (often its own voice from the speaker), which cleared the audio,
     and the waiting opener then went straight away. An app prompt now waits for
     1.2 s of quiet after the tutor's audio ends, and after an interruption for
     either the learner's words or 3.5 s. */
  function promptWait(now=Date.now()){
   const afterInterrupt=interruptedAt&&heardAt<interruptedAt?Math.max(0,interruptedAt+3500-now):0;
   // VOI-159: nor while the learner's voice is on the microphone.
   // A learner who pauses to think is still mid-answer: stay quiet 2.5 s after their voice.
   const lastVoice=det.lastVoiceAt();
   return Math.max(afterInterrupt,playedAt?Math.max(0,playedAt+1200-now):0,lastVoice?Math.max(0,lastVoice+VOICE_QUIET_PROMPT_MS-now):0);
  }
  function prompt(text){
   if(!active()||!ready||modelActive||sources.size||promptWait()>0)return false;
   // VOI-159: a phase update still waiting its quiet moment goes first, in the
   // same message, so the opening is spoken from the new phase.
   const turns=[...(pendingContext?[{role:'user',parts:[{text:pendingContext}]}]:[]),{role:'user',parts:[{text:String(text)}]}];
   pendingContext='';clearTimeout(flushTimer);
   modelActive=true;send({clientContent:{turns,turnComplete:true}});return true;
  }
  const alive=()=>!closed&&socket?.readyState===WebSocket.OPEN;
  /* A quiet-minute pause holds the microphone instead of closing: nothing is
     sent (so nothing is billed), the last 1.5 seconds are kept, and resuming
     sends them first so the learner's opening words are heard. An ordinary
     learner mute never keeps audio. */
  function mute(value,{hold=false,flush=false}={}){
   muted=!!value;holding=muted&&hold;
   /* VOI-160: audioStreamEnd closes the learner's turn, so a pause must never send
      it while they may still be speaking; the provider would answer half a thought.
      Without it the provider sees silence and ends the turn by itself. */
   if(muted){if(!hold)held=[];if(ready&&(!hold||det.sinceVoice(Date.now())>=5000))send({realtimeInput:{audioStreamEnd:true}});return;}
   const kept=held;held=[];
   if(flush&&ready)for(const chunk of kept)send({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:encodePcm(chunk)}}});
  }
  // BUS-063: whether a note is still waiting to be sent (a newer one replaces it).
  const hasPending=()=>!!pendingContext;
  // The application's answer to a tool call; the tutor carries on speaking from it.
  const respond=functionResponses=>{if(!active()||!ready)return false;send({toolResponse:{functionResponses}});return true;};
  /* BUG-510. Once a second the input path is checked end to end; see
     voice-activity.js for the faults and the order of repairs. A fault must last two
     checks in a row (a half-second glitch is not one). Each repair is reported to
     the page so it can tell the learner, and the watchdog never gives up quietly:
     the last step ends the connection so the page opens a fresh one. */
  function attachTrackWatch(track){
   micTrack=track;if(!track)return;
   track.addEventListener('ended',()=>{if(micTrack===track&&ready&&!closed)trouble('track_ended');});
   track.addEventListener('mute',()=>{if(micTrack===track)onEvent({type:'gemini.track.muted'});});
  }
  function watchInput(){
   if(closed||!ready||!started||document.hidden||muted){tickFault='';tickCount=0;return;}
   const now=Date.now(),track=micTrack||mic?.getAudioTracks?.()[0];
   const fault=Voice.diagnoseInput({now,ctxState:audio.state,trackLive:!track||track.readyState==='live',trackMuted:!!track?.muted,frameAt,nonZeroAt,bufferedBytes:socket?.bufferedAmount||0,bufferedSince});
   if(!fault){tickFault='';tickCount=0;return;}
   tickCount=fault===tickFault?tickCount+1:1;tickFault=fault;
   if(tickCount>=2)trouble(fault);
  }
  function trouble(fault,{now:force=false}={}){
   if(closed||!ready&&fault!=='track_ended')return;
   const at=Date.now();
   if(!force&&at-lastActionAt<Voice.RECOVERY_GAP_MS)return;
   recoveries=recoveries.filter(r=>at-r.at<Voice.RECOVERY_WINDOW_MS);
   const step=Voice.recoveryStep(fault,recoveries.length);
   recoveries.push({at,fault,step});lastActionAt=at;troubled=true;
   onEvent({type:'gemini.input.trouble',fault,step,attempt:recoveries.length});
   void repair(step);
  }
  async function repair(step){
   try{
    if(step==='hint')return;
    if(audio.state!=='running')await audio.resume().catch(()=>{});
    if(step==='resume_audio')return;
    if(step==='reacquire_mic'){
     if(!reacquireMic){return repair('reconnect');}
     const stream=await reacquireMic();
     if(closed)return void stream?.getTracks().forEach(t=>t.stop());
     swapMic(stream);return;
    }
    if(step==='reconnect'&&resumeHandle&&Date.now()<Date.parse(transport.expiresAt)-10000){
     // The provider resumes the same conversation from its handle; the last seconds
     // of the learner's audio go again once it is back. A dead link can take half a
     // minute to report that it closed, so the new socket is opened at once and the
     // old one is simply let go (its events are ignored from here on).
     const old=socket;replayFrom=Date.now()-REPLAY_MS;
     open(true);
     try{old?.close();}catch{}
     return;
    }
    // Last resort: end this connection; the page opens a fresh one by itself.
    onEvent({type:'gemini.recovery.failed'});finish('connection_lost');
   }catch{
    // The microphone could not be reopened (permission taken away, device gone):
    // fall through to a fresh connection, which asks the learner properly.
    if(!closed){onEvent({type:'gemini.recovery.failed'});finish('connection_lost');}
   }
  }
  function swapMic(stream){
   const old=mic;
   input.disconnect();input=audio.createMediaStreamSource(stream);input.connect(processor);
   mic=stream;frameAt=nonZeroAt=Date.now();attachTrackWatch(stream.getAudioTracks()[0]);
   onMicReplaced?.(stream);
   old?.getTracks().forEach(t=>{try{t.stop();}catch{}});
  }
  // For the page: when sustained speech and tutor audio last happened (Date.now() times).
  const idleInfo=()=>({lastVoiceAt:det.lastVoiceAt(),tutorAudio:sources.size>0?Date.now():playedAt,voiceMs:det.voiceMs(Date.now()),floor:det.floor(),threshold:det.threshold()});
  const controls={context,hasPending,mute,resumeAudio,applyRoute,prompt,respond,alive,idleInfo,trouble,fixNow:()=>trouble('manual',{now:true}),close:()=>finish('client_closed'),dispose:()=>finish('client_closed')};
  onTransport(controls);
  try{
   await audio.audioWorklet.addModule('./gemini-pcm-worklet.js?v=2.1.37');
   if(!active()){finish('cancelled');return null;}
   if(outputAudio){
    // Route model speech through the same selectable media element as GPT Live.
    // No model source also connects to the context's hardware destination.
    if(typeof audio.createMediaStreamDestination!=='function')throw Error('Gemini Live audio output is unavailable in this browser.');
    // Gemini speech is synthesised inside this context, so the hardware
    // destination is always a real route; the element is kept for the cases
    // where a chosen output device has to apply to it.
    mix=audio.createGain();
    hardGain=audio.createGain();hardGain.gain.value=0;mix.connect(hardGain);hardGain.connect(audio.destination);
    elementGain=audio.createGain();elementGain.gain.value=1;mix.connect(elementGain);
    output=audio.createMediaStreamDestination();elementGain.connect(output);
    outputAudio.autoplay=true;outputAudio.playsInline=true;outputAudio.muted=false;outputAudio.volume=1;
    outputAudio.srcObject=output.stream;outputAudio.addEventListener?.('error',outputError);
   }
   void resumeAudio().catch(playbackFailure);input=audio.createMediaStreamSource(mic);processor=new AudioWorkletNode(audio,'worldview-pcm-capture');
   // This existing zero-gain hardware connection keeps capture processing even
   // while the media element is blocked; it never carries audible tutor audio.
   silent=audio.createGain();silent.gain.value=0;input.connect(processor);processor.connect(silent);silent.connect(audio.destination);
   processor.port.onmessage=e=>{
    if(closed)return;
    const now=Date.now();
    // The last few seconds are kept even while the link is down, so a repair can send them again.
    ring.push({t:now,d:e.data});if(ring.length>RING_CHUNKS)ring.shift();
    frameAt=now;
    if(!ready||!active())return;
    {const pcm=new Int16Array(e.data);let sum=0,loud=false;for(let i=0;i<pcm.length;i++){const s=pcm[i];if(s)loud=true;const v=s/32768;sum+=v*v;}if(loud)nonZeroAt=now;const level=Math.sqrt(sum/Math.max(1,pcm.length));hearMic(level,now);onInputLevel?.(level,{voiceMs:det.voiceMs(now),lastVoiceAt:det.lastVoiceAt(),floor:det.floor(),threshold:det.threshold()});}
    if(muted){if(holding){held.push(e.data);if(held.length>HELD_CHUNKS)held.shift();}return;}
    const backlog=socket.bufferedAmount;
    if(backlog>262144){if(!bufferedSince)bufferedSince=now;}else bufferedSince=0;
    if(backlog>1024*1024){failure('The voice connection is too slow. Your conversation is saved.');return;}
    send({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:encodePcm(e.data)}}});
   };
   attachTrackWatch(mic.getAudioTracks()[0]);
   watchTimer=setInterval(watchInput,1000);
   expiryTimer=setTimeout(()=>finish('expired'),Math.max(1,Date.parse(transport.expiresAt)-Date.now()-1000));
   open();
   await connected;
  }catch(error){finish('provider_error');throw error;}
  return controls;
 }
 return {connect,model};
})();
