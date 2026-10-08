import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// The shipped module, loaded without a browser: levels and times in, decisions out.
const source=readFileSync(new URL('../lab/voice-activity.js',import.meta.url),'utf8');
const context=vm.createContext({});context.window=context;
vm.runInContext(source,context);
const Voice=context.WorldviewVoiceActivity;

const FRAME=100;
// Deterministic wobble so levels look like a microphone, not a constant.
const wobble=(i,amount)=>Math.sin(i*1.7)*amount+Math.sin(i*.9)*amount*.6;
// Feed `seconds` of frames to a detector; returns the time after the last frame.
function feed(detector,from,seconds,levelAt,{ignore=false}={}){
 let t=from;
 for(let i=0;i<seconds*1000/FRAME;i++){detector.push(levelAt(i,t),t,{ignore});t+=FRAME;}
 return t;
}
// Speech varies a lot from one tenth of a second to the next, with a dip between phrases.
const speech=(i)=>i%23===0?.01:Math.max(.012,.09+wobble(i,.035)+(i%7===0?-.05:0));
const quietRoom=(i)=>.008+Math.abs(wobble(i,.002));
const carNoise=(i)=>.05+wobble(i,.004);

test('120 s of continuous speech with no captions never pauses the lesson',()=>{
 const d=Voice.createDetector();let t=0;
 for(let second=0;second<120;second+=5){
  t=feed(d,t,5,speech);
  assert.equal(Voice.shouldIdlePause({sinceActivityMs:t,sinceVoiceMs:d.sinceVoice(t),sinceTutorAudioMs:Infinity}),false,'paused at '+t);
 }
});

test('45 s of thinking, then 60 s of talking, never pauses',()=>{
 const d=Voice.createDetector();let t=0;
 const polls=[];
 for(let second=0;second<105;second+=5){
  t=feed(d,t,5,second<45?quietRoom:speech);
  polls.push(Voice.shouldIdlePause({sinceActivityMs:t,sinceVoiceMs:d.sinceVoice(t),sinceTutorAudioMs:Infinity}));
 }
 assert.equal(polls.some(Boolean),false);
});

test('90 s of true silence does pause, and not before',()=>{
 const d=Voice.createDetector();let t=0,pausedAt=null;
 for(let second=0;second<120&&pausedAt==null;second+=5){
  t=feed(d,t,5,quietRoom);
  if(Voice.shouldIdlePause({sinceActivityMs:t,sinceVoiceMs:d.sinceVoice(t),sinceTutorAudioMs:Infinity}))pausedAt=t;
 }
 assert.ok(pausedAt>=90000&&pausedAt<=95000,'paused at '+pausedAt);
});

test('speech within the last 15 s blocks a pause even when everything else is old',()=>{
 assert.equal(Voice.shouldIdlePause({sinceActivityMs:200000,sinceVoiceMs:10000,sinceTutorAudioMs:200000,idleMs:60000}),false);
 assert.equal(Voice.shouldIdlePause({sinceActivityMs:200000,sinceVoiceMs:200000,sinceTutorAudioMs:5000}),false,'tutor audio counts');
 assert.equal(Voice.shouldIdlePause({sinceActivityMs:200000,sinceVoiceMs:Infinity,sinceTutorAudioMs:Infinity,speaking:true}),false);
 assert.equal(Voice.shouldIdlePause({sinceActivityMs:200000,sinceVoiceMs:Infinity,sinceTutorAudioMs:Infinity,checking:true}),false);
 assert.equal(Voice.shouldIdlePause({sinceActivityMs:200000,sinceVoiceMs:Infinity,sinceTutorAudioMs:Infinity}),true);
});

test('in a noisy car, speech over the road noise is heard within 300 ms and noise alone is not',()=>{
 const d=Voice.createDetector();
 let t=feed(d,0,40,carNoise);                       // let the floor settle on the road noise
 assert.ok(d.floor()>.04&&d.floor()<.06,'floor '+d.floor());
 for(let i=0;i<600;i++){d.push(carNoise(i),t,{});assert.ok(d.voiceMs(t)<250,'noise counted as voice');t+=FRAME;}
 const onset=t;let heardAfter=null;
 for(let i=0;i<10&&heardAfter==null;i++){d.push(.09+wobble(i,.004),t,{});if(d.voiceMs(t)>=250)heardAfter=t-onset;t+=FRAME;}
 assert.ok(heardAfter!=null&&heardAfter<=300,'heard after '+heardAfter);
});

test('the floor learned before a pause is what resumes it, not the first second after',()=>{
 const d=Voice.createDetector();
 let t=feed(d,0,30,quietRoom);t=feed(d,t,20,speech);        // talking right up to the pause
 const floor=d.floor();
 assert.ok(floor<.03,'talking did not raise the floor to speech level: '+floor);
 // Still talking through the first second of the pause: must register as voice.
 let resumed=false;for(let i=0;i<10;i++){d.push(.09,t,{});if(d.voiceMs(t)>=250)resumed=true;t+=FRAME;}
 assert.equal(resumed,true);
});

test('a long monologue does not teach the detector that speech is the room',()=>{
 const d=Voice.createDetector();
 let t=feed(d,0,10,quietRoom);t=feed(d,t,180,(i)=>.1+wobble(i,.02));
 assert.ok(d.threshold()<.1,'threshold '+d.threshold());
 d.push(.1,t,{});d.push(.1,t+FRAME,{});d.push(.1,t+2*FRAME,{});
 assert.ok(d.voiceMs(t+2*FRAME)>=200);
});

test('frames while the tutor is audible say nothing about the learner',()=>{
 const d=Voice.createDetector();
 let t=feed(d,0,10,quietRoom);
 t=feed(d,t,10,()=>.2,{ignore:true});
 assert.equal(d.sinceVoice(t),Infinity);
 assert.equal(d.voiceMs(t),0);
 assert.ok(d.floor()<.02,'floor not raised by the tutor');
});

test('unheard speech needs sustained speech, quiet, and a silent server',()=>{
 const base={now:20000,burstStart:5000,burstVoiced:12,lastVoiceAt:12000,serverAt:0,askedAt:0};
 assert.equal(Voice.unheardSpeech(base),true);
 assert.equal(Voice.unheardSpeech({...base,now:15000}),false,'only 3 s of quiet');
 assert.equal(Voice.unheardSpeech({...base,serverAt:8000}),false,'the server answered');
 assert.equal(Voice.unheardSpeech({...base,lastVoiceAt:5800}),false,'a cough is not an answer');
 assert.equal(Voice.unheardSpeech({...base,burstVoiced:3}),false);
 assert.equal(Voice.unheardSpeech({...base,askedAt:15000}),false,'cooldown');
});

test('every input fault is diagnosed, healthy input is not',()=>{
 const ok={now:100000,ctxState:'running',trackLive:true,trackMuted:false,frameAt:99900,nonZeroAt:99000};
 assert.equal(Voice.diagnoseInput(ok),null);
 assert.equal(Voice.diagnoseInput({...ok,ctxState:'suspended'}),'context_suspended');
 assert.equal(Voice.diagnoseInput({...ok,trackLive:false}),'track_ended');
 assert.equal(Voice.diagnoseInput({...ok,trackMuted:true}),'track_muted');
 assert.equal(Voice.diagnoseInput({...ok,frameAt:97000}),'capture_stalled');
 assert.equal(Voice.diagnoseInput({...ok,nonZeroAt:60000}),'capture_silent');
 assert.equal(Voice.diagnoseInput({...ok,bufferedBytes:400000,bufferedSince:95000}),'socket_backlog');
 assert.equal(Voice.diagnoseInput({...ok,bufferedBytes:400000,bufferedSince:99000}),null,'a brief backlog is fine');
 assert.equal(Voice.diagnoseInput({...ok,unheard:true}),'server_silent');
});

test('each fault has an ordered ladder that always ends in a fresh connection',()=>{
 for(const [fault,plan] of Object.entries(Voice.PLANS)){
  assert.equal(plan.at(-1),'restart',fault);
  assert.equal(Voice.recoveryStep(fault,0),plan[0]);
  assert.equal(Voice.recoveryStep(fault,99),'restart');
 }
 const steps=[0,1,2,3,4].map(n=>Voice.recoveryStep('server_silent',n));
 assert.deepEqual(steps,['hint','hint','reconnect','reacquire_mic','restart']);
 assert.equal(Voice.recoveryStep('context_suspended',0),'resume_audio');
 assert.equal(Voice.recoveryStep('capture_stalled',0),'reacquire_mic');
});

test('a lesson that starts in a car learns the road noise within about 3 s and does not call it speech',()=>{
 const d=Voice.createDetector();let t=1000,noiseFlagged=null;
 for(let i=0;i<300;i++){const f=d.push(carNoise(i),t,{});if(f.noise&&noiseFlagged==null)noiseFlagged=t-1000;t+=FRAME;}
 assert.ok(noiseFlagged!=null&&noiseFlagged<=3500,'noise recognised after '+noiseFlagged);
 assert.ok(d.floor()>.04,'floor '+d.floor());
 assert.equal(d.voiceMs(t),0);
 assert.equal(d.sinceVoice(t),Infinity,'no phantom speech remembered');
});

test('the car getting louder mid-lesson is learned, not mistaken for a long answer',()=>{
 const d=Voice.createDetector();
 let t=feed(d,1000,40,quietRoom);
 let noise=0;for(let i=0;i<300;i++){if(d.push(carNoise(i),t,{}).noise)noise++;t+=FRAME;}
 assert.ok(noise>=1,'engine noise recognised');
 assert.equal(d.voiceMs(t),0);
 assert.ok(d.threshold()>.07,'threshold follows the louder room: '+d.threshold());
});

test('speech does not look like steady noise, however long it goes on',()=>{
 const d=Voice.createDetector();let t=1000,noise=0;
 t=feed(d,t,5,quietRoom);
 for(let i=0;i<1800;i++){if(d.push(speech(i),t,{}).noise)noise++;t+=FRAME;}
 assert.equal(noise,0);
 assert.ok(d.voiceMs(t)>=170000);
});
