import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

/* The shipped gemini-live.js, run against a fake clock, fake timers, a fake audio
   engine and a fake WebSocket. Nothing here touches a microphone or the network. */
const voiceSource=readFileSync(new URL('../lab/voice-activity.js',import.meta.url),'utf8');
const liveSource=readFileSync(new URL('../lab/gemini-live.js',import.meta.url),'utf8');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const flush=async()=>{for(let i=0;i<8;i++)await tick();};

function world(){
 let clock=1_000_000;const timers=[];let timerId=0;
 class FakeDate extends Date{constructor(...a){a.length?super(...a):super(clock);}static now(){return clock;}}
 const sockets=[],audios=[];
 class FakeSocket{
  static OPEN=1;static CONNECTING=0;
  constructor(url){this.url=url;this.readyState=0;this.bufferedAmount=0;this.sent=[];this.listeners={};sockets.push(this);}
  addEventListener(type,fn){(this.listeners[type]||=[]).push(fn);}
  send(data){this.sent.push(JSON.parse(data));}
  close(){if(this.readyState===3)return;this.readyState=3;this.emit('close',{});}
  emit(type,event){for(const fn of this.listeners[type]||[])fn(event);}
  open(){this.readyState=1;this.emit('open',{});}
  say(message){this.emit('message',{data:JSON.stringify(message)});}
 }
 const node=()=>({connect(){},disconnect(){},gain:{value:1}});
 class FakeAudio{
  constructor(){this.state='running';this.currentTime=0;this.destination={};this.audioWorklet={addModule:async()=>{}};audios.push(this);}
  addEventListener(){}
  resume(){this.state='running';return Promise.resolve();}
  close(){this.state='closed';return Promise.resolve();}
  createGain(){return node();}
  createMediaStreamSource(){return node();}
  createMediaStreamDestination(){return{...node(),stream:{getTracks:()=>[]}};}
  createBuffer(){return{duration:0,copyToChannel(){}};}
  createBufferSource(){return{...node(),start(){},stop(){}};}
 }
 const ports=[];
 class FakeWorklet{constructor(){this.port={};ports.push(this.port);}connect(){}disconnect(){}}
 const context=vm.createContext({
  Date:FakeDate,JSON,Promise,Math,Uint8Array,Int16Array,Float32Array,DataView,ArrayBuffer,Error,Set,Map,
  btoa:s=>Buffer.from(s,'binary').toString('base64'),atob:s=>Buffer.from(s,'base64').toString('binary'),
  encodeURIComponent,WebSocket:FakeSocket,AudioContext:FakeAudio,AudioWorkletNode:FakeWorklet,document:{hidden:false},
  setTimeout:(fn,ms=0)=>{timers.push({id:++timerId,at:clock+ms,fn,every:0});return timerId;},
  setInterval:(fn,ms)=>{timers.push({id:++timerId,at:clock+ms,fn,every:ms});return timerId;},
  clearTimeout:id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);},
  clearInterval:id=>{const i=timers.findIndex(t=>t.id===id);if(i>=0)timers.splice(i,1);}
 });
 context.window=context;
 vm.runInContext(voiceSource,context);vm.runInContext(liveSource,context);
 const advance=ms=>{
  const end=clock+ms;
  for(;;){
   timers.sort((a,b)=>a.at-b.at);const due=timers.find(t=>t.at<=end);
   if(!due)break;
   clock=Math.max(clock,due.at);
   if(due.every)due.at+=due.every;else timers.splice(timers.indexOf(due),1);
   due.fn();
  }
  clock=end;
 };
 return{context,sockets,audios,advance,now:()=>clock,port:()=>ports.at(-1)};
}

const stream=()=>{const track={readyState:'live',muted:false,listeners:{},addEventListener(t,f){(this.listeners[t]||=[]).push(f);},stop(){this.readyState='ended';}};return{track,getAudioTracks:()=>[track],getTracks:()=>[track]};};
// Speech is not a constant tone: its level jumps about from one tenth of a second to the next.
const speechy=i=>Math.max(.015,.09+Math.sin(i*1.7)*.035+Math.sin(i*.9)*.02+(i%7===0?-.05:0));
const pcm=level=>{const a=new Int16Array(1600).fill(Math.round(level*32768));return a.buffer;};

async function start({reacquire=true}={}){
 const w=world(),events=[],replaced=[],reopened=[];
 const mic=stream();
 let controls;
 const connected=w.context.WorldviewGeminiLive.connect({
  transport:{type:'gemini-websocket',setup:{model:'models/gemini-3.8-live'},token:'auth_tokens/test',expiresAt:new Date(w.now()+3_600_000).toISOString(),history:[]},
  mic,outputAudio:null,initiate:false,
  onEvent:e=>events.push(e),onUsage(){},onStatus(){},onTransport:c=>{controls=c;},isCurrent:()=>true,
  reacquireMic:reacquire?async()=>{const s=stream();reopened.push(s);return s;}:null,
  onMicReplaced:s=>replaced.push(s)
 });
 await flush();
 const socket=w.sockets[0];socket.open();socket.say({setupComplete:{}});
 await connected;await flush();
 return{w,events,controls,socket,mic,replaced,reopened,sockets:w.sockets};
}
test('a pause never ends the learner\'s turn while they are still speaking',async()=>{
 const h=await start();const port=h.w.port();
 assert.ok(port,'capture port available');
 for(let i=0;i<30;i++){port.onmessage({data:pcm(speechy(i))});h.w.advance(100);}      // 3 s of speech
 h.socket.sent.length=0;
 h.controls.mute(true,{hold:true});
 assert.equal(h.socket.sent.some(m=>m.realtimeInput?.audioStreamEnd),false,'audioStreamEnd sent while speaking');
 h.controls.mute(false);
 for(let i=0;i<70;i++){port.onmessage({data:pcm(.005)});h.w.advance(100);}       // 7 s of quiet
 h.socket.sent.length=0;
 h.controls.mute(true,{hold:true});
 assert.equal(h.socket.sent.some(m=>m.realtimeInput?.audioStreamEnd),true,'a real pause closes the turn');
});

test('while paused, 3 s of held audio is kept and sent first on resume',async()=>{
 const h=await start();const port=h.w.port();
 for(let i=0;i<70;i++){port.onmessage({data:pcm(.005)});h.w.advance(100);}
 h.controls.mute(true,{hold:true});
 for(let i=0;i<60;i++){port.onmessage({data:pcm(.005)});h.w.advance(100);}
 h.socket.sent.length=0;
 h.controls.mute(false,{flush:true});
 const chunks=h.socket.sent.filter(m=>m.realtimeInput?.audio);
 assert.equal(chunks.length,30);
});

test('idleInfo reports the learner\'s voice and the tutor\'s audio on one clock',async()=>{
 const h=await start();const port=h.w.port();
 assert.equal(h.controls.idleInfo().lastVoiceAt,0);
 for(let i=0;i<20;i++){port.onmessage({data:pcm(speechy(i))});h.w.advance(100);}
 const info=h.controls.idleInfo();
 assert.ok(info.lastVoiceAt>0&&h.w.now()-info.lastVoiceAt<300);
 assert.ok(info.voiceMs>=1000);
});

test('a captured stall (no frames for 3 s) reopens the microphone by itself and tells the page',async()=>{
 const h=await start();const port=h.w.port();
 for(let i=0;i<10;i++){port.onmessage({data:pcm(.01)});h.w.advance(100);}
 h.w.advance(3500);                                               // the worklet stops producing frames
 const trouble=h.events.find(e=>e.type==='gemini.input.trouble');
 assert.ok(trouble,'trouble reported');
 assert.equal(trouble.fault,'capture_stalled');
 assert.equal(trouble.step,'reacquire_mic');
 await flush();
 assert.equal(h.reopened.length,1);
 assert.equal(h.replaced.length,1,'the page was handed the new microphone');
 assert.equal(h.mic.track.readyState,'ended','the old microphone was released');
});

test('a suspended audio engine is resumed first, before anything heavier',async()=>{
 const h=await start();const port=h.w.port();
 h.w.audios[0].state='suspended';
 for(let i=0;i<30;i++){port.onmessage({data:pcm(.01)});h.w.advance(100);}
 const trouble=h.events.find(e=>e.type==='gemini.input.trouble');
 assert.equal(trouble.fault,'context_suspended');
 assert.equal(trouble.step,'resume_audio');
 await flush();
 assert.equal(h.w.audios[0].state,'running');
});

test('speech nobody answered: a hint twice, then the connection is repaired and the last seconds are sent again',async()=>{
 const h=await start();const port=h.w.port();
 h.socket.say({sessionResumptionUpdate:{resumable:true,newHandle:'handle-1'}});await flush();
 const speak=()=>{for(let i=0;i<30;i++){port.onmessage({data:pcm(speechy(i))});h.w.advance(100);}};
 const quiet=(s)=>{for(let i=0;i<s*10;i++){port.onmessage({data:pcm(.004)});h.w.advance(100);}};
 quiet(5);
 speak();quiet(8);
 let steps=h.events.filter(e=>e.type==='gemini.input.trouble').map(e=>e.step);
 assert.deepEqual(steps,['hint'],'first time is only a hint');
 assert.equal(h.sockets.length,1,'no reconnect yet');
 quiet(5);speak();quiet(8);
 steps=h.events.filter(e=>e.type==='gemini.input.trouble').map(e=>e.step);
 assert.deepEqual(steps,['hint','hint']);
 quiet(5);speak();
 // The third unanswered turn: sent audio is only what was spoken in the last seconds.
 quiet(8);
 steps=h.events.filter(e=>e.type==='gemini.input.trouble').map(e=>e.step);
 assert.equal(steps.at(-1),'reconnect');
 await flush();
 assert.equal(h.sockets.length,2,'a resumed connection was opened');
 const second=h.sockets[1];second.open();
 second.say({setupComplete:{}});await flush();
 const replay=second.sent.filter(m=>m.realtimeInput?.audio);
 assert.ok(replay.length>0&&replay.length<=80,'recent audio sent again: '+replay.length);
 assert.ok(h.events.some(e=>e.type==='gemini.recovered'));
 // The server hearing the learner again clears the trouble.
 second.say({serverContent:{inputTranscription:{text:'hello'}}});await flush();
 assert.ok(h.events.some(e=>e.type==='gemini.input.ok'));
});

test('speech that the server answers raises no alarm, and neither does road noise',async()=>{
 const h=await start();const port=h.w.port();
 for(let i=0;i<30;i++){port.onmessage({data:pcm(speechy(i))});h.w.advance(100);}
 h.socket.say({serverContent:{modelTurn:{parts:[]}}});await flush();
 for(let i=0;i<120;i++){port.onmessage({data:pcm(.004)});h.w.advance(100);}
 assert.equal(h.events.some(e=>e.type==='gemini.input.trouble'),false);
 // Steady road noise for a minute: not speech, so not "unheard speech" either.
 for(let i=0;i<600;i++){port.onmessage({data:pcm(.05+((i*7)%9)*.0005)});h.w.advance(100);}
 for(let i=0;i<100;i++){port.onmessage({data:pcm(.004)});h.w.advance(100);}
 assert.equal(h.events.some(e=>e.type==='gemini.input.trouble'),false);
});

test('a backed-up socket (a dropped cell link) is replaced, not waited on',async()=>{
 const h=await start();const port=h.w.port();
 h.socket.say({sessionResumptionUpdate:{resumable:true,newHandle:'handle-1'}});await flush();
 h.socket.close=()=>{};                    // a dead link that never reports that it closed
 h.socket.bufferedAmount=400_000;
 for(let i=0;i<60;i++){port.onmessage({data:pcm(.02+(i%3)*.001)});h.w.advance(100);}
 const trouble=h.events.find(e=>e.type==='gemini.input.trouble');
 assert.equal(trouble?.fault,'socket_backlog');
 assert.equal(trouble?.step,'reconnect');
 await flush();
 assert.equal(h.sockets.length,2,'resumed on a fresh socket');
});

test('with no resume handle a repair ends the connection, and the page opens a new one',async()=>{
 const h=await start();const port=h.w.port();
 h.socket.bufferedAmount=400_000;
 for(let i=0;i<60&&port.onmessage;i++){port.onmessage({data:pcm(.02+(i%3)*.001)});h.w.advance(100);}
 assert.ok(h.events.some(e=>e.type==='session.closed'&&e.reason==='connection_lost'));
});

test('with no way to reopen the microphone, the ladder falls through to ending the connection',async()=>{
 const h=await start({reacquire:false});const port=h.w.port();
 for(let i=0;i<10;i++){port.onmessage({data:pcm(.01)});h.w.advance(100);}
 h.w.advance(3500);
 await flush();
 const trouble=h.events.find(e=>e.type==='gemini.input.trouble');
 assert.equal(trouble.step,'reacquire_mic');
 assert.ok(h.events.some(e=>e.type==='session.closed'&&e.reason==='connection_lost'),'connection ended for a fresh start');
});

test('the manual Fix button repairs at once, without waiting for the cool-down',async()=>{
 const h=await start();const port=h.w.port();
 for(let i=0;i<10;i++){port.onmessage({data:pcm(.01)});h.w.advance(100);}
 h.controls.fixNow();h.controls.fixNow();
 await flush();
 const manual=h.events.filter(e=>e.type==='gemini.input.trouble'&&e.fault==='manual');
 assert.equal(manual.length,2);
 assert.equal(manual[0].step,'reacquire_mic');
 assert.equal(manual[1].step,'reconnect');
});
