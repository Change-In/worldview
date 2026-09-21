/* The Live output route.

   iOS gives a web page no direct "play out of the loudspeaker" control, and the
   two levers it does give work in different places, so this module uses both:

     hardware - play through AudioContext.destination. WebKit treats that as
                media output and keeps it on the loudspeaker even while a
                play-and-record capture session is open for the microphone. A
                media element playing the same audio is demoted to the receiver
                in that state, which is the volume "changing on its own".
     device   - HTMLMediaElement.setSinkId, where the browser actually exposes
                and permits a concrete built-in output. That is Safari 18.4+ and
                desktop Chrome/Firefox; most phones expose no output device at
                all, so this is a refinement, never the plan.

   The transport (GPT Live or Gemini Live) owns its own audio graph and reports
   which route it could really produce. Nothing here claims a physical route the
   browser did not confirm. Device IDs never leave memory. */
window.WorldviewLiveAudioOutput=(()=>{
 'use strict';
 const key='worldview-live-loudspeaker-v1';
 const icon='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4V4Z"/><path class="speaker-waves" d="M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14"/></svg>';
 const realOutput=d=>d.kind==='audiooutput'&&!['','default','communications'].includes(d.deviceId);
 // Only unambiguous built-in names. Other OS languages/devices use the chooser.
 const isSpeaker=d=>realOutput(d)&&/^(?:(?:iphone|ipad|built[ -]?in|internal)\s+)?speakers?$/i.test(d.label.trim());
 const canChooseSpeaker=d=>realOutput(d)&&!/(?:earpiece|receiver|headphones?|headset|bluetooth|airpods?|earbuds?)/i.test(d.label);
 function create({audio,button,container}){
  let active=false,generation=0,enumeration=0,pending=null,outputs=[],outputsReady=false;
  let wanted=true,chosen='',route='',transport=null;
  try{wanted=localStorage.getItem(key)!=='false';}catch{}
  const status=document.createElement('p');status.className='live-speaker-status';status.setAttribute('role','status');status.hidden=true;
  const choices=document.createElement('div');choices.className='live-speaker-choices';choices.hidden=true;container.append(status,choices);
  const sinkSupported=()=>typeof audio.setSinkId==='function'&&typeof navigator.mediaDevices?.enumerateDevices==='function';
  // Pressed means the loudspeaker was asked for AND a route confirmed it.
  const applied=()=>wanted&&(route==='hardware'||(route==='device'&&!!chosen&&audio.sinkId===chosen));
  const tell=text=>{status.textContent=text;status.hidden=!text;};
  const save=()=>{try{localStorage.setItem(key,String(wanted));}catch{}};
  function paint(){
   if(!button)return;
   if(button.innerHTML!==icon)button.innerHTML=icon;
   button.classList.add('live-speaker-button');
   const on=active&&applied();
   button.setAttribute('aria-pressed',String(on));button.setAttribute('aria-busy',String(!!pending));button.disabled=!!pending;
   const label=on?'Playing out loud. Tap to follow the phone':'Play out loud';
   button.setAttribute('aria-label',label);button.title=label;
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
    if(active&&token===generation&&outputs.some(output=>output.deviceId===d.deviceId))void selectDevice(d.deviceId);
   };choices.append(b);}
   choices.hidden=!candidates.length;
   if(candidates.length)tell('Choose the loudspeaker.');
  }
  async function selectDevice(id){
   if(!active||pending)return;const token=generation,operation={token};pending=operation;paint();
   try{
    // Call before unrelated awaits: Safari requires a media user gesture.
    await audio.setSinkId(id);
    if(!active||token!==generation)return;
    if(audio.sinkId!==id){tell('The phone did not confirm the output change.');return;}
    chosen=id;route='device';choices.hidden=true;
    // A chosen device belongs to the media element, so playback moves back to it.
    await transport?.applyRoute?.(false);
    if(!active||token!==generation)return;
    tell('Selected audio output.');
   }catch(error){
    if(!active||token!==generation)return;
    if(error?.name==='NotFoundError'){outputsReady=false;chosen='';if(route==='device')route='';}
    tell(error?.name==='NotAllowedError'?'Tap the speaker to allow audio switching.':'The phone could not switch output.');
   }finally{
    if(pending===operation)pending=null;
    if(active)paint();
   }
  }
  /* The transport decides what it can really do; this only records the answer.
     'hardware' is a confirmed loudspeaker-side route, 'element' means playback
     went back to the media element and follows whatever the phone chooses. */
  async function applyRoute(user){
   if(!active||pending)return;
   const token=generation,operation={token};pending=operation;paint();
   try{
    const kind=await transport?.applyRoute?.(wanted);
    if(!active||token!==generation)return;
    if(!wanted){
     route='';chosen='';choices.hidden=true;
     if(sinkSupported()&&audio.sinkId!=='')await audio.setSinkId('').catch(()=>{});
     tell('');return;
    }
    if(kind==='hardware'){route='hardware';chosen='';choices.hidden=true;tell('Playing out loud.');return;}
    // No hardware route. Fall back to an exposed output device where one exists.
    route='';
    if(!sinkSupported()){
     if(user)tell('This browser cannot choose the speaker. Use the phone’s own audio controls.');
     return;
    }
    if(!outputsReady&&!await enumerate())return;
    if(!active||token!==generation)return;
    const speakers=outputs.filter(isSpeaker);
    if(speakers.length===1){pending=null;await selectDevice(speakers[0].deviceId);return;}
    if(user&&outputs.some(canChooseSpeaker))chooser();
    else if(user)tell(kind==='element'
     ? 'This phone has not exposed a separate loudspeaker. Audio follows the phone.'
     : 'Start or resume Voice to choose its speaker.');
   }catch{
    if(active&&token===generation){route='';if(user)tell('The speaker could not be changed. Try again.');}
   }finally{
    if(pending===operation)pending=null;
    if(active)paint();
   }
  }
  function toggle(){
   if(!active){tell('Start or resume Voice to choose its speaker.');return;}
   if(pending)return;
   wanted=!wanted;save();void applyRoute(true);
  }
  function attach(value){transport=value||null;if(active)void applyRoute(false);}
  function start(value){active=true;generation++;route='';chosen='';outputs=[];outputsReady=false;choices.hidden=true;tell('');transport=value||transport;paint();void applyRoute(false);}
  function stop(){active=false;generation++;route='';chosen='';outputs=[];outputsReady=false;choices.hidden=true;tell('');transport=null;resetButton();}
  async function refresh(){
   if(!active)return;const token=generation;
   try{
    if(sinkSupported()&&!await enumerate())return;
    if(!active||token!==generation)return;
    if(route==='device'&&chosen&&!outputs.some(d=>d.deviceId===chosen)){chosen='';route='';}
    await applyRoute(false);
   }catch{if(active&&token===generation){route='';paint();}}
  }
  navigator.mediaDevices?.addEventListener?.('devicechange',()=>void refresh());
  return{start,stop,toggle,paint,refresh,attach,apply:({user=false}={})=>applyRoute(user),wants:()=>wanted};
 }
 return{create};
})();
