import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped closure without a browser, provider call or saved lesson.
const source=readFileSync(new URL('../lab/live-conversation.js',import.meta.url),'utf8');
const start=source.indexOf(" let reviewedChapter='';");
const end=source.indexOf(' function schedulePhaseOpening(state){',start);
assert(start>=0&&end>start,'the actual phase opener must be available');
function harness(study){
 const runtime=vm.createContext({study});
 vm.runInContext(source.slice(start,end),runtime);
 return {open:fresh=>runtime.phaseOpeningInstruction(fresh),set:next=>{runtime.study=next;}};
}
const lesson=(currentIndex=0,chapter='River pumps')=>({phase:'lesson',currentIndex,complete:false,packet:{journeyContext:{chapter:{title:chapter}}}});
function assertReasoningCue(text){
 assert.match(text,/only the saved current outcome/);
 assert.match(text,/setting or prerequisites from currentOutcome\.verifiedSupport/);
 assert.match(text,/when its status is verified; otherwise do not teach it/);
 assert.match(text,/stuck or ask for an explanation, explain the relationship directly/);
 assert.match(text,/ONE short concrete prediction or application question that follows their reasoning/);
 assert.match(text,/changed condition must be clearly hypothetical/);
 assert.match(text,/Avoid leading questions, answer recitation and re-testing demonstrated ideas/);
 assert.match(text,/without demanding proof after each explanation; use their overall demonstrated understanding/);
 assert.match(text,/Hearing or echoing your words alone is not mastery/);
 assert.match(text,/Deeper independent explanation belongs in the chapter recap/);
 assert.match(text,/Only the application advances or records understanding/);
 assert.match(text,/useful explanation need not end in a question/);
 assert.match(text,/Then listen\.$/);
 assert.doesNotMatch(text,/Do not explain the idea first|work out its first step/);
}

test('fresh lesson supplies needed verified context before meaningful reasoning',()=>{
 const text=harness(lesson()).open(true);
 assertReasoningCue(text);
 assert.match(text,/The researched lesson begins now/);
 assert.match(text,/name the first chapter, "River pumps"/);
 assert.match(text,/no greeting, repeated question, or readiness offer/);
 assert.match(text,/Do not offer the quiz before its saved phase/);
});

test('later part follows the learner without restarting the lesson',()=>{
 const text=harness(lesson(1)).open(false);
 assertReasoningCue(text);
 assert.match(text,/bridge briefly from what the learner said last/);
 assert.doesNotMatch(text,/The researched lesson begins now/);
});

test('chapter recap precedes a supported next-chapter opener exactly once',()=>{
 const reviewing=lesson();reviewing.packet.chapterReview={chapterTitle:'River pumps'};
 const h=harness(reviewing),recap=h.open(false);
 assert.match(recap,/CHAPTER REVIEW/);
 assert.match(recap,/recap in their own words/);
 assert.match(recap,/Do not open the next part/);
 assert.doesNotMatch(recap,/concrete prediction or application/);
 h.set(lesson(1,'Turbines'));
 const next=h.open(false);
 assertReasoningCue(next);
 assert.match(next,/The chapter review is done/);
 assert.match(next,/next chapter, "Turbines", begins now/);
 assert.doesNotMatch(h.open(false),/The chapter review is done/,'the recap bridge is consumed');
});

test('quiz continues the saved teach-back without importing lesson teaching cues',()=>{
 const h=harness({phase:'quiz',currentIndex:0,complete:false,packet:{}});
 assert.match(h.open(true),/final teach-back starts now/);
 h.set({phase:'quiz',currentIndex:1,complete:false,packet:{}});
 const text=h.open(false);
 assert.match(text,/Continue the final teach-back/);
 assert.match(text,/one plain-language application question for the saved current outcome/);
 assert.match(text,/Do not announce completion or offer to restart/);
 assert.doesNotMatch(text,/explain the relationship directly|Supply only needed setting/);
});

test('saved completion finishes once without another question',()=>{
 const text=harness({phase:'complete',currentIndex:0,complete:true,packet:{}}).open(false);
 assert.match(text,/acknowledge the finish once, then stop/);
 assert.match(text,/Ask no question and do not begin another quiz/);
 assert.doesNotMatch(text,/concrete prediction or application/);
});
