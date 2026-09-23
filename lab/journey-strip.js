/* NAV-126: the lesson journey strip and the lesson-start moment.
   Four quiet steps (your question, preparing, lesson, teach-back) are visible
   from the first second, so a learner always knows where they are. The chapter
   banner still appears only once teaching starts, and that moment is marked:
   "Your lesson has begun". Reads lab.js state; writes nothing but the DOM. */
window.WorldviewJourneyStrip=(()=>{
 'use strict';
 const STEPS=['Your question','Preparing','Lesson','Teach-back'];
 let lastKey='',startBusy=false;
 function position(stage){
  if(stage==='clarification')return 0;
  if(stage==='map'||stage==='extraction')return 1;
  if(stage==='lesson')return 2;
  if(stage==='quiz')return 3;
  return -1;
 }
 function caption(stage,selection,done,held=false){
  if(done)return 'Lesson complete';
  if(stage==='clarification')return 'Getting to know your question';
  if(stage==='map'||stage==='extraction'){
   let research=null;try{research=liveResearchState(selection,'extraction');}catch{}
   const tail=held?' · starts when ready':'';
   if(research?.total&&research.state!=='ready')return 'Preparing your lesson · '+research.verified+' of '+research.total+' parts researched'+tail;
   return research?.state==='ready'?'Your lesson is ready':'Preparing your lesson'+tail;
  }
  if(stage==='quiz')return 'Final teach-back · explain it in your own words';
  return '';
 }
 /* VOI-141. In a voice lesson the learner decides when it starts. One tap in
    "Your question" is consent to begin with what they have said so far, and
    the lesson opens by itself as soon as its first part is researched. While
    it is being prepared, the caption opens the lesson map so the learner can
    watch it being built. */
 function startLabel(stage,journey){
  let live=false;try{live=liveLessonSelected(stage);}catch{}
  if(!live||!journey)return '';
  if(stage==='clarification'){
   let topic='',placeholder='';try{topic=labState.clarification.topic||'';placeholder=VOICE_TOPIC_PLACEHOLDER;}catch{}
   const spoke=(journey.fragments||[]).some(f=>f.role==='user'&&String(f.delta||'').trim());
   return spoke||(topic&&topic!==placeholder)?'Start my lesson':'';
  }
  if(stage==='extraction'&&journey.packet?.conversationState?.approvalSaved!==true)return 'Start when ready';
  return '';
 }
 function mapReady(stage){
  if(stage!=='extraction'&&stage!=='map')return false;
  try{return !!mockLearnerMapState(stage,selectedPipelineArtifact())&&!labState.extraction.mapRetryBusy;}catch{return false;}
 }
 function refresh(){lastKey='';try{renderMockLearnerShell();}catch{}}
 function start(){
  const live=window.WorldviewLiveConversation;if(startBusy||!live?.startLesson)return;
  startBusy=true;refresh();
  void live.startLesson().finally(()=>{startBusy=false;refresh();});
 }
 function render(selection,stage){
  const root=document.getElementById('mock-learner-journey');if(!root)return;
  let journey=null;try{journey=mockLearnerLiveJourney(selection);}catch{}
  const done=journey?.complete===true||(stage==='quiz'&&labState?.quiz?.status==='complete');
  const at=done?4:position(stage);
  root.hidden=at<0;
  if(at<0){root.replaceChildren();lastKey='';return;}
  const held=journey?.packet?.conversationState?.approvalSaved===true;
  const text=caption(stage,selection,done,held),label=done?'':startLabel(stage,journey),map=!done&&mapReady(stage);
  const key=JSON.stringify([at,text,label,startBusy,map]);if(key===lastKey)return;lastKey=key;
  const list=document.createElement('ol');list.className='journey-steps';
  STEPS.forEach((label,index)=>{
   const item=document.createElement('li');
   item.className=index<at?'is-done':index===at?'is-now':'';
   if(index===at)item.setAttribute('aria-current','step');
   const name=document.createElement('span');name.className='sr-only';name.textContent=label+(index<at?' (done)':index===at?' (now)':'');
   item.append(name);list.append(item);
  });
  const row=document.createElement('div');row.className='journey-row';
  const line=document.createElement(map?'button':'p');line.className='journey-caption'+(map?' is-link':'');line.textContent=text;line.hidden=!text;
  if(map){line.type='button';line.setAttribute('aria-label',text+'. Open your lesson map.');line.append(' ›');line.onclick=()=>{try{openPipelineExtractionMapDialog();}catch{}};}
  row.append(line);
  if(label){const button=document.createElement('button');button.type='button';button.className='journey-start';button.textContent=startBusy?'Starting…':label;button.disabled=startBusy;button.onclick=start;row.append(button);}
  root.setAttribute('aria-label','Lesson progress: '+(done?'complete':STEPS[at]));
  root.replaceChildren(list,row);
 }
 /* Called by lab.js when the saved stage actually moves during this visit.
    Restoring a saved lesson straight into its current stage is not a moment. */
 function stageChanged(previous,next,{voice=false}={}){
  if(previous===next)return;
  let chapter='';
  try{
   const selection=selectedPipelineMapRecord(selectedPipelineArtifact());
   const outcome=mockLearnerCurrentOutcome(selection,next);
   const chapters=selection?.map?.chapters||[];
   const index=Number.isInteger(outcome?.chapterIndex)?outcome.chapterIndex:0;
   if(chapters[index])chapter='Chapter '+(index+1)+': '+chapters[index].title;
  }catch{}
  const cue=previous==='extraction'&&next==='lesson'?['Your lesson has begun',chapter]
   :previous==='lesson'&&next==='quiz'?['Final teach-back','Explain what you learned in your own words']
   :null;
  if(!cue)return;
  window.WorldviewLessonCues?.toast(cue[0],cue[1]);
  // Voice lessons chime when the new part actually starts speaking.
  if(!voice)window.WorldviewLessonCues?.chime('begin');
 }
 return {render,stageChanged};
})();
