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

const LAB_PROVIDER_CATALOG = {
  anthropic: {
    label: "Claude",
    models: [
      { id: "claude-sonnet-5", label: "Sonnet 5" },
      { id: "claude-opus-4-8", label: "Opus 4.8" },
      { id: "claude-haiku-4-5", label: "Haiku 4.5" },
    ],
  },
  google: {
    label: "Gemini",
    models: [
      { id: "gemini-2.5-flash", label: "2.5 Flash" },
      { id: "gemini-2.5-pro", label: "2.5 Pro" },
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
      { id: "grok-3", label: "Grok 3" },
      { id: "grok-3-mini", label: "Grok 3 mini" },
    ],
  },
};

const LAB_STT_MODELS = [
  { id: "deepgram-nova-3", label: "Deepgram Nova-3", provider: "Deepgram", note: "Fast speech-to-text route" },
  { id: "xai-stt", label: "xAI STT", provider: "xAI", note: "Existing xAI transcription route" },
  { id: "openai-gpt-4o-transcribe", label: "GPT-4o Transcribe", provider: "OpenAI", note: "Existing OpenAI transcription route" },
];

const LAB_SONNET_PROMO_END = Date.UTC(2026, 8, 1);
const LAB_MODEL_RATES = {
  "claude-opus-4-8": { input: 5, output: 25 },
  "claude-sonnet-5": Date.now() < LAB_SONNET_PROMO_END ? { input: 2, output: 10 } : { input: 3, output: 15 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "gemini-2.5-flash": { input: 0.3, output: 2.5 },
  "gpt-5.6-luna": { input: 2, output: 8 },
  "gpt-5.6-terra": { input: 2, output: 8 },
};

const LAB_PROMPT_LIMITS = { lesson: 12000, tutor: 40000, brain: 12000 };

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

const labState = {
  code: localStorage.getItem("wv-lab-code") || "",
  client: null,
  preview: LAB_PREVIEW,
  configured: {},
  lessons: [],
  busy: false,
  outputs: [],
  flow: [],
  basePrompt: { lesson: "", tutor: "", brain: "" },
  lanes: {
    lesson: [{ provider: "anthropic", model: "claude-sonnet-5", quantity: 1 }],
    tutor: [{ provider: "anthropic", model: "claude-sonnet-5", quantity: 1 }],
    brain: [{ provider: "anthropic", model: "claude-sonnet-5", quantity: 1 }],
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

function composeTutorPacket() {
  const lesson = selectedLesson("tutor-lesson");
  return `${TUTOR_SYSTEM}\n\n---\nREAD-ONLY LAB CONTEXT (local browser snapshot; not a production packet)\n${lessonSnapshot(lesson)}\n\nLab boundary: reply as a tutor only. Do not claim to save progress, mark mastery, alter a route, or update learner data.`;
}

function composeBrainContext() {
  const lesson = selectedLesson("brain-lesson");
  return lessonSnapshot(lesson);
}

function resetPreset(kind) {
  if (kind === "tutor") {
    const text = composeTutorPacket();
    q("tutor-prompt").value = text;
    labState.basePrompt.tutor = text;
    setMessage("tutor-prompt-state", "Packet recomposed from local browser data.", "ok");
  } else {
    const preset = LAB_PRESETS[kind].find((item) => item.id === q(`${kind}-preset`).value) || LAB_PRESETS[kind][0];
    q(`${kind}-prompt`).value = preset.text;
    labState.basePrompt[kind] = preset.text;
    setMessage(`${kind}-prompt-state`, `Using “${preset.label}”.`, "ok");
  }
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
  select.replaceChildren();
  for (const preset of LAB_PRESETS[kind]) select.append(element("option", { value: preset.id, text: preset.label }));
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
}

function loadLocalLessons() {
  try {
    const stored = JSON.parse(localStorage.getItem("worldview-v1") || "{}");
    labState.lessons = Array.isArray(stored?.lessons) ? stored.lessons.filter((lesson) => lesson && typeof lesson === "object") : [];
    logFlow(`Loaded ${labState.lessons.length} saved lesson${labState.lessons.length === 1 ? "" : "s"} for read-only selection`, "browser localStorage worldview-v1 (read only)");
  } catch (_) {
    labState.lessons = [];
    logFlow("Could not read saved lessons", "browser localStorage worldview-v1 (read only)");
  }
  renderLessonSelects();
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
    const remove = element("button", { className: "button lane-remove", type: "button", text: "Remove" });
    remove.addEventListener("click", () => {
      labState.lanes[kind].splice(index, 1);
      renderLanes(kind);
    });
    top.append(remove);
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
    if (![...modelSelect.options].some((option) => option.value === lane.model)) lane.model = defaultModel(lane.provider);
    modelSelect.value = lane.model;
    modelSelect.addEventListener("change", () => { lane.model = modelSelect.value; });
    modelField.append(modelSelect);

    const quantityField = element("div");
    quantityField.append(element("label", { text: "Samples" }));
    const quantitySelect = element("select", { attrs: { "aria-label": `Lane ${index + 1} samples` } });
    for (let quantity = 1; quantity <= 4; quantity += 1) quantitySelect.append(element("option", { value: String(quantity), text: String(quantity) }));
    quantitySelect.value = String(lane.quantity);
    quantitySelect.addEventListener("change", () => { lane.quantity = Number(quantitySelect.value); renderLanes(kind); });
    quantityField.append(quantitySelect);
    fields.append(providerField, modelField, quantityField);
    card.append(fields);
    root.append(card);
  });
  const total = labState.lanes[kind].reduce((sum, lane) => sum + Number(lane.quantity || 0), 0);
  const totalLine = element("p", { className: "lane-total" });
  const totalText = total > 8 ? `${total} selected — reduce to 8 or fewer before running.` : `${total} of 8 samples selected for this run.`;
  totalLine.append(element("strong", { text: `${total} sample${total === 1 ? "" : "s"}` }), document.createTextNode(` · ${totalText}`));
  root.append(totalLine);
}

function addLane(kind) {
  if (labState.lanes[kind].length >= 8) {
    setMessage(`${kind}-run-message`, "A run cannot contain more than eight total samples.", "error");
    return;
  }
  labState.lanes[kind].push({ provider: "anthropic", model: defaultModel("anthropic"), quantity: 1 });
  renderLanes(kind);
}

function setBusy(isBusy) {
  labState.busy = isBusy;
  document.querySelectorAll(".button-run").forEach((button) => { button.disabled = isBusy || labState.preview; });
  document.querySelectorAll("[data-add-lane], #lab-enter, #export-results, #clear-results").forEach((button) => { button.disabled = isBusy; });
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

function finalizeRun(kind, lanes, total, system, messages, source, inputLabel) {
  const presetId = kind === "tutor" ? "production-core-local-snapshot" : q(`${kind}-preset`)?.value || "custom";
  const preset = kind === "tutor" ? null : LAB_PRESETS[kind]?.find((item) => item.id === presetId);
  return {
    lanes,
    total,
    system,
    messages,
    source,
    runId: makeId(),
    inputLabel: clip(inputLabel, 240),
    inputFingerprint: fingerprint(messages.map((message) => `${message.role}:${message.content}`).join("\n")),
    promptPresetId: presetId,
    promptPreset: preset?.label || "Tutor core + read-only lesson snapshot",
    promptEdited: system !== labState.basePrompt[kind],
    promptFingerprint: fingerprint(system),
  };
}

function validatePromptLength(kind, system) {
  const limit = LAB_PROMPT_LIMITS[kind];
  if (system.length > limit) throw new Error(`The visible packet is ${system.length.toLocaleString()} characters. Reduce it to ${limit.toLocaleString()} or fewer before running.`);
}

function buildRun(kind) {
  const lanes = labState.lanes[kind].map((lane) => ({ ...lane, quantity: Number(lane.quantity) }));
  const total = lanes.reduce((sum, lane) => sum + lane.quantity, 0);
  if (!lanes.length) throw new Error("Add at least one model lane before running.");
  if (lanes.some((lane) => !Number.isInteger(lane.quantity) || lane.quantity < 1 || lane.quantity > 4)) throw new Error("Each lane must have between 1 and 4 samples.");
  if (total > 8) throw new Error("A run is capped at 8 samples. Reduce lane quantities first.");
  if (lanes.some((lane) => !providerInfo(lane.provider).models.some((model) => model.id === lane.model))) throw new Error("Choose a listed model for every lane.");
  const unavailable = lanes.filter((lane) => labState.configured[lane.provider] === false).map((lane) => providerInfo(lane.provider).label);
  if (unavailable.length) throw new Error(`${[...new Set(unavailable)].join(", ")} is not configured on the protected server.`);

  if (kind === "lesson") {
    const topic = q("lesson-topic").value.trim();
    const system = q("lesson-prompt").value.trim();
    if (!topic) throw new Error("Add a learning topic first.");
    if (!system) throw new Error("The visible system packet cannot be blank.");
    validatePromptLength(kind, system);
    const messages = [{ role: "user", content: `Topic to plan: ${topic}` }];
    return finalizeRun(kind, lanes, total, system, messages, "topic typed in developer lab", `Topic: ${topic}`);
  }
  if (kind === "tutor") {
    const lesson = selectedLesson("tutor-lesson");
    const turn = q("tutor-turn").value.trim();
    const system = q("tutor-prompt").value.trim();
    if (!lesson) throw new Error("Choose a saved lesson from this device first.");
    if (!turn) throw new Error("Add the learner’s next turn first.");
    if (!system) throw new Error("The visible tutor packet cannot be blank.");
    validatePromptLength(kind, system);
    const messages = [{ role: "user", content: turn }];
    return finalizeRun(kind, lanes, total, system, messages, "read-only local lesson snapshot + typed learner turn", `${lessonTitle(lesson)} · learner turn: ${turn}`);
  }
  const lesson = selectedLesson("brain-lesson");
  const focus = q("brain-focus").value.trim();
  const system = q("brain-prompt").value.trim();
  if (!lesson) throw new Error("Choose a saved lesson from this device first.");
  if (!focus) throw new Error("State the diagnostic focus first.");
  if (!system) throw new Error("The visible diagnostic packet cannot be blank.");
  validatePromptLength(kind, system);
  const messages = [{ role: "user", content: `READ-ONLY LESSON SNAPSHOT:\n${composeBrainContext()}\n\nDiagnostic focus: ${focus}` }];
  return finalizeRun(kind, lanes, total, system, messages, "read-only local lesson snapshot + diagnostic focus", `${lessonTitle(lesson)} · focus: ${focus}`);
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
  logFlow(`Started ${kind} run ${run.runId.slice(0, 8)} with ${run.total} sample${run.total === 1 ? "" : "s"} · ${run.promptPreset}${run.promptEdited ? " · edited" : ""} · prompt ${run.promptFingerprint}`, run.source);
  let completed = 0;
  try {
    for (const lane of run.lanes) {
      for (let replicate = 1; replicate <= lane.quantity; replicate += 1) {
        completed += 1;
        const info = providerInfo(lane.provider);
        const runLabel = `${info.label} / ${lane.model} · sample ${replicate} of ${lane.quantity}`;
        setMessage(messageId, `Running ${completed} of ${run.total}: ${runLabel}`);
        logFlow(`Queued ${kind} ${runLabel}`, "browser → lab-tutor (tester-gated)");
        const started = performance.now();
        try {
          logFlow(`Sent ${kind} ${runLabel}`, "lab-tutor → configured provider");
          const result = await labFetch({ provider: lane.provider, model: lane.model, system: run.system, messages: run.messages, max_tokens: kind === "lesson" ? 1000 : 760 });
          const elapsed = Math.round(performance.now() - started);
          const cost = estimateTextCost(lane.model, result.inputTokens, result.outputTokens);
          pushOutput({
            id: makeId(), at: now(), kind, provider: result.provider || lane.provider, providerLabel: result.label || info.label,
            model: result.model || lane.model, replicate, text: asText(result.text), inputTokens: numeric(result.inputTokens), outputTokens: numeric(result.outputTokens),
            latencyMs: numeric(result.ms) ?? elapsed, cost, source: run.source, runId: run.runId, inputLabel: run.inputLabel,
            inputFingerprint: run.inputFingerprint, promptPresetId: run.promptPresetId, promptPreset: run.promptPreset,
            promptEdited: run.promptEdited, promptFingerprint: run.promptFingerprint,
          });
          logFlow(`Received ${kind} ${runLabel}`, "configured provider → lab-tutor → browser");
        } catch (error) {
          const elapsed = Math.round(performance.now() - started);
          pushOutput({
            id: makeId(), at: now(), kind, provider: lane.provider, providerLabel: info.label, model: lane.model, replicate,
            text: `Request failed: ${error.message || "Unknown error"}`, latencyMs: elapsed, cost: null, source: run.source, failed: true,
            runId: run.runId, inputLabel: run.inputLabel, inputFingerprint: run.inputFingerprint, promptPresetId: run.promptPresetId,
            promptPreset: run.promptPreset, promptEdited: run.promptEdited, promptFingerprint: run.promptFingerprint,
          });
          logFlow(`Failed ${kind} ${runLabel}: ${clip(error.message, 120)}`, "configured provider / lab-tutor");
        }
      }
    }
    setMessage(messageId, `Finished ${completed} sample${completed === 1 ? "" : "s"}. Results are captured below.`, "ok");
  } finally {
    setBusy(false);
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
  }
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
    heading.append(element("span", { className: "result-kind", text: output.kind }), element("strong", { text: `${output.providerLabel || output.provider} / ${output.model}` }));
    const timing = element("div");
    timing.append(element("span", { text: `${prettyDate(output.at)} · sample ${output.replicate || 1} · ${output.latencyMs ?? "?"}ms` }));
    meta.append(heading, timing);
    const provenance = element("div", {
      className: "result-provenance",
      text: `run ${String(output.runId || "untracked").slice(0, 8)} · ${output.inputLabel || output.source || "input not recorded"} · ${output.promptPreset || "prompt not recorded"}${output.promptEdited ? " · edited" : ""} · prompt ${output.promptFingerprint || "n/a"} · input ${output.inputFingerprint || "n/a"}`,
    });
    const text = element("pre", { className: "result-text", text: output.text || "(No text returned.)" });
    const footer = element("div", { className: "result-footer" });
    const usage = [];
    if (output.inputTokens !== null && output.inputTokens !== undefined) usage.push(`${output.inputTokens} input`);
    if (output.outputTokens !== null && output.outputTokens !== undefined) usage.push(`${output.outputTokens} output`);
    if (output.duration !== null && output.duration !== undefined) usage.push(`${output.duration}s audio`);
    if (output.language) usage.push(output.language);
    footer.append(element("span", { text: usage.length ? usage.join(" · ") : "Usage unavailable" }));
    footer.append(element("span", { className: output.failed ? "failed" : "", text: output.failed ? "Failed request" : formatCost(output.cost) }));
    card.append(meta, provenance, text, footer);
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

function downloadJson() {
  const payload = {
    schema: "worldview-owner-lab-v2",
    exportedAt: now(),
    note: "No tester code, provider secret, saved lesson object, or audio file is included.",
    outputs: labState.outputs,
    flow: labState.flow,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const href = URL.createObjectURL(blob);
  const link = element("a", { attrs: { href, download: `worldview-lab-${new Date().toISOString().slice(0, 10)}.json` } });
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(href);
  logFlow("Exported local lab results", "browser download; no code, lesson record, or audio file included");
}

function clearResults() {
  if (labState.outputs.length && !window.confirm("Clear the local Lab results and request ledger from this browser?")) return;
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
  loadLocalLessons();
  resetPreset("lesson");
  resetPreset("tutor");
  resetPreset("brain");
  renderSttChoices();
  ["lesson", "tutor", "brain"].forEach(renderLanes);
  renderResults();
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
  q("lesson-preset").addEventListener("change", () => resetPreset("lesson"));
  q("brain-preset").addEventListener("change", () => resetPreset("brain"));
  q("lesson-reset").addEventListener("click", () => resetPreset("lesson"));
  q("tutor-reset").addEventListener("click", () => resetPreset("tutor"));
  q("brain-reset").addEventListener("click", () => resetPreset("brain"));
  ["lesson", "tutor", "brain"].forEach((kind) => q(`${kind}-prompt`).addEventListener("input", () => updateEditedBadge(kind)));
  q("tutor-refresh").addEventListener("click", () => { loadLocalLessons(); resetPreset("tutor"); });
  q("brain-refresh").addEventListener("click", () => { loadLocalLessons(); resetPreset("brain"); });
  q("tutor-lesson").addEventListener("change", () => resetPreset("tutor"));
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
  document.querySelectorAll(".lab-tab").forEach((button) => button.addEventListener("click", () => activateTab(button.dataset.tab)));
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
  fillPresetSelect("lesson");
  fillPresetSelect("brain");
  bindEvents();
  q("lab-code").value = labState.code;
  renderFlow();
  renderResults();
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
