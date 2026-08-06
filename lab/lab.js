"use strict";

/*
  Worldview owner lab. This page intentionally has no client-side provider
  credential, no arbitrary endpoint, and no write path to the learner app.
  Its two network routes are the already tester-gated lab-tutor and transcribe
  functions. The production cold tutor prompt is declared verbatim above in
  index.html so the prompt-integrity test can compare it byte-for-byte.
*/

const LAB_PREVIEW = ["localhost", "127.0.0.1"].includes(window.location.hostname)
  && new URLSearchParams(window.location.search).get("preview") === "1";
const LAB_SUPABASE_SDK_URL = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.js";

/*
  Model catalogue. The server deliberately does NOT allow-list model ids (see
  supabase/functions/lab-tutor/index.ts MODEL_SHAPE): it only checks that the id
  looks like a model identifier. That is on purpose — the whole point of this lab
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
      { id: "claude-opus-5", label: "Opus 5 · current flagship" },
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-sonnet-5", label: "Sonnet 5" },
      { id: "claude-sonnet-4-6", label: "Sonnet 4.6" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5 · cheapest" },
      { id: "claude-fable-5", label: "Fable 5 · most capable, priciest" },
    ],
  },
  google: {
    label: "Gemini",
    models: [
      { id: "gemini-3.1-pro-preview", label: "3.1 Pro · current Pro tier" },
      { id: "gemini-3.6-flash", label: "3.6 Flash · newest Flash" },
      { id: "gemini-3.5-flash", label: "3.5 Flash" },
      { id: "gemini-3.5-flash-lite", label: "3.5 Flash-Lite" },
      { id: "gemini-2.5-pro", label: "2.5 Pro · previous generation" },
      { id: "gemini-2.5-flash", label: "2.5 Flash · previous generation" },
    ],
  },
  openai: {
    label: "ChatGPT",
    models: [
      { id: "gpt-5.6-luna", label: "GPT 5.6 Luna · tutor" },
      { id: "gpt-5.6-terra", label: "GPT 5.6 Terra · lesson map" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
    ],
  },
  xai: {
    label: "Grok",
    models: [
      { id: "grok-4-5", label: "Grok 4.5 · current flagship" },
      { id: "grok-4-3", label: "Grok 4.3" },
      { id: "grok-4-1-fast", label: "Grok 4.1 Fast · cheapest" },
      { id: "grok-3-mini", label: "Grok 3 mini · previous generation" },
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
  These drive an ESTIMATE only — the provider invoice is authoritative. Long
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
const LAB_WORKSPACE_SCHEMA = 1;
const LAB_MAX_CUSTOM_PROMPTS_PER_BENCH = 8;
const LAB_MAX_COMPARISONS = 60;
const LAB_MAX_TOPICS_PER_RUN = 4;
const LAB_MAX_COMPARISON_NOTE = 1200;
const LAB_LESSON_HANDOFF_KEY = "worldview-lab-lesson-handoff-v1";

const LAB_PRESETS = {
  lesson: [
    {
      id: "guided-plan",
      label: "Guided learning route",
      text: "You are planning a compact, Socratic learning route for a mobile learner. Start from the earliest useful idea. Give 4–6 checkpoints, each with a learner-visible reasoning question and a simple mastery signal. Keep factual claims modest, flag assumptions, and finish with one likely misconception to probe. This is a sandbox plan only: do not claim to save, assign, or change a lesson.",
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
  Keep it factual — the briefing is worthless if it describes a system that
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
      "A route of checkpoints, smallest sufficient graph — no fixed target count.",
      "Per checkpoint: an id, a title, its prerequisites, and the mastery goal the learner must demonstrate.",
      "A starting checkpoint and the first diagnostic question.",
    ],
    authority: "High but gated. The route is validated, hashed, and saved atomically — a partial or malformed plan is rejected whole and the previous state stays authoritative. It never teaches; the tutor does.",
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
      "One short reply, usually 1–3 sentences, ending in exactly one question.",
      "One hidden checkpoint marker the learner never sees.",
    ],
    authority: "None over progress. The tutor proposes 'demonstrated'; the browser decides, and a client-side gate refuses to advance on agreement, one-word answers, uncertainty, or a request to be told.",
    knownIssues: [
      "BUG-108: a surface-level partial answer drew a large content dump instead of one eliciting question.",
      "BUG-082: replies that only confirm understanding, leaving the learner nothing to answer.",
      "BUG-062: advancing without evidence the learner understood.",
      "LES-049: 'just tell me' is a frustration signal, not permission to give the answer.",
    ],
    labGap: "This bench appends a read-only lesson snapshot, not the byte-exact production packet. It has no marker composition, no response gate, and no mastery authority — so a result here is an approximation, not a production replay.",
  },
  brain: {
    title: "Brain (proposed — not live)",
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
  const list = (items) => items.map((item) => `- ${item}`).join("\n");
  return `# Prompt workshop — Worldview: ${role.title}

I want to talk my way to a better version of this prompt. Ask me ONE question at a time and wait for my answer — I am replying with my voice, so keep your questions short and do not send me long lists to read.

## What Worldview is
Worldview is a voice-first learning app. A learner says what they want to understand; the app plans a route of checkpoints through the topic, then a Socratic tutor talks them through it. The learner is supposed to do the explaining and reasoning — the tutor asks the next question rather than delivering the answer. Progress is only granted when the learner demonstrates understanding in their own words.

## Where this particular AI sits
${role.oneLine}

Production model today: ${role.productionModel}

What it receives:
${list(role.receives)}

What it must return:
${list(role.returns)}

How much authority it has:
${role.authority}

## What has actually gone wrong here before
${list(role.knownIssues)}

## The prompt as it stands right now
Version loaded: ${loaded?.name || "unsaved draft"}

\`\`\`text
${promptText || "(the editor is currently empty)"}
\`\`\`

## Your job
1. Read the prompt above and tell me, in a couple of sentences, what you think it is optimising for and where you think it is weak.
2. Then interview me one question at a time about what I want changed. Do not assume — I know this product and you do not.
3. When we have enough, output the complete replacement prompt in one fenced block, ready to paste. Not a diff, not a summary — the whole thing.

Constraints the new version must still satisfy:
- It is a system prompt for one model in the pipeline above. It cannot invent capabilities the app does not have.
- It must not claim authority this component does not have (see the authority note above).
- Keep it under ${LAB_PROMPT_LIMITS[kind].toLocaleString()} characters.
${kind === "tutor" ? "- Every ordinary reply must end with exactly one question, and the hidden checkpoint marker rule must survive.\n" : ""}
Start with step 1.`;
}

const labState = {
  code: localStorage.getItem("wv-lab-code") || "",
  client: null,
  preview: LAB_PREVIEW,
  configured: {},
  lessons: [],
  notes: [],
  selectedNoteId: "",
  busy: false,
  outputs: [],
  flow: [],
  promptVersions: { lesson: [], tutor: [], brain: [] },
  comparisons: [],
  basePrompt: { lesson: "", tutor: "", brain: "" },
  loadedPromptVersionId: { lesson: "", tutor: "", brain: "" },
  lanes: {
    lesson: [{ provider: "anthropic", model: "claude-sonnet-5", promptVersionId: "draft", quantity: 1 }],
    tutor: [{ provider: "anthropic", model: "claude-sonnet-5", promptVersionId: "draft", quantity: 1 }],
    brain: [{ provider: "anthropic", model: "claude-sonnet-5", promptVersionId: "draft", quantity: 1 }],
  },
};

const q = (id) => document.getElementById(id);
const now = () => new Date().toISOString();
const clip = (value, length = 1700) => {
  const text = String(value ?? "").trim();
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
};
const asText = (value) => typeof value === "string" ? value : "";
const prettyDate = (iso) => {
  try { return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" }); }
  catch (_) { return iso; }
};
const makeId = () => window.crypto?.randomUUID?.() || `lab-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function fingerprint(value) {
  let hash = 0x811c9dc5;
  for (const character of String(value ?? "")) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 0x01000193);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function builtinPromptVersions(kind) {
  return (LAB_PRESETS[kind] || []).map((preset) => ({
    id: `builtin:${kind}:${preset.id}`,
    kind,
    name: preset.label,
    text: preset.text,
    fingerprint: fingerprint(preset.text),
    builtIn: true,
  }));
}

function allPromptVersions(kind) {
  return [...builtinPromptVersions(kind), ...(labState.promptVersions[kind] || [])];
}

function promptVersion(kind, id) {
  return allPromptVersions(kind).find((item) => item.id === id) || null;
}

function sanitizePromptVersion(value, kind) {
  if (!value || typeof value !== "object" || value.kind !== kind) return null;
  const name = clip(value.name, 80);
  const text = asText(value.text).trim();
  if (!name || !text || text.length > LAB_PROMPT_LIMITS[kind]) return null;
  const id = String(value.id || "");
  if (!/^custom:[a-z]+:[A-Za-z0-9-]{8,}$/.test(id)) return null;
  return {
    id,
    kind,
    name,
    text,
    fingerprint: fingerprint(text),
    createdAt: asText(value.createdAt) || now(),
  };
}

function sanitizeComparison(value) {
  if (!value || typeof value !== "object") return null;
  const kind = ["lesson", "tutor", "brain", "transcription"].includes(value.kind) ? value.kind : "lesson";
  const text = asText(value.text);
  if (!text || text.length > 50000) return null;
  const promptCore = asText(value.promptCore);
  if (promptCore.length > (LAB_PROMPT_LIMITS[kind] || 12000)) return null;
  return {
    id: clip(value.id || makeId(), 120),
    sourceOutputId: clip(value.sourceOutputId, 120),
    keptAt: asText(value.keptAt) || now(),
    at: asText(value.at) || now(),
    kind,
    provider: clip(value.provider, 80),
    providerLabel: clip(value.providerLabel, 80),
    model: clip(value.model, 100),
    replicate: Math.max(1, Math.min(4, Number(value.replicate) || 1)),
    text,
    inputTokens: numeric(value.inputTokens),
    outputTokens: numeric(value.outputTokens),
    latencyMs: numeric(value.latencyMs),
    cost: numeric(value.cost),
    failed: Boolean(value.failed),
    runId: clip(value.runId, 120),
    inputLabel: clip(value.inputLabel, 240),
    inputFixture: clip(value.inputFixture, 4000),
    inputFingerprint: clip(value.inputFingerprint, 80),
    sourceNoteId: clip(value.sourceNoteId, 160),
    promptVersionId: clip(value.promptVersionId, 160),
    promptVersionName: clip(value.promptVersionName || value.promptPreset, 100),
    promptCore,
    promptCoreFingerprint: fingerprint(promptCore),
    promptFingerprint: clip(value.promptFingerprint || fingerprint(promptCore), 80),
    preferred: Boolean(value.preferred),
    /* 0 means unscored. A kept result without a verdict is just an old reply;
       the score is what makes the archive worth searching later. */
    rating: Math.max(0, Math.min(5, Math.round(Number(value.rating) || 0))),
    checks: Array.isArray(value.checks)
      ? value.checks.slice(0, 12)
        .map((check) => ({ level: ["pass", "warn", "fail"].includes(check?.level) ? check.level : "warn", label: clip(check?.label, 120) }))
        .filter((check) => check.label)
      : [],
    note: clip(value.note, LAB_MAX_COMPARISON_NOTE),
  };
}

function loadWorkspace() {
  try {
    const stored = JSON.parse(localStorage.getItem(LAB_WORKSPACE_KEY) || "{}");
    if (Number(stored?.schemaVersion || LAB_WORKSPACE_SCHEMA) !== LAB_WORKSPACE_SCHEMA) return;
    for (const kind of ["lesson", "tutor", "brain"]) {
      labState.promptVersions[kind] = (Array.isArray(stored?.promptVersions?.[kind]) ? stored.promptVersions[kind] : [])
        .map((item) => sanitizePromptVersion(item, kind))
        .filter(Boolean)
        .slice(0, LAB_MAX_CUSTOM_PROMPTS_PER_BENCH);
    }
    labState.comparisons = (Array.isArray(stored?.comparisons) ? stored.comparisons : [])
      .map(sanitizeComparison)
      .filter(Boolean)
      .slice(0, LAB_MAX_COMPARISONS);
  } catch (_) {
    labState.promptVersions = { lesson: [], tutor: [], brain: [] };
    labState.comparisons = [];
  }
}

function workspacePayload() {
  return {
    schemaVersion: LAB_WORKSPACE_SCHEMA,
    savedAt: now(),
    promptVersions: labState.promptVersions,
    comparisons: labState.comparisons,
  };
}

function persistWorkspace(successMessage = "") {
  try {
    localStorage.setItem(LAB_WORKSPACE_KEY, JSON.stringify(workspacePayload()));
    if (successMessage) setMessage("workspace-message", successMessage, "ok");
    return true;
  } catch (error) {
    setMessage("workspace-message", "This browser could not save more Lab material. Remove an older kept comparison or prompt version and try again.", "error");
    return false;
  }
}

let workspaceSaveTimer = 0;
function scheduleWorkspaceSave() {
  clearTimeout(workspaceSaveTimer);
  workspaceSaveTimer = setTimeout(() => persistWorkspace("Evaluation note saved on this device."), 280);
}

function element(tag, options = {}) {
  const node = document.createElement(tag);
  if (options.className) node.className = options.className;
  if (options.text !== undefined) node.textContent = options.text;
  if (options.type) node.type = options.type;
  if (options.value !== undefined) node.value = options.value;
  if (options.disabled !== undefined) node.disabled = options.disabled;
  if (options.hidden !== undefined) node.hidden = options.hidden;
  for (const [name, value] of Object.entries(options.attrs || {})) node.setAttribute(name, value);
  return node;
}

function setMessage(id, message = "", type = "") {
  const node = q(id);
  if (!node) return;
  node.textContent = message;
  node.classList.toggle("is-error", type === "error");
  node.classList.toggle("is-ok", type === "ok");
}

function logFlow(what, from) {
  labState.flow.unshift({ id: makeId(), at: now(), what, from });
  if (labState.flow.length > 140) labState.flow.length = 140;
  renderFlow();
}

function providerInfo(id) {
  return LAB_PROVIDER_CATALOG[id] || { label: id, models: [] };
}

function defaultModel(provider) {
  return providerInfo(provider).models[0]?.id || "";
}

function numeric(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function estimateTextCost(model, inputTokens, outputTokens) {
  const rate = LAB_MODEL_RATES[model];
  const input = numeric(inputTokens);
  const output = numeric(outputTokens);
  if (!rate || input === null || output === null) return null;
  return (input / 1_000_000) * rate.input + (output / 1_000_000) * rate.output;
}

/*
  Deterministic, free, instant checks on an output. These cost nothing and run
  on every result, so an obviously policy-breaking prompt variant is visible
  without reading four replies side by side.

  They are heuristics, NOT proof of teaching quality. A reply can pass every
  check here and still be a bad tutor turn; that judgement stays with Cristian.
  The rules encoded are the ones the production tutor prompt actually states
  (see requirements/00-principles.md and LES-055 / P-017).
*/
const LAB_BANNED_TUTOR_PHRASES = [
  { pattern: /\bsocratic(ally)?\b/i, why: "names the teaching method" },
  { pattern: /\bfeynman\b/i, why: "names the teaching method" },
  { pattern: /\bpedagog(y|ical)\b/i, why: "names the teaching method" },
  { pattern: /before I explain/i, why: "banned throat-clearing phrase" },
  { pattern: /^(great|good|excellent|perfect|nice|awesome|well done)\b/i, why: "opens with praise" },
  { pattern: /^(hi|hello|hey|welcome back)\b/i, why: "opens with a greeting" },
];

function policyFindings(kind, text) {
  const body = String(text || "").trim();
  if (!body) return [];
  const findings = [];
  if (kind === "tutor") {
    const questionMarks = (body.match(/\?/g) || []).length;
    if (questionMarks === 0) findings.push({ level: "fail", label: "No question — the learner has nothing to answer" });
    else if (questionMarks > 1) findings.push({ level: "warn", label: `${questionMarks} questions — the policy is exactly one` });
    else findings.push({ level: "pass", label: "Exactly one question" });
    if (questionMarks && !/\?["')\]]*$/.test(body)) findings.push({ level: "warn", label: "Does not end on the question" });
    const sentences = body.split(/(?<=[.!?])\s+/).filter(Boolean).length;
    if (sentences > 5) findings.push({ level: "warn", label: `${sentences} sentences — usually 1–3` });
    for (const banned of LAB_BANNED_TUTOR_PHRASES) {
      if (banned.pattern.test(body)) findings.push({ level: "fail", label: `"${banned.why}"` });
    }
  }
  if (kind === "lesson") {
    const checkpoints = (body.match(/^\s*(?:\d+[.)]|[-*])\s+/gm) || []).length;
    findings.push(checkpoints
      ? { level: "pass", label: `${checkpoints} listed steps` }
      : { level: "warn", label: "No enumerated checkpoints found" });
  }
  if (/\[\[checkpoint:/i.test(body)) findings.push({ level: "warn", label: "Emitted a checkpoint marker — the Lab does not ask for one" });
  return findings;
}

function formatCost(value) {
  const number = numeric(value);
  return number === null ? "Estimate unavailable" : `Estimated $${number.toFixed(number < 0.01 ? 4 : 2)}`;
}

function selectedLesson(selectId) {
  const index = Number(q(selectId)?.value);
  return Number.isInteger(index) && labState.lessons[index] ? labState.lessons[index] : null;
}

function lessonTitle(lesson, index = 0) {
  return clip(lesson?.title || lesson?.topic || lesson?.name || lesson?.lessonTitle || `Saved lesson ${index + 1}`, 100);
}

function messageText(message) {
  if (typeof message === "string") return message;
  if (!message || typeof message !== "object") return "";
  return asText(message.content || message.text || message.message || message.body);
}

function lessonHistory(lesson) {
  const candidates = [lesson?.messages, lesson?.history, lesson?.conversation, lesson?.turns, lesson?.chat];
  const source = candidates.find(Array.isArray) || [];
  return source
    .map((turn) => ({
      role: turn?.role === "assistant" || turn?.role === "tutor" ? "assistant" : "user",
      content: clip(messageText(turn), 900),
    }))
    .filter((turn) => turn.content)
    .slice(-10);
}

function lessonSnapshot(lesson) {
  if (!lesson) return "No saved lesson is available in this browser.";
  const title = lessonTitle(lesson);
  const brief = lesson?.briefing || lesson?.sourceBriefing || lesson?.summary || lesson?.description;
  const tree = Array.isArray(lesson?.knowledgeTree) ? lesson.knowledgeTree : [];
  const fallbackRoute = lesson?.route || lesson?.teachingRoute || lesson?.plan || lesson?.checkpoints || lesson?.outline;
  const checkpointId = String(lesson?.currentPathNodeId || lesson?.lastTutorCheckpointId || "").trim();
  const checkpoint = tree.find((node) => String(node?.id || "") === checkpointId);
  const demonstratedIds = Array.isArray(lesson?.demonstratedNodeIds) ? lesson.demonstratedNodeIds.map(String) : [];
  const learnerSummary = lesson?.rollingContext?.learnerSummary || lesson?.learnerSummary;
  const lines = [
    `Saved lesson: ${title}`,
    tree.length
      ? `Knowledge tree (in route order):\n${tree.slice(0, 18).map((node, index) => {
        const goal = clip(node?.mastery_goal || node?.why_needed || "No mastery goal recorded.", 320);
        const reason = node?.why_needed && node?.mastery_goal ? ` · why needed: ${clip(node.why_needed, 260)}` : "";
        const prerequisites = Array.isArray(node?.prerequisites) && node.prerequisites.length ? ` · prerequisites: ${node.prerequisites.join(", ")}` : "";
        return `${index + 1}. ${node?.id || "unnamed"}: ${node?.title || "Untitled"} · mastery goal: ${goal}${reason}${prerequisites}`;
      }).join("\n")}`
      : fallbackRoute ? `Route / checkpoints: ${clip(Array.isArray(fallbackRoute) ? fallbackRoute.map((item) => typeof item === "string" ? item : item?.title || item?.label || "").filter(Boolean).join(" | ") : fallbackRoute, 1500)}` : "Route / checkpoints: not available in local record.",
    checkpoint
      ? `Current / resume checkpoint: ${checkpoint.id}: ${checkpoint.title}. Mastery goal: ${clip(checkpoint.mastery_goal || checkpoint.why_needed || "No mastery goal recorded.", 500)}`
      : checkpointId ? `Current / resume checkpoint id: ${checkpointId} (not found in this local knowledge tree).` : "Current / resume checkpoint: not recorded.",
    `Demonstrated checkpoint ids: ${demonstratedIds.length ? demonstratedIds.join(", ") : "none recorded"}.`,
    learnerSummary ? `Learner summary (local record): ${clip(learnerSummary, 1900)}` : "Learner summary: not available in local record.",
    brief ? `Briefing: ${clip(brief, 1700)}` : "Briefing: not available in local record.",
  ];
  const history = lessonHistory(lesson);
  if (history.length) lines.push(`Recent local conversation:\n${history.map((turn) => `${turn.role}: ${turn.content}`).join("\n")}`);
  return lines.join("\n\n");
}

function composeTutorPacket(instructionCore, lesson = selectedLesson("tutor-lesson")) {
  return `${instructionCore}\n\n---\nREAD-ONLY LAB CONTEXT (local browser snapshot; not a production packet)\n${lessonSnapshot(lesson)}\n\nLab boundary: reply as a tutor only. Do not claim to save progress, mark mastery, alter a route, or update learner data.`;
}

function composeBrainContext() {
  const lesson = selectedLesson("brain-lesson");
  return lessonSnapshot(lesson);
}

function updateTutorContextPreview() {
  const preview = q("tutor-context-preview");
  if (preview) preview.textContent = lessonSnapshot(selectedLesson("tutor-lesson"));
}

function resetPreset(kind) {
  const select = q(`${kind}-preset`);
  const version = promptVersion(kind, select?.value) || builtinPromptVersions(kind)[0];
  if (!version) return;
  if (select) select.value = version.id;
  q(`${kind}-prompt`).value = version.text;
  labState.basePrompt[kind] = version.text;
  labState.loadedPromptVersionId[kind] = version.id;
  setMessage(`${kind}-prompt-state`, `Loaded “${version.name}”. Edits remain a draft until saved as a new version.`, "ok");
  updateEditedBadge(kind);
}

function updateEditedBadge(kind) {
  const editor = q(`${kind}-prompt`);
  const badge = q(`${kind}-edited`);
  if (!editor || !badge) return;
  badge.hidden = editor.value === labState.basePrompt[kind];
  const limit = LAB_PROMPT_LIMITS[kind];
  const count = q(`${kind}-prompt-count`);
  if (count) {
    count.textContent = `${editor.value.length.toLocaleString()} / ${limit.toLocaleString()} characters`;
    count.classList.toggle("is-over", editor.value.length > limit);
  }
}

function fillPresetSelect(kind) {
  const select = q(`${kind}-preset`);
  if (!select) return;
  const prior = select.value;
  select.replaceChildren();
  const builtIns = element("optgroup", { attrs: { label: "Built-in baselines" } });
  for (const version of builtinPromptVersions(kind)) builtIns.append(element("option", { value: version.id, text: version.name }));
  select.append(builtIns);
  if (labState.promptVersions[kind].length) {
    const saved = element("optgroup", { attrs: { label: "Saved on this device" } });
    for (const version of labState.promptVersions[kind]) saved.append(element("option", { value: version.id, text: version.name }));
    select.append(saved);
  }
  select.value = [...select.options].some((option) => option.value === prior) ? prior : builtinPromptVersions(kind)[0]?.id || "";
  syncPromptControls(kind);
}

function syncPromptControls(kind) {
  const deleteButton = document.querySelector(`[data-delete-prompt="${kind}"]`);
  if (!deleteButton) return;
  const version = promptVersion(kind, q(`${kind}-preset`)?.value);
  deleteButton.disabled = labState.busy || !version || Boolean(version.builtIn);
  deleteButton.title = version?.builtIn ? "Built-in baselines cannot be deleted." : "Delete this saved device-local version.";
}

function savePromptVersion(kind) {
  const nameInput = q(`${kind}-version-name`);
  const name = clip(nameInput?.value, 80);
  const text = q(`${kind}-prompt`)?.value.trim() || "";
  if (!name) { setMessage(`${kind}-prompt-state`, "Name this prompt version first.", "error"); return; }
  if (!text) { setMessage(`${kind}-prompt-state`, "The instruction core cannot be blank.", "error"); return; }
  if (text.length > LAB_PROMPT_LIMITS[kind]) { setMessage(`${kind}-prompt-state`, `Reduce this instruction core to ${LAB_PROMPT_LIMITS[kind].toLocaleString()} characters before saving.`, "error"); return; }
  if (allPromptVersions(kind).some((item) => item.name.toLocaleLowerCase() === name.toLocaleLowerCase())) {
    setMessage(`${kind}-prompt-state`, "That version name already exists. Use a distinct name so comparisons stay clear.", "error");
    return;
  }
  if (labState.promptVersions[kind].length >= LAB_MAX_CUSTOM_PROMPTS_PER_BENCH) {
    setMessage(`${kind}-prompt-state`, `This bench keeps up to ${LAB_MAX_CUSTOM_PROMPTS_PER_BENCH} named versions. Delete one before saving another.`, "error");
    return;
  }
  const version = {
    id: `custom:${kind}:${makeId().replace(/[^A-Za-z0-9-]/g, "-")}`,
    kind,
    name,
    text,
    fingerprint: fingerprint(text),
    createdAt: now(),
  };
  labState.promptVersions[kind].unshift(version);
  if (!persistWorkspace()) {
    labState.promptVersions[kind] = labState.promptVersions[kind].filter((item) => item.id !== version.id);
    setMessage(`${kind}-prompt-state`, "This browser could not save another prompt version. Remove an older Lab item and try again.", "error");
    return;
  }
  fillPresetSelect(kind);
  q(`${kind}-preset`).value = version.id;
  syncPromptControls(kind);
  labState.basePrompt[kind] = version.text;
  labState.loadedPromptVersionId[kind] = version.id;
  if (nameInput) nameInput.value = "";
  updateEditedBadge(kind);
  renderLanes(kind);
  setMessage(`${kind}-prompt-state`, `Saved immutable version “${version.name}” on this device.`, "ok");
}

function deletePromptVersion(kind) {
  const select = q(`${kind}-preset`);
  const version = promptVersion(kind, select?.value);
  if (!version || version.builtIn) { setMessage(`${kind}-prompt-state`, "Built-in baselines cannot be deleted.", "error"); return; }
  if (!window.confirm(`Delete the saved prompt version “${version.name}”? Kept comparisons retain their own snapshot.`)) return;
  const prior = [...labState.promptVersions[kind]];
  labState.promptVersions[kind] = prior.filter((item) => item.id !== version.id);
  if (!persistWorkspace()) {
    labState.promptVersions[kind] = prior;
    setMessage(`${kind}-prompt-state`, "This browser could not update the saved prompt library.", "error");
    return;
  }
  for (const lane of labState.lanes[kind]) if (lane.promptVersionId === version.id) lane.promptVersionId = "draft";
  fillPresetSelect(kind);
  resetPreset(kind);
  renderLanes(kind);
  setMessage(`${kind}-prompt-state`, `Deleted “${version.name}”. Kept comparisons were not changed.`, "ok");
}

function renderLessonSelects() {
  for (const id of ["tutor-lesson", "brain-lesson"]) {
    const select = q(id);
    if (!select) continue;
    const prior = select.value;
    select.replaceChildren();
    if (!labState.lessons.length) {
      select.append(element("option", { value: "", text: "No saved Worldview lessons found on this device" }));
      select.disabled = true;
    } else {
      labState.lessons.forEach((lesson, index) => {
        const historyCount = lessonHistory(lesson).length;
        select.append(element("option", { value: String(index), text: `${lessonTitle(lesson, index)}${historyCount ? ` · ${historyCount} recent turns` : ""}` }));
      });
      select.disabled = false;
      if ([...select.options].some((option) => option.value === prior)) select.value = prior;
    }
  }
  updateTutorContextPreview();
}

function renderNoteSelect() {
  const select = q("lesson-note");
  if (!select) return;
  const prior = select.value;
  select.replaceChildren();
  select.append(element("option", { value: "", text: labState.notes.length ? "Type a new topic instead" : "No saved Worldview Notes found on this device" }));
  for (const note of [...labState.notes].sort((a, b) => Number(b.addedAt || 0) - Number(a.addedAt || 0))) {
    select.append(element("option", { value: String(note.id), text: clip(note.text, 110) }));
  }
  select.disabled = !labState.notes.length;
  if ([...select.options].some((option) => option.value === prior)) select.value = prior;
}

function loadLocalLibrary() {
  try {
    const stored = JSON.parse(localStorage.getItem("worldview-v1") || "{}");
    labState.lessons = Array.isArray(stored?.lessons) ? stored.lessons.filter((lesson) => lesson && typeof lesson === "object") : [];
    labState.notes = Array.isArray(stored?.notes) ? stored.notes.filter((note) => note && note.id && typeof note.text === "string" && note.text.trim()) : [];
    logFlow(`Loaded ${labState.lessons.length} saved lesson${labState.lessons.length === 1 ? "" : "s"} and ${labState.notes.length} Note${labState.notes.length === 1 ? "" : "s"} for read-only selection`, "browser localStorage worldview-v1 (read only)");
  } catch (_) {
    labState.lessons = [];
    labState.notes = [];
    logFlow("Could not read the local Worldview library", "browser localStorage worldview-v1 (read only)");
  }
  renderLessonSelects();
  renderNoteSelect();
}

function addProviderOptions(select, provider) {
  select.replaceChildren();
  for (const model of providerInfo(provider).models) select.append(element("option", { value: model.id, text: model.label }));
}

function renderLanes(kind) {
  const root = q(`${kind}-lanes`);
  if (!root) return;
  root.replaceChildren();
  labState.lanes[kind].forEach((lane, index) => {
    const card = element("div", { className: "lane" });
    const top = element("div", { className: "lane-top" });
    top.append(element("span", { text: `Lane ${index + 1}` }));
    const laneActions = element("div", { className: "lane-actions" });
    const duplicate = element("button", { className: "button lane-duplicate", type: "button", text: "Duplicate" });
    duplicate.addEventListener("click", () => duplicateLane(kind, index));
    const remove = element("button", { className: "button lane-remove", type: "button", text: "Remove" });
    remove.addEventListener("click", () => {
      labState.lanes[kind].splice(index, 1);
      renderLanes(kind);
    });
    laneActions.append(duplicate, remove);
    top.append(laneActions);
    card.append(top);
    const fields = element("div", { className: "lane-fields" });

    const providerField = element("div");
    providerField.append(element("label", { text: "Provider" }));
    const providerSelect = element("select", { attrs: { "aria-label": `Lane ${index + 1} provider` } });
    for (const [id, info] of Object.entries(LAB_PROVIDER_CATALOG)) providerSelect.append(element("option", { value: id, text: info.label }));
    providerSelect.value = lane.provider;
    providerSelect.addEventListener("change", () => {
      lane.provider = providerSelect.value;
      lane.model = defaultModel(lane.provider);
      renderLanes(kind);
    });
    providerField.append(providerSelect);

    const modelField = element("div");
    modelField.append(element("label", { text: "Model" }));
    const modelSelect = element("select", { attrs: { "aria-label": `Lane ${index + 1} model` } });
    addProviderOptions(modelSelect, lane.provider);
    modelSelect.append(element("option", { value: LAB_CUSTOM_MODEL, text: "Other — type an exact model id…" }));
    const isListed = providerInfo(lane.provider).models.some((model) => model.id === lane.model);
    modelSelect.value = isListed ? lane.model : LAB_CUSTOM_MODEL;
    modelField.append(modelSelect);

    /* The server accepts any plausible model id, so a model that shipped after
       this page was written is one field away rather than one deploy away.
       It sits on its own full-width row: a model id is too long to type into a
       quarter-width cell on a phone. */
    const extra = element("div", { className: "lane-extra" });
    const customModel = element("input", {
      className: "lane-custom-model",
      type: "text",
      value: isListed ? "" : lane.model,
      hidden: isListed,
      attrs: { placeholder: "exact provider model id, e.g. gemini-3.1-pro-preview", "aria-label": `Lane ${index + 1} custom model id`, maxlength: "64", spellcheck: "false", autocapitalize: "none", autocorrect: "off" },
    });
    const rateLine = element("p", { className: "lane-rate" });
    const showRate = () => {
      const rate = LAB_MODEL_RATES[lane.model];
      rateLine.textContent = rate
        ? `${lane.model} · $${rate.input}/M in · $${rate.output}/M out`
        : `${lane.model || "no model"} · no stored rate, so spend will not be estimated`;
    };
    showRate();
    customModel.addEventListener("input", () => {
      lane.model = customModel.value.trim();
      showRate();
      renderRunEstimate(kind);
    });
    modelSelect.addEventListener("change", () => {
      const picked = modelSelect.value;
      const custom = picked === LAB_CUSTOM_MODEL;
      customModel.hidden = !custom;
      lane.model = custom ? customModel.value.trim() : picked;
      showRate();
      if (custom) customModel.focus();
      renderRunEstimate(kind);
    });
    extra.append(customModel, rateLine);

    const promptField = element("div");
    promptField.append(element("label", { text: "Prompt version" }));
    const promptSelect = element("select", { attrs: { "aria-label": `Lane ${index + 1} prompt version` } });
    promptSelect.append(element("option", { value: "draft", text: "Current editor draft" }));
    for (const version of allPromptVersions(kind)) promptSelect.append(element("option", { value: version.id, text: version.name }));
    if (![...promptSelect.options].some((option) => option.value === lane.promptVersionId)) lane.promptVersionId = "draft";
    promptSelect.value = lane.promptVersionId;
    promptSelect.addEventListener("change", () => { lane.promptVersionId = promptSelect.value; });
    promptField.append(promptSelect);

    const quantityField = element("div");
    quantityField.append(element("label", { text: "Samples" }));
    const quantitySelect = element("select", { attrs: { "aria-label": `Lane ${index + 1} samples` } });
    for (let quantity = 1; quantity <= 4; quantity += 1) quantitySelect.append(element("option", { value: String(quantity), text: String(quantity) }));
    quantitySelect.value = String(lane.quantity);
    quantitySelect.addEventListener("change", () => { lane.quantity = Number(quantitySelect.value); renderLanes(kind); });
    quantityField.append(quantitySelect);

    /* BUG-127: the whole point of the toggle is answering "what does grounding
       actually buy this route?", so it belongs on the lane, not on the run —
       the useful comparison is the same prompt and topic with research on in
       one lane and off in another. ChatGPT has no provable search on this
       route, so the control is disabled rather than silently ignored. */
    const supportsResearch = lane.provider !== "openai";
    const researchField = element("div", { className: "lane-research" });
    researchField.append(element("label", { text: "Research" }));
    const researchLabel = element("label", { className: "lane-research-toggle" });
    const researchInput = element("input", { type: "checkbox", attrs: { "aria-label": `Lane ${index + 1} web research` } });
    researchInput.checked = supportsResearch && !!lane.research;
    researchInput.disabled = !supportsResearch;
    if (!supportsResearch) lane.research = false;
    researchInput.addEventListener("change", () => { lane.research = researchInput.checked; renderRunEstimate(kind); });
    researchLabel.append(researchInput, element("span", { text: supportsResearch ? "Search the web first" : "Not available on ChatGPT" }));
    researchField.append(researchLabel);

    fields.append(providerField, modelField, promptField, quantityField, researchField);
    card.append(fields, extra);
    root.append(card);
  });
  root.append(element("p", { className: "lane-total", attrs: { id: `${kind}-run-estimate` } }));
  renderRunEstimate(kind);
}

/* How many topics this run fans out across. Only Lesson generation supports
   more than one; the others run a single fixture. */
function runTopics(kind) {
  if (kind !== "lesson") return [""];
  const lines = (q("lesson-topic")?.value || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.length ? lines.slice(0, LAB_MAX_TOPICS_PER_RUN) : [""];
}

function runSampleCount(kind) {
  const perLane = runTopics(kind).length;
  return labState.lanes[kind].reduce((sum, lane) => sum + Number(lane.quantity || 0) * perLane, 0);
}

function maxOutputTokens(kind) {
  return kind === "lesson" ? 1000 : 760;
}

/*
  Pre-flight spend estimate. A lab that only tells you the bill afterwards is a
  lab you are afraid to press Run in, so this shows the cost before the money is
  spent. It is an over-estimate on purpose: it assumes every reply runs to the
  full output cap, so the real charge lands at or under the number shown.
*/
function estimateRunCost(kind) {
  const topics = runTopics(kind);
  const contextChars = kind === "tutor"
    ? (q("tutor-context-preview")?.textContent || "").length + (q("tutor-turn")?.value || "").length
    : kind === "brain"
      ? composeBrainContext().length + (q("brain-focus")?.value || "").length
      : 0;
  let known = 0;
  let unpriced = 0;
  for (const lane of labState.lanes[kind]) {
    const rate = LAB_MODEL_RATES[lane.model];
    for (const topic of topics) {
      const samples = Number(lane.quantity || 0);
      if (!rate) { unpriced += samples; continue; }
      let promptChars = 0;
      try { promptChars = instructionSnapshot(kind, lane).text.length; }
      catch (_) { promptChars = (q(`${kind}-prompt`)?.value || "").length; }
      const inputTokens = (promptChars + contextChars + topic.length) / LAB_CHARS_PER_TOKEN;
      const perSample = (inputTokens / 1_000_000) * rate.input + (maxOutputTokens(kind) / 1_000_000) * rate.output;
      known += perSample * samples;
    }
  }
  return { known, unpriced };
}

function renderRunEstimate(kind) {
  const node = q(`${kind}-run-estimate`);
  if (!node) return;
  const total = runSampleCount(kind);
  const topics = runTopics(kind).length;
  const { known, unpriced } = estimateRunCost(kind);
  node.replaceChildren();
  node.append(element("strong", { text: `${total} sample${total === 1 ? "" : "s"}` }));
  const spread = kind === "lesson" && topics > 1 ? ` across ${topics} topics` : "";
  const capText = total > 8
    ? ` — over the 8-sample cap${spread}. Remove a lane, a topic, or some replicates before running.`
    : ` of 8${spread}.`;
  node.append(document.createTextNode(capText));
  const costText = !total
    ? " No spend."
    : unpriced === total
      ? " Spend cannot be estimated — no stored rate for the selected model(s)."
      : ` Costs at most about $${known.toFixed(known < 0.01 ? 4 : 3)}${unpriced ? `, plus ${unpriced} unpriced sample${unpriced === 1 ? "" : "s"}` : ""}.`;
  node.append(element("span", { className: "lane-estimate", text: costText }));
  /* Research is billed by the provider per search, on top of tokens, and those
     per-search rates are not in the rate table — so it is named as an extra
     rather than folded into a number that would then be wrong. */
  const researchLanes = labState.lanes[kind].filter((lane) => lane.research).length;
  if (researchLanes) {
    node.append(element("span", {
      className: "lane-estimate",
      text: ` ${researchLanes} lane${researchLanes === 1 ? "" : "s"} will search the web first: expect longer runs and a per-search provider charge on top of the token estimate above, which this figure does not include.`,
    }));
  }
  node.classList.toggle("is-over", total > 8);
}

function addLane(kind) {
  const total = labState.lanes[kind].reduce((sum, lane) => sum + Number(lane.quantity || 0), 0);
  if (labState.lanes[kind].length >= 8 || total >= 8) {
    setMessage(`${kind}-run-message`, "A run cannot contain more than eight total samples.", "error");
    return;
  }
  labState.lanes[kind].push({ provider: "anthropic", model: defaultModel("anthropic"), promptVersionId: "draft", quantity: 1 });
  renderLanes(kind);
}

function duplicateLane(kind, index) {
  const source = labState.lanes[kind][index];
  if (!source) return;
  const total = labState.lanes[kind].reduce((sum, lane) => sum + Number(lane.quantity || 0), 0);
  if (total + Number(source.quantity || 1) > 8) {
    setMessage(`${kind}-run-message`, "Duplicating this lane would exceed the eight-sample run cap.", "error");
    return;
  }
  labState.lanes[kind].splice(index + 1, 0, { ...source });
  renderLanes(kind);
}

function setBusy(isBusy) {
  labState.busy = isBusy;
  document.querySelectorAll(".button-run").forEach((button) => { button.disabled = isBusy || labState.preview; });
  document.querySelectorAll("[data-add-lane], [data-load-prompt], [data-save-prompt], [data-delete-prompt], #lab-enter, #export-results, #clear-results, #clear-comparisons").forEach((button) => { button.disabled = isBusy; });
  document.querySelectorAll(".result-actions button, .comparison-card button, .comparison-card textarea").forEach((control) => { control.disabled = isBusy; });
  ["lesson", "tutor", "brain"].forEach(syncPromptControls);
}

async function accessToken(forceRefresh = false) {
  if (!labState.client) throw new Error("The protected lab client did not load.");
  let { data, error } = await labState.client.auth.getSession();
  if (error) throw error;
  if (!data.session) {
    const signIn = await labState.client.auth.signInAnonymously();
    if (signIn.error) throw signIn.error;
    data = signIn.data;
  }
  if (forceRefresh && data.session) {
    const refreshed = await labState.client.auth.refreshSession();
    if (refreshed.error) throw refreshed.error;
    data = refreshed.data;
  }
  const token = data?.session?.access_token;
  if (!token) throw new Error("Could not establish the temporary lab session.");
  return token;
}

async function requestWithToken(makeRequest) {
  let response = await makeRequest(await accessToken());
  if (response.status === 401) response = await makeRequest(await accessToken(true));
  return response;
}

async function responseJson(response) {
  let payload = {};
  try { payload = await response.json(); } catch (_) { /* A useful status still follows. */ }
  if (!response.ok) {
    const gatewayError = payload?.error && typeof payload.error === "object" ? payload.error : null;
    const message = gatewayError?.message || payload?.message || (typeof payload?.error === "string" ? payload.error : "") || `Request failed (${response.status}).`;
    const error = new Error(message);
    error.type = gatewayError?.type || payload?.type;
    error.status = response.status;
    throw error;
  }
  return payload;
}

async function labFetch(body) {
  const url = `${SUPABASE_URL}/functions/v1/lab-tutor`;
  const response = await requestWithToken((token) => fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      "x-worldview-access": labState.code,
    },
    body: JSON.stringify(body),
  }));
  return responseJson(response);
}

async function transcribeFetch(file, model, language, operationId) {
  const url = `${SUPABASE_URL}/functions/v1/transcribe?model=${encodeURIComponent(model)}&language=${encodeURIComponent(language)}`;
  const response = await requestWithToken((token) => fetch(url, {
    method: "POST",
    headers: {
      apikey: SUPABASE_PUBLISHABLE_KEY,
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
      "x-worldview-access": labState.code,
      "x-worldview-operation-id": operationId,
    },
    body: file,
  }));
  return responseJson(response);
}

async function probeProviders() {
  const health = q("lab-health");
  health.textContent = "Checking routes…";
  health.className = "lab-health";
  let count = 0;
  for (const [provider, info] of Object.entries(LAB_PROVIDER_CATALOG)) {
    try {
      const status = await labFetch({ provider, probe: true });
      labState.configured[provider] = Boolean(status?.configured);
      if (status?.defaultModel && !info.models.some((model) => model.id === status.defaultModel)) {
        info.models.unshift({ id: status.defaultModel, label: `${status.defaultModel} (server default)` });
      }
      if (labState.configured[provider]) count += 1;
      logFlow(`${info.label} route ${labState.configured[provider] ? "is configured" : "is not configured"}`, "lab-tutor protected provider probe");
    } catch (error) {
      labState.configured[provider] = false;
      logFlow(`${info.label} route probe failed: ${clip(error.message, 120)}`, "lab-tutor protected provider probe");
    }
  }
  q("lab-provider-count").textContent = String(count);
  health.textContent = `${count} route${count === 1 ? "" : "s"} ready`;
  health.className = `lab-health ${count ? "is-ready" : "is-failed"}`;
  ["lesson", "tutor", "brain"].forEach(renderLanes);
}

function instructionSnapshot(kind, lane) {
  if (lane.promptVersionId === "draft") {
    const text = q(`${kind}-prompt`)?.value.trim() || "";
    const loaded = promptVersion(kind, labState.loadedPromptVersionId[kind]);
    return {
      id: `draft:${kind}:${fingerprint(text)}`,
      name: `${loaded?.name || "Prompt"} · current draft`,
      text,
      edited: text !== labState.basePrompt[kind],
    };
  }
  const version = promptVersion(kind, lane.promptVersionId);
  if (!version) throw new Error("A selected prompt version is no longer available. Choose another version in that lane.");
  return { id: version.id, name: version.name, text: version.text, edited: false };
}

function finalizeRun(kind, lanes, fixtures, source, options = {}) {
  const candidates = lanes.map((lane) => {
    const prompt = instructionSnapshot(kind, lane);
    if (!prompt.text) throw new Error("Every selected prompt version needs a non-blank instruction core.");
    validatePromptLength(kind, prompt.text);
    const system = kind === "tutor" ? composeTutorPacket(prompt.text, options.lesson) : prompt.text;
    return {
      ...lane,
      system,
      promptVersionId: prompt.id,
      promptVersionName: prompt.name,
      promptEdited: prompt.edited,
      promptCore: prompt.text,
      promptCoreFingerprint: fingerprint(prompt.text),
      promptFingerprint: fingerprint(system),
    };
  });
  const preparedFixtures = fixtures.map((fixture) => ({
    label: clip(fixture.label, 240),
    fixture: clip(fixture.fixture, 4000),
    messages: fixture.messages,
    sourceNoteId: clip(fixture.sourceNoteId, 160),
    fingerprint: fingerprint(fixture.messages.map((message) => `${message.role}:${message.content}`).join("\n")),
  }));
  const total = candidates.reduce((sum, lane) => sum + lane.quantity, 0) * preparedFixtures.length;
  return { candidates, fixtures: preparedFixtures, total, source, runId: makeId() };
}

function validatePromptLength(kind, system) {
  const limit = LAB_PROMPT_LIMITS[kind];
  if (system.length > limit) throw new Error(`The visible packet is ${system.length.toLocaleString()} characters. Reduce it to ${limit.toLocaleString()} or fewer before running.`);
}

/* Mirrors MODEL_SHAPE in supabase/functions/lab-tutor/index.ts so a typo is
   caught here instead of becoming a wasted round trip. */
const LAB_MODEL_SHAPE = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,63}$/;

function buildRun(kind) {
  const lanes = labState.lanes[kind].map((lane) => ({ ...lane, quantity: Number(lane.quantity) }));
  if (!lanes.length) throw new Error("Add at least one model lane before running.");
  if (lanes.some((lane) => !Number.isInteger(lane.quantity) || lane.quantity < 1 || lane.quantity > 4)) throw new Error("Each lane must have between 1 and 4 samples.");
  if (lanes.some((lane) => !lane.model)) throw new Error("Every lane needs a model. Pick one, or type an exact model id.");
  const malformed = lanes.find((lane) => !LAB_MODEL_SHAPE.test(lane.model));
  if (malformed) throw new Error(`"${clip(malformed.model, 64)}" does not look like a model id. Use the provider's exact id, for example claude-opus-5.`);
  const unavailable = lanes.filter((lane) => labState.configured[lane.provider] === false).map((lane) => providerInfo(lane.provider).label);
  if (unavailable.length) throw new Error(`${[...new Set(unavailable)].join(", ")} is not configured on the protected server.`);

  if (kind === "lesson") {
    const topics = runTopics(kind).filter(Boolean);
    if (!topics.length) throw new Error("Add a learning topic first.");
    const raw = q("lesson-topic").value.split("\n").map((line) => line.trim()).filter(Boolean);
    if (raw.length > LAB_MAX_TOPICS_PER_RUN) throw new Error(`A run compares at most ${LAB_MAX_TOPICS_PER_RUN} topics. Remove ${raw.length - LAB_MAX_TOPICS_PER_RUN} line${raw.length - LAB_MAX_TOPICS_PER_RUN === 1 ? "" : "s"}.`);
    const selectedNote = labState.notes.find((note) => String(note.id) === q("lesson-note")?.value);
    const sourceNoteId = selectedNote && labState.selectedNoteId === String(selectedNote.id) ? String(selectedNote.id) : "";
    const fixtures = topics.map((topic) => ({
      label: `Topic: ${topic}`,
      fixture: topic,
      sourceNoteId,
      messages: [{ role: "user", content: `Topic to plan: ${topic}` }],
    }));
    const run = finalizeRun(kind, lanes, fixtures, sourceNoteId ? "saved Note copied into developer lab" : "topic typed in developer lab");
    assertRunCap(run, topics.length > 1);
    return run;
  }
  if (kind === "tutor") {
    const lesson = selectedLesson("tutor-lesson");
    const turn = q("tutor-turn").value.trim();
    if (!lesson) throw new Error("Choose a saved lesson from this device first.");
    if (!turn) throw new Error("Add the learner’s next turn first.");
    const fixtures = [{ label: `${lessonTitle(lesson)} · learner turn: ${turn}`, fixture: turn, messages: [{ role: "user", content: turn }] }];
    const run = finalizeRun(kind, lanes, fixtures, "read-only local lesson snapshot + typed learner turn", { lesson });
    assertRunCap(run);
    return run;
  }
  const lesson = selectedLesson("brain-lesson");
  const focus = q("brain-focus").value.trim();
  if (!lesson) throw new Error("Choose a saved lesson from this device first.");
  if (!focus) throw new Error("State the diagnostic focus first.");
  const fixtures = [{
    label: `${lessonTitle(lesson)} · focus: ${focus}`,
    fixture: focus,
    messages: [{ role: "user", content: `READ-ONLY LESSON SNAPSHOT:\n${composeBrainContext()}\n\nDiagnostic focus: ${focus}` }],
  }];
  const run = finalizeRun(kind, lanes, fixtures, "read-only local lesson snapshot + diagnostic focus");
  assertRunCap(run);
  return run;
}

function assertRunCap(run, multiTopic = false) {
  if (run.total <= 8) return;
  throw new Error(multiTopic
    ? `That is ${run.total} paid calls (lanes × topics × replicates). The cap is 8 — remove a topic, a lane, or some replicates.`
    : `A run is capped at 8 samples and this one is ${run.total}. Reduce lane quantities first.`);
}

function pushOutput(output) {
  labState.outputs.unshift(output);
  renderResults();
}

async function runTextExperiment(kind) {
  if (labState.preview) {
    setMessage(`${kind}-run-message`, "Preview mode is local only; provider calls are disabled.", "error");
    return;
  }
  const messageId = `${kind}-run-message`;
  if (labState.busy) return;
  let run;
  try { run = buildRun(kind); }
  catch (error) { setMessage(messageId, error.message, "error"); return; }
  setBusy(true);
  setMessage(messageId, `Preparing ${run.total} sample${run.total === 1 ? "" : "s"}…`);
  const versionNames = [...new Set(run.candidates.map((candidate) => candidate.promptVersionName))];
  logFlow(`Started ${kind} run ${run.runId.slice(0, 8)} with ${run.total} sample${run.total === 1 ? "" : "s"} across ${versionNames.length} prompt version${versionNames.length === 1 ? "" : "s"}`, run.source);
  let completed = 0;
  try {
    for (const lane of run.candidates) {
      for (const fixture of run.fixtures) {
        for (let replicate = 1; replicate <= lane.quantity; replicate += 1) {
          completed += 1;
          const info = providerInfo(lane.provider);
          const fixtureTag = run.fixtures.length > 1 ? ` · ${clip(fixture.fixture, 40)}` : "";
          const runLabel = `${info.label} / ${lane.model} · ${lane.promptVersionName}${fixtureTag} · sample ${replicate} of ${lane.quantity}`;
          setMessage(messageId, `Running ${completed} of ${run.total}: ${runLabel}`);
          logFlow(`Queued ${kind} ${runLabel}`, "browser → lab-tutor (tester-gated)");
          const started = performance.now();
          const shared = {
            kind, replicate, source: run.source, runId: run.runId,
            inputLabel: fixture.label, inputFixture: fixture.fixture, inputFingerprint: fixture.fingerprint,
            sourceNoteId: fixture.sourceNoteId,
            promptVersionId: lane.promptVersionId, promptVersionName: lane.promptVersionName,
            promptPresetId: lane.promptVersionId, promptPreset: lane.promptVersionName,
            promptEdited: lane.promptEdited, promptCore: lane.promptCore,
            promptCoreFingerprint: lane.promptCoreFingerprint, promptFingerprint: lane.promptFingerprint,
          };
          try {
            logFlow(`Sent ${kind} ${runLabel}`, "lab-tutor → configured provider");
            const result = await labFetch({
              provider: lane.provider, model: lane.model, system: lane.system,
              messages: fixture.messages, max_tokens: maxOutputTokens(kind),
              ...(lane.research ? { research: true, research_max_uses: 2 } : {}),
            });
            const elapsed = Math.round(performance.now() - started);
            const text = asText(result.text);
            pushOutput({
              ...shared,
              id: makeId(), at: now(), provider: result.provider || lane.provider, providerLabel: result.label || info.label,
              model: result.model || lane.model, text, inputTokens: numeric(result.inputTokens), outputTokens: numeric(result.outputTokens),
              latencyMs: numeric(result.ms) ?? elapsed, cost: estimateTextCost(lane.model, result.inputTokens, result.outputTokens),
              checks: policyFindings(kind, text),
              researchRequested: !!result.researchRequested,
              researchApplied: !!result.researchApplied,
              searches: numeric(result.searches),
              citations: Array.isArray(result.citations) ? result.citations.slice(0, 20) : [],
            });
            logFlow(`Received ${kind} ${runLabel}`, "configured provider → lab-tutor → browser");
          } catch (error) {
            const elapsed = Math.round(performance.now() - started);
            pushOutput({
              ...shared,
              id: makeId(), at: now(), provider: lane.provider, providerLabel: info.label, model: lane.model,
              text: `Request failed: ${error.message || "Unknown error"}`, latencyMs: elapsed, cost: null, failed: true,
              researchRequested: !!lane.research, researchApplied: false,
            });
            logFlow(`Failed ${kind} ${runLabel}: ${clip(error.message, 120)}`, "configured provider / lab-tutor");
          }
        }
      }
    }
    setMessage(messageId, `Finished ${completed} sample${completed === 1 ? "" : "s"}. Results are captured below.`, "ok");
  } finally {
    setBusy(false);
    renderResults();
    renderComparisonLibrary();
  }
}

function renderSttChoices() {
  const root = q("stt-models");
  root.replaceChildren();
  for (const model of LAB_STT_MODELS) {
    const label = element("label", { className: "stt-choice" });
    const checkbox = element("input", { type: "checkbox", value: model.id, attrs: { "data-stt-model": model.id } });
    checkbox.checked = model.id === "deepgram-nova-3";
    const copy = element("span");
    copy.append(element("strong", { text: model.label }), element("span", { text: model.note }));
    label.append(checkbox, copy);
    root.append(label);
  }
}

async function runTranscription() {
  if (labState.preview) {
    setMessage("stt-run-message", "Preview mode is local only; transcription calls are disabled.", "error");
    return;
  }
  const messageId = "stt-run-message";
  if (labState.busy) return;
  const file = q("stt-file").files?.[0];
  const selected = LAB_STT_MODELS.filter((model) => document.querySelector(`#stt-models input[data-stt-model="${model.id}"]`)?.checked);
  if (!file) { setMessage(messageId, "Choose one audio file first.", "error"); return; }
  if (!selected.length) { setMessage(messageId, "Choose at least one existing STT route.", "error"); return; }
  const runId = makeId();
  const inputFingerprint = fingerprint(`${file.name}:${file.size}:${file.lastModified}`);
  setBusy(true);
  logFlow(`Started transcription run ${runId.slice(0, 8)} with ${selected.length} route${selected.length === 1 ? "" : "s"}`, "selected audio file (not retained by Lab)");
  try {
    let number = 0;
    for (const model of selected) {
      number += 1;
      setMessage(messageId, `Transcribing ${number} of ${selected.length}: ${model.label}`);
      const operationId = makeId();
      const started = performance.now();
      logFlow(`Sent audio to ${model.label}`, "browser → transcribe (tester-gated)");
      try {
        const result = await transcribeFetch(file, model.id, q("stt-language").value, operationId);
        const elapsed = Math.round(performance.now() - started);
        pushOutput({
          id: makeId(), at: now(), kind: "transcription", provider: result.provider || model.provider, providerLabel: model.provider,
          model: result.model || model.id, replicate: 1, text: asText(result.text), latencyMs: elapsed,
          duration: numeric(result.duration), language: result.language || q("stt-language").value,
          cost: numeric(result.estimated_cost_usd), source: "selected audio file (not retained by Lab)", runId,
          inputLabel: `Audio file: ${clip(file.name, 180)}`, inputFingerprint, promptPreset: "Existing batch STT contract",
          promptPresetId: "batch-stt-v57", promptEdited: false, promptFingerprint: "batch-stt-v57",
        });
        logFlow(`Received ${model.label} transcript`, "transcribe → browser; audio not retained in Lab result cache");
      } catch (error) {
        const elapsed = Math.round(performance.now() - started);
        pushOutput({
          id: makeId(), at: now(), kind: "transcription", provider: model.provider, providerLabel: model.provider, model: model.id,
          replicate: 1, text: `Request failed: ${error.message || "Unknown error"}`, latencyMs: elapsed, cost: null,
          source: "selected audio file (not retained by Lab)", failed: true, runId,
          inputLabel: `Audio file: ${clip(file.name, 180)}`, inputFingerprint, promptPreset: "Existing batch STT contract",
          promptPresetId: "batch-stt-v57", promptEdited: false, promptFingerprint: "batch-stt-v57",
        });
        logFlow(`Failed ${model.label} transcription: ${clip(error.message, 120)}`, "transcribe protected route");
      }
    }
    setMessage(messageId, "Transcription comparison finished. Results are captured below.", "ok");
  } finally {
    setBusy(false);
    renderResults();
    renderComparisonLibrary();
  }
}

function keptComparisonFor(outputId) {
  return labState.comparisons.find((entry) => entry.sourceOutputId === outputId) || null;
}

function keepOutputForComparison(output) {
  if (keptComparisonFor(output.id)) return;
  if (labState.comparisons.length >= LAB_MAX_COMPARISONS) {
    setMessage("workspace-message", `The comparison library keeps up to ${LAB_MAX_COMPARISONS} entries. Remove one before keeping another.`, "error");
    activateTab("results");
    return;
  }
  const entry = sanitizeComparison({
    ...output,
    id: makeId(),
    sourceOutputId: output.id,
    keptAt: now(),
    promptVersionName: output.promptVersionName || output.promptPreset,
    promptCore: output.promptCore || "",
    preferred: false,
    rating: 0,
    checks: output.checks || [],
    note: "",
  });
  if (!entry) { setMessage("workspace-message", "This result could not be prepared for the comparison library.", "error"); return; }
  labState.comparisons.unshift(entry);
  if (!persistWorkspace()) {
    labState.comparisons = labState.comparisons.filter((item) => item.id !== entry.id);
    return;
  }
  renderResults();
  renderComparisonLibrary();
  setMessage("workspace-message", "Kept for future comparison on this device.", "ok");
}

function removeComparison(id) {
  const prior = [...labState.comparisons];
  labState.comparisons = prior.filter((entry) => entry.id !== id);
  if (!persistWorkspace()) { labState.comparisons = prior; return; }
  renderResults();
  renderComparisonLibrary();
  setMessage("workspace-message", "Removed from the device-local comparison library.", "ok");
}

function setComparisonRating(id, rating) {
  const entry = labState.comparisons.find((item) => item.id === id);
  if (!entry) return;
  const prior = entry.rating;
  entry.rating = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  if (!persistWorkspace(entry.rating ? `Scored ${entry.rating}/5.` : "Score cleared.")) entry.rating = prior;
  renderComparisonLibrary();
}

function togglePreferredComparison(id) {
  const entry = labState.comparisons.find((item) => item.id === id);
  if (!entry) return;
  const prior = entry.preferred;
  entry.preferred = !entry.preferred;
  if (!persistWorkspace(entry.preferred ? "Marked as preferred." : "Preferred mark removed.")) entry.preferred = prior;
  renderComparisonLibrary();
}

function clearComparisons() {
  if (!labState.comparisons.length) return;
  if (!window.confirm("Clear every kept comparison and its evaluation note from this browser? Saved prompt versions will remain.")) return;
  const prior = [...labState.comparisons];
  labState.comparisons = [];
  if (!persistWorkspace()) { labState.comparisons = prior; return; }
  renderResults();
  renderComparisonLibrary();
  setMessage("workspace-message", "Cleared the kept comparison library. Saved prompt versions remain.", "ok");
}

function createLessonHandoff(output) {
  const topic = clip(output?.inputFixture, 2000);
  if (!topic || output?.kind !== "lesson" || output?.failed) return;
  const handoff = {
    version: 1,
    nonce: makeId(),
    topic,
    sourceNoteId: clip(output.sourceNoteId, 160) || null,
    createdAt: now(),
  };
  try {
    sessionStorage.setItem(LAB_LESSON_HANDOFF_KEY, JSON.stringify(handoff));
    window.location.href = "../index.html";
  } catch (_) {
    setMessage("workspace-message", "The browser could not hand this topic back to Worldview. Copy the topic and start it from the main page instead.", "error");
    activateTab("results");
  }
}

function renderComparisonLibrary() {
  const root = q("comparison-list");
  if (!root) return;
  root.replaceChildren();
  q("comparison-count").textContent = `${labState.comparisons.length} of ${LAB_MAX_COMPARISONS} kept`;
  if (!labState.comparisons.length) {
    root.append(element("div", { className: "empty-results", text: "Keep a result and it will stay here after reload, ready for side-by-side review." }));
    return;
  }
  const ordered = [...labState.comparisons].sort((a, b) =>
    Number(b.preferred) - Number(a.preferred) || Number(b.rating || 0) - Number(a.rating || 0));
  for (const entry of ordered) {
    const card = element("article", { className: `comparison-card${entry.preferred ? " is-preferred" : ""}` });
    const head = element("div", { className: "comparison-card-head" });
    const identity = element("div");
    identity.append(
      element("span", { className: "result-kind", text: entry.kind }),
      element("strong", { text: `${entry.providerLabel || entry.provider || "Provider"} / ${entry.model || "model"}` }),
      element("small", { text: entry.promptVersionName || "No instruction prompt" }),
    );
    const preferred = element("button", {
      className: `button preferred-button${entry.preferred ? " is-on" : ""}`,
      type: "button",
      text: entry.preferred ? "★ Preferred" : "☆ Mark preferred",
      attrs: { "aria-pressed": String(entry.preferred) },
    });
    preferred.addEventListener("click", () => togglePreferredComparison(entry.id));
    head.append(identity, preferred);
    const provenance = element("div", {
      className: "result-provenance",
      text: `${entry.inputLabel || "Input fixture"} · prompt ${entry.promptCoreFingerprint || "n/a"} · ${entry.latencyMs ?? "?"}ms · ${formatCost(entry.cost)}`,
    });
    const output = element("pre", { className: "result-text comparison-output", text: entry.text });
    card.append(head, provenance, output);
    const keptChecks = renderChecks(entry.checks);
    if (keptChecks) card.append(keptChecks);

    /* A score turns the archive from "replies I once saw" into evidence you can
       sort. Kept separate from the preferred star: preferred is "this is the one",
       the score is "how good was it". */
    const scoreRow = element("div", { className: "comparison-score" });
    scoreRow.append(element("span", { className: "score-caption", text: "Score" }));
    for (let score = 1; score <= 5; score += 1) {
      const button = element("button", {
        className: `button score-button${entry.rating >= score ? " is-on" : ""}`,
        type: "button",
        text: String(score),
        attrs: { "aria-label": `Score ${score} out of 5`, "aria-pressed": String(entry.rating >= score) },
      });
      button.addEventListener("click", () => setComparisonRating(entry.id, entry.rating === score ? 0 : score));
      scoreRow.append(button);
    }
    scoreRow.append(element("span", { className: "score-value", text: entry.rating ? `${entry.rating}/5` : "not scored" }));
    card.append(scoreRow);
    if (entry.promptCore) {
      const promptDetails = element("details", { className: "saved-prompt-snapshot" });
      promptDetails.append(
        element("summary", { text: `Instruction snapshot · ${entry.promptVersionName}` }),
        element("pre", { text: entry.promptCore }),
      );
      card.append(promptDetails);
    }
    const noteLabel = element("label", { text: "Evaluation note", attrs: { for: `comparison-note-${entry.id}` } });
    const note = element("textarea", {
      value: entry.note || "",
      attrs: { id: `comparison-note-${entry.id}`, maxlength: String(LAB_MAX_COMPARISON_NOTE), rows: "3", placeholder: "What worked, failed, or should change in the next prompt?" },
    });
    note.addEventListener("input", () => { entry.note = note.value.slice(0, LAB_MAX_COMPARISON_NOTE); scheduleWorkspaceSave(); });
    const actions = element("div", { className: "comparison-card-actions" });
    const remove = element("button", { className: "button button-danger-soft", type: "button", text: "Remove" });
    remove.addEventListener("click", () => removeComparison(entry.id));
    actions.append(element("span", { text: `Kept ${prettyDate(entry.keptAt)}` }), remove);
    card.append(noteLabel, note, actions);
    root.append(card);
  }
}

function renderBenchRole(kind) {
  const panel = document.querySelector(`[data-role-panel="${kind}"]`);
  const role = LAB_BENCH_ROLES[kind];
  if (!panel || !role) return;
  panel.replaceChildren();
  panel.append(element("summary", { text: "About this test" }));
  const body = element("div", { className: "role-body" });
  body.append(element("p", { className: "role-lead", text: role.oneLine }));
  body.append(element("p", { className: "role-model", text: `In production today: ${role.productionModel}` }));
  const columns = element("div", { className: "role-columns" });
  const block = (heading, items) => {
    const section = element("section");
    section.append(element("h4", { text: heading }));
    const list = element("ul");
    for (const item of items) list.append(element("li", { text: item }));
    section.append(list);
    return section;
  };
  columns.append(block("It receives", role.receives), block("It must return", role.returns));
  body.append(columns);
  body.append(element("h4", { text: "How much authority it has" }), element("p", { text: role.authority }));
  body.append(block("What has gone wrong here before", role.knownIssues));
  body.append(element("p", { className: "role-gap", text: `Where this bench differs from production: ${role.labGap}` }));
  panel.append(body);
}

/*
  The prompt-workshop loop: copy a self-contained briefing, paste it into a
  fresh chat, talk your way to a new prompt with your voice, paste the result
  back into the editor above, then Save as new version. The briefing carries
  the system context the other model has no way to know.
*/
async function copyWorkshopBriefing(kind) {
  const briefing = benchRoleBriefing(kind);
  if (!briefing) return;
  const done = () => setMessage(`${kind}-prompt-state`, "Briefing copied. Paste it into a new chat, talk through the changes, then paste the prompt it gives you back into the editor above and Save as new version.", "ok");
  try {
    await navigator.clipboard.writeText(briefing);
    done();
  } catch (_) {
    /* Clipboard access can be refused; falling back to a selectable textarea
       keeps the loop working instead of dead-ending on a permission prompt. */
    const holder = q(`${kind}-prompt`);
    if (!holder) { setMessage(`${kind}-prompt-state`, "This browser blocked clipboard access.", "error"); return; }
    window.prompt("Copy this briefing, then paste it into a new chat:", briefing);
    done();
  }
}

function renderChecks(checks) {
  if (!Array.isArray(checks) || !checks.length) return null;
  const row = element("div", { className: "result-checks" });
  row.append(element("span", { className: "checks-caption", text: "Automatic checks:" }));
  for (const check of checks) row.append(element("span", { className: `check-pill is-${check.level}`, text: check.label }));
  return row;
}

function renderResults() {
  const root = q("results-list");
  if (!root) return;
  root.replaceChildren();
  q("results-count").textContent = `${labState.outputs.length} output${labState.outputs.length === 1 ? "" : "s"}`;
  const successful = labState.outputs.filter((output) => !output.failed);
  const knownCosts = successful.map((output) => numeric(output.cost)).filter((cost) => cost !== null);
  const unpriced = successful.length - knownCosts.length;
  const total = knownCosts.reduce((sum, cost) => sum + cost, 0);
  q("results-cost").textContent = !successful.length
    ? "No cost recorded yet"
    : unpriced
      ? `Known estimate $${total.toFixed(total < 0.01 ? 4 : 2)} · ${unpriced} unpriced`
      : `Estimated total $${total.toFixed(total < 0.01 ? 4 : 2)}`;
  if (!labState.outputs.length) {
    root.append(element("div", { className: "empty-results", text: "Run a sandbox comparison and the normalized outputs will appear here." }));
    return;
  }
  for (const output of labState.outputs) {
    const card = element("article", { className: "result-card" });
    const meta = element("div", { className: "result-meta" });
    const heading = element("div");
    heading.append(
      element("span", { className: "result-kind", text: output.kind }),
      element("strong", { text: `${output.providerLabel || output.provider} / ${output.model}` }),
      element("small", { className: "result-prompt-name", text: output.promptVersionName || output.promptPreset || "Prompt not recorded" }),
    );
    const timing = element("div");
    timing.append(element("span", { text: `${prettyDate(output.at)} · sample ${output.replicate || 1} · ${output.latencyMs ?? "?"}ms` }));
    /* Requested vs applied are deliberately different pills. "Research on but
       nothing searched" is a result worth seeing, not something to round up
       into a grounded label. */
    if (output.researchRequested) {
      const grounded = !!output.researchApplied;
      const searches = numeric(output.searches);
      const cited = Array.isArray(output.citations) ? output.citations.length : 0;
      timing.append(element("span", {
        className: `research-pill ${grounded ? "is-grounded" : "is-ungrounded"}`,
        text: grounded
          ? `researched · ${searches ?? "?"} search${searches === 1 ? "" : "es"} · ${cited} source${cited === 1 ? "" : "s"}`
          : "research requested · none performed",
      }));
    } else if (!output.failed) {
      timing.append(element("span", { className: "research-pill", text: "no research" }));
    }
    meta.append(heading, timing);
    const provenance = element("div", {
      className: "result-provenance",
      text: `run ${String(output.runId || "untracked").slice(0, 8)} · ${output.inputLabel || output.source || "input not recorded"} · ${output.promptPreset || "prompt not recorded"}${output.promptEdited ? " · edited" : ""} · prompt ${output.promptFingerprint || "n/a"} · input ${output.inputFingerprint || "n/a"}`,
    });
    const text = element("pre", { className: "result-text", text: output.text || "(No text returned.)" });
    const checks = renderChecks(output.checks);
    const footer = element("div", { className: "result-footer" });
    const usage = [];
    if (output.inputTokens !== null && output.inputTokens !== undefined) usage.push(`${output.inputTokens} input`);
    if (output.outputTokens !== null && output.outputTokens !== undefined) usage.push(`${output.outputTokens} output`);
    if (output.duration !== null && output.duration !== undefined) usage.push(`${output.duration}s audio`);
    if (output.language) usage.push(output.language);
    footer.append(element("span", { text: usage.length ? usage.join(" · ") : "Usage unavailable" }));
    footer.append(element("span", { className: output.failed ? "failed" : "", text: output.failed ? "Failed request" : formatCost(output.cost) }));
    const actions = element("div", { className: "result-actions" });
    const kept = keptComparisonFor(output.id);
    const keep = element("button", { className: "button button-quiet", type: "button", text: kept ? "✓ Kept for comparison" : "Keep for comparison", disabled: Boolean(kept) || labState.busy });
    keep.addEventListener("click", () => keepOutputForComparison(output));
    actions.append(keep);
    if (output.kind === "lesson" && !output.failed) {
      const create = element("button", { className: "button button-primary create-lesson-button", type: "button", text: "Create real lesson" });
      create.disabled = labState.busy;
      create.title = "Return the original topic to Worldview. The sandbox output is never copied into learner state.";
      create.addEventListener("click", () => createLessonHandoff(output));
      actions.append(create);
    }
    card.append(meta, provenance, text);
    if (checks) card.append(checks);
    // What the model actually read is the evidence that separates a grounded
    // route from a confident one, so it is shown, not just counted.
    if (Array.isArray(output.citations) && output.citations.length) {
      const sources = element("details", { className: "result-sources" });
      sources.append(element("summary", { text: `Sources read (${output.citations.length})` }));
      const list = element("ul");
      for (const citation of output.citations) {
        const item = element("li");
        const link = element("a", { text: citation.title || citation.url });
        link.href = citation.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer nofollow";
        item.append(link);
        list.append(item);
      }
      sources.append(list);
      card.append(sources);
    }
    card.append(footer, actions);
    root.append(card);
  }
}

function renderFlow() {
  const root = q("flow-list");
  if (!root) return;
  root.replaceChildren();
  if (!labState.flow.length) {
    root.append(element("li", { text: "No requests have run yet." }));
    return;
  }
  for (const entry of labState.flow) {
    const item = element("li");
    item.append(element("b", { text: entry.what }), document.createTextNode(` · ${entry.from}`), element("time", { text: prettyDate(entry.at), attrs: { datetime: entry.at } }));
    root.append(item);
  }
}

function exportableOutput(output) {
  return {
    id: output.id,
    at: output.at,
    kind: output.kind,
    provider: output.provider,
    providerLabel: output.providerLabel,
    model: output.model,
    replicate: output.replicate,
    text: output.text,
    failed: Boolean(output.failed),
    inputTokens: output.inputTokens,
    outputTokens: output.outputTokens,
    latencyMs: output.latencyMs,
    researchRequested: Boolean(output.researchRequested),
    researchApplied: Boolean(output.researchApplied),
    searches: output.searches ?? null,
    citations: Array.isArray(output.citations) ? output.citations : [],
    duration: output.duration,
    language: output.language,
    cost: output.cost,
    runId: output.runId,
    inputLabel: output.inputLabel,
    inputFixture: output.inputFixture,
    inputFingerprint: output.inputFingerprint,
    sourceNoteId: output.sourceNoteId || "",
    promptVersionId: output.promptVersionId || output.promptPresetId,
    promptVersionName: output.promptVersionName || output.promptPreset,
    promptCore: output.promptCore || "",
    promptCoreFingerprint: output.promptCoreFingerprint || fingerprint(output.promptCore || ""),
    promptFingerprint: output.promptFingerprint,
    promptEdited: Boolean(output.promptEdited),
    checks: Array.isArray(output.checks) ? output.checks : [],
  };
}

function downloadJson() {
  const payload = {
    schema: "worldview-owner-lab-v3",
    exportedAt: now(),
    contentWarning: "This file contains owner-written instruction prompts, typed test inputs, model outputs, and private evaluation notes. Review it before sharing. It contains no tester code, provider secret, audio file, raw saved lesson object, or raw lesson/transcript context.",
    promptVersions: Object.fromEntries(["lesson", "tutor", "brain"].map((kind) => [kind, allPromptVersions(kind).map((version) => ({
      id: version.id,
      name: version.name,
      text: version.text,
      fingerprint: version.fingerprint,
      builtIn: Boolean(version.builtIn),
      createdAt: version.createdAt || null,
    }))])),
    comparisons: labState.comparisons,
    outputs: labState.outputs.map(exportableOutput),
    flow: labState.flow,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = element("a", { attrs: { href, download: `worldview-lab-${new Date().toISOString().slice(0, 10)}.json` } });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  logFlow("Exported Lab prompts and comparisons", "browser download; no access code, raw lesson context, or audio file included");
}

function clearResults() {
  if (labState.outputs.length && !window.confirm("Clear this page session’s results and request ledger? Kept comparisons and saved prompt versions will remain.")) return;
  labState.outputs = [];
  labState.flow = [];
  renderResults();
  renderFlow();
}

function activateTab(tab) {
  for (const button of document.querySelectorAll(".lab-tab")) {
    const active = button.dataset.tab === tab;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-selected", String(active));
  }
  for (const panel of document.querySelectorAll(".tab-panel")) {
    const active = panel.dataset.panel === tab;
    panel.hidden = !active;
    panel.classList.toggle("is-active", active);
  }
}

function initializeWorkspace() {
  q("lab-gate").hidden = true;
  q("lab-shell").hidden = false;
  loadLocalLibrary();
  resetPreset("lesson");
  resetPreset("tutor");
  resetPreset("brain");
  renderSttChoices();
  ["lesson", "tutor", "brain"].forEach(renderLanes);
  renderResults();
  renderComparisonLibrary();
}

function openPreview() {
  initializeWorkspace();
  q("lab-provider-count").textContent = "—";
  q("lab-health").textContent = "Preview · calls disabled";
  q("lab-health").className = "lab-health is-ready";
  logFlow("Opened safe local preview", "localhost / 127.0.0.1 with all network calls disabled");
  setBusy(false);
}

async function openLab() {
  if (labState.preview) { openPreview(); return; }
  if (labState.busy) return;
  const input = q("lab-code");
  labState.code = input.value.trim();
  if (!labState.code) { setMessage("lab-gate-message", "Enter the tester access code first.", "error"); return; }
  setBusy(true);
  setMessage("lab-gate-message", "Checking protected access…");
  try {
    // The first existing probe claims/validates tester access without paying for a model response.
    await labFetch({ provider: "anthropic", probe: true });
    localStorage.setItem("wv-lab-code", labState.code);
    initializeWorkspace();
    await probeProviders();
    setMessage("lab-gate-message", "");
  } catch (error) {
    setMessage("lab-gate-message", error.type === "access_denied" ? "That tester code was not accepted." : `Could not open the protected lab: ${error.message || "unknown error"}`, "error");
  } finally {
    setBusy(false);
  }
}

function bindEvents() {
  q("lab-enter").addEventListener("click", openLab);
  q("lab-code").addEventListener("keydown", (event) => { if (event.key === "Enter") openLab(); });
  document.querySelectorAll("[data-load-prompt]").forEach((button) => button.addEventListener("click", () => resetPreset(button.dataset.loadPrompt)));
  document.querySelectorAll("[data-save-prompt]").forEach((button) => button.addEventListener("click", () => savePromptVersion(button.dataset.savePrompt)));
  document.querySelectorAll("[data-delete-prompt]").forEach((button) => button.addEventListener("click", () => deletePromptVersion(button.dataset.deletePrompt)));
  for (const kind of ["lesson", "tutor", "brain"]) {
    q(`${kind}-preset`).addEventListener("change", () => syncPromptControls(kind));
    q(`${kind}-version-name`).addEventListener("keydown", (event) => { if (event.key === "Enter") { event.preventDefault(); savePromptVersion(kind); } });
  }
  ["lesson", "tutor", "brain"].forEach((kind) => q(`${kind}-prompt`).addEventListener("input", () => { updateEditedBadge(kind); renderRunEstimate(kind); }));
  document.querySelectorAll("[data-workshop]").forEach((button) => button.addEventListener("click", () => copyWorkshopBriefing(button.dataset.workshop)));
  ["lesson", "tutor", "brain"].forEach(renderBenchRole);
  q("results-rate-note").textContent = `Costs are estimates from hand-entered list prices, last checked ${LAB_RATES_CHECKED}. The provider invoice is authoritative.`;
  /* Keep the pre-flight spend figure honest as the inputs change. */
  q("tutor-turn").addEventListener("input", () => renderRunEstimate("tutor"));
  q("brain-focus").addEventListener("input", () => renderRunEstimate("brain"));
  q("lesson-notes-refresh").addEventListener("click", loadLocalLibrary);
  q("lesson-note").addEventListener("change", () => {
    const note = labState.notes.find((item) => String(item.id) === q("lesson-note").value);
    if (!note) { labState.selectedNoteId = ""; return; }
    q("lesson-topic").value = clip(note.text, 2000);
    labState.selectedNoteId = String(note.id);
    setMessage("lesson-run-message", "Copied this saved Note into the Lab topic. The original Note remains unchanged.", "ok");
  });
  q("lesson-topic").addEventListener("input", () => {
    const note = labState.notes.find((item) => String(item.id) === q("lesson-note").value);
    if (note && note.text.trim() !== q("lesson-topic").value.trim()) {
      q("lesson-note").value = "";
      labState.selectedNoteId = "";
    }
    renderRunEstimate("lesson");
  });
  q("tutor-refresh").addEventListener("click", loadLocalLibrary);
  q("brain-refresh").addEventListener("click", loadLocalLibrary);
  q("tutor-lesson").addEventListener("change", updateTutorContextPreview);
  q("brain-lesson").addEventListener("change", () => { /* Context is retained in the separate user message at run time. */ });
  document.querySelectorAll("[data-add-lane]").forEach((button) => button.addEventListener("click", () => addLane(button.dataset.addLane)));
  document.querySelectorAll("[data-run]").forEach((button) => button.addEventListener("click", () => runTextExperiment(button.dataset.run)));
  q("stt-run").addEventListener("click", runTranscription);
  q("stt-file").addEventListener("change", () => {
    const file = q("stt-file").files?.[0];
    q("stt-file-name").textContent = file ? `Selected locally: ${file.name} · ${Math.max(1, Math.round(file.size / 1024))} KB` : "No file selected.";
  });
  q("export-results").addEventListener("click", downloadJson);
  q("clear-results").addEventListener("click", clearResults);
  q("clear-comparisons").addEventListener("click", clearComparisons);
  document.querySelectorAll(".lab-tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
  window.addEventListener("pagehide", () => { if (workspaceSaveTimer) persistWorkspace(); });
}

function loadSupabaseSdk() {
  if (window.supabase?.createClient) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = LAB_SUPABASE_SDK_URL;
    script.async = true;
    script.dataset.worldviewLabSdk = "true";
    script.onload = () => window.supabase?.createClient ? resolve() : reject(new Error("The protected lab client did not load."));
    script.onerror = () => reject(new Error("Could not load the protected lab client."));
    document.head.append(script);
  });
}

async function boot() {
  loadWorkspace();
  fillPresetSelect("lesson");
  fillPresetSelect("tutor");
  fillPresetSelect("brain");
  bindEvents();
  q("lab-code").value = labState.code;
  renderFlow();
  renderResults();
  renderComparisonLibrary();
  if (labState.preview) {
    openPreview();
    return;
  }
  q("lab-enter").disabled = true;
  try {
    await loadSupabaseSdk();
    labState.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: "worldview-alpha-auth" },
    });
    q("lab-enter").disabled = false;
  } catch (error) {
    setMessage("lab-gate-message", `${error.message || "The protected lab client did not load."} Check your connection and reload.`, "error");
  }
}

void boot();
