/* NAV-126: the lesson journey strip and the lesson-start moment.
   Four quiet steps (your question, preparing, lesson, teach-back) are visible
   from the first second, so a learner always knows where they are. The chapter
   banner still appears only once teaching starts, and that moment is marked:
   "Your lesson has begun". Reads lab.js state; writes nothing but the DOM. */
window.WorldviewJourneyStrip=(()=>{
 'use strict';
 const STEPS=['Your question','Preparing','Lesson','Teach-back'];
 let lastKey='';
 function position(stage){
  if(stage==='clarification')return 0;
  if(stage==='map'||stage==='extraction')return 1;
  if(stage==='lesson')return 2;
  if(stage==='quiz')return 3;
  return -1;
 }
 function caption(stage,selection,done){
  if(done)return 'Lesson complete';
  if(stage==='clarification')return 'Getting to know your question';
  if(stage==='map'||stage==='extraction'){
   let research=null;try{research=liveResearchState(selection,'extraction');}catch{}
   if(research?.total&&research.state!=='ready')return 'Preparing your lesson · '+research.verified+' of '+research.total+' parts researched';
   return research?.state==='ready'?'Your lesson is ready':'Preparing your lesson';
  }
  if(stage==='quiz')return 'Final teach-back · explain it in your own words';
  return '';
 }
 function render(selection,stage){
  const root=document.getElementById('mock-learner-journey');if(!root)return;
  let journey=null;try{journey=mockLearnerLiveJourney(selection);}catch{}
  const done=journey?.complete===true||(stage==='quiz'&&labState?.quiz?.status==='complete');
  const at=done?4:position(stage);
  root.hidden=at<0;
  if(at<0){root.replaceChildren();lastKey='';return;}
  const text=caption(stage,selection,done);
  const key=JSON.stringify([at,text]);if(key===lastKey)return;lastKey=key;
  const list=document.createElement('ol');list.className='journey-steps';
  STEPS.forEach((label,index)=>{
   const item=document.createElement('li');
   item.className=index<at?'is-done':index===at?'is-now':'';
   if(index===at)item.setAttribute('aria-current','step');
   const name=document.createElement('span');name.className='sr-only';name.textContent=label+(index<at?' (done)':index===at?' (now)':'');
   item.append(name);list.append(item);
  });
  const line=document.createElement('p');line.className='journey-caption';line.textContent=text;line.hidden=!text;
  root.setAttribute('aria-label','Lesson progress: '+(done?'complete':STEPS[at]));
  root.replaceChildren(list,line);
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
