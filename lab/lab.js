"use strict";

/*
  Worldview owner lab. This page intentionally has no client-side provider
  credential, no arbitrary endpoint, and no write path to the learner app.
  Its network routes are existing tester-gated functions; durable text work uses
  lab-jobs while transcription and speech remain foreground-only. The production cold tutor prompt is declared verbatim above in
  index.html so the prompt-integrity test can compare it byte-for-byte.
*/

const LAB_PREVIEW = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get("preview") === "1";
const LAB_SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

/*
  Model catalogue. The server deliberately does NOT allow-list model ids (see
  supabase/functions/lab-tutor/index.ts MODEL_SHAPE): it only checks that the id
  looks like a model identifier. That is on purpose â€” the whole point of this lab
  is trying a model the day it ships. So this list is a convenience menu, not a
  boundary, and every lane also offers LAB_CUSTOM_MODEL to type an exact id.
  If a listed id ever 404s at the provider, type the corrected id instead of
  waiting for a deploy.
*/
const LAB_CUSTOM_MODEL = "__custom__";

const LAB_PROVIDER_CATALOG = {
  anthropic: {
    label: "Claude",
    models: [
      { id: "claude-opus-5", label: "Opus 5 Â· current flagship" },
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-5", label: "Sonnet 5" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5 Â· cheapest" },
      { id: "claude-fable-5", label: "Fable 5 Â· most capable, priciest" },
    ],
  },
  google: {
    label: "Gemini",
    models: [
      { id: "gemini-3.1-pro-preview", label: "3.1 Pro Â· current Pro tier" },
      { id: "gemini-3.6-flash", label: "3.6 Flash Â· newest Flash" },
      { id: "gemini-3.5-flash", label: "3.5 Flash" },
      { id: "gemini-3.5-flash-lite", label: "3.5 Flash-Lite" },
      { id: "gemini-2.5-pro", label: "2.5 Pro Â· previous generation" },
      { id: "gemini-2.5-flash", label: "2.5 Flash Â· previous generation" },
    ],
  },
  openai: {
    label: "ChatGPT",
    models: [
      { id: "gpt-5.6-luna", label: "GPT 5.6 Luna Â· tutor" },
      { id: "gpt-5.6-terra", label: "GPT 5.6 Terra Â· lesson map" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  xai: {
    label: "Grok",
    models: [
      { id: "grok-4-5", label: "Grok 4.5 Â· current flagship" },
      { id: "grok-4-3", label: "Grok 4.3" },
      { id: "grok-4-1-fast", label: "Grok 4.1 Fast Â· cheapest" },
      { id: "grok-3-mini", label: "Grok 3 mini Â· previous generation" },
    ],
  },
};

const LAB_STT_MODELS = [
  { id: "deepgram-nova-3", label: "Deepgram Nova-3", provider: "Deepgram", note: "Fast speech-to-text route" },
  { id: "xai-stt", label: "xAI STT", provider: "xAI", note: "Existing xAI transcription route" },
  { id: "openai-gpt-4o-transcribe", label: "GPT-4o Transcribe", provider: "OpenAI", note: "Existing OpenAI transcription route" },
];

/*
  Published list prices in US dollars per million tokens, entered by hand.
  These drive an ESTIMATE only â€” the provider invoice is authoritative. Long
  context windows, cached input, priority tiers, and tool calls are all billed
  differently and are not modelled here. Anthropic/Gemini/Grok rows were checked
  on the date below; re-check them whenever a model is added.
*/
const LAB_RATES_CHECKED = "2026-08-05";
const LAB_SONNET_PROMO_END = Date.UTC(2026, 8, 1);
const LAB_MODEL_RATES = {
  "claude-fable-5": { input: 10, output: 50 },
  "claude-opus-5": { input: 5, output: 25 },
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": Date.now() < LAB_SONNET_PROMO_END ? { input: 2, output: 10 } : { input: 3, output: 15 },
  "claude-sonnet-4-6": { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gemini-3.1-pro-preview": { input: 2, output: 12 },
  "gemini-3.6-flash": { input: 1.5, output: 7.5 },
  "gemini-3.5-flash": { input: 1.5, output: 9 },
  "gemini-3.5-flash-lite": { input: 0.3, output: 2.5 },
  "gemini-2.5-pro": { input: 1.25, output: 10 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gpt-5.6-luna": { input: 2, output: 8 },
  "gpt-5.6-terra": { input: 2, output: 8 },
  "gpt-4.1": { input: 2, output: 8 },
  "gpt-4.1-mini": { input: 0.4, output: 1.6 },
  "grok-4-5": { input: 2, output: 6 },
  "grok-4-3": { input: 1.25, output: 2.5 },
  "grok-4-1-fast": { input: 0.2, output: 0.5 },
  "grok-3-mini": { input: 0.3, output: 0.5 },
};

/* Rough pre-flight sizing. ~4 characters per token is the usual English
   approximation; it is deliberately labelled an estimate everywhere it shows. */
const LAB_CHARS_PER_TOKEN = 4;

const LAB_PROMPT_LIMITS = { lesson: 12000, tutor: 40000, brain: 12000 };
const LAB_WORKSPACE_KEY = "worldview-owner-lab-workspace-v1";
const LAB_WORKSPACE_SCHEMA = 3;
const LAB_ACCOUNT_STATE_PREFIX = "worldview-account-state-v1:";
const LAB_PREVIEW_WORKSPACE_OWNER = "preview";
const LAB_MAX_CUSTOM_PROMPTS_PER_BENCH = 8;
const LAB_MAX_COMPARISONS = 60;
const LAB_MAX_TOPICS_PER_RUN = 4;
const LAB_MAX_COMPARISON_NOTE = 1200;
const LAB_MAX_BENCHMARK_SCENARIOS = 8;
const LAB_MAX_LATENCY_METRICS = 240;
const LAB_MAX_PENDING_CREATES = 4;
const LAB_LESSON_HANDOFF_KEY = "worldview-lab-lesson-handoff-v1";
const LAB_ACTIVE_JOB_STATES = new Set(["queued", "running", "cancelling"]);
const LESSON_MAP_OUTPUT_CONTRACT = `Return only valid JSON with this shape:
{
  "goal": "the clarified lesson goal",
  "route": ["node_id_in_learner_order"],
  "nodes": [
    {
      "id": "stable_short_id",
      "kind": "foundation | integration | goal",
      "title": "short learner-facing checkpoint title",
      "whyNeeded": "why this supports the learner's goal",
      "prerequisites": ["earlier_node_id"],
      "masteryGoal": "what the learner must explain, predict, compare, or apply",
      "diagnosticQuestion": "one question that can reveal that understanding"
    }
  ],
  "startingQuestion": "the first broad diagnostic question",
  "assumptions": ["important map assumption not established by the learner"],
  "researchNeeds": ["fresh or contested claim that should be checked before teaching"]
}
The route must contain every node exactly once in branch-completion order. Every masteryGoal must be an observable passing standard, not a topic label. Keep each node field to one concise sentence so the complete JSON fits within the output budget. Use empty arrays when no assumptions or research needs exist. Do not wrap the JSON in markdown.`;
const LAB_DEFAULT_SCENARIO = Object.freeze({
  id: "builtin:scenario:first-principles",
  name: "First-principles baseline",
  question: "Why does a metal spoon feel colder than a wooden spoon in the same room?",
  learnerAnswer: "I think metal pulls heat away from my hand faster.",
  speechText: "The same temperature can feel different when heat moves at different rates.",
  builtIn: true,
});

const LAB_PRESETS = {
  lesson: [
    {
      id: "branch-completion-map-v3",
      label: "Branch-completion knowledge map",
      text: `Build the smallest sufficient dependency graph for the learner's clarified goal. Identify the first-principle nodes, the integrating nodes they unlock, and the final target. Do not force a checkpoint count. Return a linear learner route that completes one prerequisite family and its integrating node before crossing to the next family, then converges on the shared goal. For every node, name its prerequisites, the understanding the learner must demonstrate, and one diagnostic question. Preserve all interests and constraints in the frozen Clarification artifact. This map plans the route; it does not teach or award mastery.\n\n${LESSON_MAP_OUTPUT_CONTRACT}`,
    },
    {
      id: "first-principles",
      label: "First-principles map",
      text: "Map a topic into a first-principles teaching route for an adult beginner. Identify the smallest prerequisite, then a sequence of causal questions that lets the learner build the model themselves. Explain why each step must come before the next. Be concise and avoid pretending this output controls the learner app.",
    },
    {
      id: "adversarial",
      label: "Assumption stress test",
      text: "Act as a careful learning-design critic. Given a topic, propose a short route and then stress-test it: what prerequisite could be missing, what false intuition could derail the learner, and what one question would reveal that failure. Sandbox only; no learner-state authority and no writes.",
    },
  ],
  tutor: [
    {
      id: "production-cold-core",
      label: "Production cold tutor core",
      get text() { return TUTOR_SYSTEM; },
    },
  ],
  brain: [
    {
      id: "diagnostic",
      label: "Foothold diagnostic",
      text: "You are a shadow diagnostic for an experimental learning system. Read the supplied lesson snapshot and identify only observable evidence of understanding, ambiguity, missing prerequisites, and a single next diagnostic question. Do not infer mastery from agreement. This has no authority: never prescribe a progress update, route change, or learner-state write.",
    },
    {
      id: "route-audit",
      label: "Route coherence audit",
      text: "You are auditing a lesson route in a sealed sandbox. Check whether each move depends on a demonstrated prerequisite, where the route may jump too far, and what learner evidence would justify the next checkpoint. Return observations and questions only. You have no production authority and cannot change any learner record.",
    },
  ],
};

/*
  What each bench's model actually does inside Worldview. This feeds two
  surfaces: the "What this AI does" panel on each bench, and the workshop
  briefing you paste into a fresh chat to talk your way to a new prompt.
  Keep it factual â€” the briefing is worthless if it describes a system that
  does not exist. Production behaviour referenced here is buildSystem() and the
  Gate 0A planner in app/index.html.
*/
const LAB_BENCH_ROLES = {
  lesson: {
    title: "Lesson generation (the planner)",
    oneLine: "Turns a topic into the ordered list of checkpoints a learner must pass through.",
    productionModel: "Claude Opus for the map, in the Gate 0A planning path.",
    receives: [
      "The learner's typed topic, or a source (link / PDF / image) they supplied.",
      "In production only: research findings, when the truthfulness gate decides the topic is fresh or contested rather than settled.",
    ],
    returns: [
      "A route of checkpoints, smallest sufficient graph â€” no fixed target count.",
      "Per checkpoint: an id, a title, its prerequisites, and the mastery goal the learner must demonstrate.",
      "A starting checkpoint and the first diagnostic question.",
    ],
    authority: "High but gated. The route is validated, hashed, and saved atomically â€” a partial or malformed plan is rejected whole and the previous state stays authoritative. It never teaches; the tutor does.",
    knownIssues: [
      "BUG-109: openings can start too technically instead of at intuition and first principles inside the requested topic.",
      "BUG-048: a Napoleon route omitted world context, technology, logistics, and any usable sense of scale.",
      "LES-055: the first foundation must be the first load-bearing idea in the topic, not an automatic descent into algebra or formalism.",
    ],
    labGap: "This bench sketches a route as prose. It does not run the production research gate, graph validation, checkpoint-contract build, or atomic save.",
  },
  tutor: {
    title: "Socratic tutor (the voice the learner talks to)",
    oneLine: "Runs the actual conversation, one question per reply, and reports whether the learner met the current checkpoint.",
    productionModel: "Claude Sonnet 5 by default; switchable per lesson in Models.",
    receives: [
      "The cold tutor core (the big instruction block on this bench).",
      "Saved grounding from the briefing, plus the source URL or upload when there is one.",
      "The teaching route, and a window of previous / current / next checkpoint with the current checkpoint's prerequisites and mastery goal.",
      "A compact learner-state summary and the recent conversation turns.",
      "A marker instruction: end every reply with exactly one hidden [[checkpoint:id;mastery:hold|demonstrated]].",
    ],
    returns: [
      "One short reply, usually 1â€“3 sentences, ending in exactly one question.",
      "One hidden checkpoint marker the learner never sees.",
    ],
    authority: "None over progress. The tutor proposes 'demonstrated'; the browser decides, and a client-side gate refuses to advance on agreement, one-word answers, uncertainty, or a request to be told.",
    knownIssues: [
      "BUG-108: a surface-level partial answer drew a large content dump instead of one eliciting question.",
      "BUG-082: replies that only confirm understanding, leaving the learner nothing to answer.",
      "BUG-062: advancing without evidence the learner understood.",
      "LES-049: 'just tell me' is a frustration signal, not permission to give the answer.",
    ],
    labGap: "This bench appends a read-only lesson snapshot, not the byte-exact production packet. It has no marker composition, no response gate, and no mastery authority â€” so a result here is an approximation, not a production replay.",
  },
  brain: {
    title: "Brain (proposed â€” not live)",
    oneLine: "A shadow diagnostic layer that would watch the conversation and judge understanding separately from the tutor's voice.",
    productionModel: "None. Nothing in the live app calls this.",
    receives: ["A read-only lesson snapshot and a diagnostic focus you type."],
    returns: ["Observations about evidence, ambiguity, missing prerequisites, and one next diagnostic question."],
    authority: "None whatsoever. Shadow only. It cannot write learner state, and no output here has any bearing on a real lesson.",
    knownIssues: [
      "BUG-099: on a post-cutover timeout, which component is the single mastery judge is still undecided.",
      "BUG-100: the privacy boundary for retained learner evidence is not yet settled.",
    ],
    labGap: "Everything here is exploratory. Treat any output as a sketch of a system that does not exist yet.",
  },
};

function benchRoleBriefing(kind) {
  const role = LAB_BENCH_ROLES[kind];
  if (!role) return "";
  const promptText = q(`${kind}-prompt`)?.value.trim() || "";
  const loaded = promptVersion(kind, labState.loadedPromptVersionId[kind]);
  const list = (items) => items.map(ë¾úÚÚ$z{-®éÜj×R"Â'66Væ&–ò"Â&ÆW76öâ%Òæ–æ6ÇVFW2‡F"’’Æ%7FFRæÆ7E&–Ö'•F"ÒF#°Ğ¢–b‡F"ÓÓÒ&ÆW76öâ"’Ö÷VçDÆW76öåv÷&·76R‚&ÆW76öâ"“°Ğ¢–b‡F"ÓÓÒ'—VÆ–æR"bbÆ%7FFRç—VÆ–æU7FvRÓÓÒ&Ö"’Ö÷VçDÆW76öåv÷&·76R‚'—VÆ–æR"“°Ğ¢f÷"†6öç7B'WGFöâöbFö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æÆ"×F""’’°Ğ¢6öç7B7F—fRÒ'WGFöâæFF6WBçF"ÓÓÒF#°Ğ¢'WGFöâæ6Æ74Æ—7BçFövvÆR‚&—2Ö7F—fR"Â7F—fR“°Ğ¢'WGFöâç6WDGG&–'WFR‚&&–×6VÆV7FVB"Â7G&–ær†7F—fR’“°Ğ¢ĞĞ¢f÷"†6öç7BæVÂöbFö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"çF"×æVÂ"’’°Ğ¢6öç7B7F—fRÒæVÂæFF6WBçæVÂÓÓÒF#°Ğ¢æVÂæ†–FFVâÒ7F—fS°Ğ¢æVÂæ6Æ74Æ—7BçFövvÆR‚&—2Ö7F—fR"Â7F—fR“°Ğ¢ĞĞ¢Fö7VÖVçBæ&öG’æ6Æ74Æ—7BçFövvÆR‚&6Æ&–f–6F–öâÖÆV&æW"Ö7F—fR"ÂF"ÓÓÒ'—VÆ–æR"bbÆ%7FFRç—VÆ–æU7FvRÓÓÒ&6Æ&–f–6F–öâ"bbÆ%7FFRæ6Æ&–f–6F–öâçf–WrÓÓÒ&ÆV&æW""“°Ğ¢–b‡F"ÓÓÒ'&W7VÇG2"’&VæFW$ÆFVæ7”F6†&ö&B‚“°Ğ§ĞĞ Ğ¦gVæ7F–öâ–æ—F–Æ—¦Uv÷&·76R‚’°¢‚&Æ"ÖvFR"’æ†–FFVâÒG'VS°Ğ¢‚&Æ"×6†VÆÂ"’æ†–FFVâÒfÇ6S°Ğ¢‚&Æ"Ö÷Vâ×F–Ö–ær"’æF—6&ÆVBÒfÇ6S°Ğ¢ÆöDÆö6ÄÆ–'&'’‚“°Ğ¢&W6WE&W6WB‚&ÆW76öâ"“°Ğ¢&W6WE&W6WB‚'GWF÷""“°Ğ¢&W6WE&W6WB‚&'&–â"“°Ğ¢&VæFW%7GD6†ö–6W2‚“°Ğ¢&VæFW%66Væ&–õ6VÆV7B‚“°Ğ¢ÆöE66Væ&–ôf–VÆG2‚“°Ğ¢Ç”&Væ6†Ö&µ66Væ&–ò†fÇ6R“°Ğ¢²&ÆW76öâ"Â'GWF÷""Â&'&–â%Òæf÷$V6‚‡&VæFW$ÆæW2“°Ğ¢&VæFW%&W7VÇG2‚“°Ğ¢&VæFW$6ö×&—6öäÆ–'&'’‚“°Ğ¢&VæFW$¦ö$†—7F÷'’‚“°Ğ¢&VæFW$ÆFVæ7”F6†&ö&B‚“°Ğ¢–æ—F–Æ—¦T6Æ&–f–6F–öâ‚“°Ğ¢6WE—VÆ–æU7FvR‚&6Æ&–f–6F–öâ"“°§Ğ ¦gVæ7F–öâ÷VäÖ&Wf–Wtf—‡GW&R‚’°¢–b‚Æ%7FFRç&Wf–WrÇÂæWrU$Å6V&6…&×2‡v–æF÷ræÆö6F–öâç6V&6‚’ævWB‚&f—‡GW&R"’ÓÒ&Ö"’&WGW&ã°¢6öç7B'F–f7BÒ°¢'Vä–C¢'&Wf–WrÖÖ×c“2"ÂF÷–3¢$†÷r6†ÖVÆVöç26†ævR6öÆ÷""À¢66÷U7VÖÖ'“¢%VæFW'7FæBF†R‡—6–6ÂÖV6†æ—6ÒÂF†R6–væÇ2F†B6öçG&öÂ—BÂæBv†B6öÆ÷"6†ævRFöW2f÷"6†ÖVÆVöââ"À¢66÷T—FV×3¥²&6VÆÂ7G'V7GW&R"Â&æW'f÷W26–væÇ2"Â&6öÖ×Væ–6F–öâ%ÒÀ¢G&ç67&—C¥°¢²&öÆS¢&76—7FçB"Â6öçFVçC¢%v†–6‚'Böb6†ÖVÆVöâ6öÆ÷"6†ævRFò–÷RÖ÷7BvçBFòVæFW'7FæCò"ÒÀ¢²&öÆS¢'W6W""Â6öçFVçC¢%F†RÖV6†æ—6ÒÂæBv‡’F†W’7GVÆÇ’Fò—Bâ"ÒÀ¢ÒÀ¢6ö×ÆWF–öäÖWF†öC¢'&Wf–Wrf—‡GW&R"Â7F÷&vS¢&FWf–6R"À¢Ó°¢&VÖVÖ&W$6Æ&–f–6F–öä'F–f7B†'F–f7BÂ&FWf–6R"“°¢Æ%7FFRç—VÆ–æU6VÆV7FVE'Vä–BÒ'F–f7Bç'Vä–C°¢6öç7B¦ö"Ò°¢–C¢'&Wf–WrÖÖÖ¦ö"×c“2"Â6ö×öæVçC¢&ÆW76öâ"Â7FGW3¢&6ö×ÆWFVB"Â7&VFVDC¦æ÷r‚’À¢66Væ&–ó§²—VÆ–æU'Vä–C¦'F–f7Bç'Vä–BÂ—VÆ–æU7FvS¢&Ö"ÒÀ¢Ó°¢Æ%7FFRæ¦ö'2çVç6†–gB†¦ö"“°¢6öç7BÖ¶TÖÒ‡f&–çB’Óâ¥4ôâç7G&–æv–g’‡°¢vöÃ§f&–çBÓÓÒ'&W6V&6‚"ò$W‡Æ–â†÷r7W'&VçBWf–FVæ6R6öææV7G26†ÖVÆVöâ6¶–â7G'V7GW&RFò6–væÆ–æræB6ö6–Â6öçFW‡Bâ"¢$W‡Æ–â†÷r6¶–â7G'V7GW&RæB6–væÇ2ÆWB6†ÖVÆVöâ6†ævR—G2f—6–&ÆR6öÆ÷"â"À¢&÷WFS¥²&Æ–v‡E÷7G'V7GW&R"Â'6–væÅö6öçG&öÂ"Â'W'÷6Uö–çFVw&F–öâ%ÒÀ¢æöFW3¥°¢²–C¢&Æ–v‡E÷7G'V7GW&R"Â¶–æC¢&f÷VæFF–öâ"ÂF—FÆS¢$†÷r6¶–â7G'V7GW&W26†ævR&VfÆV7FVBÆ–v‡B"Âv‡”æVVFVC¢$6öÆ÷"6†ævR&Vv–ç2v—F‚‡—6–6Â6†ævR–â&VfÆV7F—fR6VÆÇ2Âæ÷B6öÆ÷&VBÆ—V–BÖ÷f–ærF‡&÷Vv‚F†R6¶–ââ"Â&W&WV—6—FW3¥µÒÂÖ7FW'”vöÃ¢%&VF–7B†÷r6†æv–ærF†R76–æröb&VfÆV7F—fR7G'V7GW&W26†ævW2F†RvfVÆVæwF‡2F†BÆVfRF†R6¶–ââ"ÂF–væ÷7F–5VW7F–öã¢$–bF†R&VfÆV7F—fR76–ærw&÷w2Âv†B6†÷VÆB†VâFòF†R&VfÆV7FVB6öÆ÷"ÂæBv‡“ò"ÒÀ¢²–C¢'6–væÅö6öçG&öÂ"Â¶–æC¢&–çFVw&F–öâ"ÂF—FÆS¢$†÷rF†R&öG’6öçG&öÇ2F†÷6R7G'V7GW&W2"Âv‡”æVVFVC¢%F†R÷F–6ÂÖV6†æ—6ÒæVVG26öçG&öÂ6–væÂF†B6öææV7G2F†Ræ–ÖÂw27FFRFò—G26¶–ââ"Â&W&WV—6—FW3¥²&Æ–v‡E÷7G'V7GW&R%ÒÂÖ7FW'”vöÃ¢%G&6RÆW6–&ÆR6†–âg&öÒ6Vç6÷'’÷"6ö6–Â7VRFòf—6–&ÆR6¶–â6†ævRâ"ÂF–væ÷7F–5VW7F–öã¢%v†BÆ–æ·26VV–ær&—fÂFò6†ævR–âF†R&VfÆV7F—fR6VÆÇ3ò"ÒÀ¢²–C¢'W'÷6Uö–çFVw&F–öâ"Â¶–æC¢&vöÂ"ÂF—FÆS¢%v†VâæBv‡’6†ÖVÆVöç26†ævR6öÆ÷""Âv‡”æVVFVC¢$ÖV6†æ—6ÒÆöæRFöW2æ÷BW‡Æ–âF†R&V†f–÷"w2&öÆR–âFV×W&GW&RÂ6Ö÷VfÆvRÂæB6öÖ×Væ–6F–öââ"Â&W&WV—6—FW3¥²'6–væÅö6öçG&öÂ%ÒÂÖ7FW'”vöÃ¢$6ö×&RGvò6öçFW‡G2æBW‡Æ–âv‡’F†R6ÖR6öÆ÷"Ö6†ævR7—7FVÒ&öGV6W2F–ffW&VçBf—6–&ÆR÷WF6öÖW2â"ÂF–væ÷7F–5VW7F–öã¢$†÷rv÷VÆBF†RW‡V7FVB6†ævRF–ffW"&WGvVVâv&Ö–ær–â7VæÆ–v‡BæB6–væÆ–ærFò&—fÃò"ÒÀ¢ÒÀ¢7F'F–æuVW7F–öã¢%v†Bv÷VÆB†fRFò6†ævR–ç6–FRF†R6¶–âf÷"F†R&VfÆV7FVB6öÆ÷"Fò6†ævSò"À¢77V×F–öç3¥µÒÂ&W6V&6„æVVG3§f&–çBÓÓÒ'&W6V&6‚"òµÒ¢²$†÷r7G&öævÇ’V6‚gVæ7F–öâf&–W2'’7V6–W2%ÒÀ¢Ò“°¢6öç7B6×ÆW2Ò°¢²–C¢'&Wf–WrÖæò×&W6V&6‚"Â&÷f–FW#¢&çF‡&÷–2"Â&÷f–FW$Æ&VÃ¢$6ÆVFR"ÂÖöFVÃ¢&6ÆVFR×6öææWBÓR"Â7FGW3¢&6ö×ÆWFVB"Â&WVW7C§²Ö…Fö¶Vç3£#Â&W6V&6ƒ¦fÇ6RÒÂ&W7VÇC§²FW‡C¦Ö¶TÖ‚'Æ–â"’Â–çWEFö¶Vç3£3Â÷WGWEFö¶Vç3£CBÂ×3£ƒC#Â&W6V&6…&WVW7FVC¦fÇ6RÂ&W6V&6„Æ–VC¦fÇ6RÂ6V&6†W3£Â6—FF–öç3¥µÒÒÒÀ¢²–C¢'&Wf–Wr×&W6V&6†VB"Â&÷f–FW#¢&vöövÆR"Â&÷f–FW$Æ&VÃ¢$vVÖ–æ’"ÂÖöFVÃ¢&vVÖ–æ’Ó2ã×&ò×&Wf–Wr"Â7FGW3¢&6ö×ÆWFVB"Â&WVW7C§²Ö…Fö¶Vç3£#Â&W6V&6ƒ§G'VRÒÂ&W7VÇC§²FW‡C¦Ö¶TÖ‚'&W6V&6‚"’Â–çWEFö¶Vç3£C“‚Â÷WGWEFö¶Vç3£c‚Â×3£#csSÂ&W6V&6…&WVW7FVC§G'VRÂ&W6V&6„Æ–VC§G'VRÂ6V&6†W3£"Â6—FF–öç3¥·²W&Ã¢&‡GG3¢òöW†×ÆRçFW7B÷6÷W&6R"ÕÒÒÒÀ¢Ó°¢Æ%7FFRæ¦ö$FWF–Ç2ç6WB†¦ö"æ–BÂ²¦ö"Â6×ÆW2ÂGFV×G3¥µÒÒ“°¢&VæFW%—VÆ–æT'F–f7E6VÆV7B‚“°¢6WE—VÆ–æU7FvR‚&Ö"“°§Ğ ¦gVæ7F–öâ÷Vå&Wf–Wr‚’°¢Æ%7FFRçv÷&·76T÷væW$–BÒÄ%õ$Ud”Uuõtõ$µ54UôõtäU#°Ğ¢ÆöEv÷&·76R„Ä%õ$Ud”Uuõtõ$µ54UôõtäU"“°Ğ¢–æ—F–Æ—¦Uv÷&·76R‚“°Ğ¢–b‡‚&Æ"×&÷f–FW"Ö6÷VçB"’’‚&Æ"×&÷f–FW"Ö6÷VçB"’çFW‡D6öçFVçBÒ.(	B#°Ğ¢‚&Æ"Ö†VÇF‚"’çFW‡D6öçFVçBÒ%&Wf–Wr+r6ÆÇ2F—6&ÆVB#°Ğ¢‚&Æ"Ö†VÇF‚"’æ6Æ74æÖRÒ&Æ"Ö†VÇF‚—2×&VG’#°¢ÆötfÆ÷r‚$÷VæVB6fRÆö6Â&Wf–Wr"Â&Æö6Æ†÷7Bò#rãããv—F‚ÆÂæWGv÷&²6ÆÇ2F—6&ÆVB"“°¢6WD'W7’†fÇ6R“°¢÷VäÖ&Wf–Wtf—‡GW&R‚“°§Ğ Ğ¦7–æ2gVæ7F–öâ÷VäÆ"‚’°Ğ¢–b†Æ%7FFRç&Wf–Wr’²÷Vå&Wf–Wr‚“²&WGW&ã²ĞĞ¢–b†Æ%7FFRæ'W7’’&WGW&ã°Ğ¢6öç7B–çWBÒ‚&Æ"Ö6öFR"“°Ğ¢Æ%7FFRæ6öFRÒ–çWBçfÇVRçG&–Ò‚“°Ğ¢–b‚Æ%7FFRæ6öFR’²6WDÖW76vR‚&Æ"ÖvFRÖÖW76vR"Â$VçFW"F†RFW7FW"66W726öFRf—'7Bâ"Â&W'&÷""“²&WGW&ã²ĞĞ¢6WD'W7’‡G'VR“°Ğ¢6WDÖW76vR‚&Æ"ÖvFRÖÖW76vR"Â$6†V6¶–ær&÷FV7FVB66W7>(
b"“°Ğ¢G'’°Ğ¢òòF†Rf—'7BW†—7F–ær&ö&R6Æ–×2÷fÆ–FFW2FW7FW"66W72v—F†÷WB––ærf÷"ÖöFVÂ&W7öç6RàĞ¢v—BÆ$fWF6‚‡²&÷f–FW#¢&çF‡&÷–2"Â&ö&S¢G'VRÒ“°Ğ¢Æ%7FFRæ66W75fW&–f–VBÒG'VS°Ğ¢Æö6Å7F÷&vRç6WD—FVÒ‚'wbÖÆ"Ö6öFR"ÂÆ%7FFRæ6öFR“°Ğ¢–æ—F–Æ—¦Uv÷&·76R‚“°Ğ¢v—B&ö&U&÷f–FW'2‚“°Ğ¢v—B&Vg&W6„¦ö'2‚“°Ğ¢v—B&Vg&W6„6Æ&–f–6F–öä'F–f7G2‚“°Ğ¢6WDÖW76vR‚&Æ"ÖvFRÖÖW76vR"Â""“°Ğ¢Ò6F6‚†W'&÷"’°Ğ¢6WDÖW76vR‚&Æ"ÖvFRÖÖW76vR"ÂW'&÷"çG—RÓÓÒ&66W75öFVæ–VB"ò%F†BFW7FW"6öFRv2æ÷B66WFVBâ"¢6÷VÆBæ÷B÷VâF†R&÷FV7FVBÆ#¢G¶W'&÷"æÖW76vRÇÂ'Væ¶æ÷vâW'&÷"'ÖÂ&W'&÷""“°Ğ¢Òf–æÆÇ’°Ğ¢6WD'W7’†fÇ6R“°Ğ¢ĞĞ§ĞĞ Ğ¦gVæ7F–öâ&–æDWfVçG2‚’°Ğ¢‚&Æ"ÖVçFW""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â÷VäÆ"“°Ğ¢‚&Æ"Ö6öFR"’æFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Â†WfVçB’Óâ²–b†WfVçBæ¶W’ÓÓÒ$VçFW""’÷VäÆ"‚“²Ò“°Ğ¢&–æD6Æ&–f–6F–öäWfVçG2‚“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FFÖÆöB×&ö×EÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ&W6WE&W6WB†'WGFöâæFF6WBæÆöE&ö×B’’“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×6fR×&ö×EÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6fU&ö×EfW'6–öâ†'WGFöâæFF6WBç6fU&ö×B’’“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FFÖFVÆWFR×&ö×EÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFVÆWFU&ö×EfW'6–öâ†'WGFöâæFF6WBæFVÆWFU&ö×B’’“°Ğ¢f÷"†6öç7B¶–æBöb²&ÆW76öâ"Â'GWF÷""Â&'&–â%Ò’°Ğ¢†G¶¶–æGÒ×&W6WF’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ7–æ5&ö×D6öçG&öÇ2†¶–æB’“°Ğ¢†G¶¶–æGÒ×fW'6–öâÖæÖV’æFDWfVçDÆ—7FVæW"‚&¶W–F÷vâ"Â†WfVçB’Óâ²–b†WfVçBæ¶W’ÓÓÒ$VçFW""’²WfVçBç&WfVçDFVfVÇB‚“²6fU&ö×EfW'6–öâ†¶–æB“²ÒÒ“°Ğ¢ĞĞ¢²&ÆW76öâ"Â'GWF÷""Â&'&–â%Òæf÷$V6‚‚†¶–æB’Óâ†G¶¶–æGÒ×&ö×F’æFDWfVçDÆ—7FVæW"‚&–çWB"Â‚’Óâ²WFFTVF—FVD&FvR†¶–æB“²&VæFW%'VäW7F–ÖFR†¶–æB“²Ò’“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×v÷&·6†÷Ò"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6÷•v÷&·6†÷'&–Vf–ær†'WGFöâæFF6WBçv÷&·6†÷’’“°Ğ¢²&ÆW76öâ"Â'GWF÷""Â&'&–â%Òæf÷$V6‚‡&VæFW$&Væ6…&öÆR“°Ğ¢‚'&W7VÇG2×&FRÖæ÷FR"’çFW‡D6öçFVçBÒ6÷7G2&RW7F–ÖFW2g&öÒ†æBÖVçFW&VBÆ—7B&–6W2ÂÆ7B6†V6¶VBG´Ä%õ$DU5ô4„T4´TGÒâF†R&÷f–FW"–çfö–6R—2WF†÷&—FF—fRæ°Ğ¢ò¢¶VWF†R&RÖfÆ–v‡B7VæBf–wW&R†öæW7B2F†R–çWG26†ævRâ¢ğĞ¢‚'GWF÷"×GW&â"’æFDWfVçDÆ—7FVæW"‚&–çWB"Â‚’Óâ&VæFW%'VäW7F–ÖFR‚'GWF÷""’“°Ğ¢‚&'&–âÖfö7W2"’æFDWfVçDÆ—7FVæW"‚&–çWB"Â‚’Óâ&VæFW%'VäW7F–ÖFR‚&'&–â"’“°Ğ¢‚&ÆW76öâÖæ÷FW2×&Vg&W6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂÆöDÆö6ÄÆ–'&'’“°Ğ¢‚&ÆW76öâÖæ÷FR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°Ğ¢6öç7Bæ÷FRÒÆ%7FFRææ÷FW2æf–æB‚†—FVÒ’Óâ7G&–ær†—FVÒæ–B’ÓÓÒ‚&ÆW76öâÖæ÷FR"’çfÇVR“°Ğ¢–b‚æ÷FR’²Æ%7FFRç6VÆV7FVDæ÷FT–BÒ"#²&WGW&ã²ĞĞ¢‚&ÆW76öâ×F÷–2"’çfÇVRÒ6Æ—†æ÷FRçFW‡BÂ#“°Ğ¢FVÆWFR‚&ÆW76öâ×F÷–2"’æFF6WBç—VÆ–æU'Vä–C°Ğ¢Æ%7FFRç6VÆV7FVDæ÷FT–BÒ7G&–ær†æ÷FRæ–B“°Ğ¢6WDÖW76vR‚&ÆW76öâ×'VâÖÖW76vR"Â$6÷–VBF†—26fVBæ÷FR–çFòF†RÆ"F÷–2âF†R÷&–v–æÂæ÷FR&VÖ–ç2Væ6†ævVBâ"Â&ö²"“°Ğ¢Ò“°Ğ¢‚&ÆW76öâ×F÷–2"’æFDWfVçDÆ—7FVæW"‚&–çWB"Â‚’Óâ°Ğ¢FVÆWFR‚&ÆW76öâ×F÷–2"’æFF6WBç—VÆ–æU'Vä–C°Ğ¢6öç7Bæ÷FRÒÆ%7FFRææ÷FW2æf–æB‚†—FVÒ’Óâ7G&–ær†—FVÒæ–B’ÓÓÒ‚&ÆW76öâÖæ÷FR"’çfÇVR“°Ğ¢–b†æ÷FRbbæ÷FRçFW‡BçG&–Ò‚’ÓÒ‚&ÆW76öâ×F÷–2"’çfÇVRçG&–Ò‚’’°Ğ¢‚&ÆW76öâÖæ÷FR"’çfÇVRÒ"#°Ğ¢Æ%7FFRç6VÆV7FVDæ÷FT–BÒ"#°Ğ¢ĞĞ¢&VæFW%'VäW7F–ÖFR‚&ÆW76öâ"“°Ğ¢Ò“°Ğ¢‚'GWF÷"×&Vg&W6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂÆöDÆö6ÄÆ–'&'’“°Ğ¢‚&'&–â×&Vg&W6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂÆöDÆö6ÄÆ–'&'’“°Ğ¢‚'GWF÷"ÖÆW76öâ"’æFDWfVçDÆ—7FVæW"‚&6†ævR"ÂWFFUGWF÷$6öçFW‡E&Wf–Wr“°Ğ¢‚&'&–âÖÆW76öâ"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ²ò¢6öçFW‡B—2&WF–æVB–âF†R6W&FRW6W"ÖW76vRB'VâF–ÖRâ¢òÒ“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FFÖFBÖÆæUÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâFDÆæR†'WGFöâæFF6WBæFDÆæR’’“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×'VåÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ'VåFW‡DW‡W&–ÖVçB†'WGFöâæFF6WBç'Vâ’’“°Ğ¢‚'7GB×'Vâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â'VåG&ç67&—F–öâ“°Ğ¢‚'7GBÖf–ÆR"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°Ğ¢6öç7Bf–ÆRÒ‚'7GBÖf–ÆR"’æf–ÆW3òå³Ó°Ğ¢‚'7GBÖf–ÆRÖæÖR"’çFW‡D6öçFVçBÒf–ÆRò6VÆV7FVBÆö6ÆÇ“¢G¶f–ÆRææÖWÒ+rG´ÖF‚æÖ‚ƒÂÖF‚ç&÷VæB†f–ÆRç6—¦Rò#B’—Ò´&¢$æòf–ÆR6VÆV7FVBâ#°Ğ¢Ò“°Ğ¢‚'66Væ&–ò×6VÆV7B"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â‚’Óâ°Ğ¢Æ%7FFRæ7W'&VçE66Væ&–ô–BÒ‚'66Væ&–ò×6VÆV7B"’çfÇVRÇÂÄ%ôDTdTÅEõ44Tä$”òæ–C°Ğ¢W'6—7Ev÷&·76R‚“°Ğ¢ÆöE66Væ&–ôf–VÆG2‚“°Ğ¢&VæFW$ÆFVæ7”F6†&ö&B‚“°Ğ¢Ò“°Ğ¢‚'66Væ&–ò×6fR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6fT&Væ6†Ö&µ66Væ&–ò“°Ğ¢‚'66Væ&–òÖFVÆWFR"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂFVÆWFT&Væ6†Ö&µ66Væ&–ò“°¢‚'66Væ&–ò×W6R"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’ÓâÇ”&Væ6†Ö&µ66Væ&–ò‡G'VR’“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×—VÆ–æR×7FvUÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6WE—VÆ–æU7FvR†'WGFöâæFF6WBç—VÆ–æU7FvR’’“°¢‚'—VÆ–æR×'Vâ×6VÆV7B"’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â†WfVçB’Óâ6VÆV7E—VÆ–æU'Vâ†WfVçBæ7W'&VçEF&vWBçfÇVR’“°¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚%¶FF×—VÆ–æR×&Wf–÷W2×7FvUÒ"’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6WE—VÆ–æU7FvR†'WGFöâæFF6WBç—VÆ–æU&Wf–÷W57FvR’’“°¢‚&Ö×f–WrÖÆV&æW""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6WDÖf–Wr‚&ÆV&æW""’“°¢‚&Ö×f–WrÖ&6¶VæB"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ6WDÖf–Wr‚&&6¶VæB"’“°¢‚'—VÆ–æRÖÆöBÖÖ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂÆöE—VÆ–æTÖ–çWB“°¢‚&6Æ&–f–6F–öâÖ÷VâÖÖ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ğ¢6öç7B'Vä–BÒÆ%7FFRæ6Æ&–f–6F–öâæf–æÆ—¦VCòç'Vä–C°Ğ¢–b‡'Vä–B’Æ%7FFRç—VÆ–æU6VÆV7FVE'Vä–BÒ'Vä–C°Ğ¢6WE—VÆ–æU7FvR‚&Ö"“°Ğ¢Ò“°Ğ¢‚&Æ"Ö÷Vâ×F–Ö–ær"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ°Ğ¢7F—fFUF"‚'&W7VÇG2"“°Ğ¢‚&ÆFVæ7’×F—FÆR"’ç67&öÆÄ–çFõf–Wr‡²&V†f–÷#¢'6Öö÷F‚"Â&Æö6³¢'7F'B"Ò“°Ğ¢Ò“°Ğ¢‚'F–Ö–ærÖ&6²"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7F—fFUF"†Æ%7FFRæÆ7E&–Ö'•F"ÇÂ'—VÆ–æR"’“°Ğ¢‚'7VV6‚×'Vâ"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â'Vå7VV6„6ö×&—6öâ“°Ğ¢‚'7VV6‚×7F÷"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â7F÷7VV6„6ö×&—6öâ“°Ğ¢‚&¦ö'2×&Vg&W6‚"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â&Vg&W6„¦ö'2“°Ğ¢‚&ÆFVæ7’Ö6ÆV""’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6ÆV$ÆFVæ7”ÖWG&–72“°Ğ¢²&ÆFVæ7’Ö6ö×öæVçB"Â&ÆFVæ7’×&÷f–FW""Â&ÆFVæ7’ÖÖöFVÂ%Òæf÷$V6‚‚†–B’Óâ†–B’æFDWfVçDÆ—7FVæW"‚&6†ævR"Â&VæFW$ÆFVæ7”F6†&ö&B’“°Ğ¢‚&W‡÷'B×&W7VÇG2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"ÂF÷væÆöD§6öâ“°Ğ¢‚&6ÆV"×&W7VÇG2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6ÆV%&W7VÇG2“°Ğ¢‚&6ÆV"Ö6ö×&—6öç2"’æFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â6ÆV$6ö×&—6öç2“°Ğ¢Fö7VÖVçBçVW'•6VÆV7F÷$ÆÂ‚"æÆ"×F""’æf÷$V6‚‚†'WGFöâ’Óâ'WGFöâæFDWfVçDÆ—7FVæW"‚&6Æ–6²"Â‚’Óâ7F—fFUF"†'WGFöâæFF6WBçF"’’“°Ğ¢v–æF÷ræFDWfVçDÆ—7FVæW"‚'vV†–FR"Â‚’Óâ°Ğ¢7F÷7VV6„6ö×&—6öâ‚“°Ğ¢7F÷6Æ&–f–6F–öå7VV6‚‚“°Ğ¢f÷"†6öç7BG&6²öbÆ%7FFRæ6Æ&–f–6F–öâæÖ–57G&VÓòævWEG&6·3òâ‚’ÇÂµÒ’G&6²ç7F÷‚“°Ğ¢–b‡v÷&·76U6fUF–ÖW"’W'6—7Ev÷&·76R‚“°Ğ¢Ò“°Ğ§ĞĞ Ğ¦gVæ7F–öâÆöE7W&6U6F²‚’°Ğ¢–b‡v–æF÷rç7W&6Sòæ7&VFT6Æ–VçB’&WGW&â&öÖ—6Rç&W6öÇfR‚“°Ğ¢&WGW&âæWr&öÖ—6R‚‡&W6öÇfRÂ&V¦V7B’Óâ°Ğ¢6öç7B67&—BÒFö7VÖVçBæ7&VFTVÆVÖVçB‚'67&—B"“°Ğ¢67&—Bç7&2ÒÄ%õ5U$4Uõ4DµõU$Ã°Ğ¢67&—Bæ7–æ2ÒG'VS°Ğ¢67&—BæFF6WBçv÷&ÆGf–WtÆ%6F²Ò'G'VR#°Ğ¢67&—BæöæÆöBÒ‚’Óâv–æF÷rç7W&6Sòæ7&VFT6Æ–VçBò&W6öÇfR‚’¢&V¦V7B†æWrW'&÷"‚%F†R&÷FV7FVBÆ"6Æ–VçBF–Bæ÷BÆöBâ"’“°Ğ¢67&—BæöæW'&÷"Ò‚’Óâ&V¦V7B†æWrW'&÷"‚$6÷VÆBæ÷BÆöBF†R&÷FV7FVBÆ"6Æ–VçBâ"’“°Ğ¢Fö7VÖVçBæ†VBæVæB‡67&—B“°Ğ¢Ò“°Ğ§ĞĞ Ğ¦7–æ2gVæ7F–öâ&ö÷B‚’°Ğ¢f–ÆÅ&W6WE6VÆV7B‚&ÆW76öâ"“°Ğ¢f–ÆÅ&W6WE6VÆV7B‚'GWF÷""“°Ğ¢f–ÆÅ&W6WE6VÆV7B‚&'&–â"“°Ğ¢&–æDWfVçG2‚“°Ğ¢‚&Æ"Ö6öFR"’çfÇVRÒÆ%7FFRæ6öFS°Ğ¢&VæFW$fÆ÷r‚“°Ğ¢&VæFW%&W7VÇG2‚“°Ğ¢&VæFW$6ö×&—6öäÆ–'&'’‚“°Ğ¢&VæFW$ÆFVæ7”F6†&ö&B‚“°Ğ¢–b†Æ%7FFRç&Wf–Wr’°Ğ¢÷Vå&Wf–Wr‚“°Ğ¢&WGW&ã°Ğ¢ĞĞ¢‚&Æ"ÖVçFW""’æF—6&ÆVBÒG'VS°Ğ¢G'’°Ğ¢v—BÆöE7W&6U6F²‚“°Ğ¢Æ%7FFRæ6Æ–VçBÒv–æF÷rç7W&6Ræ7&VFT6Æ–VçB…5U$4UõU$ÂÂ5U$4UõT$Ä•4„$ÄUô´U’Â°Ğ¢WFƒ¢²W'6—7E6W76–öã¢G'VRÂWFõ&Vg&W6…Fö¶Vã¢G'VRÂFWFV7E6W76–öä–åW&Ã¢G'VRÂ7F÷&vT¶W“¢'v÷&ÆGf–WrÖÇ†ÖWF‚"ÒÀĞ¢Ò“°Ğ¢Æ%7FFRæ6Æ–VçBæWF‚æöäWF…7FFT6†ævR‚†WfVçB’Óâ°Ğ¢–b†WfVçBÓÓÒ%4”täTEôõUB"’°Ğ¢6ÆV%fW&–f–VDÆ%W6W"‚“°Ğ¢&WGW&ã°Ğ¢ĞĞ¢–b‚Æ%7FFRæ66W75fW&–f–VBÇÂ²%4”täTEô”â"Â%Dô´Tåõ$Te$U4„TB"Â%U4U%õUDDTB%Òæ–æ6ÇVFW2†WfVçB’’&WGW&ã°Ğ¢6WEF–ÖV÷WB†7–æ2‚’Óâ°Ğ¢G'’²v—B66W75Fö¶Vâ†fÇ6R“²v—B&Vg&W6„¦ö'2‚“²ĞĞ¢6F6‚…ò’²6ÆV%fW&–f–VDÆ%W6W"‚“²ĞĞ¢ÒÂ“°Ğ¢Ò“°Ğ¢‚&Æ"ÖVçFW""’æF—6&ÆVBÒfÇ6S°Ğ¢Ò6F6‚†W'&÷"’°Ğ¢6WDÖW76vR‚&Æ"ÖvFRÖÖW76vR"ÂG¶W'&÷"æÖW76vRÇÂ%F†R&÷FV7FVBÆ"6Æ–VçBF–Bæ÷BÆöBâ'Ò6†V6²–÷W"6öææV7F–öâæB&VÆöBæÂ&W'&÷""“°Ğ¢ĞĞ§ĞĞ Ğ§fö–B&ö÷B‚“°Ğ 