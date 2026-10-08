/* Voice activity and microphone health, as plain functions. Nothing here touches
   the network, the microphone or the page: levels and times go in, decisions come
   out, so every rule can be tested without a phone. Speech and text are never
   recorded; only levels, times and fixed reason words. */
(()=>{
 'use strict';
 /* VOI-160. Learner speech is captioned only when the turn ends, so a minute of
    talking looked like a minute of silence and the lesson paused itself in the
    middle of a sentence. Voice is now judged from the microphone level against
    the room as it was a moment ago: a rolling floor (the quiet 10th percentile of
    the last 20 s), and speech is anything clearly above it. The floor is learned
    only while the tutor is not audible, so the tutor's own voice leaking into the
    microphone never counts as the learner. */
 const FLOOR_WINDOW_MS=20000,MAX_SAMPLES=400,MIN_SAMPLES=10,FLOOR_CAP=.06;
 const SUSTAIN_MS=200,HANGOVER_MS=300,STRONG_RATIO=1.5;
 const thresholdFor=floor=>Math.max(floor*1.6,floor+.02);
 const STEADY_FRAMES=30,STEADY_CV=.12;
 // Steady noise (an engine, a fan, wind) barely varies from frame to frame; speech does.
 const isSteady=values=>{
  if(values.length<STEADY_FRAMES)return false;
  let sum=0,sq=0;for(const v of values){sum+=v;sq+=v*v;}
  const mean=sum/values.length;if(mean<=0)return false;
  return Math.sqrt(Math.max(0,sq/values.length-mean*mean))/mean<STEADY_CV;
 };
 function createDetector(){
  let samples=[],floor=0,inRun=false,runStart=0,runFloor=0,lastLoudAt=0,lastVoiceAt=0,recent=[];
  const percentile=list=>{const sorted=list.map(x=>x.v).sort((x,y)=>x-y);return sorted[Math.floor((sorted.length-1)*.1)];};
  function learn(level,clampAt,now){
   // A loud frame is clamped, so a room that really got louder is followed. Inside a
   // run of speech the clamp comes from the floor the run began with, so a long
   // unbroken answer cannot teach the detector that the speech is the room.
   samples.push({t:now,v:Math.min(level,clampAt)});
   const from=now-FLOOR_WINDOW_MS;let drop=0;while(drop<samples.length&&samples[drop].t<from)drop++;
   if(drop)samples=samples.slice(drop);
   if(samples.length>MAX_SAMPLES)samples=samples.slice(samples.length-MAX_SAMPLES);
   if(samples.length<MIN_SAMPLES){floor=0;return;}
   floor=Math.min(FLOOR_CAP,percentile(samples));
  }
  return{
   // ignore: the tutor is audible, so this frame says nothing about the learner.
   // noise: this frame showed that the "speech" so far was steady noise; the burst is void.
   push(level,now,{ignore=false}={}){
    if(ignore){inRun=false;recent=[];return{voice:false,strong:false,ignored:true,noise:false};}
    const threshold=thresholdFor(floor),loud=level>threshold;
    learn(level,inRun?thresholdFor(runFloor):threshold,now);
    let noise=false;
    if(loud){
     lastLoudAt=now;
     if(!inRun){inRun=true;runStart=now;runFloor=floor;recent=[];}
     recent.push(level);if(recent.length>STEADY_FRAMES)recent.shift();
     if(isSteady(recent)){
      // The room itself got louder (the engine started, the window came down): learn it at once.
      samples=recent.map((v,i)=>({t:now-(recent.length-1-i)*100,v}));
      floor=Math.min(FLOOR_CAP,percentile(samples));
      inRun=false;recent=[];lastVoiceAt=0;noise=true;
     }else if(now-runStart>=SUSTAIN_MS)lastVoiceAt=now;
    }else if(inRun&&now-lastLoudAt>HANGOVER_MS){inRun=false;recent=[];}
    return{voice:loud&&!noise,strong:level>threshold*STRONG_RATIO,ignored:false,noise};
   },
   floor:()=>floor,
   threshold:()=>thresholdFor(floor),
   // The last moment of sustained speech (0 when there has been none).
   lastVoiceAt:()=>lastVoiceAt,
   // How long the current run of speech has lasted.
   voiceMs:now=>inRun?now-runStart:0,
   sinceVoice:now=>lastVoiceAt?now-lastVoiceAt:Infinity
  };
 }

 /* The quiet-minute pause. Only when nothing at all has happened: no words
    captioned, no tap, no tutor audio, and above all no voice on the microphone. */
 const IDLE_PAUSE_MS=90000,VOICE_GUARD_MS=15000;
 function shouldIdlePause({sinceActivityMs=Infinity,sinceVoiceMs=Infinity,sinceTutorAudioMs=Infinity,speaking=false,checking=false,idleMs=IDLE_PAUSE_MS,voiceGuardMs=VOICE_GUARD_MS}={}){
  if(speaking||checking)return false;
  if(sinceVoiceMs<voiceGuardMs)return false;
  return Math.min(sinceActivityMs,sinceVoiceMs,sinceTutorAudioMs)>=idleMs;
 }

 /* "You spoke and nothing came back": sustained speech, then quiet, and the
    server has sent nothing at all since the speech began. It no longer makes the
    tutor talk (that interrupted people who were only thinking); it is evidence
    for the input watchdog and a hint on the screen. */
 const UNHEARD_QUIET_MS=6000,UNHEARD_FRAMES=5,UNHEARD_MIN_MS=1500,UNHEARD_COOLDOWN_MS=10000;
 function unheardSpeech({now,burstStart,burstVoiced,lastVoiceAt,serverAt,askedAt=0}){
  if(!burstStart||burstVoiced<UNHEARD_FRAMES)return false;
  // A cough, a bump or a passenger's word is not an answer: speech must have lasted.
  if(lastVoiceAt-burstStart<UNHEARD_MIN_MS)return false;
  if(now-lastVoiceAt<UNHEARD_QUIET_MS)return false;
  if(serverAt>=burstStart)return false;
  return now-askedAt>UNHEARD_COOLDOWN_MS;
 }

 /* BUG-510: in a car the microphone sometimes heard nothing for a minute while
    the connection looked healthy. Everything that can silently stop audio
    reaching the tutor is checked once a second, and each fault has an ordered
    ladder of fixes, so the lesson repairs itself without a tap. */
 const STALL_MS=1500,ZERO_MS=30000,BACKLOG_BYTES=256*1024,BACKLOG_MS=3000;
 function diagnoseInput({now,ctxState='running',trackLive=true,trackMuted=false,frameAt=now,nonZeroAt=now,bufferedBytes=0,bufferedSince=0,unheard=false}){
  if(ctxState!=='running')return'context_suspended';
  if(!trackLive)return'track_ended';
  if(trackMuted)return'track_muted';
  if(now-frameAt>STALL_MS)return'capture_stalled';
  if(now-nonZeroAt>ZERO_MS)return'capture_silent';
  if(bufferedBytes>BACKLOG_BYTES&&bufferedSince&&now-bufferedSince>BACKLOG_MS)return'socket_backlog';
  if(unheard)return'server_silent';
  return null;
 }
 const PLANS={
  context_suspended:['resume_audio','reacquire_mic','reconnect','restart'],
  track_ended:['reacquire_mic','reconnect','restart'],
  track_muted:['resume_audio','reacquire_mic','reconnect','restart'],
  capture_stalled:['reacquire_mic','reconnect','restart'],
  capture_silent:['reacquire_mic','reconnect','restart'],
  socket_backlog:['reconnect','restart'],
  // Speech that got no answer is first only a hint (it may be a slow reply); the
  // third time in two minutes the connection itself is repaired.
  server_silent:['hint','hint','reconnect','reacquire_mic','restart'],
  manual:['reacquire_mic','reconnect','restart']
 };
 // attempts: how many repairs were already tried in the last two minutes.
 const RECOVERY_WINDOW_MS=120000,RECOVERY_GAP_MS=4000;
 function recoveryStep(fault,attempts){const plan=PLANS[fault]||PLANS.server_silent;return plan[Math.min(Math.max(0,attempts),plan.length-1)];}

 window.WorldviewVoiceActivity=Object.freeze({createDetector,shouldIdlePause,unheardSpeech,diagnoseInput,recoveryStep,thresholdFor,IDLE_PAUSE_MS,VOICE_GUARD_MS,UNHEARD_QUIET_MS,RECOVERY_WINDOW_MS,RECOVERY_GAP_MS,PLANS});
})();
