/* Native Gemini Live transport. Credentials and audio are held in memory only. */
window.WorldviewGeminiLive=(()=>{
 'use strict';
 const model='gemini-3.8-live';
 const endpoint='wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1beta.GenerativeService.BidiGenerateContentConstrained';
 function encodePcm(buffer){let bytes='';for(const value of new Uint8Array(buffer))bytes+=String.fromCharCode(value);return btoa(bytes);}
 function decodePcm(data){const raw=atob(data),view=new DataView(new ArrayBuffer(raw.length));for(let i=0;i<raw.length;i++)view.setUint8(i,raw.charCodeAt(i));const samples=new Float32Array(Math.floor(raw.length/2));for(let i=0;i<samples.length;i++)samples[i]=view.getInt16(i*2,true)/32768;return samples;}
 async function connect({transport,mic,outputAudio,initiate=true,onEvent,onUsage,onStatus,onTransport,isCurrent}){
  if(transport?.type!=='gemini-websocket'||transport.setup?.model!==`models/${model}`||!transport.token?.startsWith('auth_tokens/'))throw Error('Gemini authorization was invalid.');
  const Audio=window.AudioContext||window.webkitAudioContext;
  if(!Audio||!window.AudioWorkletNode)throw Error('Gemini Live needs a browser with AudioWorklet support.');
  const audio=new Audio({latencyHint:'interactive'}),sources=new Set();
  let socket,ready=false,closed=false,started=false,muted=false,modelActive=false,processor,input,silent,playAt=0,resumeHandle='',resumeAttempts=0,closingReason='connection_lost',expiryTimer,openTimer;
  let received=Promise.resolve(),pendingContext='',connectResolve,connectReject,output,mix,hardGain,elementGain;
  const connected=new Promise((resolve,reject)=>{connectResolve=resolve;connectReject=reject;});
  // Cancellation can precede the asynchronous worklet load and its later await.
  // Observe this promise immediately; awaiting the original still propagates errors.
  void connected.catch(()=>{});
  const active=()=>!closed&&isCurrent();
  const send=payload=>{if(active()&&socket?.readyState===WebSocket.OPEN)socket.send(JSON.stringify(payload));};
  const ownsOutput=()=>!!output&&outputAudio?.srcObject===output.stream;
  function playbackFailure(error){if(active()&&(!outputAudio||ownsOutput()))onStatus(error?.name==='NotAllowedError'?'Tap Enable audio.':'Audio playback failed. Tap Enable audio.');}
  const outputError=()=>playbackFailure(outputAudio?.error);
  function resumeAudio(){
   if(!active()||outputAudio&&!ownsOutput())return Promise.reject(Error('This voice output is no longer active.'));
   // Start both operations on the original tap: awaiting resume first would
   // lose the media element's user activation in browsers that require it.
   const start=operation=>{try{return Promise.resolve(operation());}catch(error){return Promise.reject(error);}};
   const tasks=[start(()=>audio.resume())];if(outputAudio)tasks.push(start(()=>outputAudio.play()));
   return Promise.all(tasks).then(()=>{if(!active()||outputAudio&&!ownsOutput())throw Error('This voice output is no longer active.');});
  }
  function clearAudio(){for(const source of sources){try{source.stop();}catch{}}sources.clear();playAt=audio.currentTime;}
  function finish(reason){
   if(closed)return;closed=true;ready=false;clearTimeout(expiryTimer);clearTimeout(openTimer);clearAudio();
   processor?.disconnect();input?.disconnect();silent?.disconnect();if(processor)processor.port.onmessage=null;
   if(outputAudio){outputAudio.removeEventListener?.('error',outputError);if(ownsOutput()){outputAudio.pause();outputAudio.srcObject=null;}}
   output?.stream.getTracks().forEach(track=>track.stop());output?.disconnect();
   mix?.disconnect();hardGain?.disconnect();elementGain?.disconnect();
   socket?.close();void audio.close().catch(()=>{});
   if(!started)connectReject(Error('Gemini Live did not complete its connection.'));
   onEvent({type:'session.closed',reason});
  }
  function failure(text){onStatus(text);closingReason='provider_error';finish(closingReason);}
  function play(data,mimeType){
   const samples=decodePcm(data),rate=Number(/rate=(\d+)/.exec(mimeType||'')?.[1]||24000);
   if(!samples.length||rate<8000||rate>96000)return;
   const buffer=audio.createBuffer(1,samples.length,rate);buffer.copyToChannel(samples,0);
   const source=audio.createBufferSource();source.buffer=buffer;source.connect(mix||audio.destination);sources.add(source);
   source.onended=()=>{sources.delete(source);flushContext();};playAt=Math.max(audio.currentTime+.02,playAt);source.start(playAt);playAt+=buffer.duration;
   if(audio.state==='suspended'||outputAudio?.paused)onStatus('Tap Enable audio.');
  }
  function context(text){
   pendingContext=text;flushContext();
  }
  function flushContext(){
   // Generic API references warn clientContent can interrupt generation even
   // with turnComplete false. Wait for completion AND local playback drainage.
   if(!pendingContext||!ready||modelActive||sources.size)return;
   const text=pendingContext;pendingContext='';
   send({clientContent:{turns:[{role:'user',parts:[{text}]}],turnComplete:false}});
  }
  async function receive(event,source){
   const raw=typeof event.data==='string'?event.data:await event.data.text();
   if(!active()||source!==socket)return;
   const message=JSON.parse(raw);
   if(message.error){failure('Gemini Live rejected the connection. Choose GPT Live or try again.');return;}
   if(message.usageMetadata)onUsage(message.usageMetadata);
   if(message.setupComplete){
    clearTimeout(openTimer);ready=true;
    if(!started){
     send({clientContent:{turns:transport.history||[],turnComplete:false}});
     started=true;connectResolve();onEvent({type:'session.started'});
     if(audio.state==='suspended'||outputAudio?.paused)onStatus('Tap Enable audio.');
     // Give a fresh conversation its opening; resumed lessons continue from the
     // saved current phase/question rather than running Clarification again.
     if(initiate){modelActive=true;send({clientContent:{turns:[{role:'user',parts:[{text:'APP_START. Begin or resume the saved lesson now. Use the saved phase and conversation. Do not re-ask a question already answered. Speak first now in the selected language. If no subject is chosen, ask what they would like to explore today. Ask at most one relevant next question, then listen.'}]}],turnComplete:true}});}
    }else onStatus('Listening');
    flushContext();
   }
   if(message.sessionResumptionUpdate?.resumable&&message.sessionResumptionUpdate.newHandle)resumeHandle=message.sessionResumptionUpdate.newHandle;
   const content=message.serverContent;
   if(content){
    if(content.interrupted){modelActive=false;clearAudio();}
    if(content.modelTurn||content.outputTranscription)modelActive=true;
    if(content.inputTranscription?.text)onEvent({type:'session.input_transcript.delta',delta:content.inputTranscription.text});
    if(content.outputTranscription?.text)onEvent({type:'session.output_transcript.delta',delta:content.outputTranscription.text});
    for(const part of content.modelTurn?.parts||[])if(part.inlineData?.data&&part.inlineData.mimeType?.startsWith('audio/pcm'))play(part.inlineData.data,part.inlineData.mimeType);
    if(content.turnComplete){modelActive=false;onEvent({type:'gemini.turn.complete'});flushContext();}
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
  function prompt(text){
   if(!active()||!ready||modelActive||sources.size)return false;
   modelActive=true;send({clientContent:{turns:[{role:'user',parts:[{text:String(text)}]}],turnComplete:true}});return true;
  }
  const alive=()=>!closed&&socket?.readyState===WebSocket.OPEN;
  const controls={context,mute(value){muted=!!value;if(muted&&ready)send({realtimeInput:{audioStreamEnd:true}});},resumeAudio,applyRoute,prompt,alive,close:()=>finish('client_closed'),dispose:()=>finish('client_closed')};
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
    if(!ready||muted||!active())return;
    if(socket.bufferedAmount>1024*1024){failure('The voice connection is too slow. Your conversation is saved.');return;}
    send({realtimeInput:{audio:{mimeType:'audio/pcm;rate=16000',data:encodePcm(e.data)}}});
   };
   expiryTimer=setTimeout(()=>finish('expired'),Math.max(1,Date.parse(transport.expiresAt)-Date.now()-1000));
   open();
   await connected;
  }catch(error){finish('provider_error');throw error;}
  return controls;
 }
 return {connect,model};
})();
