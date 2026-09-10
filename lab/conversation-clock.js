/* Local duration estimates only. No audio, transcript, or account identifier is exported. */
(function (root) {
  "use strict";
  function createClock(storage, monotonic = () => performance.now()) {
    let previous = null;
    const rows = new Map();
    const key = id => "worldview-conversation-time-v1:" + id;
    function read(id) {
      if (!rows.has(id)) {
        let saved = {};
        try { saved = JSON.parse(storage.getItem(key(id)) || "{}"); } catch (_) { /* unavailable */ }
        rows.set(id, saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {});
      }
      return rows.get(id);
    }
    function sample(context = {}, at = monotonic()) {
      // Never bridge a hidden interval, a different account/run, or a suspended tab.
      if (previous && previous.active && context.active && previous.userId === context.userId && previous.runId === context.runId) {
        const delta = at - previous.at;
        if (delta > 0 && delta <= 15000) {
          const account = read(previous.userId);
          const row = account[previous.runId] ||= { milliseconds:0, voiceMilliseconds:0, phases:{} };
          row.milliseconds = Math.max(0, Number(row.milliseconds) || 0) + delta;
          row.voiceMilliseconds = Math.max(0, Number(row.voiceMilliseconds) || 0) + (previous.mode === "text" ? 0 : delta);
          if (!row.phases || typeof row.phases !== "object") row.phases = {};
          row.phases[previous.phase] = Math.max(0, Number(row.phases[previous.phase]) || 0) + delta;
          // Bound local retention. Current run always survives trimming.
          const ids = Object.keys(account).filter(id => id !== previous.runId);
          for (const id of ids.slice(0, Math.max(0, ids.length - 99))) delete account[id];
          try { storage.setItem(key(previous.userId), JSON.stringify(account)); } catch (_) { /* in-memory still works */ }
        }
      }
      previous = { ...context, at, active:Boolean(context.active && context.userId && context.runId) };
    }
    function summary(userId, runId) {
      const row = userId && runId ? read(userId)[runId] : null;
      const milliseconds = Math.max(0, Number(row?.milliseconds) || 0);
      return { milliseconds, voiceMilliseconds:Math.max(0, Number(row?.voiceMilliseconds) || 0), hypotheticalLiveUSD:milliseconds / 60000 * .05 };
    }
    return { sample, summary };
  }
  root.WorldviewConversationClock = { createClock };
  if (!root.document || !root.WorldviewTimingHost) return;
  const host = root.WorldviewTimingHost;
  const clock = createClock(root.localStorage);
  let lastActivity = performance.now();
  const refresh = () => {
    const context = host.context();
    context.active = context.active && !document.hidden && (host.mediaActive() || performance.now() - lastActivity < 120000);
    clock.sample(context);
    const row = clock.summary(context.userId, context.runId);
    const output = document.getElementById("conversation-time-summary");
    if (output) output.textContent = `${(row.milliseconds / 60000).toFixed(1)} min active here · ${(row.voiceMilliseconds / 60000).toFixed(1)} min in Voice/Car · $${row.hypotheticalLiveUSD.toFixed(2)} at GPT-Live's voice rate. This is an estimate, excludes background/model work, and pauses after two idle minutes or when hidden. It is not a bill.`;
  };
  for (const type of ["pointerdown", "keydown", "input"]) document.addEventListener(type, () => { refresh(); lastActivity = performance.now(); refresh(); }, { passive:true });
  document.addEventListener("visibilitychange", refresh);
  root.addEventListener("pagehide", refresh);
  setInterval(refresh, 5000);
  refresh();
})(typeof window === "undefined" ? globalThis : window);
