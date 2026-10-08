import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// The shipped quiet-minute pause and resume (live-conversation.js), run against a fake clock.
const voiceSource=readFileSync(new URL('../lab/voice-activity.js',import.meta.url),'utf8');
const source=readFileSync(new URL('../lab/live-conversation.js',import.meta.url),'utf8');
const start=source.indexOf(' function recordTalk(s){');
const end=source.indexOf(' // One entry cue, not a learner turn.',start);
assert(start>=0&&end>start,'the actual pause code must be available');

// Objects built inside the fake page have another realm's prototypes; compare them as plain data.
const plain=x=>JSON.parse(JSON.stringify(x));

function world(){
 let clock=1_000_000;
 class FakeDate extends Date{constructor(...a){a.length?super(...a):super(clock);}static now(){return clock;}}
 const calls=[],chimes=[],messages=[];
 const gemini={info:{lastVoiceAt:0,tutorAudio:0},idleInfo(){return this.info;},mute:(...args)=>calls.push(['mute',...args])};
 const s={ready:true,closing:false,gemini,lastActivityAt:0,muted:false,speaking:false,checking:false};
 const context=vm.createContext({
  Date:FakeDate,Infinity,Number,Math,JSON,
  window:{WorldviewLessonCues:{chime:k=>chimes.push(k)}},document:{hidden:false},
  performance:{now:()=>clock-1_000_000},
  IDLE_LISTEN_MS:120000,study:null,session:s,
  studyStep:()=>'',message:t=>messages.push(t),paint(){},stop:async(...a)=>calls.push(['stop',...a]),
  voiceEvents:[],paused:false
 });
 const voice=vm.createContext({});voice.window=voice;vm.runInContext(voiceSource,voice);context.Voice=voice.WorldviewVoiceActivity;
 context.voiceEvent=(kind,detail={})=>context.voiceEvents.push({kind,...detail});
 vm.runInContext(source.slice(start,end),context);
 return{context,s,gemini,calls,chimes,messages,advance:ms=>{clock+=ms;},now:()=>clock,perf:()=>clock-1_000_000};
}

test('a learner talking for two minutes with no captions is never paused',()=>{
 const w=world();
 for(let second=0;second<120;second+=5){
  w.advance(5000);
  w.gemini.info.lastVoiceAt=w.now()-200;             // voice on the microphone right now
  w.context.idleCheck(w.s);
 }
 assert.equal(w.s.softPaused,undefined);
 assert.deepEqual(plain(w.calls),[]);
});

test('thinking in silence for 45 s and then talking never pauses',()=>{
 const w=world();
 w.s.lastActivityAt=w.perf();
 for(let second=0;second<105;second+=5){
  w.advance(5000);
  if(second>=45)w.gemini.info.lastVoiceAt=w.now()-200;
  w.context.idleCheck(w.s);
 }
 assert.equal(w.s.softPaused,undefined);
});

test('90 s of real quiet pauses once, holds the microphone and logs it',()=>{
 const w=world();
 w.s.lastActivityAt=w.perf();
 let pausedAfter=null;
 for(let second=5;second<=120&&!w.s.softPaused;second+=5){
  w.advance(5000);w.context.idleCheck(w.s);
  if(w.s.softPaused)pausedAfter=second;
 }
 assert.ok(pausedAfter>=90&&pausedAfter<=95,'paused after '+pausedAfter);
 assert.deepEqual(plain(w.calls.at(-1)),['mute',true,{hold:true}]);
 assert.deepEqual(plain(w.chimes),['pause']);
 assert.equal(w.context.voiceEvents[0].kind,'idle_pause');
});

test('tutor audio, a pending check, or the tutor speaking keeps the lesson awake',()=>{
 const w=world();
 w.s.lastActivityAt=w.perf();w.advance(200_000);
 w.gemini.info.tutorAudio=w.now()-1000;w.context.idleCheck(w.s);assert.equal(w.s.softPaused,undefined);
 w.gemini.info.tutorAudio=0;w.s.checking=true;w.context.idleCheck(w.s);assert.equal(w.s.softPaused,undefined);
 w.s.checking=false;w.s.speaking=true;w.context.idleCheck(w.s);assert.equal(w.s.softPaused,undefined);
 w.s.speaking=false;w.context.idleCheck(w.s);assert.equal(w.s.softPaused,true);
});

test('speaking while paused resumes by voice with the held audio, and the room before the pause sets the bar',()=>{
 const w=world();
 w.s.softPaused=true;w.s.softPausedAt=w.perf();
 w.context.inputLevel(w.s,.1,{voiceMs:120});
 assert.equal(w.s.softPaused,true,'120 ms is too short to be sure');
 w.context.inputLevel(w.s,.1,{voiceMs:300});
 assert.equal(w.s.softPaused,false);
 assert.deepEqual(plain(w.calls.at(-1)),['mute',false,{flush:true}]);
 assert.deepEqual(plain(w.context.voiceEvents.map(e=>[e.kind,e.by])),[['soft_resume','voice']]);
});

test('a tap resumes too, and is logged as a tap',()=>{
 const w=world();
 w.s.softPaused=true;w.s.softPausedAt=w.perf();
 w.context.softResume(w.s);
 assert.equal(w.s.softPaused,false);
 assert.deepEqual(plain(w.context.voiceEvents.map(e=>[e.kind,e.by])),[['soft_resume','tap']]);
});
