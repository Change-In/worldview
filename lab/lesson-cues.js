/* Small, self-contained lesson cues: a soft chime and a short banner that names
   a moment ("Your lesson has begun"). Kept out of lab.js on purpose. Nothing
   here records speech or reaches the network. */
window.WorldviewLessonCues=(()=>{
 'use strict';
 let context=null,toastTimer=null;
 function audio(){
  const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return null;
  try{if(!context||context.state==='closed')context=new Audio({latencyHint:'interactive'});}catch{return null;}
  return context;
 }
 // Two soft sine notes. Best effort: a browser that refuses audio without a
 // tap simply stays quiet, and the banner still marks the moment.
 function chime(kind='begin'){
  const ctx=audio();if(!ctx)return;
  const notes=kind==='pause'?[659.25,523.25]:[523.25,783.99];
  const play=()=>{
   const start=ctx.currentTime+.02;
   notes.forEach((frequency,index)=>{
    const osc=ctx.createOscillator(),gain=ctx.createGain(),at=start+index*.16;
    osc.type='sine';osc.frequency.value=frequency;
    gain.gain.setValueAtTime(0,at);gain.gain.linearRampToValueAtTime(.16,at+.02);gain.gain.exponentialRampToValueAtTime(.0001,at+.45);
    osc.connect(gain);gain.connect(ctx.destination);osc.start(at);osc.stop(at+.5);
   });
  };
  if(ctx.state==='running')play();else ctx.resume().then(play).catch(()=>{});
 }
 function toast(title,detail=''){
  let node=document.getElementById('lesson-cue-toast');
  if(!node){
   node=document.createElement('div');node.id='lesson-cue-toast';node.className='lesson-cue-toast';
   node.setAttribute('role','status');node.setAttribute('aria-live','polite');
   node.append(document.createElement('strong'),document.createElement('span'));
   (document.getElementById('mock-learner-shell')||document.body).append(node);
  }
  node.querySelector('strong').textContent=title;
  const line=node.querySelector('span');line.textContent=detail;line.hidden=!detail;
  node.classList.remove('is-leaving');node.hidden=false;
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>{node.classList.add('is-leaving');toastTimer=setTimeout(()=>{node.hidden=true;},400);},4200);
 }
 return {chime,toast};
})();
