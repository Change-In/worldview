(function(root){
"use strict";
function liveUsage(previous,event){
  const seconds=event?.usage?.seconds;
  if(typeof seconds!=="number"||!Number.isFinite(seconds)||seconds<0)return previous;
  return {seconds:Math.max(previous.seconds||0,seconds),final:event.type==="session.closed",usd:Math.max(previous.seconds||0,seconds)/60*.05};
}
root.WorldviewLiveTrial={liveUsage};
if(!root.document)return;
const $=id=>document.getElementById(id);
const endpoint="https://eqppapoepynjvsfnoodj.supabase.co/functions/v1/live-trial";
const publishable="sb_publishable_rfg0gznLhbAW07TlC4U6WQ_i8WqA3PT";
let client,owner="",token="",verified=false,active=null,epoch=0;
const status=text=>{$("status").textContent=text;};
function buttons(){ $("start").disabled=!verified||!!active||!$("consent").checked||!$("topic").value.trim();$("stop").disabled=!active; }
async function request(body,bearer=token){
  const response=await fetch(endpoint,{method:"POST",headers:{apikey:publishable,Authorization:`Bearer ${bearer}`,"content-type":"application/json"},body:JSON.stringify(body),signal:AbortSignal.timeout(40000)});
  let result;try{result=await response.json();}catch{throw Error("The voice test backend is not ready.");}
  if(!response.ok)throw Error(result.error?.message||"The voice test backend is not ready.");return result;
}
function remember(state){
  if(!state.owner)return;
  try{
    const key="worldview-live-trial-usage-v1:"+state.owner;
    let rows=JSON.parse(localStorage.getItem(key)||"[]");if(!Array.isArray(rows))rows=[];
    rows=rows.filter(row=>row?.requestId!==state.id);
    rows.push({requestId:state.id,at:state.at,seconds:state.usage.seconds,final:state.usage.final,voiceUSD:state.usage.usd,localElapsedSeconds:Math.max(0,(performance.now()-state.startedAt)/1000)});
    localStorage.setItem(key,JSON.stringify(rows.slice(-100)));
  }catch{/* storage optional */}
}
function display(state){
  if(active!==state)return;
  const seconds=state.usage.seconds;
  $("usage").textContent=`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,"0")} · $${state.usage.usd.toFixed(3)}`;
  $("usage-note").textContent=state.usage.final?"Final provider voice duration received. Voice estimate; provider billing is authoritative.":state.ready?"Latest provider duration; updates are cumulative. Final usage is not yet confirmed.":"Connecting. A failed start may incur the 15-second initialization charge.";
}
function cleanup(state){
  clearTimeout(state.limit);clearTimeout(state.startup);clearTimeout(state.closeTimer);
  state.mic?.getTracks().forEach(track=>track.stop());
  state.channel?.close();state.peer?.close();
  remember(state);
  if(active===state){active=null;$("audio").srcObject=null;$("consent").checked=false;buttons();}
}
function finish(state,message){if(active!==state)return;display(state);status(message);cleanup(state);}
async function stop(){
  const state=active;if(!state)return;
  if(state.closing){if(state.dispatched)void request({action:"close",requestId:state.id},state.token).catch(()=>{});return;}
  state.closing=true;state.mic?.getTracks().forEach(track=>track.stop());status("Ending the test and collecting final usage…");
  if(state.ready&&state.channel?.readyState==="open")state.channel.send(JSON.stringify({type:"session.close"}));
  if(state.dispatched)void request({action:"close",requestId:state.id},state.token).catch(()=>{});
  state.closeTimer=setTimeout(()=>finish(state,"Test disconnected. Final usage could not be confirmed; the server shutdown is also requested."),15000);
  if(!state.dispatched&&!state.ready)finish(state,"Test cancelled before creating a paid session.");
}
function onEvent(state,event){
  if(active!==state)return;
  if(event.type==="session.started"){
    state.ready=true;clearTimeout(state.startup);
    if(state.closing){void stop();state.channel.send(JSON.stringify({type:"session.close"}));return;}
    status("Connected. You can speak, pause, or interrupt. The test ends automatically after 90 seconds.");display(state);
  }else if(event.type==="session.usage.updated"||event.type==="session.closed"){
    state.usage=liveUsage(state.usage,event);display(state);remember(state);
    if(event.type==="session.closed")finish(state,state.usage.final?"Test ended. Final voice usage received.":"Test ended; final voice usage was not supplied.");
  }else if(event.type==="session.input_transcript.delta"||event.type==="session.output_transcript.delta"){
    const who=event.type==="session.input_transcript.delta"?"You":"Worldview";
    const text=typeof event.delta==="string"?event.delta:"";
    state.transcript=(state.transcript+(state.lastSpeaker===who?"":"\n\n"+who+": ")+text).slice(-18000);state.lastSpeaker=who;
    $("transcript").textContent=state.transcript;
  }else if(event.type==="session.delegation.created"&&!state.closing){
    const id=event.delegation?.id;if(typeof id!=="string"||state.delegations.has(id))return;
    state.delegations.add(id);$("delegations").textContent="Application handoffs received: "+state.delegations.size;
    state.channel.send(JSON.stringify({type:"session.commentary.append",delegation_id:id,content:"This is a standalone voice test. It cannot research facts, change models, or start or modify a saved lesson. Return to Worldview for the normal lesson flow. No external action was performed."}));
  }else if(event.type==="error"){status("GPT-Live reported an error. Ending this test; no automatic restart.");void stop();}
}
async function start(){
  if(!verified||active||!$("consent").checked||!$("topic").value.trim()||document.hidden)return;
  const state={id:crypto.randomUUID(),owner,token,epoch,at:new Date().toISOString(),startedAt:performance.now(),ready:false,closing:false,dispatched:false,usage:{seconds:0,usd:0,final:false},delegations:new Set(),transcript:""};active=state;buttons();status("Requesting microphone access…");
  $("transcript").textContent="";$("delegations").textContent="Application handoffs received: 0";display(state);
  state.startup=setTimeout(()=>{if(active===state){status("Startup timed out.");void stop();}},45000);
  try{
    if(!navigator.mediaDevices?.getUserMedia||!root.RTCPeerConnection)throw Error("This browser does not support the voice test.");
    const mic=await navigator.mediaDevices.getUserMedia({audio:true});
    if(active!==state||state.closing||state.epoch!==epoch){mic.getTracks().forEach(track=>track.stop());return;}
    state.mic=mic;const peer=state.peer=new RTCPeerConnection();
    for(const track of mic.getAudioTracks()){peer.addTrack(track,mic);track.addEventListener("ended",()=>{if(active===state&&!state.closing)void stop();});}
    peer.addEventListener("track",event=>{if(active!==state)return;$("audio").srcObject=new MediaStream([event.track]);$("audio").play().catch(()=>status("Use Play on the audio control to hear the AI."));});
    peer.addEventListener("connectionstatechange",()=>{if(active===state&&["failed","closed"].includes(peer.connectionState)&&!state.closing)void stop();});
    const channel=state.channel=peer.createDataChannel("oai-events");
    channel.addEventListener("message",event=>{try{onEvent(state,JSON.parse(event.data));}catch{status("An unreadable event arrived; ending the test.");void stop();}});
    channel.addEventListener("close",()=>{if(active===state&&!state.closing){state.closing=true;void request({action:"close",requestId:state.id},state.token).catch(()=>{});finish(state,"Connection lost. Final usage is unconfirmed; no automatic restart.");}});
    await peer.setLocalDescription(await peer.createOffer());
    if(peer.iceGatheringState!=="complete")await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{peer.removeEventListener("icegatheringstatechange",check);reject(Error("Connection setup timed out."));},10000);
      function check(){if(peer.iceGatheringState==="complete"){clearTimeout(timer);peer.removeEventListener("icegatheringstatechange",check);resolve();}}
      peer.addEventListener("icegatheringstatechange",check);check();
    });
    if(active!==state||state.closing||state.epoch!==epoch)return;
    state.dispatched=true;state.limit=setTimeout(()=>{if(active===state)void stop();},90000);
    const result=await request({action:"create",requestId:state.id,consent:"paid-90-second-gpt-live-1-test",topic:$("topic").value.trim(),sdp:peer.localDescription.sdp},state.token);
    if(active!==state||state.closing||state.epoch!==epoch){void request({action:"close",requestId:state.id},state.token).catch(()=>{});return;}
    await peer.setRemoteDescription({type:"answer",sdp:result.transport.sdp});
  }catch(error){if(active===state){if(state.dispatched)void request({action:"close",requestId:state.id},state.token).catch(()=>{});finish(state,error.message||"Test startup failed. No automatic retry was made.");}}
}
$("start").addEventListener("click",()=>void start());$("stop").addEventListener("click",()=>void stop());
$("consent").addEventListener("change",buttons);$("topic").addEventListener("input",buttons);
document.addEventListener("visibilitychange",()=>{if(document.hidden)void stop();});root.addEventListener("pagehide",()=>{void stop();if(active)cleanup(active);});
async function authenticate(session){
  const next=++epoch;verified=false;buttons();
  if(active&&session?.user?.id!==owner)await stop();
  owner=session?.user?.id||"";token=session?.access_token||"";
  if(!owner){status("Sign in to your owner account in Worldview, then return here. No microphone or paid session has started.");return;}
  try{await request({action:"check"});if(next!==epoch)return;verified=true;status("Owner access checked. Choose a topic and tick the paid-test box when you want to start.");}
  catch(error){if(next===epoch)status(error.message+" No microphone or paid session has started.");}
  buttons();
}
async function boot(){
  try{
    client=root.supabase.createClient("https://eqppapoepynjvsfnoodj.supabase.co",publishable,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false,storageKey:"worldview-alpha-auth"}});
    client.auth.onAuthStateChange((event,session)=>{if(event!=="INITIAL_SESSION")setTimeout(()=>void authenticate(session),0);});
    const result=await client.auth.getSession();await authenticate(result.data.session);
  }catch{status("The account connection did not load. Reload when online; no paid session has started.");}
}
void boot();
})(typeof window==="undefined"?globalThis:window);
