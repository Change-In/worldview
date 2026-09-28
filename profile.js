/* Profile page: lesson counts, the daily chart, completed lessons by category.
   Moved out of index.html unchanged on 2026-09-28 (v3.1.16). It is loaded in
   index.html at the same point it used to sit, so it runs in the same order.
   See architecture/CODE_MAP.md. */
"use strict";

/* ================= Profile ================= */
let profileCategory = null;
function renderProfile(resetSelection = false) {
  const scroll = $("profile-scroll");
  if (resetSelection) profileCategory = null;
  scroll.innerHTML = "";
  /* Current lessons live in the saved lesson list, not in state.lessons, so the
     profile counts both and charts the list day by day. */
  const removals = typeof homeLearnerRunRemovals === "function" ? homeLearnerRunRemovals() : {};
  const learnerRuns = typeof homeLearnerRuns === "function" ? homeLearnerRuns({ all:true }).filter(run => removals[run.runId]?.state !== "deleted" && !unfinishedLearnerRun(run)) : [];
  /* BUG-498: finished voice lessons count and are listed, not only old text
     conversations. */
  const learnerDone = learnerRuns.filter(run => run.phase === "complete");
  const appendCompletedRuns = host => {
    [...learnerDone].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(run => {
      const button = document.createElement("button");
      button.className = "recent-lesson";
      button.type = "button";
      const when = Number(run.updatedAt || run.startedAt) || 0;
      button.innerHTML = `<span class="recent-lesson-copy"><span class="recent-lesson-title">${esc(titleCaseLesson(run.title || run.topic || "Lesson"))}</span><span class="recent-lesson-meta">${when ? esc(new Date(when).toLocaleDateString(undefined,{month:"short",day:"numeric"})) : ""}</span></span>`;
      button.onclick = () => { void openHomeLearnerRun({runId:run.runId}); };
      host.appendChild(button);
    });
  };
  if (!state.lessons.length && !learnerRuns.length) {
    scroll.innerHTML = `<div id="profile-empty">Nothing here yet.</div>`;
    return;
  }
  /* PRO-010: one small centered line of numbers instead of three tiles. */
  const statLine = (notes, lessons, done) => `<span><b>${notes}</b> note${notes === 1 ? "" : "s"}</span><span><b>${lessons}</b> lesson${lessons === 1 ? "" : "s"}</span><span><b>${done}</b> completed</span>`;
  if (!state.lessons.length) {
    const done = learnerRuns.filter(run => run.phase === "complete").length;
    const stats = document.createElement("div");
    stats.className = "worldview-stats compact";
    stats.innerHTML = statLine(state.notes.length, learnerRuns.length, done);
    scroll.appendChild(stats);
    window.WorldviewProfileChart?.render(scroll, learnerRuns);
    window.WorldviewProfileChart?.renderThinking?.(scroll, cloudAccount?.id);
    const runsSection = document.createElement("section");
    runsSection.className = "worldview-section";
    runsSection.innerHTML = `<h3>Completed</h3>`;
    if (learnerDone.length) appendCompletedRuns(runsSection);
    else { const empty = document.createElement("p");empty.className = "worldview-completed-empty";empty.textContent = "Nothing yet.";runsSection.appendChild(empty); }
    scroll.appendChild(runsSection);
    return;
  }
  const cats = {};
  state.lessons.forEach(l => {
    const c = l.category || "Uncategorized";
    (cats[c] = cats[c] || []).push(l);
  });
  if (profileCategory && !cats[profileCategory]) profileCategory = null;

  const stats = document.createElement("div");
  stats.className = "worldview-stats compact";
  /* notes · conversations · completed (LES-037). "Areas explored" is gone: it
     only ever went up, so it never asked anything of the learner. Completed
     sitting lower than conversations is the point — what is unfinished should
     be visible without being scolded about. */
  const finished = state.lessons.filter(lessonRouteComplete);
  const allLessons = state.lessons.length + learnerRuns.length, allDone = finished.length + learnerDone.length;
  stats.innerHTML = statLine(state.notes.length, allLessons, allDone);
  scroll.appendChild(stats);
  if (learnerRuns.length) window.WorldviewProfileChart?.render(scroll, learnerRuns);
  window.WorldviewProfileChart?.renderThinking?.(scroll, cloudAccount?.id);

  /* Completed lessons, grouped by the category they already carry. Tap a
     category to see what is inside it. The old "where your curiosity has gone"
     list is gone — it counted every conversation whether or not anything came
     of it, which is the opposite of what this page is now for. */
  const completedSection = document.createElement("section");
  completedSection.className = "worldview-section";
  completedSection.innerHTML = `<h3>Completed</h3>`;
  scroll.appendChild(completedSection);
  appendCompletedRuns(completedSection);

  if (!finished.length && learnerDone.length) return;
  if (!finished.length) {
    const empty = document.createElement("p");
    empty.className = "worldview-completed-empty";
    empty.textContent = state.lessons.length
      ? "Nothing yet. A lesson lands here once you have explained every checkpoint in it out loud."
      : "Nothing yet.";
    completedSection.appendChild(empty);
    return;
  }

  const doneByCategory = {};
  finished.forEach(lesson => {
    const category = lesson.category || "Uncategorized";
    (doneByCategory[category] = doneByCategory[category] || []).push(lesson);
  });
  if (profileCategory && !doneByCategory[profileCategory]) profileCategory = null;

  const categoryRow = document.createElement("div");
  categoryRow.className = "worldview-categories";
  completedSection.appendChild(categoryRow);

  const detail = document.createElement("div");
  detail.id = "profile-category-detail";
  completedSection.appendChild(detail);

  const renderCategoryDetail = () => {
    categoryRow.querySelectorAll(".worldview-category").forEach(button => {
      const active = button.dataset.category === profileCategory;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (!profileCategory) { detail.hidden = true; detail.innerHTML = ""; return; }
    detail.hidden = false;
    detail.innerHTML = "";
    [...doneByCategory[profileCategory]].sort((a,b) => (b.updatedAt || 0) - (a.updatedAt || 0)).forEach(lesson => {
      const button = document.createElement("button");
      button.className = "recent-lesson";
      button.type = "button";
      const turns = Math.ceil((lesson.messages || []).filter(message => !message.synthetic).length / 2);
      button.innerHTML = `<span class="recent-lesson-copy"><span class="recent-lesson-title">${esc(lesson.title || lesson.topic || "Conversation")}</span><span class="recent-lesson-meta">${turns} exchange${turns === 1 ? "" : "s"} &middot; ${relativeTime(lesson.updatedAt)}</span></span><span class="recent-arrow" aria-hidden="true">&rsaquo;</span>`;
      button.onclick = () => openChat(lesson.id);
      detail.appendChild(button);
    });
  };

  Object.keys(doneByCategory).sort().forEach(category => {
    const chip = document.createElement("button");
    chip.className = "worldview-category";
    chip.type = "button";
    chip.dataset.category = category;
    chip.innerHTML = `${esc(category)}<span>${doneByCategory[category].length}</span>`;
    chip.onclick = () => { profileCategory = profileCategory === category ? null : category; renderCategoryDetail(); };
    categoryRow.appendChild(chip);
  });
  renderCategoryDetail();
}
