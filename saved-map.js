/* Read-only map previews. Only explicit route fields enter the account cache;
   model requests, transcripts, research payloads and account tokens never do. */
(function (root) {
  'use strict';
  const PREFIX = 'worldview-saved-map-v1:';
  const id = value => /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(String(value || ''));
  const text = (value, max = 1500) => typeof value === 'string' ? value.trim().slice(0, max) : '';
  const list = value => Array.isArray(value) ? value : [];
  const strings = value => list(value).map(item => text(typeof item === 'object' ? item?.id || item?.title : item)).filter(Boolean);
  function project(value) {
    if (!value || typeof value !== 'object') return null;
    let chapters = list(value.chapters);
    if (!chapters.length) {
      const nodes = [value.nodes, value.checkpoints, value.knowledgeTree, value.linear, value.route].find(items => Array.isArray(items) && items.some(item => item && typeof item === 'object')) || [];
      const order = list(value.route).filter(item => typeof item === 'string');
      const ordered = order.length ? [...order.map(key => nodes.find(node => node.id === key)).filter(Boolean), ...nodes.filter(node => !order.includes(node.id))] : nodes;
      chapters = ordered.map(node => ({ ...node, purpose:node.whyNeeded || node.why_needed || node.purpose,
        outcomes:[{ title:'Chapter outcome', learningOutcome:node.masteryGoal || node.mastery_goal || node.mastery,
          diagnosticQuestion:node.diagnosticQuestion || node.diagnostic_question }] }));
    }
    if (!chapters.length || chapters.length > 100) return null;
    const result = chapters.map((chapter, index) => {
      const outcomes = [chapter.outcomes, chapter.learningOutcomes, chapter.learning_outcomes, chapter.checkpoints].find(Array.isArray) || [];
      if (!outcomes.length || outcomes.length > 100) return null;
      return { id:text(chapter.id || chapter.chapterId, 100) || `chapter_${index + 1}`,
        title:text(chapter.title || chapter.label || chapter.name, 300),
        purpose:text(chapter.purpose || chapter.whyNeeded || chapter.why_needed || chapter.description),
        prerequisites:strings(chapter.prerequisites || chapter.prerequisiteIds),
        outcomes:outcomes.map((outcome, n) => ({ id:text(outcome.id || outcome.outcomeId, 100) || `${index + 1}.${n + 1}`,
          title:text(outcome.title || outcome.label || outcome.name, 300),
          learningOutcome:text(outcome.learningOutcome || outcome.learning_outcome || outcome.masteryGoal || outcome.mastery_goal || outcome.mastery),
          successEvidence:text(outcome.successEvidence || outcome.success_evidence || outcome.successCriteria || outcome.success_criteria),
          diagnosticQuestion:text(outcome.diagnosticQuestion || outcome.diagnostic_question || outcome.question || outcome.probe),
          supportNeeds:strings(outcome.supportNeeds || outcome.support_needs || outcome.researchNeeds || outcome.research_needs) })) };
    });
    if (result.some(chapter => !chapter?.title || chapter.outcomes.some(outcome => !outcome.title))) return null;
    return { lessonTitle:text(value.lessonTitle || value.lesson_title || value.title, 500),
      goal:text(value.goal || value.mission || value.target), chapters:result };
  }
  function read(owner, runId) {
    if (!id(owner) || !id(runId)) return null;
    try {
      const row = JSON.parse(root.localStorage.getItem(PREFIX + owner) || '{}')[runId];
      if (!row || row.owner !== owner || row.runId !== runId || !id(row.jobId)) return null;
      const map = project(row.map);
      return map ? { owner, runId, jobId:row.jobId, savedAt:Number(row.savedAt) || 0,
        recordId:text(row.recordId,120), updatedAt:text(row.updatedAt), researchReady:row.researchReady === true, map } : null;
    } catch (_) { return null; }
  }
  function publish(owner, runId, value, meta = {}) {
    const map = project(value);
    if (!id(owner) || !id(runId) || !id(meta.jobId) || !map) return null;
    const row = { owner, runId, jobId:meta.jobId, recordId:text(meta.recordId,120), savedAt:Date.now(), updatedAt:text(meta.updatedAt), researchReady:meta.researchReady === true, map };
    try {
      const stored = JSON.parse(root.localStorage.getItem(PREFIX + owner) || '{}');
      const rows = Object.values(stored).filter(item => item?.owner === owner && id(item.runId) && item.runId !== runId);
      rows.push(row);
      root.localStorage.setItem(PREFIX + owner, JSON.stringify(Object.fromEntries(rows.sort((a,b) => b.savedAt-a.savedAt).slice(0,12).map(item => [item.runId,item]))));
    } catch (_) { /* The current read stays usable if device storage is full. */ }
    return row;
  }
  function fromDetail(detail, runId, { recordId = '', title = '' } = {}) {
    const job = detail?.job;
    if (!id(job?.id) || job.scenario?.pipelineRunId !== runId || job.component !== 'lesson'
      || !['map','map_planner'].includes(job.scenario?.pipelineStage)) throw new Error('The saved map did not match this lesson.');
    if (job.status !== 'completed') return null;
    const candidates = [];
    const samples = list(detail.samples).filter(sample => !recordId || String(sample.id || sample.clientSampleId || '') === recordId);
    if (recordId && !samples.length) throw new Error('The selected saved map could not be found.');
    for (const sample of samples) {
      if (sample.status !== 'completed') continue;
      const finish = String(sample.finishReason || sample.result?.finishReason || '').toLowerCase();
      if (['max_tokens','length','max_tokens_reached','max_tokens_stop','max_output_tokens','max_output_tokens_reached','pause_turn'].includes(finish)) continue;
      const outputTokens = Number(sample.outputTokens ?? sample.result?.outputTokens);
      const maxTokens = Number(sample.request?.maxTokens ?? sample.request?.max_tokens);
      if (!finish && maxTokens > 0 && outputTokens >= maxTokens - Math.max(8,Math.round(maxTokens * .01))) continue;
      const raw = sample.result?.text ?? sample.text ?? sample.resultText;
      const rawText = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.map(part => typeof part === 'string' ? part : part?.text || '').join('') : list(raw?.content).map(part => part?.text || '').join('');
      try {
        const map = project(JSON.parse(rawText.trim().replace(/^```(?:json)?\s*/i,'').replace(/\s*```$/,'')));
        if (map && job.scenario.pipelineStage === 'map_planner') {
          const keys = new Set(), outcomes = new Set();
          const key = value => String(value).toLowerCase().replace(/\s+/g,'_');
          let valid = map.chapters.length <= 18;
          for (const chapter of map.chapters) {
            if (keys.has(key(chapter.id)) || chapter.prerequisites.some(value => !keys.has(key(value)))) valid = false;
            keys.add(key(chapter.id));
            for (const outcome of chapter.outcomes) {
              if (outcomes.has(key(outcome.id)) || !outcome.supportNeeds.length) valid = false;
              outcomes.add(key(outcome.id));
            }
          }
          if (!valid || outcomes.size > 18) continue;
        }
        if (map) candidates.push({ map, jobId:job.id, recordId:text(sample.id || sample.clientSampleId,120), updatedAt:job.updatedAt || job.finishedAt || job.createdAt || '', researchReady:false });
      } catch (_) { /* An unfinished response must never become a fake tree. */ }
    }
    if (candidates.length < 2) return candidates[0] || null;
    const matching = candidates.filter(item => item.map.lessonTitle === title);
    if (matching.length === 1) return matching[0];
    throw new Error('This lesson has more than one saved map. Open its chosen map from the lesson once to save the selection here.');
  }
  async function load(runId, request, { jobId = '', recordId = '', recordJobId = '', title = '' } = {}) {
    if (!id(runId)) throw new Error('Choose a saved lesson first.');
    if (id(jobId)) return fromDetail(await request({ action:'get', jobId }), runId, {recordId,title});
    let cursor = null;
    for (let page = 0; page < 100; page += 1) {
      const payload = await request({ action:'list', ...(cursor ? { cursor } : {}) });
      const job = list(payload.jobs).find(item => item?.scenario?.pipelineRunId === runId && item.component === 'lesson' && ['map','map_planner'].includes(item.scenario?.pipelineStage));
      if (job) return fromDetail(await request({ action:'get', jobId:job.id }), runId, {recordId:job.id === recordJobId ? recordId : '',title});
      cursor = payload.nextCursor;
      if (!cursor) return null;
    }
    throw new Error('This map could not be found in the saved history.');
  }
  root.WorldviewSavedMap = { prefix:PREFIX, project, read, publish, fromDetail, load };
})(window);
