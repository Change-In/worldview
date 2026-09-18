/* One explicit output choice for native Live. Device IDs never leave memory. */
window.WorldviewLiveAudioOutput=(()=>{
 'use strict';
 const key='worldview-live-loudspeaker-v1';
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 // Only unambiguous built-in names. Other OS languages/devices use the chooser.
 const isSpeaker=d=>d.kind==='audiooutput'&&!['','default','communications'].includes(d.deviceId)&&/^(?:(?:iphone|ipad|built[ -]?in|internal)\s+)?speakers?$/i.test(d.label.trim());
 const canChooseSpeaker=d=>d.kind==='audiooutput'&&!['','default','communications'].includes(d.deviceId)&&!/(?:earpiece|receiver|headphones?|headset|bluetooth|airpods?|earbuds?)/i.test(d.label);
 function create({audio,button,container}){
  let active=false,generation=0,enumeration=0,pending=null,applied=false,outputs=[],outputsReady=false,wanted=true,chosen='';
  try{wanted=localStorage.getItem(key)!=='false';}catch{}
  const status=document.createElement('p');status.className='live-speaker-status';status.setAttribute('role','status');status.hidden=true;
  const choices=document.createElement('div');choices.className='live-speaker-choices';choices.hidden=true;container.append(status,choices);
  const supported=()=>typeof audio.setSinkId==='function'&&typeof navigator.mediaDevices?.enumerateDevices==='function';
  const tell=text=>{status.textContent=text;status.hidden=!text;};
  const save=()=>{try{localStorage.setItem(key,String(wanted));}catch{}};
  function paint(){
   if(!button)return;button.innerHTML=icon;button.classList.add('live-speaker-button');
   const selected=active&&applied&&audio.sinkId===chosen;
   button.setAttribute('aria-pressed',String(selected));button.setAttribute('aria-busy',String(!!pending));button.disabled=!!pending;
   const label=selected?'Loudspeaker selected. Use system audio output':'Use loudspeaker';button.setAttribute('aria-label',label);button.title=label;
  }
  function resetButton(){if(!button)return;button.classList.remove('live-speaker-button');button.removeAttribute('aria-pressed');button.removeAttribute('aria-busy');button.disabled=false;}
  async function enumerate(){
   const token=generation,sequence=++enumeration;
   const devices=(await navigator.mediaDevices.enumerateDevices()).filter(d=>d.kind==='audiooutput');
   if(!active||token!==generation||sequence!==enumeration)return false;
   outputs=devices;outputsReady=true;return true;
  }
  function chooser(){
   const token=generation,candidates=outputs.filter(canChooseSpeaker);choices.replaceChildren();
   for(const d of candidates){const b=document.createElement('button');b.type='button';b.textContent=d.label||'Audio output';b.onclick=()=>{
    if(active&&token===generation&&outputs.some(output=>output.deviceId===d.deviceId))void select(d.deviceId,true);
   };choices.append(b);}
   choices.hidden=!candidates.length;tell(candidates.length?'Choose the phone’s loudspeaker.':'The phone has not exposed a speaker output. Try again after allowing the microphone.');
  }
  async function select(id,loudspeaker){
   if(!active||pending)return;const token=generation,operation={token};pending=operation;paint();
   try{
    // Call before unrelated awaits: Safari requires a media user gesture.
    await audio.setSinkId(id);
    if(!active||token!==generation)return;
    if(audio.sinkId!==id){applied=false;tell('The phone did not confirm the output change. Tap the speaker to try again.');return;}
    applied=loudspeaker;wanted=loudspeaker;chosen=loudspeaker?id:'';save();choices.hidden=true;
    tell(applied?'Loudspeaker selected.':id===''||id==='default'?'Audio follows your phone.':'Selected audio output.');
   }catch(error){
    if(!active||token!==generation)return;
    applied=applied&&audio.sinkId===chosen;
    if(error?.name==='NotFoundError'){outputsReady=false;chosen='';applied=false;}
    tell(error?.name==='NotAllowedError'?'Tap the speaker to allow audio switching.':'The phone could not switch output. Tap the speaker to try again.');
   }finally{
    if(pending===operation)pending=null;
    if(active){paint();if(token!==generation)void refresh();}
   }
  }
  async function apply({user=false}={}){
   if(!active||pending)return;
   if(!supported()){applied=false;paint();if(user)tell('This browser cannot switch speakers. Update iOS or use your phone’s audio controls.');return;}
   const token=generation;
   try{
    if((!outputsReady||(user&&!outputs.some(canChooseSpeaker)))&&!await enumerate())return;
    if(!active||token!==generation)return;
    if(!wanted){if(audio.sinkId!=='')await select('',false);else{applied=false;paint();}return;}
    // An explicit chooser answer also identifies localized/ambiguous labels.
    // Keep that exact device; never replace it with the first of two speakers.
    const remembered=outputs.find(d=>d.deviceId===chosen&&canChooseSpeaker(d)),speakers=outputs.filter(isSpeaker);
    const speaker=remembered||(speakers.length===1?speakers[0]:null);
    if(speaker){
     if(applied&&chosen===speaker.deviceId&&audio.sinkId===chosen){paint();return;}
     await select(speaker.deviceId,true);
    }
    else if(user)chooser();
   }catch{if(active&&token===generation){applied=false;paint();if(user)tell('Audio outputs are unavailable. Allow the microphone, then try again.');}}
  }
  function toggle(){
   if(!active){tell('Start or resume Voice to choose its speaker.');return;}
   if(pending)return;
   if(applied&&audio.sinkId===chosen)void select('',false);
   else{wanted=true;void apply({user:true});}
  }
  function start(){active=true;generation++;applied=false;outputs=[];outputsReady=false;choices.hidden=true;tell('');paint();void refresh();}
  function stop(){active=false;generation++;applied=false;outputs=[];outputsReady=false;choices.hidden=true;tell('');resetButton();}
  async function refresh(){
   if(!active||!supported())return;const token=generation;
   try{if(!await enumerate()||!active||token!==generation)return;
    if(chosen&&!outputs.some(d=>d.deviceId===chosen)){chosen='';applied=false;paint();}
    await apply();
   }catch{if(active&&token===generation){applied=false;paint();}}
  }
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>void refresh());
  return{start,stop,toggle,paint,refresh,apply};
 }
 return{create};
})();
