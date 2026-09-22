/* One account/run ledger for the lesson's visible estimate. Never stores speech or credentials. */
(function(root){
 'use strict';
 const PREFIX='worldview-lesson-cost-v1:',memory=new Map(),unsaved=new Set();
 const amount=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0?value:null;
 const keyFor=(owner,runId)=>owner&&runId?PREFIX+encodeURIComponent(owner)+':'+encodeURIComponent(runId):'';
 function read(owner,runId){
  const key=keyFor(owner,runId);if(!key)return {entries:{}};
  if(unsaved.has(key)&&memory.has(key))return memory.get(key);
  try{const value=JSON.parse(root.localStorage.getItem(key)||'null');if(value?.version===1&&value.entries&&typeof value.entries==='object')return value;}catch{}
  return memory.get(key)||{version:1,entries:{}};
 }
 function report(owner,runId,id,value){
  const key=keyFor(owner,runId);if(!key||!id)return summary(owner,runId);
  const ledger=read(owner,runId),old=ledger.entries[id];
  const next={usd:amount(value.usd),partial:!!value.partial,model:String(value.model||'').slice(0,100),final:!!value.final};
  if(old&&amount(old.usd)!==null&&(next.usd===null||value.atLeast&&next.usd<old.usd)){next.usd=old.usd;next.partial=true;}
  // Final provider usage can correct the running clock estimate. Late
  // provisional events must never replace the final value for that session.
  if(old?.final&&!next.final)return summary(owner,runId);
  if(JSON.stringify(old)===JSON.stringify(next))return summary(owner,runId);
  ledger.entries[id]=next;memory.set(key,ledger);
  try{root.localStorage.setItem(key,JSON.stringify(ledger));unsaved.delete(key);}catch{unsaved.add(key);}
  root.dispatchEvent?.(new root.CustomEvent('worldview-lesson-cost-updated',{detail:{owner,runId}}));
  return summary(owner,runId);
 }
 function summary(owner,runId){
  const values=Object.values(read(owner,runId).entries);let usd=0,known=0,unknown=0;
  for(const value of values){if(amount(value?.usd)===null)unknown++;else{usd+=value.usd;known++;}if(value?.partial)unknown++;}
  return {usd,known,unknown,partial:true,saved:!unsaved.has(keyFor(owner,runId))};
 }
 function format(value){return value?.known?`Est. total $${value.usd.toFixed(3)}`:'Est. total —';}
 function describe(value){return (value?.saved===false?'Device saving is unavailable; this estimate may be lost when the page closes. ':'')+'Estimate from usage recorded on this device, including resumed sessions, recorded lesson preparation and its web searches at their list rate. '+(value?.unknown?'Some usage or charges are unavailable. ':'Earlier sessions, other devices and unreported charges may be missing. ')+'Provider billing is authoritative.';}
 function geminiUsage(metadata){
  if(!metadata||typeof metadata!=='object')return {usd:null,partial:true};
  let usd=0,known=false,partial=false;
  for(const [field,totalField,rates] of [['promptTokensDetails','promptTokenCount',{TEXT:.75,AUDIO:3}],['responseTokensDetails','responseTokenCount',{TEXT:4.5,AUDIO:12}]]){
   const details=metadata[field];let accounted=0;
   if(!Array.isArray(details)){if(amount(metadata[totalField])!==0)partial=true;continue;}
   for(const detail of details){const count=amount(detail?.tokenCount),rate=rates[detail?.modality];if(count===null||rate===undefined){partial=true;continue;}usd+=count*rate/1e6;accounted+=count;known=true;}
   if(amount(metadata[totalField])!==null&&metadata[totalField]>accounted)partial=true;
  }
  const thoughts=amount(metadata.thoughtsTokenCount);if(thoughts!==null){usd+=thoughts*4.5/1e6;known=true;}
  // Missing modality data is unknown rather than pricing every token as text.
  return {usd:known?usd:null,partial};
 }
 /* Minutes spent talking in a lesson, per voice session so a repeated update
    never counts twice. Shown on lesson cards in place of a dollar estimate. */
 const TALK='worldview-talk-time-v1:';
 const talkKey=(owner,runId)=>owner&&runId?TALK+encodeURIComponent(owner)+':'+encodeURIComponent(runId):'';
 function readTalk(key){try{const v=JSON.parse(root.localStorage.getItem(key)||'null');return v&&typeof v.sessions==='object'?v:{sessions:{}};}catch{return {sessions:{}};}}
 function recordTalk(owner,runId,sessionId,seconds){
  const key=talkKey(owner,runId);if(!key||!sessionId||!(seconds>=0))return;
  const value=readTalk(key);if((value.sessions[sessionId]||0)>=seconds)return;
  value.sessions[sessionId]=Math.round(seconds);
  try{root.localStorage.setItem(key,JSON.stringify(value));}catch{}
 }
 function talk(owner,runId){const key=talkKey(owner,runId);if(!key)return 0;return Object.values(readTalk(key).sessions).reduce((n,v)=>n+(Number(v)||0),0);}
 root.WorldviewLessonCost={report,summary,format,describe,geminiUsage,recordTalk,talk,prefix:PREFIX};
})(typeof window!=='undefined'?window:globalThis);
